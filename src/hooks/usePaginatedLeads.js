import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const usePaginatedLeads = (brandId, filters = {}) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 50; // Optimal page size for performance
  
  // Track if we're already fetching to prevent duplicate requests
  const fetchingRef = useRef(false);
  
  // Reset pagination when brandId or filters change
  useEffect(() => {
    setLeads([]);
    setCurrentPage(0);
    setHasNextPage(true);
    setError(null);
    fetchingRef.current = false;
  }, [brandId, filters.status, filters.search, filters.intent]);

  // Build query with filters
  const buildQuery = useCallback((page = 0, isCountQuery = false) => {
    if (!brandId) return null;

    let query = supabase
      .from('retention_harbor')
      .select(isCountQuery ? 'id' : '*, draft_content, draft_html, draft_updated_at', { count: isCountQuery ? 'exact' : 'estimated' })
      .eq('brand_id', brandId);

    // Apply filters
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.search) {
      // Use ilike for case-insensitive search across multiple fields
      const searchTerm = `%${filters.search}%`;
      query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},lead_email.ilike.${searchTerm}`);
    }

    if (filters.intent) {
      if (filters.intent === 'high') {
        query = query.gte('intent', 8);
      } else if (filters.intent === 'medium') {
        query = query.gte('intent', 5).lt('intent', 8);
      } else if (filters.intent === 'low') {
        query = query.lt('intent', 5);
      }
    }

    if (!isCountQuery) {
      // Add pagination and sorting
      query = query
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    }

    return query;
  }, [brandId, filters, PAGE_SIZE]);

  // Fetch total count (for pagination info)
  const fetchTotalCount = useCallback(async () => {
    const countQuery = buildQuery(0, true);
    if (!countQuery) return;

    try {
      const { count, error } = await countQuery;
      if (error) throw error;
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Failed to fetch total count:', err);
    }
  }, [buildQuery]);

  // Fetch leads for a specific page
  const fetchLeadsPage = useCallback(async (page = 0, append = false) => {
    if (fetchingRef.current) return;
    
    const query = buildQuery(page);
    if (!query) return;

    fetchingRef.current = true;
    const isLoadingMore = append && page > 0;
    
    if (isLoadingMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      console.log(`📄 Fetching leads page ${page + 1} (${PAGE_SIZE} per page)...`);
      
      const { data, error } = await query;
      
      if (error) throw error;

      const newLeads = data || [];
      
      console.log(`✅ Fetched ${newLeads.length} leads for page ${page + 1}`);

      if (append && page > 0) {
        setLeads(prev => {
          // Deduplicate by ID to prevent duplicates
          const existingIds = new Set(prev.map(lead => lead.id));
          const uniqueNewLeads = newLeads.filter(lead => !existingIds.has(lead.id));
          return [...prev, ...uniqueNewLeads];
        });
      } else {
        setLeads(newLeads);
      }

      // Update pagination state
      setHasNextPage(newLeads.length === PAGE_SIZE);
      setCurrentPage(page);
      setError(null);

    } catch (err) {
      console.error('Failed to fetch leads:', err);
      setError(err.message);
      
      // Don't reset leads on error when loading more
      if (!isLoadingMore) {
        setLeads([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [buildQuery, PAGE_SIZE]);

  // Load more (for infinite scrolling)
  const loadMore = useCallback(async () => {
    if (!hasNextPage || loadingMore || loading) return;
    
    const nextPage = currentPage + 1;
    console.log(`🔄 Loading more leads (page ${nextPage + 1})...`);
    
    await fetchLeadsPage(nextPage, true);
  }, [currentPage, hasNextPage, loadingMore, loading, fetchLeadsPage]);

  // Refresh (reload from page 0)
  const refresh = useCallback(async () => {
    setCurrentPage(0);
    setHasNextPage(true);
    await fetchLeadsPage(0, false);
    await fetchTotalCount();
  }, [fetchLeadsPage, fetchTotalCount]);

  // Initial load when brandId changes
  useEffect(() => {
    if (brandId) {
      refresh();
    }
  }, [brandId, refresh]);

  // Refetch when filters change
  useEffect(() => {
    if (brandId) {
      setCurrentPage(0);
      setHasNextPage(true);
      fetchLeadsPage(0, false);
      fetchTotalCount();
    }
  }, [brandId, filters.status, filters.search, filters.intent, fetchLeadsPage, fetchTotalCount]);

  // Add new lead to the list (for real-time updates)
  const addLead = useCallback((newLead) => {
    setLeads(prev => [newLead, ...prev]);
    setTotalCount(prev => prev + 1);
  }, []);

  // Update existing lead
  const updateLead = useCallback((leadId, updates) => {
    setLeads(prev => prev.map(lead => 
      lead.id === leadId ? { ...lead, ...updates } : lead
    ));
  }, []);

  // Remove lead from list
  const removeLead = useCallback((leadId) => {
    setLeads(prev => prev.filter(lead => lead.id !== leadId));
    setTotalCount(prev => Math.max(0, prev - 1));
  }, []);

  return {
    // Data
    leads,
    totalCount,
    
    // State
    loading,
    loadingMore,
    hasNextPage,
    error,
    currentPage,
    
    // Actions
    loadMore,
    refresh,
    addLead,
    updateLead,
    removeLead,
    
    // Metadata
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
    isFiltered: !!(filters.status && filters.status !== 'all') || !!filters.search || !!filters.intent
  };
};

export default usePaginatedLeads;