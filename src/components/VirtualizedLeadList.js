import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Mail, User, Calendar, Target, ChevronRight, Eye, EyeOff } from 'lucide-react';

const VirtualizedLeadList = ({
  leads,
  selectedLead,
  onSelectLead,
  onToggleRead,
  themeStyles,
  getIntentStyle,
  viewMode = 'list', // 'list' or 'grid'
  itemHeight = 80, // Height of each lead item
  containerHeight = 600, // Height of the virtualized container
  onLoadMore, // Callback to load more data
  hasNextPage = false,
  isLoadingMore = false
}) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const listRef = useRef();
  const loadingRef = useRef(false);

  // Memoized lead items to avoid re-renders
  const memoizedLeads = useMemo(() => leads, [leads]);

  // Handle scroll-based pagination
  const handleItemsRendered = useCallback(({ visibleStartIndex, visibleStopIndex }) => {
    setVisibleRange({ start: visibleStartIndex, end: visibleStopIndex });
    
    // Load more when approaching the end
    const buffer = 10; // Load more when 10 items from the end
    if (
      !loadingRef.current &&
      hasNextPage &&
      onLoadMore &&
      visibleStopIndex >= leads.length - buffer
    ) {
      loadingRef.current = true;
      onLoadMore().finally(() => {
        loadingRef.current = false;
      });
    }
  }, [leads.length, hasNextPage, onLoadMore]);

  // Lead item component for virtualization
  const LeadItem = useCallback(({ index, style }) => {
    const lead = memoizedLeads[index];
    
    if (!lead) {
      return (
        <div style={style} className="flex items-center justify-center">
          <div className="animate-pulse bg-gray-200 h-16 w-full rounded"></div>
        </div>
      );
    }

    const isSelected = selectedLead?.id === lead.id;
    const intentStyle = getIntentStyle(lead.intent);
    
    return (
      <div style={style} className="px-4">
        <div
          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
            isSelected ? 'ring-2 ring-blue-500' : ''
          }`}
          style={{
            backgroundColor: isSelected ? themeStyles.accent + '20' : themeStyles.secondaryBg,
            border: `1px solid ${isSelected ? themeStyles.accent : themeStyles.border}`,
          }}
          onClick={() => onSelectLead(lead)}
        >
          {/* Lead Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: themeStyles.accent }}
              >
                {(lead.first_name?.[0] || lead.lead_email?.[0] || '?').toUpperCase()}
              </div>
            </div>

            {/* Lead Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span 
                  className="font-medium truncate" 
                  style={{ color: themeStyles.textPrimary }}
                >
                  {lead.first_name || 'Unknown'} {lead.last_name || ''}
                </span>
                {!lead.opened && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-3 h-3" style={{ color: themeStyles.textMuted }} />
                <span 
                  className="truncate" 
                  style={{ color: themeStyles.textMuted }}
                >
                  {lead.lead_email || 'No email'}
                </span>
              </div>
            </div>
          </div>

          {/* Intent & Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Intent Score */}
            {lead.intent && (
              <div className="text-center">
                <div 
                  className="px-2 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: intentStyle.bg,
                    color: intentStyle.text,
                    border: intentStyle.border
                  }}
                >
                  {lead.intent}/10
                </div>
              </div>
            )}

            {/* Date */}
            <div className="text-right text-xs" style={{ color: themeStyles.textMuted }}>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(lead.created_at_lead || lead.created_at).toLocaleDateString()}
              </div>
            </div>

            {/* Read/Unread Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleRead(lead);
              }}
              className="p-1 rounded hover:bg-gray-200 transition-colors"
              title={lead.opened ? 'Mark as unread' : 'Mark as read'}
            >
              {lead.opened ? (
                <EyeOff className="w-4 h-4" style={{ color: themeStyles.textMuted }} />
              ) : (
                <Eye className="w-4 h-4" style={{ color: themeStyles.accent }} />
              )}
            </button>

            {/* Expand Arrow */}
            <ChevronRight 
              className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90' : ''}`}
              style={{ color: themeStyles.textMuted }}
            />
          </div>
        </div>
      </div>
    );
  }, [memoizedLeads, selectedLead, onSelectLead, onToggleRead, themeStyles, getIntentStyle]);

  // Loading indicator for pagination
  const LoadingIndicator = () => (
    <div className="flex items-center justify-center py-4">
      <div className="flex items-center gap-2" style={{ color: themeStyles.textMuted }}>
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
        <span className="text-sm">Loading more leads...</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Virtualized List */}
      <div style={{ height: containerHeight }} className="flex-1">
        <List
          ref={listRef}
          height={containerHeight}
          itemCount={memoizedLeads.length + (hasNextPage ? 1 : 0)} // +1 for loading indicator
          itemSize={itemHeight}
          onItemsRendered={handleItemsRendered}
          overscanCount={5} // Render 5 extra items for smooth scrolling
        >
          {({ index, style }) => {
            // Show loading indicator for the last item if hasNextPage
            if (index === memoizedLeads.length && hasNextPage) {
              return (
                <div style={style}>
                  <LoadingIndicator />
                </div>
              );
            }
            
            return <LeadItem index={index} style={style} />;
          }}
        </List>
      </div>

      {/* Stats */}
      <div 
        className="px-4 py-2 border-t text-sm"
        style={{ 
          backgroundColor: themeStyles.primaryBg,
          borderColor: themeStyles.border,
          color: themeStyles.textMuted 
        }}
      >
        Showing {visibleRange.start + 1}-{Math.min(visibleRange.end + 1, memoizedLeads.length)} of {memoizedLeads.length} leads
        {hasNextPage && <span> (Loading more available)</span>}
      </div>
    </div>
  );
};

export default VirtualizedLeadList;