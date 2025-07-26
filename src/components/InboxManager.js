import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Filter, Send, Edit3, Clock, Mail, User, MessageSquare, ChevronDown, ChevronRight, X, TrendingUp, Calendar, ExternalLink, BarChart3, Users, AlertCircle, CheckCircle, Timer, Zap, Target, DollarSign, Activity, Key, Brain, Database, Loader2, Save, Phone, LogOut, FileText } from 'lucide-react';
import { leadsService } from '../lib/leadsService';
import { supabase } from '../lib/supabase';
import CRMManager from './CRMManager';
import TemplateManager from './TemplateManager';

// Security utilities for API key encryption
const ENCRYPTION_SALT = 'InboxManager_2024_Salt_Key';

const encryptApiKey = (key) => {
  if (!key) return '';
  try {
    // Simple encryption using base64 encoding with salt
    const combined = key + ENCRYPTION_SALT;
    return btoa(combined);
  } catch (error) {
    console.warn('Failed to encrypt API key:', error);
    return key;
  }
};

const decryptApiKey = (encryptedKey) => {
  try {
  if (!encryptedKey) return '';
    
    // Check if it looks like base64 (contains only valid base64 characters)
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(encryptedKey)) {
      // Not base64, return as plain text
      return encryptedKey;
    }
    
  try {
    const decoded = atob(encryptedKey);
      // Check if the decoded value contains our salt (indicating it was encrypted by us)
      if (decoded.includes(ENCRYPTION_SALT)) {
    return decoded.replace(ENCRYPTION_SALT, '');
      } else {
        // Decoded successfully but no salt found, likely just base64 encoded plain text
        return decoded;
      }
  } catch (error) {
      // atob failed, treat as plain text
      console.warn('atob decoding failed for key:', error);
    return encryptedKey;
    }
  } catch (error) {
    // Catch any unexpected errors (like the "jn" initialization error)
    console.error('Unexpected error in decryptApiKey:', error);
    return encryptedKey || '';
  }
};

// Clean up messy browser-generated HTML and convert to semantic tags
const cleanFormattingHtml = (html) => {
  if (!html) return '';
  
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Remove link editing UI elements (remove buttons, wrappers)
  const linkWrappers = temp.querySelectorAll('span[style*="position: relative"][style*="inline-block"]');
  linkWrappers.forEach(wrapper => {
    const link = wrapper.querySelector('a');
    if (link) {
      // Replace the wrapper with just the link
      wrapper.parentNode.replaceChild(link, wrapper);
    }
  });

  // Remove any remaining remove buttons (× characters with specific styling)
  const removeButtons = temp.querySelectorAll('span');
  removeButtons.forEach(span => {
    const style = span.getAttribute('style') || '';
    const text = span.textContent.trim();
    // Remove spans that look like remove buttons
    if ((text === '×' || text === 'x') && 
        (style.includes('position: absolute') || 
         style.includes('border-radius: 50%') ||
         style.includes('width: 16px'))) {
      span.remove();
    }
  });

  // Strip ALL style attributes (removes Tailwind CSS bloat) but preserve essential link attributes
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(element => {
    element.removeAttribute('style');
    // Preserve essential link attributes
    if (element.tagName === 'A') {
      // Keep href, target, rel attributes for links
      const href = element.getAttribute('href');
      const target = element.getAttribute('target');
      const rel = element.getAttribute('rel');
      // Remove all attributes first
      Array.from(element.attributes).forEach(attr => {
        element.removeAttribute(attr.name);
      });
      // Add back essential attributes
      if (href) element.setAttribute('href', href);
      if (target) element.setAttribute('target', target);
      if (rel) element.setAttribute('rel', rel);
    }
  });
  
  // Convert divs to paragraphs for better email compatibility
  const divs = temp.querySelectorAll('div');
  divs.forEach(div => {
    const p = document.createElement('p');
    p.innerHTML = div.innerHTML;
    div.parentNode.replaceChild(p, div);
  });
  
  // Convert spans with font-weight: bold to <strong>
  const boldSpans = temp.querySelectorAll('span[style*="font-weight"], span[style*="bold"]');
  boldSpans.forEach(span => {
    if (span.style.fontWeight === 'bold' || span.style.fontWeight === '700' || span.style.fontWeight === 'bolder') {
      const strong = document.createElement('strong');
      strong.innerHTML = span.innerHTML;
      span.parentNode.replaceChild(strong, span);
    }
  });
  
  // Convert spans with font-style: italic to <em>
  const italicSpans = temp.querySelectorAll('span[style*="font-style"]');
  italicSpans.forEach(span => {
    if (span.style.fontStyle === 'italic') {
      const em = document.createElement('em');
      em.innerHTML = span.innerHTML;
      span.parentNode.replaceChild(em, span);
    }
  });
  
  // Convert spans with text-decoration: underline to <u>
  const underlineSpans = temp.querySelectorAll('span[style*="text-decoration"]');
  underlineSpans.forEach(span => {
    if (span.style.textDecoration === 'underline') {
      const u = document.createElement('u');
      u.innerHTML = span.innerHTML;
      span.parentNode.replaceChild(u, span);
    }
  });
  
  // Remove empty spans and divs
  const emptyElements = temp.querySelectorAll('span, div');
  emptyElements.forEach(element => {
    if (!element.textContent.trim() && !element.querySelector('br, img, a')) {
      element.remove();
    } else if (element.tagName === 'SPAN' && !element.hasAttributes()) {
      // Replace spans with no attributes with their content
      element.outerHTML = element.innerHTML;
    }
  });
  
  // Clean up any remaining empty paragraphs
  const emptyPs = temp.querySelectorAll('p:empty');
  emptyPs.forEach(p => p.remove());
  
  // Remove common editing artifacts and invisible characters
  let cleanedHtml = temp.innerHTML;
  
  // Remove cursor artifacts and invisible characters
  cleanedHtml = cleanedHtml
    .replace(/\u200B/g, '') // Zero-width space
    .replace(/\u00A0/g, ' ') // Non-breaking space to regular space
    .replace(/\uFEFF/g, '') // Zero-width no-break space (BOM)
    .replace(/<br\s*\/?>(\s*<br\s*\/?>)+/gi, '<br>') // Multiple consecutive <br> tags
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .trim();
  
  return cleanedHtml;
};

// HTML sanitization function (basic XSS protection)
const sanitizeHtml = (html) => {
  if (!html) return '';
  
  // First clean up messy formatting
  const cleanedHtml = cleanFormattingHtml(html);
  
  // Create a temporary element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = cleanedHtml;
  
  // Remove potentially dangerous elements and attributes
  const dangerousElements = ['script', 'object', 'embed', 'iframe', 'form'];
  const dangerousAttributes = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'];
  
  dangerousElements.forEach(tagName => {
    const elements = temp.querySelectorAll(tagName);
    elements.forEach(el => el.remove());
  });
  
  // Remove dangerous attributes from all elements
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    dangerousAttributes.forEach(attr => {
      if (el.hasAttribute(attr)) {
        el.removeAttribute(attr);
      }
    });
    
    // Remove javascript: URLs
    ['href', 'src'].forEach(attr => {
      const value = el.getAttribute(attr);
      if (value && value.toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr);
      }
    });
  });
  
  return temp.innerHTML;
};

const InboxManager = ({ user, onSignOut }) => {
  // Helper function to check if intent is null/undefined/invalid
  const isIntentNull = (intent) => {
    return intent === null || intent === undefined || intent === '' || intent === 'null' || isNaN(Number(intent));
  };

  // State for leads from API
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add new state for enrichment data
  const [enrichmentData, setEnrichmentData] = useState(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [showEnrichmentPopup, setShowEnrichmentPopup] = useState(false);

  // Add new state for API settings and tab management
  const [activeTab, setActiveTab] = useState('all');
  const [showApiSettings, setShowApiSettings] = useState(false);
  
  // Intent filter state (default to 'positive' to show only leads with positive intent)
  const [intentFilter, setIntentFilter] = useState('positive');
  
  // Lead backfill states
  const [showBackfillModal, setShowBackfillModal] = useState(false);
  const [backfillDays, setBackfillDays] = useState(30);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState({ current: 0, total: 0, status: '' });
  // ===== SIMPLE BULLETPROOF API KEY SYSTEM =====
  const [apiKeys, setApiKeys] = useState({
    accounts: [],
    fullenrich: ''
  });
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(false);
  const [apiTestStatus, setApiTestStatus] = useState({
    esp: null,
    fullenrich: null
  });

  // Debug: Track apiKeys state changes
  useEffect(() => {
    console.log('🔄 apiKeys state changed:', {
      accountCount: apiKeys.accounts.length,
      accounts: apiKeys.accounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        provider: acc.esp?.provider,
        hasKey: !!acc.esp?.key
      })),
      hasFullenrich: !!apiKeys.fullenrich
    });
  }, [apiKeys]);
  const [isSavingApi, setIsSavingApi] = useState(false);
  const [showApiToast, setShowApiToast] = useState(false);
  const [apiToastMessage, setApiToastMessage] = useState({ type: '', message: '' });

  // Add new state for searching phone number
  const [isSearchingPhone, setIsSearchingPhone] = useState(false);

  // Add state for template selection
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Add state for file attachments
  const [attachedFiles, setAttachedFiles] = useState([]);

  // Add state for message scheduling
  const [scheduledTime, setScheduledTime] = useState(null);
  const [showScheduler, setShowScheduler] = useState(false);

  // Add ref for recent dropdown positioning
  const recentButtonRef = useRef(null);

  // Replace single loading states with maps of lead IDs
  const [enrichingLeads, setEnrichingLeads] = useState(new Set());
  const [searchingPhoneLeads, setSearchingPhoneLeads] = useState(new Set());

  // Replace single toast with array of toasts
  const [toasts, setToasts] = useState([]);
  const toastsTimeoutRef = useRef({}); // Store timeouts by toast ID

  // Theme management
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('inbox_manager_theme');
    return savedTheme ? savedTheme === 'dark' : true; // Default to dark mode
  });

  // Auto-save drafts state
  const [drafts, setDrafts] = useState(() => {
    try {
      const savedDrafts = localStorage.getItem('inbox_manager_drafts');
      return savedDrafts ? JSON.parse(savedDrafts) : {};
    } catch (e) {
      console.warn('Failed to load saved drafts:', e);
      return {};
    }
  });

  // Recently viewed leads state
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try {
      const savedRecent = localStorage.getItem('inbox_manager_recent_leads');
      return savedRecent ? JSON.parse(savedRecent) : [];
    } catch (e) {
      console.warn('Failed to load recently viewed leads:', e);
      return [];
    }
  });
  const [showRecentDropdown, setShowRecentDropdown] = useState(false);
  const [categoryDropdowns, setCategoryDropdowns] = useState(new Set()); // Track which lead category dropdowns are open
  const [dropdownPositions, setDropdownPositions] = useState({}); // Track dropdown positions for portal
  const dropdownButtonRefs = useRef({}); // Refs for dropdown buttons
  const [recentDropdownPosition, setRecentDropdownPosition] = useState(null);

  // Clean up all timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(toastsTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
      }
    };
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close recent dropdown if clicking outside (check for both button and portal dropdown)
      if (showRecentDropdown) {
        const isClickOnRecentButton = event.target.closest('.recent-dropdown');
        const isClickOnRecentPortalDropdown = event.target.closest('[data-portal-dropdown]');
        
        if (!isClickOnRecentButton && !isClickOnRecentPortalDropdown) {
        setShowRecentDropdown(false);
          setRecentDropdownPosition(null);
        }
      }
      
      // Close category dropdowns if clicking outside (check for both in-container buttons and portal dropdowns)
      if (categoryDropdowns.size > 0) {
        const isClickOnButton = event.target.closest('.category-dropdown');
        const isClickOnPortalDropdown = event.target.closest('[data-portal-dropdown]');
        
        if (!isClickOnButton && !isClickOnPortalDropdown) {
          setCategoryDropdowns(new Set());
          setDropdownPositions({});
        }
      }
      
      // Close scheduler if clicking outside
      if (showScheduler) {
        const isClickOnScheduler = event.target.closest('.scheduler-container');
        
        if (!isClickOnScheduler) {
          setShowScheduler(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRecentDropdown, categoryDropdowns, showScheduler]);

  // Auto-save drafts with debouncing
  const draftTimeoutRef = useRef(null);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  
  const saveDraft = (leadId, content, htmlContent) => {
    if (draftTimeoutRef.current) {
      clearTimeout(draftTimeoutRef.current);
    }
    
    setIsDraftSaving(true);
    
    draftTimeoutRef.current = setTimeout(() => {
      const newDrafts = {
        ...drafts,
        [leadId]: {
          content: content.trim(),
          htmlContent: htmlContent || '',
          savedAt: new Date().toISOString()
        }
      };
      
      // Remove empty drafts
      if (!content.trim()) {
        delete newDrafts[leadId];
      }
      
      setDrafts(newDrafts);
      localStorage.setItem('inbox_manager_drafts', JSON.stringify(newDrafts));
      setIsDraftSaving(false);
    }, 2000); // Auto-save after 2 seconds of inactivity
  };

  // Recently viewed leads management
  const addToRecentlyViewed = (lead) => {
    if (!lead) return;
    
    const newRecent = [
      { id: lead.id, name: `${lead.first_name} ${lead.last_name}`, email: lead.email },
      ...recentlyViewed.filter(item => item.id !== lead.id)
    ].slice(0, 8); // Keep only last 8
    
    setRecentlyViewed(newRecent);
    localStorage.setItem('inbox_manager_recent_leads', JSON.stringify(newRecent));
  };



  // Migrate existing unencrypted API keys to encrypted storage (runs once on mount)
  useEffect(() => {
    const migrateApiKeys = () => {
      const keysToMigrate = ['smartlead', 'claude', 'fullenrich'];
      let migrationNeeded = false;

      keysToMigrate.forEach(keyName => {
        const oldKey = localStorage.getItem(`${keyName}_api_key`);
        const newKey = localStorage.getItem(`${keyName}_api_key_enc`);
        
        // If old unencrypted key exists but new encrypted key doesn't
        if (oldKey && !newKey) {
          const encryptedKey = encryptApiKey(oldKey);
          localStorage.setItem(`${keyName}_api_key_enc`, encryptedKey);
          localStorage.removeItem(`${keyName}_api_key`);
          migrationNeeded = true;
        }
      });

      if (migrationNeeded) {
        console.info('API keys migrated to encrypted storage for security');
        showToast('API keys upgraded to encrypted storage', 'success');
      }
    };

    migrateApiKeys();
  }, []);

  // Theme toggle function
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('inbox_manager_theme', newTheme ? 'dark' : 'light');
    // Dispatch custom event for other components to listen to
    window.dispatchEvent(new CustomEvent('themeChanged'));
    showToast(`Switched to ${newTheme ? 'dark' : 'light'} mode`, 'success');
  };

  // Theme CSS variables
  const themeStyles = isDarkMode ? {
    // Dark mode colors
    primaryBg: '#1A1C1A',
    secondaryBg: 'rgba(26, 28, 26, 0.8)',
    tertiaryBg: 'rgba(255, 255, 255, 0.05)',
    textPrimary: '#FFFFFF',
    textSecondary: '#D1D5DB',
    textMuted: '#9CA3AF',
    accent: '#54FCFF',
    border: 'rgba(255, 255, 255, 0.1)',
    borderStrong: 'rgba(255, 255, 255, 0.2)',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  } : {
    // Light mode colors (fixed contrast)
    primaryBg: '#F8FAFC',
    secondaryBg: '#FFFFFF',
    tertiaryBg: '#F1F5F9',
    textPrimary: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    accent: '#2563EB',
    border: 'rgba(0, 0, 0, 0.15)',
    borderStrong: 'rgba(0, 0, 0, 0.25)',
    success: '#059669',
    warning: '#D97706',
    error: '#DC2626',
  };

  // Modified toast helper function
  const showToast = (message, type = 'success', leadId = null) => {
    const id = Date.now(); // Unique ID for each toast
    const newToast = { id, message, type, leadId };
    
    setToasts(currentToasts => [...currentToasts, newToast]);
    
    // Store the timeout reference
    toastsTimeoutRef.current[id] = setTimeout(() => {
      removeToast(id);
    }, 10000);
  };

  // Remove specific toast
  const removeToast = (id) => {
    // Clear the timeout
    if (toastsTimeoutRef.current[id]) {
      clearTimeout(toastsTimeoutRef.current[id]);
      delete toastsTimeoutRef.current[id];
    }
    
    setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
  };

  // Helper functions (moved up before they're used)
  // Get last response date from them (last REPLY message)
  const getLastResponseFromThem = (conversation) => {
    const replies = conversation.filter(msg => msg.type === 'REPLY');
    if (replies.length === 0) return null;
    return replies[replies.length - 1].time;
  };

  // Add utility functions at the top of the component
  const safeGetLastMessage = (lead) => {
    if (!lead?.conversation?.length) return null;
    return lead.conversation[lead.conversation.length - 1];
  };

  const timeDiff = (date1, date2) => {
    try {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return Infinity;
      return (d1 - d2) / (1000 * 60 * 60 * 24);
    } catch (e) {
      return Infinity;
    }
  };

  // Replace getResponseUrgency with new logic
  const getResponseUrgency = (lead) => {
    const lastMessage = safeGetLastMessage(lead);
    if (!lastMessage) return 'none';

    const theyRepliedLast = lastMessage.type === 'REPLY';
    const weRepliedLast = lastMessage.type === 'SENT';
    const now = new Date();
    const lastMsgTime = new Date(lastMessage.time);
    const hoursSinceLastMessage = (now - lastMsgTime) / (1000 * 60 * 60);
    const daysSinceLastMessage = (now - lastMsgTime) / (1000 * 60 * 60 * 24);

    // URGENT: They replied last, and it's been 24h+
    if (theyRepliedLast && hoursSinceLastMessage >= 24) {
      return 'urgent-response';
    }
    // NEEDS RESPONSE: They replied last, and it's been less than 24h
    if (theyRepliedLast && hoursSinceLastMessage < 24) {
      return 'needs-response';
    }
    // NEEDS FOLLOWUP: We sent last, and it's been 3+ days
    if (weRepliedLast && daysSinceLastMessage >= 3) {
      return 'needs-followup';
    }
    return 'none';
  };

  // Fetch the user's brand_id from the profiles table after login
  const [brandId, setBrandId] = useState(() => {
    // Try localStorage first for immediate availability
    return localStorage.getItem('user_brand_id') || null;
  });

  // Fetch the user's brand_id from the profiles table after login
  useEffect(() => {
    const fetchBrandId = async () => {
      if (!user) return;
      
      // Check if we already have it cached
      const cachedBrandId = localStorage.getItem('user_brand_id');
      if (cachedBrandId) {
        setBrandId(cachedBrandId);
        return;
      }
      
      // Only fetch from database if not cached
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('brand_id')
        .eq('id', user.id)
        .single();
        
      if (profile?.brand_id) {
        setBrandId(profile.brand_id);
        localStorage.setItem('user_brand_id', profile.brand_id); // Cache it
      } else {
        setBrandId(null);
        localStorage.removeItem('user_brand_id'); // Clear invalid cache
      }
    };
    fetchBrandId();
  }, [user]);

  // SIMPLE SAVE: Save to both Supabase and localStorage
  const saveApiKeys = async (showSuccessMessage = true) => {
    console.log('💾 Saving API keys...');
    setIsSavingApi(true);
    
    try {
      // STEP 1: Always save to localStorage first
      localStorage.setItem('apiKeys_backup', JSON.stringify(apiKeys));
      console.log('✅ Saved to localStorage');
      
      // STEP 2: Save to Supabase if possible
      if (brandId && user) {
        console.log('📤 Saving to Supabase...');
        
        // Prepare all records
        const recordsToInsert = [];
        
        // Separate new accounts from existing accounts
        const newAccounts = [];
        const existingAccounts = [];
        
        apiKeys.accounts.forEach(account => {
          const recordData = {
            brand_id: String(brandId),
            created_by: String(user.id),
            account_id: account.account_id || crypto.randomUUID(), // UUID for webhook routing
            account_name: account.name,
            esp_api_key: encryptApiKey(account.esp.key),
            esp_provider: account.esp.provider,
            fullenrich_api_key: null,
            is_primary: account.is_primary || false,
            is_active: true,
            backfilled: account.backfilled || false, // Preserve backfill status
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          if (account.id && !isNaN(account.id)) {
            // Existing account - include ID for update
            recordData.id = parseInt(account.id);
            existingAccounts.push(recordData);
          } else {
            // New account - don't include ID, let database auto-assign
            newAccounts.push(recordData);
          }
        });
        
        // STEP 2A: Insert new accounts (no ID, let database auto-assign)
        if (newAccounts.length > 0) {
          const { error: insertError } = await supabase
            .from('api_settings')
            .insert(newAccounts);
            
          if (insertError) throw insertError;
          console.log(`✅ Inserted ${newAccounts.length} new accounts`);
        }
        
        // STEP 2B: Update existing accounts
        if (existingAccounts.length > 0) {
          const { error: upsertError } = await supabase
            .from('api_settings')
            .upsert(existingAccounts, {
              onConflict: 'id',
              ignoreDuplicates: false
            });
            
          if (upsertError) throw upsertError;
          console.log(`✅ Updated ${existingAccounts.length} existing accounts`);
        }
        
        // STEP 2C: Handle FullEnrich
        if (apiKeys.fullenrich) {
          // Check if FullEnrich record exists
          const { data: existingFullenrich } = await supabase
            .from('api_settings')
            .select('id')
            .eq('brand_id', brandId)
            .eq('account_name', 'FullEnrich Global')
            .single();
            
          const fullenrichData = {
            brand_id: String(brandId),
            created_by: String(user.id),
            account_name: 'FullEnrich Global',
            esp_api_key: null,
            esp_provider: null,
            fullenrich_api_key: encryptApiKey(apiKeys.fullenrich),
            is_primary: false,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          if (existingFullenrich) {
            // Update existing FullEnrich
            fullenrichData.id = existingFullenrich.id;
            const { error: fullenrichError } = await supabase
              .from('api_settings')
              .upsert([fullenrichData], {
                onConflict: 'id',
                ignoreDuplicates: false
              });
              
            if (fullenrichError) throw fullenrichError;
          } else {
            // Insert new FullEnrich
            const { error: fullenrichError } = await supabase
              .from('api_settings')
              .insert([fullenrichData]);
              
            if (fullenrichError) throw fullenrichError;
          }
        }
        
        console.log('✅ Saved to Supabase');
      }
      
      // Only show success message if explicitly requested (user-initiated saves)
      if (showSuccessMessage) {
        setApiToastMessage({
          type: 'success',
          message: 'API keys saved successfully!'
        });
        setShowApiToast(true);
        setTimeout(() => setShowApiToast(false), 3000);
        setShowApiSettings(false);
        
        // Show backfill prompt only for new Smartlead accounts that haven't been backfilled
        const newSmartleadAccounts = apiKeys.accounts.filter(acc => 
          acc.esp.provider === 'smartlead' && 
          acc.esp.key && 
          !acc.backfilled // Only show for accounts that haven't been backfilled
        );
        
        if (newSmartleadAccounts.length > 0) {
          console.log(`📋 Found ${newSmartleadAccounts.length} new Smartlead accounts that need backfill`);
          setTimeout(() => {
            setShowBackfillModal(true);
          }, 1000); // Show after API settings modal closes
        } else {
          console.log('✅ All Smartlead accounts have already been backfilled');
        }
      }
      
    } catch (error) {
      console.error('❌ Save failed:', error);
      if (showSuccessMessage) {
        setApiToastMessage({
          type: 'error',
          message: 'Failed to save: ' + error.message
        });
        setShowApiToast(true);
        setTimeout(() => setShowApiToast(false), 5000);
      }
    } finally {
      setIsSavingApi(false);
    }
  };

  // SIMPLE LOAD: Try Supabase first, fallback to localStorage
  const loadApiKeys = async () => {
    if (isLoadingApiKeys) return; // Prevent double-loading
    
    setIsLoadingApiKeys(true);
    console.log('📥 Loading API keys...');
    
    try {
      // STEP 1: Try Supabase if we have brandId
      if (brandId && user) {
        console.log('📊 Trying Supabase...');
        
        const { data, error } = await supabase
          .from('api_settings')
          .select('*')
          .eq('brand_id', brandId);
          
        if (!error && data && data.length > 0) {
          console.log(`✅ Found ${data.length} records in Supabase`);
          
          const accounts = [];
          let fullenrichKey = '';
          
          data.forEach(record => {
            if (record.account_name === 'FullEnrich Global') {
              fullenrichKey = decryptApiKey(record.fullenrich_api_key || '');
            } else {
              // Keep the original integer ID from the database
              accounts.push({
                id: record.id, // Keep as integer (bigint from database)
                account_id: record.account_id, // This is the UUID for webhook routing
                name: record.account_name || 'Account',
                esp: {
                  provider: record.esp_provider || '',
                  key: decryptApiKey(record.esp_api_key || '')
                },
                is_primary: record.is_primary || false,
                backfilled: record.backfilled || false // Track if this account has been backfilled
              });
            }
          });
          
          const newState = { accounts, fullenrich: fullenrichKey };
          setApiKeys(newState);
          
          // Sync to localStorage as backup
          localStorage.setItem('apiKeys_backup', JSON.stringify(newState));
          console.log('✅ Loaded from Supabase');
          

          
          return;
        }
      }
      
      // STEP 2: Fallback to localStorage
      console.log('📱 Trying localStorage...');
      const backup = localStorage.getItem('apiKeys_backup');
      if (backup) {
        const parsed = JSON.parse(backup);
        setApiKeys(parsed);
        console.log('✅ Loaded from localStorage backup');
      }
      
    } catch (error) {
      console.error('❌ Load failed:', error);
    } finally {
      setIsLoadingApiKeys(false);
    }
  };

  // Load API keys when brandId and user are available
  useEffect(() => {
    if (brandId && user) {
      loadApiKeys();
    }
  }, [brandId, user]);

  // Fetch leads when brandId or API keys are available
  useEffect(() => {
    const shouldFetchLeads = brandId || (apiKeys.accounts && apiKeys.accounts.length > 0);
    
    if (shouldFetchLeads) {
      // Small delay to avoid rapid re-fetching during initialization
      const timeoutId = setTimeout(() => {
      fetchLeads();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [brandId, apiKeys.accounts?.length]); // Only depend on accounts length, not entire apiKeys object

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all leads first
      const { data, error } = await supabase
        .from('retention_harbor')
        .select('*');
      if (error) throw error;

      let filteredData = [];

      // If API keys are configured, use API key filtering
      if (apiKeys.accounts && apiKeys.accounts.length > 0) {
        console.log('🔑 Filtering leads by API keys');
        
        // Get current user's API keys for filtering
        const userApiKeys = apiKeys.accounts.map(account => 
          decryptApiKey(account.esp.key) || account.esp.key
        ).filter(key => key && key.trim() !== '');

        // Filter leads by email_account_id 
        filteredData = (data || []).filter(lead => {
          // Primary filter: Check if lead's email_account_id matches any of our account_id (UUIDs)
          if (lead.email_account_id) {
            const hasMatchingAccount = apiKeys.accounts.some(account => account.account_id === lead.email_account_id);
            if (hasMatchingAccount) {
              console.log(`✅ Lead matches account: ${lead.email_account_id}`);
              return true;
            }
          }
          
          // Fallback: If no email_account_id, use brand_id matching (backward compatibility)
          if (!lead.email_account_id && brandId && lead.brand_id === brandId) {
            console.log(`✅ Lead matches brand_id fallback: ${lead.brand_id}`);
            return true;
          }
          
          return false;
        });
      } else if (brandId) {
        // Fallback: If no API keys configured, filter by brand ID only
        console.log('🏢 No API keys found - filtering leads by brand ID');
        filteredData = (data || []).filter(lead => lead.brand_id === brandId);
      } else {
        // No API keys and no brand ID - show empty
        console.log('❌ No API keys or brand ID - showing empty state');
        filteredData = [];
      }


      // Transform the filtered data to match the expected format
      const transformedLeads = filteredData.map(lead => {
        // ... your existing transformation code ...
        // (keep your conversation parsing, metrics, etc. as before)
        let conversation = [];
        let extractedSubject = `Campaign for ${lead.first_name || 'Lead'}`;
        let emailStatsId = null;
        try {
          if (lead.email_message_body) {
            const parsedConversation = JSON.parse(lead.email_message_body);
            if (parsedConversation.length > 0 && parsedConversation[0].stats_id) {
              emailStatsId = parsedConversation[0].stats_id;
            }
            conversation = parsedConversation.map((msg, index) => {
              const prevMsg = parsedConversation[index - 1];
              let responseTime = undefined;
              if (msg.type === 'REPLY' && prevMsg && prevMsg.type === 'SENT') {
                const timeDiff = new Date(msg.time) - new Date(prevMsg.time);
                responseTime = timeDiff / (1000 * 60 * 60); // Convert to hours
              }
              return {
                from: msg.from || '',
                to: msg.to || '',
                cc: msg.cc || null,
                type: msg.type || 'SENT',
                time: msg.time || new Date().toISOString(),
                content: extractTextFromHTML(msg.email_body || ''),
                subject: msg.subject || '',
                opened: (msg.open_count || 0) > 0,
                clicked: (msg.click_count || 0) > 0,
                response_time: responseTime
              };
            });
            if (conversation.length > 0) {
              const messageWithSubject = conversation.find(msg => msg.subject && msg.subject.trim() !== '');
              if (messageWithSubject) {
                extractedSubject = messageWithSubject.subject.trim();
              }
            }
          }
        } catch (e) {
          console.error('Error parsing conversation for lead', lead.id, e);
          conversation = [];
        }
        const replies = conversation.filter(m => m.type === 'REPLY');
        const sent = conversation.filter(m => m.type === 'SENT');
        const responseTimes = conversation
          .filter(m => m.response_time !== undefined)
          .map(m => m.response_time);
        const avgResponseTime = responseTimes.length > 0 
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
          : 0;
        let engagementScore = 0;
        if (sent.length > 0) {
          engagementScore += Math.min((replies.length / sent.length) * 60, 60);
          if (avgResponseTime < 1) engagementScore += 40;
          else if (avgResponseTime < 4) engagementScore += 30;
          else if (avgResponseTime < 24) engagementScore += 20;
          else if (avgResponseTime < 72) engagementScore += 10;
        }
        engagementScore = Math.round(Math.min(engagementScore, 100));
        const allText = conversation.map(m => m.content.toLowerCase()).join(' ');
        let intentScore = 1 + Math.min(replies.length * 2, 6);
        const positiveKeywords = ['interested', 'yes', 'sure', 'sounds good', 'let me know', 'call', 'meeting', 'schedule'];
        intentScore += positiveKeywords.filter(keyword => allText.includes(keyword)).length;
        if (allText.includes('price') || allText.includes('cost')) intentScore += 1;
        if (allText.includes('sample') || allText.includes('example')) intentScore += 1;
        intentScore = Math.min(intentScore, 10);
        return {
          id: lead.id,
          campaign_id: lead.campaign_ID || null,
          lead_id: lead.lead_ID || null,
          email_stats_id: emailStatsId,
          created_at: lead.created_at,
          updated_at: lead.created_at,
          email: lead.lead_email,
          first_name: lead.first_name || 'Unknown',
          last_name: lead.last_name || '',
          website: lead.website || lead.lead_email?.split('@')[1] || '',
          content_brief: `Email marketing campaign for ${lead.lead_category || 'business'}`,
          subject: extractedSubject,
          email_message_body: lead.email_message_body,
          intent: lead.intent, // ✅ Use actual database value instead of calculated score
          created_at_best: lead.created_at,
          response_time_avg: avgResponseTime,
          engagement_score: engagementScore,
          lead_category: lead.lead_category ? parseInt(lead.lead_category, 10) : null,
          tags: [lead.lead_category ? leadCategoryMap[parseInt(lead.lead_category, 10)] || 'Uncategorized' : 'Uncategorized'],
          conversation: conversation,
          role: lead.role || 'N/A',
          company_data: lead.company_data || 'N/A',
          personal_linkedin_url: lead.personal_linkedin_url || null,
          business_linkedin_url: lead.business_linkedin_url || null,
          linkedin_url: lead.linkedin_url || 'N/A',
          phone: lead.phone || null,
          status: lead.status || 'INBOX'
        };
      });
      setLeads(transformedLeads);
    } catch (err) {
      console.error('Error fetching leads:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to extract text from HTML and clean reply content
  const extractTextFromHTML = (html) => {
    if (!html) return '';
    
    // First clean HTML tags and entities
    let text = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&#x22;/g, '"')
      .replace(/&#8217;/g, "'")
      .replace(/&#8216;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/&#8211;/g, '-')
      .replace(/&#8212;/g, '—')
      .replace(/&#8230;/g, '...')
      .replace(/&hellip;/g, '...')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '-')
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"')
      .replace(/&ldquo;/g, '"')
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract only the new reply content (before common reply separators)
    const replyIndicators = [
      'On ', // "On [date], [person] wrote:"
      'From:', // "From: [email]"
      '-----Original Message-----',
      '________________________________',
      '--- On ',
      'Sent from my iPhone',
      'Sent from my iPad',
      'Get Outlook for',
      'This email was sent to'
    ];
    
    // Find the first occurrence of any reply indicator
    let cutoffIndex = text.length;
    replyIndicators.forEach(indicator => {
      const index = text.indexOf(indicator);
      if (index !== -1 && index < cutoffIndex) {
        cutoffIndex = index;
      }
    });
    
    // Also look for common quote patterns like "> "
    const lines = text.split('\n');
    let newReplyLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Stop if we hit quoted content (lines starting with >)
      if (line.startsWith('>')) {
        break;
      }
      
      // Stop if we hit a reply indicator
      const hasReplyIndicator = replyIndicators.some(indicator => 
        line.includes(indicator)
      );
      if (hasReplyIndicator) {
        break;
      }
      
      newReplyLines.push(line);
    }
    
    // Use the shorter of the two methods
    const methodOne = text.substring(0, cutoffIndex).trim();
    const methodTwo = newReplyLines.join('\n').trim();
    
    const result = methodTwo.length > 0 && methodTwo.length < methodOne.length 
      ? methodTwo 
      : methodOne;
    
    return result || text; // Fallback to original if extraction fails
  };

  // Lead category mapping
  const leadCategoryMap = {
    1: 'Interested',
    2: 'Meeting Request', 
    3: 'Not Interested',
    4: 'Do Not Contact',
    5: 'Information Request',
    6: 'Out Of Office',
    7: 'Wrong Person',
    8: 'Uncategorizable by AI',
    9: 'Sender Originated Bounce'
  };

  // Category options for dropdown
  const CATEGORY_OPTIONS = [
    { value: 1, label: 'Interested', color: '#10B981' },
    { value: 2, label: 'Meeting Request', color: '#8B5CF6' },
    { value: 3, label: 'Not Interested', color: '#EF4444' },
    { value: 4, label: 'Do Not Contact', color: '#DC2626' },
    { value: 5, label: 'Information Request', color: '#F59E0B' },
    { value: 6, label: 'Out Of Office', color: '#6B7280' },
    { value: 7, label: 'Wrong Person', color: '#F97316' },
    { value: 8, label: 'Uncategorizable by AI', color: '#9CA3AF' },
    { value: 9, label: 'Sender Originated Bounce', color: '#EF4444' }
  ];

  // Portal Dropdown Component
  const PortalDropdown = ({ leadId, lead, position, onClose, onSelect }) => {
    if (!position) return null;

    return createPortal(
      <div
        data-portal-dropdown
        className="fixed rounded-xl shadow-2xl overflow-hidden z-[10000]"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          minWidth: '220px',
          maxWidth: '300px',
          width: 'auto',
          backgroundColor: isDarkMode ? '#1A1C1A' : '#FFFFFF',
          border: `2px solid ${themeStyles.borderStrong}`,
          boxShadow: '0 20px 40px rgba(0,0,0,0.9)',
          boxSizing: 'border-box',
          borderRadius: '12px',
          overflow: 'hidden'
        }}
      >
        {CATEGORY_OPTIONS.map((option, optionIndex) => (
          <button
            key={option.value}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(leadId, option.value);
              onClose();
            }}
            className="w-full px-5 py-4 text-left transition-all duration-200 hover:opacity-90 text-sm font-medium"
            style={{
              backgroundColor: lead.lead_category === option.value 
                ? `${option.color}30` 
                : isDarkMode ? '#2A2C2A' : '#F8F9FA',
              borderBottom: optionIndex < CATEGORY_OPTIONS.length - 1 ? `1px solid ${themeStyles.border}` : 'none',
              color: '#ffffff',
              boxSizing: 'border-box',
              minHeight: '50px',
              display: 'flex',
              alignItems: 'center'
            }}
            onMouseEnter={(e) => {
              if (lead.lead_category !== option.value) {
                e.target.style.backgroundColor = `${option.color}15`;
              }
            }}
            onMouseLeave={(e) => {
              if (lead.lead_category !== option.value) {
                e.target.style.backgroundColor = isDarkMode ? '#2A2C2A' : '#F8F9FA';
              }
            }}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-sm whitespace-nowrap">{option.label}</span>
              {lead.lead_category === option.value && (
                <CheckCircle className="w-5 h-5 ml-3 flex-shrink-0" style={{color: '#ffffff'}} />
              )}
            </div>
          </button>
        ))}
      </div>,
      document.body
    );
  };

  // Recent Portal Dropdown Component
  const RecentPortalDropdown = ({ position, onClose }) => {
    if (!position || !recentlyViewed.length) return null;

    return createPortal(
      <div
        data-portal-dropdown
        className="fixed rounded-xl shadow-2xl overflow-hidden z-[10000]"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: '256px',
          maxHeight: '320px',
          backgroundColor: isDarkMode ? '#1A1C1A' : '#FFFFFF',
          border: `2px solid ${themeStyles.borderStrong}`,
          boxShadow: '0 20px 40px rgba(0,0,0,0.9)',
          boxSizing: 'border-box',
          borderRadius: '12px',
          overflow: 'hidden'
        }}
      >
        <div className="p-3">
          <h4 className="font-medium mb-2 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>Recently Viewed</h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {recentlyViewed.map((recent) => (
              <button
                key={recent.id}
                onClick={(e) => {
                  e.stopPropagation();
                                     const lead = leads.find(l => l.id === recent.id);
                   if (lead) {
                     setSelectedLead(lead);
                     setShowRecentDropdown(false);
                     setActiveTab('all'); // Switch to inbox to show the selected lead
                     // Clear attachments and scheduling when switching leads
                     setAttachedFiles([]);
                     setScheduledTime(null);
                     setShowScheduler(false);
                   }
                  onClose();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-300 hover:opacity-80"
                style={{
                  backgroundColor: selectedLead?.id === recent.id ? `${themeStyles.accent}20` : themeStyles.tertiaryBg,
                  color: themeStyles.textPrimary
                }}
              >
                <div className="font-medium">{recent.name}</div>
                <div className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>{recent.email}</div>
              </button>
            ))}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRecentlyViewed([]);
              localStorage.removeItem('inbox_manager_recent_leads');
              setShowRecentDropdown(false);
              onClose();
            }}
            className="w-full mt-3 px-3 py-2 text-xs rounded-lg transition-all duration-300 hover:opacity-80"
            style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textMuted}}
          >
            Clear Recent
          </button>
        </div>
      </div>,
      document.body
    );
  };



  // Available sort options
  const sortOptions = [
    { field: 'last_reply', label: 'Most Recent Lead Reply', getValue: (lead) => {
      const lastReply = getLastResponseFromThem(lead.conversation);
      return lastReply ? new Date(lastReply) : new Date(0);
    }},
    { field: 'last_sent', label: 'Most Recent Sent Message', getValue: (lead) => {
      const lastSent = lead.conversation.filter(m => m.type === 'SENT');
      return lastSent.length > 0 ? new Date(lastSent[lastSent.length - 1].time) : new Date(0);
    }},
    { field: 'intent', label: 'Intent Score', getValue: (lead) => lead.intent },
    { field: 'engagement', label: 'Engagement Score', getValue: (lead) => lead.engagement_score },
    { field: 'response_time', label: 'Response Time', getValue: (lead) => lead.response_time_avg },
    { field: 'name', label: 'Name (A-Z)', getValue: (lead) => `${lead.first_name} ${lead.last_name}`.toLowerCase() },
    { field: 'urgency', label: 'Urgency Level', getValue: (lead) => {
      const urgency = getResponseUrgency(lead);
      const urgencyOrder = { 'urgent-response': 4, 'needs-response': 3, 'needs-followup': 2, 'none': 1 };
      return urgencyOrder[urgency] || 0;
    }}
  ];

  // State for UI controls
  const [selectedLead, setSelectedLead] = useState(null);
  const [sortBy, setSortBy] = useState('recent');
  const [filterBy, setFilterBy] = useState('all');
  const [responseFilter, setResponseFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftResponse, setDraftResponse] = useState('');
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);
  
  // Add state for collapsible sections - default to all open
  const [activeSection, setActiveSection] = useState(['general', 'enrichment', 'engagement']);
  
  // Analytics state
  const [analyticsDateRange, setAnalyticsDateRange] = useState('30'); // days
  
  // New state for editable email fields
  const [editableToEmail, setEditableToEmail] = useState('');
  const [editableCcEmails, setEditableCcEmails] = useState('');
  
  // New state for rich text editor
  const [showFormatting, setShowFormatting] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [draftHtml, setDraftHtml] = useState('');
  
  // New state for advanced sort/filter popups
  const [showSortPopup, setShowSortPopup] = useState(false);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [activeSorts, setActiveSorts] = useState([{ field: 'last_reply', direction: 'desc' }]);
  const [activeFilters, setActiveFilters] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [showSentConfirm, setShowSentConfirm] = useState(false);

  // Available filter options
  const filterOptions = {
    response_status: {
      label: 'Response Status',
      options: [
        { value: 'all_leads', label: 'All Leads' },
        { value: 'recently_responded', label: 'Recently Responded To' },
        { value: 'needs_response', label: 'Needs Response' }
      ]
    },
    intent: {
      label: 'Intent Score',
      options: [
        { value: 'high', label: 'High Intent (7-10)' },
        { value: 'medium', label: 'Medium Intent (4-6)' },
        { value: 'low', label: 'Low Intent (1-3)' },
        { value: 'not-classified', label: 'Not Classified' }
      ]
    },
    urgency: {
      label: 'Urgency Status',
      options: [
        { value: 'urgent-response', label: '🚨 Urgent Response Needed' },
        { value: 'needs-response', label: '⚡ Needs Response' },
        { value: 'needs-followup', label: '📞 Needs Followup' },
        { value: 'none', label: 'No Action Needed' }
      ]
    },
    category: {
      label: 'Lead Category',
      options: [
        { value: '1', label: 'Interested' },
        { value: '2', label: 'Meeting Request' },
        { value: '3', label: 'Not Interested' },
        { value: '4', label: 'Do Not Contact' },
        { value: '5', label: 'Information Request' },
        { value: '6', label: 'Out Of Office' },
        { value: '7', label: 'Wrong Person' },
        { value: '8', label: 'Uncategorizable by AI' },
        { value: '9', label: 'Sender Originated Bounce' }
      ]
    },
    engagement: {
      label: 'Engagement Level',
      options: [
        { value: 'high', label: 'High Engagement (80%+)' },
        { value: 'medium', label: 'Medium Engagement (50-79%)' },
        { value: 'low', label: 'Low Engagement (0-49%)' }
      ]
    },
    replies: {
      label: 'Reply Status',
      options: [
        { value: 'has_replies', label: 'Has Replies' },
        { value: 'no_replies', label: 'No Replies Yet' },
        { value: 'multiple_replies', label: 'Multiple Replies (2+)' }
      ]
    },
    timeframe: {
      label: 'Last Activity',
      options: [
        { value: 'today', label: 'Today' },
        { value: 'yesterday', label: 'Yesterday' },
        { value: 'this_week', label: 'This Week' },
        { value: 'last_week', label: 'Last Week' },
        { value: 'this_month', label: 'This Month' },
        { value: 'older', label: 'Older than 1 Month' }
      ]
    }
  };

  // Handle adding sort
  const handleAddSort = (field, direction = 'desc') => {
    setActiveSorts(prev => {
      const existing = prev.find(s => s.field === field);
      if (existing) {
        return prev.map(s => s.field === field ? { ...s, direction } : s);
      }
      return [...prev, { field, direction }];
    });
  };

  // Handle removing sort
  const handleRemoveSort = (field) => {
    setActiveSorts(prev => prev.filter(s => s.field !== field));
    if (activeSorts.length === 1) {
      setActiveSorts([{ field: 'last_reply', direction: 'desc' }]); // Always have at least one sort
    }
  };

  // Handle adding filter with validation
  const handleAddFilter = (category, value) => {
    if (!category || !value || !filterOptions[category]) {
      console.warn('Invalid filter:', { category, value });
      return;
    }

    // Validate that the value exists in the options
    const isValidValue = filterOptions[category].options.some(opt => opt.value === value);
    if (!isValidValue) {
      console.warn('Invalid filter value:', { category, value });
      return;
    }

    setActiveFilters(prev => ({
      ...prev,
      [category]: [...new Set([...(prev[category] || []), value])]
    }));
  };

  // Handle removing filter with validation
  const handleRemoveFilter = (category, value) => {
    if (!category || !value || !activeFilters[category]) {
      console.warn('Invalid filter removal:', { category, value });
      return;
    }

    setActiveFilters(prev => {
      const updated = { ...prev };
      if (updated[category]) {
        updated[category] = updated[category].filter(v => v !== value);
        if (updated[category].length === 0) {
          delete updated[category];
        }
      }
      return updated;
    });
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setActiveFilters({});
    // Reset any related filter states
    setShowFilterPopup(false);
  };

  // Handle delete lead
  const handleDeleteLead = async (lead) => {
    try {
      console.log('Deleting lead:', lead);
      
      // Send all lead data to delete webhook
      const response = await fetch('https://reidsickels.app.n8n.cloud/webhook/bfffab96-188f-4a4a-9ae2-62aa9e0a02f4', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...lead,
          ...((() => {
            const leadApiKey = getApiKeyForLead(lead, apiKeys);
            return {
              esp_provider: leadApiKey?.esp.provider || '',
              esp_api_key: leadApiKey?.esp.key || '',
              account_name: leadApiKey?.name || '',
              account_id: leadApiKey?.id || '',
          fullenrich_api_key: apiKeys.fullenrich
            };
          })())
        })
      });

      console.log('Delete response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete webhook error:', errorText);
        throw new Error(`Failed to delete lead: ${response.status}`);
      }

      console.log('Lead deleted successfully');
      
      // Remove from local state immediately for better UX
      setLeads(prevLeads => prevLeads.filter(l => l.id !== lead.id));
      
      // If this was the selected lead, clear selection
      if (selectedLead?.id === lead.id) {
        setSelectedLead(null);
      }
      
      // Close confirmation popup
      setShowDeleteConfirm(false);
      setLeadToDelete(null);
      
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert(`Error deleting lead: ${error.message}`);
      setShowDeleteConfirm(false);
      setLeadToDelete(null);
    }
  };

  // Show delete confirmation
  const showDeleteConfirmation = (lead) => {
    setLeadToDelete(lead);
    setShowDeleteConfirm(true);
  };
  const availableStages = [
    'initial-outreach',
    'engaged', 
    'pricing-discussion',
    'samples-requested',
    'call-scheduled',
    'considering',
    'stalled',
    'no-response',
    'rejected',
    'active'
  ];

  // Update lead stage
  const updateLeadStage = (leadId, newStage) => {
    setLeads(prevLeads => 
      prevLeads.map(lead => 
        lead.id === leadId 
          ? { ...lead, stage: newStage }
          : lead
      )
    );
  };

  // Calculate dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const totalLeads = leads.length;
    const highIntentLeads = leads.filter(lead => lead.intent >= 7).length;
    const avgResponseTime = leads.reduce((sum, lead) => sum + lead.response_time_avg, 0) / totalLeads;
    const avgEngagement = leads.reduce((sum, lead) => sum + lead.engagement_score, 0) / totalLeads;
    
    const urgentResponse = leads.filter(lead => getResponseUrgency(lead) === 'urgent-response' && !isIntentNull(lead.intent)).length;
    const needsResponse = leads.filter(lead => getResponseUrgency(lead) === 'needs-response' && !isIntentNull(lead.intent)).length;
    const needsFollowup = leads.filter(lead => getResponseUrgency(lead) === 'needs-followup' && !isIntentNull(lead.intent)).length;

    return {
      totalLeads,
      highIntentLeads,
      avgResponseTime,
      avgEngagement,
      urgentResponse,
      needsResponse,
      needsFollowup
    };
  }, [leads]);

  // Message patterns for our outbound messages
  const MESSAGE_PATTERNS = {
    questions: ['?', 'what', 'how', 'when', 'where', 'why', 'could', 'would', 'interested', 'thoughts'],
    calls: ['call', 'meeting', 'schedule', 'discuss', 'chat', 'talk', 'meet', 'zoom', 'teams', 'connect'],
    pricing: ['price', 'cost', 'budget', 'investment', 'pricing', 'package', 'quote', 'plan', 'rate'],
    value_props: ['help', 'improve', 'increase', 'reduce', 'save', 'better', 'solution', 'roi', 'results', 'benefit']
  };

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    if (!leads.length) return null;

    // Filter leads by date range
    const daysBack = parseInt(analyticsDateRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    const filteredLeads = leads.filter(lead => {
      const leadDate = new Date(lead.created_at);
      return leadDate >= cutoffDate;
    });

    // Analyze message content and patterns
    const messageAnalysis = filteredLeads.flatMap(lead => 
      lead.conversation
        .filter(msg => msg.type === 'SENT')
        .map(msg => {
          const content = msg.content.toLowerCase();
          const wordCount = content.split(/\s+/).length;
          
          // Check for pattern matches in our outbound messages
          const hasQuestion = MESSAGE_PATTERNS.questions.some(q => content.includes(q));
          const hasCall = MESSAGE_PATTERNS.calls.some(c => content.includes(c));
          const hasPricing = MESSAGE_PATTERNS.pricing.some(p => content.includes(p));
          const hasValueProp = MESSAGE_PATTERNS.value_props.some(v => content.includes(v));
          
          // Get next message if exists
          const msgIndex = lead.conversation.indexOf(msg);
          const nextMsg = lead.conversation[msgIndex + 1];
          const gotReply = nextMsg && nextMsg.type === 'REPLY';
          const replyTime = gotReply ? new Date(nextMsg.time) - new Date(msg.time) : null;
          
          return {
            wordCount,
            hasQuestion,
            hasCall,
            hasPricing,
            hasValueProp,
            gotReply,
            replyTime
          };
        })
    );

    // Calculate what works
    const copyInsights = {
      // Message length analysis
      totalMessages: messageAnalysis.length,
      avgWordCount: messageAnalysis.reduce((sum, m) => sum + m.wordCount, 0) / messageAnalysis.length,
      
      // Pattern success rates
             withQuestions: {
         total: messageAnalysis.filter(m => m.hasQuestion).length,
         success: messageAnalysis.filter(m => m.hasQuestion && m.gotReply).length
       },
       withCalls: {
         total: messageAnalysis.filter(m => m.hasCall).length,
         success: messageAnalysis.filter(m => m.hasCall && m.gotReply).length
       },
       withPricing: {
         total: messageAnalysis.filter(m => m.hasPricing).length,
         success: messageAnalysis.filter(m => m.hasPricing && m.gotReply).length
       },
       withValueProps: {
         total: messageAnalysis.filter(m => m.hasValueProp).length,
         success: messageAnalysis.filter(m => m.hasValueProp && m.gotReply).length
       },
      
      // Length effectiveness
      lengthBreakdown: [
        {
          range: '< 50 words',
          messages: messageAnalysis.filter(m => m.wordCount < 50).length,
          replies: messageAnalysis.filter(m => m.wordCount < 50 && m.gotReply).length
        },
        {
          range: '50-100 words',
          messages: messageAnalysis.filter(m => m.wordCount >= 50 && m.wordCount < 100).length,
          replies: messageAnalysis.filter(m => m.wordCount >= 50 && m.wordCount < 100 && m.gotReply).length
        },
        {
          range: '100-200 words',
          messages: messageAnalysis.filter(m => m.wordCount >= 100 && m.wordCount < 200).length,
          replies: messageAnalysis.filter(m => m.wordCount >= 100 && m.wordCount < 200 && m.gotReply).length
        },
        {
          range: '200+ words',
          messages: messageAnalysis.filter(m => m.wordCount >= 200).length,
          replies: messageAnalysis.filter(m => m.wordCount >= 200 && m.gotReply).length
        }
      ],
      
      // Response time by pattern
      avgReplyTime: {
        withQuestion: messageAnalysis.filter(m => m.hasQuestion && m.replyTime).reduce((sum, m) => sum + m.replyTime, 0) / 
                     messageAnalysis.filter(m => m.hasQuestion && m.replyTime).length / (1000 * 60 * 60), // Convert to hours
        withCall: messageAnalysis.filter(m => m.hasCall && m.replyTime).reduce((sum, m) => sum + m.replyTime, 0) /
                 messageAnalysis.filter(m => m.hasCall && m.replyTime).length / (1000 * 60 * 60),
        withPricing: messageAnalysis.filter(m => m.hasPricing && m.replyTime).reduce((sum, m) => sum + m.replyTime, 0) /
                    messageAnalysis.filter(m => m.hasPricing && m.replyTime).length / (1000 * 60 * 60),
        withValueProp: messageAnalysis.filter(m => m.hasValueProp && m.replyTime).reduce((sum, m) => sum + m.replyTime, 0) /
                      messageAnalysis.filter(m => m.hasValueProp && m.replyTime).length / (1000 * 60 * 60)
      }
    };

    // Overall metrics (meaningful for response inbox)
    const totalLeads = filteredLeads.length;
    const leadsWithMultipleReplies = filteredLeads.filter(lead => 
      lead.conversation.filter(msg => msg.type === 'REPLY').length >= 2
    ).length;
    const engagementRate = totalLeads > 0 ? (leadsWithMultipleReplies / totalLeads * 100) : 0;
    
    // Average replies per lead (more meaningful than response rate)
    const totalReplies = filteredLeads.reduce((sum, lead) => 
      sum + lead.conversation.filter(msg => msg.type === 'REPLY').length, 0
    );
    const avgRepliesPerLead = totalLeads > 0 ? (totalReplies / totalLeads) : 0;

    // Response time analysis
    const responseTimesByLead = filteredLeads.map(lead => lead.response_time_avg).filter(time => time > 0);
    const avgResponseTime = responseTimesByLead.length > 0 
      ? responseTimesByLead.reduce((sum, time) => sum + time, 0) / responseTimesByLead.length 
      : 0;

    // Response time distribution
    const responseTimeDistribution = {
      under1h: responseTimesByLead.filter(time => time < 1).length,
      '1to4h': responseTimesByLead.filter(time => time >= 1 && time < 4).length,
      '4to24h': responseTimesByLead.filter(time => time >= 4 && time < 24).length,
      over24h: responseTimesByLead.filter(time => time >= 24).length
    };

    // Campaign performance (meaningful metrics for response inbox)
    const campaignPerformance = filteredLeads.reduce((acc, lead) => {
      const campaignId = lead.campaign_id || 'Unknown Campaign';
      if (!acc[campaignId]) {
        acc[campaignId] = {
          name: `Campaign ${campaignId}`,
          totalLeads: 0,
          totalReplies: 0,
          totalIntent: 0,
          totalEngagement: 0,
          responseTimes: [],
          conversationDepths: []
        };
      }
      
      acc[campaignId].totalLeads++;
      acc[campaignId].totalIntent += lead.intent;
      acc[campaignId].totalEngagement += lead.engagement_score;
      
      const replyCount = lead.conversation.filter(msg => msg.type === 'REPLY').length;
      acc[campaignId].totalReplies += replyCount;
      acc[campaignId].conversationDepths.push(lead.conversation.length);
      
      if (lead.response_time_avg > 0) {
        acc[campaignId].responseTimes.push(lead.response_time_avg);
      }
      
      return acc;
    }, {});

    // Calculate campaign averages and sort by engagement score
    const campaignStats = Object.values(campaignPerformance)
      .map(campaign => ({
        ...campaign,
        avgRepliesPerLead: campaign.totalLeads > 0 ? (campaign.totalReplies / campaign.totalLeads) : 0,
        avgIntent: campaign.totalLeads > 0 ? (campaign.totalIntent / campaign.totalLeads) : 0,
        avgEngagement: campaign.totalLeads > 0 ? (campaign.totalEngagement / campaign.totalLeads) : 0,
        avgResponseTime: campaign.responseTimes.length > 0 
          ? campaign.responseTimes.reduce((sum, time) => sum + time, 0) / campaign.responseTimes.length 
          : 0,
        avgConversationDepth: campaign.conversationDepths.length > 0
          ? campaign.conversationDepths.reduce((sum, depth) => sum + depth, 0) / campaign.conversationDepths.length
          : 0
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    // Lead category performance (meaningful metrics for response inbox)
    const categoryPerformance = filteredLeads.reduce((acc, lead) => {
      const category = lead.tags && lead.tags[0] ? lead.tags[0] : 'Uncategorized';
      if (!acc[category]) {
        acc[category] = { 
          totalLeads: 0, 
          totalReplies: 0, 
          totalEngagement: 0,
          responseTimes: [],
          conversationDepths: []
        };
      }
      
      acc[category].totalLeads++;
      acc[category].totalReplies += lead.conversation.filter(msg => msg.type === 'REPLY').length;
      acc[category].totalEngagement += lead.engagement_score;
      acc[category].conversationDepths.push(lead.conversation.length);
      
      if (lead.response_time_avg > 0) {
        acc[category].responseTimes.push(lead.response_time_avg);
      }
      
      return acc;
    }, {});

    const categoryStats = Object.entries(categoryPerformance)
      .map(([category, data]) => ({
        category,
        totalLeads: data.totalLeads,
        avgRepliesPerLead: data.totalLeads > 0 ? (data.totalReplies / data.totalLeads) : 0,
        avgEngagement: data.totalLeads > 0 ? (data.totalEngagement / data.totalLeads) : 0,
        avgResponseTime: data.responseTimes.length > 0
          ? data.responseTimes.reduce((sum, time) => sum + time, 0) / data.responseTimes.length
          : 0,
        avgConversationDepth: data.conversationDepths.length > 0
          ? data.conversationDepths.reduce((sum, depth) => sum + depth, 0) / data.conversationDepths.length
          : 0
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    // Intent vs Engagement correlation (more meaningful than response rate)
    const intentCorrelation = [
      { intent: 'High (7-10)', 
        avgReplies: filteredLeads.filter(l => l.intent >= 7).length > 0
          ? filteredLeads.filter(l => l.intent >= 7)
              .reduce((sum, l) => sum + l.conversation.filter(m => m.type === 'REPLY').length, 0) / 
            filteredLeads.filter(l => l.intent >= 7).length : 0,
        count: filteredLeads.filter(l => l.intent >= 7).length },
      { intent: 'Medium (4-6)', 
        avgReplies: filteredLeads.filter(l => l.intent >= 4 && l.intent < 7).length > 0
          ? filteredLeads.filter(l => l.intent >= 4 && l.intent < 7)
              .reduce((sum, l) => sum + l.conversation.filter(m => m.type === 'REPLY').length, 0) / 
            filteredLeads.filter(l => l.intent >= 4 && l.intent < 7).length : 0,
        count: filteredLeads.filter(l => l.intent >= 4 && l.intent < 7).length },
      { intent: 'Low (1-3)', 
        avgReplies: filteredLeads.filter(l => l.intent < 4).length > 0
          ? filteredLeads.filter(l => l.intent < 4)
              .reduce((sum, l) => sum + l.conversation.filter(m => m.type === 'REPLY').length, 0) / 
            filteredLeads.filter(l => l.intent < 4).length : 0,
        count: filteredLeads.filter(l => l.intent < 4).length }
    ];

    // Time/Day heatmap analysis
    const replyMessages = filteredLeads.flatMap(lead => 
      lead.conversation.filter(msg => msg.type === 'REPLY')
        .map(msg => ({
          ...msg,
          date: new Date(msg.time),
          hour: new Date(msg.time).getHours(),
          dayOfWeek: new Date(msg.time).getDay() // 0=Sunday, 1=Monday, etc
        }))
    );

    // Create heatmap data structure
    const heatmapData = Array.from({ length: 7 }, (_, day) => 
      Array.from({ length: 24 }, (_, hour) => ({
        day,
        hour,
        count: replyMessages.filter(msg => msg.dayOfWeek === day && msg.hour === hour).length,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]
      }))
    ).flat();

    // Peak activity times
    const maxCount = Math.max(...heatmapData.map(d => d.count));
    const peakHour = heatmapData.find(d => d.count === maxCount);

    // Response trends (daily) - showing engagement trends instead
    const last30Days = Array.from({ length: Math.min(daysBack, 30) }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    const responseTrends = last30Days.map(dateStr => {
      const dayReplies = replyMessages.filter(msg => 
        msg.time.split('T')[0] === dateStr
      );
      
      return {
        date: dateStr,
        replyCount: dayReplies.length,
        avgResponseTime: dayReplies.length > 0 
          ? dayReplies.reduce((sum, msg) => sum + (msg.response_time || 0), 0) / dayReplies.length 
          : 0
      };
    });

          return {
      totalLeads,
      leadsWithMultipleReplies,
      engagementRate,
      avgRepliesPerLead,
      avgResponseTime,
      responseTimeDistribution,
      campaignStats: campaignStats.slice(0, 10), // Top 10 campaigns
      categoryStats,
      intentCorrelation,
      responseTrends,
      heatmapData,
      peakHour,
      maxCount,
      totalReplies,
      dateRange: daysBack,
      copyInsights // Add copy insights to analytics data
    };
  }, [leads, analyticsDateRange]);

  // Get intent color and label (updated to use helper functions)
  const getIntentStyle = (intent) => {
    const label = getIntentLabel(intent);
    const badgeStyle = getIntentBadgeStyle(intent);
    
    return { 
      bg: badgeStyle.backgroundColor, 
      border: badgeStyle.border, 
      text: badgeStyle.color, 
      label: label 
    };
  };



  // Enhanced filter and sort leads
  const filteredAndSortedLeads = useMemo(() => {
    try {
      if (!leads || !Array.isArray(leads)) {
        return [];
      }
      
      // Debug: Count leads with null intent (using comprehensive null check)
      const nullIntentLeads = leads.filter(lead => isIntentNull(lead.intent));
      console.log('🔍 Debug: Total leads:', leads.length);
      console.log('🔍 Debug: Leads with null intent:', nullIntentLeads.length);
      if (nullIntentLeads.length > 0) {
        console.log('🔍 Debug: First few null intent leads:', nullIntentLeads.slice(0, 5).map(lead => ({ 
          email: lead.lead_email, 
          intent: lead.intent, 
          intentType: typeof lead.intent,
          intentValue: JSON.stringify(lead.intent)
        })));
      }
      
      let filtered = leads.slice(); // Create a copy

      // Apply intent filter
      if (intentFilter === 'positive') {
        // Show only leads with non-null intent (positive intent)
        filtered = filtered.filter(lead => !isIntentNull(lead.intent));
      } else if (intentFilter === 'negative') {
        // Show only leads with null intent (negative/no intent)
        filtered = filtered.filter(lead => isIntentNull(lead.intent));
      }
      // If intentFilter === 'all', show all leads (no additional filtering)

      // Apply search filter
      if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(lead => {
          try {
            if (!lead) return false;
            
            const firstName = (lead.first_name || '').toLowerCase();
            const lastName = (lead.last_name || '').toLowerCase();
            const email = (lead.email || '').toLowerCase();
            const subject = (lead.subject || '').toLowerCase();
            
            let tagsMatch = false;
            if (lead.tags && Array.isArray(lead.tags)) {
              tagsMatch = lead.tags.some(tag => {
                return tag && typeof tag === 'string' && tag.toLowerCase().includes(query);
              });
            }
            
            return firstName.includes(query) || 
                   lastName.includes(query) || 
                   email.includes(query) || 
                   subject.includes(query) || 
                   tagsMatch;
          } catch (e) {
            console.warn('Error in search filter:', e);
            return false;
          }
        });
      }

      // Apply advanced filters
      if (activeFilters && typeof activeFilters === 'object') {
        for (const [category, values] of Object.entries(activeFilters)) {
          if (!values || !Array.isArray(values) || values.length === 0) continue;
          
          filtered = filtered.filter(lead => {
            try {
              if (!lead) return false;
              
              return values.some(value => {
                if (!value) return false;
                
                switch (category) {
                  case 'response_status':
                    if (value === 'all_leads') return true; // Show all leads
                    if (value === 'recently_responded') {
                      // Show leads that have replied (need response from us)
                      try {
                        if (!lead.conversation || !Array.isArray(lead.conversation) || lead.conversation.length === 0) return false;
                        const lastMessage = lead.conversation[lead.conversation.length - 1];
                        return lastMessage && lastMessage.type === 'REPLY';
                      } catch (e) {
                        return false;
                      }
                    }
                    if (value === 'needs_response') {
                      // Show leads we sent to recently (within 24h)
                      try {
                        if (!lead.conversation || !Array.isArray(lead.conversation) || lead.conversation.length === 0) return false;
                        const lastMessage = lead.conversation[lead.conversation.length - 1];
                        if (!lastMessage || !lastMessage.time || lastMessage.type !== 'SENT') return false;
                        const timeSinceLastMessage = Math.floor((new Date() - new Date(lastMessage.time)) / (1000 * 60 * 60));
                        return timeSinceLastMessage <= 24;
                      } catch (e) {
                        return false;
                      }
                    }
                    return false;
                  
                  case 'intent':
                    if (value === 'not-classified') {
                      return isIntentNull(lead.intent);
                    }
                    if (isIntentNull(lead.intent)) return false;
                    const numIntent = parseInt(lead.intent);
                    if (value === 'high') return numIntent >= 7;
                    if (value === 'medium') return numIntent >= 4 && numIntent <= 6;
                    if (value === 'low') return numIntent <= 3;
                    return false;
                  
                  case 'urgency':
                    try {
                      const urgency = getResponseUrgency(lead);
                      return value === urgency;
                    } catch (e) {
                      console.warn('Error checking urgency:', e);
                      return false;
                    }
                  
                  case 'category':
                    return lead.lead_category && lead.lead_category.toString() === value;
                  
                  case 'engagement':
                    if (typeof lead.engagement_score !== 'number') return false;
                    if (value === 'high') return lead.engagement_score >= 80;
                    if (value === 'medium') return lead.engagement_score >= 50 && lead.engagement_score < 80;
                    if (value === 'low') return lead.engagement_score < 50;
                    return false;
                  
                  case 'replies':
                    try {
                      let replyCount = 0;
                      if (lead.conversation && Array.isArray(lead.conversation)) {
                        replyCount = lead.conversation.filter(m => m && m.type === 'REPLY').length;
                      }
                      if (value === 'has_replies') return replyCount > 0;
                      if (value === 'no_replies') return replyCount === 0;
                      if (value === 'multiple_replies') return replyCount >= 2;
                      return false;
                    } catch (e) {
                      console.warn('Error checking replies:', e);
                      return false;
                    }
                  
                  case 'timeframe':
                    try {
                      let lastActivity;
                      if (lead.conversation && Array.isArray(lead.conversation) && lead.conversation.length > 0) {
                        const lastMessage = lead.conversation[lead.conversation.length - 1];
                        lastActivity = lastMessage && lastMessage.time ? new Date(lastMessage.time) : new Date(lead.created_at || Date.now());
                      } else {
                        lastActivity = new Date(lead.created_at || Date.now());
                      }
                      
                      const daysDiff = (new Date() - lastActivity) / (1000 * 60 * 60 * 24);
                      
                      if (value === 'today') return daysDiff >= 0 && daysDiff < 1;
                      if (value === 'yesterday') return daysDiff >= 1 && daysDiff < 2;
                      if (value === 'this_week') return daysDiff <= 7;
                      if (value === 'last_week') return daysDiff > 7 && daysDiff <= 14;
                      if (value === 'this_month') return daysDiff <= 30;
                      if (value === 'older') return daysDiff > 30;
                      return false;
                    } catch (e) {
                      console.warn('Error checking timeframe:', e);
                      return false;
                    }
                  
                  default:
                    return false;
                }
              });
            } catch (e) {
              console.warn('Error in advanced filter:', e);
              return false;
            }
          });
        }
      }

      return filtered;
    } catch (e) {
      console.error('Error in filteredAndSortedLeads:', e);
      return leads || [];
    }
  }, [leads, searchQuery, activeFilters, intentFilter]);

  // Auto-populate email fields and restore drafts when lead is selected
  useEffect(() => {
    if (selectedLead) {
      // Add to recently viewed
      addToRecentlyViewed(selectedLead);
      
      // Restore draft if exists
      const savedDraft = drafts[selectedLead.id];
      if (savedDraft) {
        setDraftResponse(savedDraft.content);
        setDraftHtml(savedDraft.htmlContent || '');
        const editor = document.querySelector('[contenteditable]');
        if (editor) {
          const htmlContent = savedDraft.htmlContent || savedDraft.content.replace(/\n/g, '<br>');
          // Convert any links in the saved draft to interactive editor format
          const editorReadyHtml = convertLinksToEditorFormat(htmlContent);
          editor.innerHTML = editorReadyHtml;
        }
      } else {
        // Clear draft if no saved content
        setDraftResponse('');
        setDraftHtml('');
        const editor = document.querySelector('[contenteditable]');
        if (editor) {
          editor.innerHTML = '';
        }
      }
      
      if (selectedLead.conversation.length > 0) {
        const lastMessage = selectedLead.conversation[selectedLead.conversation.length - 1];
        
        // Dynamically detect our email addresses from SENT messages
        const getOurEmails = () => {
          const ourEmails = new Set();
          selectedLead.conversation.forEach(msg => {
            if (msg.type === 'SENT' && msg.from) {
              ourEmails.add(msg.from);
            }
          });
          return Array.from(ourEmails);
        };
        
        // Get all unique email participants from the conversation (excluding our emails)
        const getAllParticipants = () => {
          const participants = new Set();
          const ourEmails = getOurEmails();
          
          // Go through conversation to find all unique email addresses
          selectedLead.conversation.forEach(msg => {
            if (msg.from) participants.add(msg.from);
            if (msg.to) participants.add(msg.to);
            if (msg.cc && Array.isArray(msg.cc) && msg.cc.length > 0) {
              msg.cc.forEach(ccEntry => {
                if (ccEntry.address) participants.add(ccEntry.address);
              });
            }
          });
          
          // Remove our own emails dynamically
          ourEmails.forEach(email => participants.delete(email));
          
          return Array.from(participants);
        };
        
        // Determine recipients based on the last message
        let primaryRecipient = '';
        let ccRecipients = [];
        
        if (lastMessage.type === 'REPLY') {
          // If they replied, send back to the sender and CC everyone else who was involved
          primaryRecipient = lastMessage.from;
          
          // Get all other participants for CC (excluding the primary recipient)
          const allParticipants = getAllParticipants();
          ccRecipients = allParticipants.filter(email => email !== primaryRecipient);
        } else {
          // If we sent last, use the same recipients as the last sent message
          primaryRecipient = lastMessage.to || selectedLead.email;
          
          // Only add CC if the last message actually had CC recipients
          if (lastMessage.cc && Array.isArray(lastMessage.cc) && lastMessage.cc.length > 0) {
            ccRecipients = lastMessage.cc
              .map(cc => cc.address)
              .filter(email => email && email.trim() !== '');
          }
        }
        
        setEditableToEmail(primaryRecipient || selectedLead.email);
        setEditableCcEmails(ccRecipients.join(', '));
      } else {
        // Fallback to original lead email if no conversation
        setEditableToEmail(selectedLead.email);
        setEditableCcEmails('');
      }
    }
  }, [selectedLead]);
  const calculateEngagementScore = (conversation) => {
    const replies = conversation.filter(m => m.type === 'REPLY').length;
    const sent = conversation.filter(m => m.type === 'SENT').length;
    if (sent === 0) return 0;
    
    let score = 0;
    
    // Response rate (60 points max)
    score += Math.min((replies / sent) * 60, 60);
    
    // Response speed bonus (40 points max)
    const avgResponse = conversation
      .filter(m => m.response_time)
      .reduce((sum, m) => sum + m.response_time, 0) / Math.max(replies, 1);
    
    if (avgResponse < 1) score += 40;      // Under 1 hour = 40 points
    else if (avgResponse < 4) score += 30;  // Under 4 hours = 30 points  
    else if (avgResponse < 24) score += 20; // Under 1 day = 20 points
    else if (avgResponse < 72) score += 10; // Under 3 days = 10 points
    
    return Math.round(Math.min(score, 100));
  };

  // Check if lead needs reply (they replied last)
  const checkNeedsReply = (conversation) => {
    if (!conversation || conversation.length === 0) return false;
    const lastMessage = conversation[conversation.length - 1];
    return lastMessage && lastMessage.type === 'REPLY';
  };

  // Auto-generate tags based on conversation - DISABLED
  const generateAutoTags = (conversation, lead) => {
    // Only return the lead category tag
    return lead.tags || [];
  };

  // Detect conversation stage
  const detectConversationStage = (conversation) => {
    const allText = conversation.map(m => m.content.toLowerCase()).join(' ');
    const replies = conversation.filter(m => m.type === 'REPLY');
    const lastMessage = conversation[conversation.length - 1];
    const daysSinceLastMessage = (new Date() - new Date(lastMessage.time)) / (1000 * 60 * 60 * 24);
    
    // No replies yet
    if (replies.length === 0) {
      if (daysSinceLastMessage > 7) return 'no-response';
      return 'initial-outreach';
    }
    
    // Has replies - analyze content and timing
    if (allText.includes('not interested') || allText.includes('no thanks')) {
      return 'rejected';
    }
    
    if (allText.includes('price') || allText.includes('cost') || allText.includes('budget')) {
      return 'pricing-discussion';
    }
    
    if (allText.includes('sample') || allText.includes('example') || allText.includes('portfolio')) {
      return 'samples-requested';
    }
    
    if (allText.includes('call') || allText.includes('meeting') || allText.includes('schedule')) {
      return 'call-scheduled';
    }
    
    if (allText.includes('think about') || allText.includes('discuss with team') || allText.includes('get back')) {
      return 'considering';
    }
    
    // Check for stalled conversations
    if (daysSinceLastMessage > 7) {
      return 'stalled';
    }
    
    // Active conversation with positive engagement
    if (replies.length > 0 && (allText.includes('interested') || allText.includes('yes') || allText.includes('sure'))) {
      return 'engaged';
    }
    
    return 'active';
  };

  // Get stage styling
  const getStageStyle = (stage) => {
    const styles = {
      'initial-outreach': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Initial Outreach' },
      'engaged': { bg: 'bg-green-100', text: 'text-green-800', label: 'Engaged' },
      'pricing-discussion': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Pricing Discussion' },
      'samples-requested': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Samples Requested' },
      'call-scheduled': { bg: 'bg-cyan-100', text: 'text-cyan-800', label: 'Call Scheduled' },
      'considering': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Considering' },
      'stalled': { bg: 'bg-red-100', text: 'text-red-800', label: 'Stalled' },
      'no-response': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'No Response' },
      'rejected': { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
      'active': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Active' }
    };
    return styles[stage] || styles['active'];
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  // Rich text formatting functions - Generate clean semantic HTML
  const formatText = (command, value = null) => {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    
    if (!selectedText) return;
    
    let wrapper;
    switch (command) {
      case 'bold':
        wrapper = document.createElement('strong');
        break;
      case 'italic':
        wrapper = document.createElement('em');
        break;
      case 'underline':
        wrapper = document.createElement('u');
        break;
      default:
        // Fallback to execCommand for other commands
    document.execCommand(command, false, value);
        return;
    }
    
    if (wrapper) {
      wrapper.textContent = selectedText;
      range.deleteContents();
      range.insertNode(wrapper);
      
      // Clear selection and update content
      selection.removeAllRanges();
      const editor = document.querySelector('[contenteditable]');
      if (editor) {
        handleTextareaChange({ target: editor });
      }
    }
  };

  const insertLink = () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const editor = document.querySelector('[contenteditable]');

    // Create modal with clean styling
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: #1A1C1A;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 24px;
      width: 400px;
      max-width: 90vw;
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Insert Link';
    title.style.cssText = `
      color: white;
      font-weight: bold;
      margin: 0 0 20px 0;
      font-size: 16px;
    `;

    // Text input
    const textContainer = document.createElement('div');
    textContainer.style.marginBottom = '16px';
    
    const textLabel = document.createElement('label');
    textLabel.textContent = 'Text to display:';
    textLabel.style.cssText = `
      display: block;
      color: white;
      font-size: 12px;
      margin-bottom: 4px;
    `;

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = selectedText;
    textInput.placeholder = 'Link text';
    textInput.style.cssText = `
          width: 100%;
          padding: 8px 12px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          color: white;
      font-size: 14px;
      box-sizing: border-box;
      outline: none;
    `;

    // URL input
    const urlContainer = document.createElement('div');
    urlContainer.style.marginBottom = '24px';
    
    const urlLabel = document.createElement('label');
    urlLabel.textContent = 'URL:';
    urlLabel.style.cssText = textLabel.style.cssText;

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.placeholder = 'https://example.com';
    urlInput.style.cssText = textInput.style.cssText;

    // Error message
    const errorMessage = document.createElement('div');
    errorMessage.style.cssText = `
      color: #ff4444;
      font-size: 12px;
          margin-bottom: 16px;
      min-height: 16px;
    `;

    // Buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    `;

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
            padding: 8px 16px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.05);
            color: white;
            cursor: pointer;
      font-size: 14px;
    `;

    const insertButton = document.createElement('button');
    insertButton.textContent = 'Insert Link';
    insertButton.style.cssText = `
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            background: #54FCFF;
            color: #1A1C1A;
            cursor: pointer;
            font-weight: bold;
      font-size: 14px;
    `;

    // Assemble the modal
    textContainer.appendChild(textLabel);
    textContainer.appendChild(textInput);
    urlContainer.appendChild(urlLabel);
    urlContainer.appendChild(urlInput);
    buttonsContainer.appendChild(cancelButton);
    buttonsContainer.appendChild(insertButton);

    content.appendChild(title);
    content.appendChild(textContainer);
    content.appendChild(urlContainer);
    content.appendChild(errorMessage);
    content.appendChild(buttonsContainer);
    modal.appendChild(content);

    document.body.appendChild(modal);

    // Focus URL input if text is selected, otherwise focus text input
    setTimeout(() => {
      if (selectedText) {
    urlInput.focus();
      } else {
        textInput.focus();
      }
    }, 50);

    const validateAndInsert = () => {
      const text = textInput.value.trim();
      let url = urlInput.value.trim();

      // Validate inputs
      if (!text) {
        errorMessage.textContent = 'Please enter the text to display';
        return;
      }

      if (!url) {
        errorMessage.textContent = 'Please enter a URL';
        return;
      }

      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      // Validate URL format
      try {
        new URL(url);
      } catch (e) {
        errorMessage.textContent = 'Please enter a valid URL';
        return;
      }

      if (range && editor) {
        // Create link wrapper div to help with positioning the remove button
        const linkWrapper = document.createElement('span');
        linkWrapper.style.position = 'relative';
        linkWrapper.style.display = 'inline-block';
        
        // Create the link
        const link = document.createElement('a');
        link.href = url;
        link.textContent = text;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.cssText = `
          color: #0066cc;
          text-decoration: underline;
          cursor: pointer;
        `;
        
        // Create remove button (always visible)
        const removeBtn = document.createElement('span');
        removeBtn.textContent = '×';
        removeBtn.style.cssText = `
          position: absolute;
          top: -8px;
          right: -12px;
          background: #e0e0e0;
          color: #333;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          font-size: 12px;
          line-height: 16px;
          text-align: center;
          cursor: pointer;
          user-select: none;
          opacity: 0;
          transition: opacity 0.2s;
        `;
        
        // Show/hide remove button on hover
        linkWrapper.addEventListener('mouseenter', () => {
          removeBtn.style.opacity = '1';
          link.style.color = '#004499';
        });
        
        linkWrapper.addEventListener('mouseleave', () => {
          removeBtn.style.opacity = '0';
          link.style.color = '#0066cc';
        });
        
        // Handle remove button click
        removeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const text = document.createTextNode(link.textContent);
          linkWrapper.parentNode.replaceChild(text, linkWrapper);
          handleTextareaChange({ target: editor });
        });
        
        // Assemble the link component
        linkWrapper.appendChild(link);
        linkWrapper.appendChild(removeBtn);
        
        // Insert into document
        range.deleteContents();
        range.insertNode(linkWrapper);
        
        // Update editor content
        handleTextareaChange({ target: editor });
      }

      // Close modal
      document.body.removeChild(modal);
    };
    
    // Event Listeners
    cancelButton.addEventListener('click', () => document.body.removeChild(modal));
    insertButton.addEventListener('click', validateAndInsert);
    
    // Handle Enter key
    [textInput, urlInput].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          validateAndInsert();
        }
      });
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
      document.body.removeChild(modal);
      }
    });

    // Handle Escape key
    document.addEventListener('keydown', function escapeHandler(e) {
      if (e.key === 'Escape') {
        document.body.removeChild(modal);
        document.removeEventListener('keydown', escapeHandler);
      }
    });
  };

  const insertList = () => {
    document.execCommand('insertUnorderedList', false, null);
      
      // Update the draft content
    const editor = document.querySelector('[contenteditable]');
    if (editor) {
      handleTextareaChange({ target: editor });
    }
  };

  const handleTextareaChange = (e) => {
    // Clean up any remaining remove buttons that might be in the content
    const removeButtons = e.target.querySelectorAll('.remove-link');
    removeButtons.forEach(btn => btn.remove());
    
    // Get the raw HTML from the editor
    const rawHtml = e.target.innerHTML;
    
    // Create clean HTML for sending (remove editor UI elements)
    const cleanHtml = sanitizeHtml(cleanFormattingHtml(rawHtml));
    
    // Update content states
    const textContent = e.target.textContent || e.target.innerText;
    setDraftResponse(textContent);
    setDraftHtml(cleanHtml); // Store clean HTML for sending
    
    // Auto-save draft if we have a selected lead
    if (selectedLead) {
      saveDraft(selectedLead.id, textContent, cleanHtml);
    }
    
    // The editor keeps its current content with interactive elements
    // We don't modify e.target.innerHTML here to preserve editor functionality
  };

  const convertToHtml = (text) => {
    return text.replace(/\n/g, '<br>');
  };

  // Handle file attachment selection
  const handleFileAttachment = (event) => {
    const files = Array.from(event.target.files);
    const newAttachments = files.map(file => ({
      id: Date.now() + Math.random(), // Unique ID
      file: file,
      name: file.name,
      size: file.size,
      type: file.type
    }));
    
    setAttachedFiles(prev => [...prev, ...newAttachments]);
    // Clear the input so the same file can be selected again if needed
    event.target.value = '';
  };

  // Remove file attachment
  const removeAttachment = (attachmentId) => {
    setAttachedFiles(prev => prev.filter(file => file.id !== attachmentId));
  };

  // Format file size for display
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  const formatResponseTime = (hours) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  // Handle draft generation
  const generateDraft = async () => {
    if (!selectedLead) {
      console.error('No lead selected');
      return;
    }

    setIsGeneratingDraft(true);
    console.log('Generating draft for lead:', selectedLead);
    
    try {
      const lastMessage = selectedLead.conversation[selectedLead.conversation.length - 1];
      const urgency = getResponseUrgency(selectedLead);
      
      // Clean function to remove problematic characters
      const cleanString = (str) => {
        if (!str) return '';
        return str
          .replace(/\r\n/g, ' ')  // Replace Windows line breaks
          .replace(/\n/g, ' ')    // Replace Unix line breaks  
          .replace(/\r/g, ' ')    // Replace Mac line breaks
          .replace(/\t/g, ' ')    // Replace tabs
          .replace(/[\x00-\x1F\x7F-\x9F]/g, '')  // Remove other control characters
          .replace(/"/g, "'")     // Replace double quotes with single quotes
          .replace(/\s+/g, ' ')   // Replace multiple spaces with single space
          .trim();
      };

      // Debug: Log the full payload we're sending
      const payload = {
        id: selectedLead.id,
        email: cleanString(selectedLead.email),
        first_name: cleanString(selectedLead.first_name),
        last_name: cleanString(selectedLead.last_name),
        subject: cleanString(selectedLead.subject),
        intent: selectedLead.intent,
        engagement_score: selectedLead.engagement_score,
        urgency: urgency,
        last_message_type: lastMessage?.type || 'SENT',
        last_message_content: cleanString((lastMessage?.content || '').substring(0, 300)),
        reply_count: selectedLead.conversation.filter(msg => msg.type === 'REPLY').length,
        days_since_last_message: Math.floor((new Date() - new Date(lastMessage?.time || new Date())) / (1000 * 60 * 60 * 24)),
        website: cleanString(selectedLead.website || ''),
        content_brief: cleanString(selectedLead.content_brief || ''),
        conversation: selectedLead.conversation.map(msg => ({
          ...msg,
          content: cleanString(msg.content),
          from: cleanString(msg.from || ''),
          to: cleanString(msg.to || '')
        }))
      };

      // Debug: Log the full payload we're sending
      const fullPayload = {
        id: selectedLead.id,
        email: cleanString(selectedLead.email),
        first_name: cleanString(selectedLead.first_name),
        last_name: cleanString(selectedLead.last_name),
        subject: cleanString(selectedLead.subject),
        intent: selectedLead.intent,
        engagement_score: selectedLead.engagement_score,
        urgency: urgency,
        last_message_type: lastMessage?.type || 'SENT',
        last_message_content: cleanString((lastMessage?.content || '').substring(0, 300)),
        reply_count: selectedLead.conversation.filter(msg => msg.type === 'REPLY').length,
        days_since_last_message: Math.floor((new Date() - new Date(lastMessage?.time || new Date())) / (1000 * 60 * 60 * 24)),
        website: cleanString(selectedLead.website || ''),
        content_brief: cleanString(selectedLead.content_brief || ''),
        conversation: selectedLead.conversation.map(msg => ({
          ...msg,
          content: cleanString(msg.content),
          from: cleanString(msg.from || ''),
          to: cleanString(msg.to || '')
        })),
        email_message_body: selectedLead.email_message_body || ''
      };

      console.log('=== WEBHOOK DEBUG INFO ===');
      console.log('Payload being sent:', JSON.stringify(fullPayload, null, 2));
      console.log('Payload size (characters):', JSON.stringify(fullPayload).length);
      console.log('URL:', 'https://reidsickels.app.n8n.cloud/webhook/8021dcee-ebfd-4cd0-a424-49d7eeb5b66b');
      console.log('Request method: POST');
      console.log('Content-Type: application/json');

      const response = await fetch('https://reidsickels.app.n8n.cloud/webhook/draftmessage', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fullPayload)
      });
      
      console.log('=== RESPONSE DEBUG INFO ===');
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Get raw response text to see what we're actually getting
      const responseText = await response.text();
      console.log('Raw response text:', responseText);
      console.log('Response text length:', responseText.length);
      console.log('Response text type:', typeof responseText);
      
      if (!response.ok) {
        console.error('=== ERROR DETAILS ===');
        console.error('Status:', response.status);
        console.error('Status Text:', response.statusText);
        console.error('Response Body:', responseText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${responseText}`);
      }
      
      // Check if response is empty
      if (!responseText || responseText.trim() === '') {
        console.error('Empty response from webhook');
        throw new Error('Empty response from webhook');
      }
      
      // Try to parse JSON response
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Parsed response data:', data);
      } catch (e) {
        console.error('JSON parsing failed. Raw response:', responseText);
        console.error('JSON parse error:', e.message);
        throw new Error(`Invalid JSON response from webhook. Raw response: ${responseText}`);
      }
      
      // Handle both array and object response formats
      if (data.text) {
        // Clean the response text of any problematic characters
        const cleanResponseText = data.text
          .replace(/\\n/g, '\n')  // Convert literal \n to actual line breaks
          .replace(/\\r/g, '\r')  // Convert literal \r to actual line breaks
          .trim();

        // Update both the text state and HTML content
        setDraftResponse(cleanResponseText);
        const formattedHtml = convertToHtml(cleanResponseText);
        setDraftHtml(formattedHtml);

        // Update the contenteditable div
        const editor = document.querySelector('[contenteditable]');
        if (editor) {
          editor.innerHTML = formattedHtml;
        }

        console.log('Draft set successfully from object format');
      } else if (data && data.length > 0 && data[0].text) {
        const cleanResponseText = data[0].text
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .trim();

        // Update both the text state and HTML content
        setDraftResponse(cleanResponseText);
        const formattedHtml = convertToHtml(cleanResponseText);
        setDraftHtml(formattedHtml);

        // Update the contenteditable div
        const editor = document.querySelector('[contenteditable]');
        if (editor) {
          editor.innerHTML = formattedHtml;
        }

        console.log('Draft set successfully from array format');
      } else {
        console.error('No text found in response:', data);
        throw new Error('No text content in webhook response');
      }
    } catch (error) {
      console.error('=== FULL ERROR DETAILS ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Selected lead data:', selectedLead);
      
      // Simple fallback for debugging
      setDraftResponse(`Hi ${selectedLead.first_name},\n\nThank you for your message.\n\nBest regards`);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  // SECURE EMAIL PROVIDER INTEGRATIONS (API keys never leave device)
  
  // Smartlead direct integration (matches your exact API structure)
  const sendViaSmartlead = async (apiKey, lead, htmlContent, scheduledTime) => {
    console.log('📧 Sending via Smartlead directly...');
    console.log('🔑 API Key (first 10 chars):', apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING');
    console.log('🔑 API Key length:', apiKey ? apiKey.length : 0);
    console.log('🔑 API Key type:', typeof apiKey);
    console.log('📋 Campaign ID:', lead.campaign_id);
    console.log('📋 Email Stats ID:', lead.email_stats_id);
    
    // Validate required fields
    if (!apiKey || apiKey.trim() === '') throw new Error('Smartlead API key is missing or empty');
    if (!lead.campaign_id) throw new Error('Campaign ID is missing for Smartlead');
    if (!lead.email_stats_id) throw new Error('Email Stats ID is missing for Smartlead');
    
    // Use the exact API structure from your n8n workflow
    const url = `https://server.smartlead.ai/api/v1/campaigns/${lead.campaign_id}/reply-email-thread?api_key=${apiKey}`;
    console.log('🌐 Smartlead URL:', url.replace(apiKey, 'HIDDEN_API_KEY'));
    
    const bodyPayload = {
      email_stats_id: lead.email_stats_id,
      email_body: htmlContent.replace(/\n/g, '<br>'),
      reply_email_time: scheduledTime ? new Date(scheduledTime).toISOString() : undefined,
      reply_email_body: htmlContent.replace(/\n/g, '<br>'),
      to_email: lead.sl_lead_email || lead.email
    };

    console.log('🎯 Smartlead payload:', bodyPayload);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Smartlead API error response:', errorText);
      
      // Check for specific API key errors
      if (errorText.toLowerCase().includes('invalid') && errorText.toLowerCase().includes('api')) {
        throw new Error(`Invalid Smartlead API key. Please check your API key in settings. (${response.status})`);
      } else if (errorText.toLowerCase().includes('unauthorized')) {
        throw new Error(`Unauthorized Smartlead API key. Please verify your API key. (${response.status})`);
      }
      
      throw new Error(`Smartlead API error: ${response.status} - ${errorText}`);
    }

    // Handle Smartlead response (can be JSON or plain text)
    const responseText = await response.text();
    console.log('📝 Raw Smartlead response:', responseText);
    
    // Smartlead often returns plain text success messages
    if (responseText.includes('Email added to the queue') || responseText.includes('sent out soon')) {
      console.log('✅ Smartlead success (plain text response)');
      return { success: true, message: responseText, provider: 'smartlead' };
    }
    
    // Try to parse as JSON if it doesn't look like a success message
    try {
      const result = JSON.parse(responseText);
      console.log('✅ Smartlead response (JSON):', result);
      return result;
    } catch (parseError) {
      // If it's not JSON and not a known success message, it might be an error
      console.warn('⚠️ Smartlead response is neither JSON nor known success message:', responseText);
      return { success: true, message: responseText, provider: 'smartlead' };
    }
  };

  // Email Bison direct integration
  const sendViaEmailBison = async (apiKey, lead, htmlContent, scheduledTime) => {
    console.log('📧 Sending via Email Bison directly...');
    console.log('🔑 API Key (first 10 chars):', apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING');
    console.log('📧 To Email:', lead.sl_lead_email);
    console.log('📧 From Email:', lead.from_email);
    
    // Validate required fields
    if (!apiKey || apiKey.trim() === '') throw new Error('Email Bison API key is missing or empty');
    if (!lead.sl_lead_email) throw new Error('To email is missing for Email Bison');
    if (!lead.from_email) throw new Error('From email is missing for Email Bison');
    
    const payload = {
      api_key: apiKey,
      to: lead.sl_lead_email,
      to_name: lead.to_name || lead.first_name,
      from: lead.from_email,
      subject: lead.subject,
      html: htmlContent,
      scheduled_time: scheduledTime ? new Date(scheduledTime).toISOString() : null
    };

    const response = await fetch('https://api.emailbison.com/v1/send', {
        method: 'POST',
        headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Email Bison API error response:', errorText);
      
      // Check for specific API key errors
      if (errorText.toLowerCase().includes('invalid') && errorText.toLowerCase().includes('api')) {
        throw new Error(`Invalid Email Bison API key. Please check your API key in settings. (${response.status})`);
      } else if (errorText.toLowerCase().includes('unauthorized')) {
        throw new Error(`Unauthorized Email Bison API key. Please verify your API key. (${response.status})`);
      }
      
      throw new Error(`Email Bison API error: ${response.status} - ${errorText}`);
    }

    // Handle Email Bison response (can be JSON or plain text)
    const responseText = await response.text();
    console.log('📝 Raw Email Bison response:', responseText);
    
    // Try to parse as JSON first
    try {
      const result = JSON.parse(responseText);
      console.log('✅ Email Bison response (JSON):', result);
      return result;
    } catch (parseError) {
      // If not JSON, treat as plain text success if it looks positive
      if (responseText.includes('success') || responseText.includes('sent') || responseText.includes('queued')) {
        console.log('✅ Email Bison success (plain text response)');
        return { success: true, message: responseText, provider: 'email_bison' };
      }
      
      console.warn('⚠️ Email Bison response is neither JSON nor obvious success:', responseText);
      return { success: true, message: responseText, provider: 'email_bison' };
    }
  };

  // Instantly direct integration
  const sendViaInstantly = async (apiKey, lead, htmlContent, scheduledTime) => {
    console.log('📧 Sending via Instantly directly...');
    console.log('🔑 API Key (first 10 chars):', apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING');
    console.log('📧 To Email:', lead.sl_lead_email);
    console.log('📧 From Email:', lead.from_email);
    
    // Validate required fields
    if (!apiKey || apiKey.trim() === '') throw new Error('Instantly API key is missing or empty');
    if (!lead.sl_lead_email) throw new Error('To email is missing for Instantly');
    if (!lead.from_email) throw new Error('From email is missing for Instantly');
    
    const payload = {
      api_key: apiKey,
      to_email: lead.sl_lead_email,
      to_name: lead.to_name || lead.first_name,
      from_email: lead.from_email,
      subject: lead.subject,
      body_html: htmlContent,
      send_time: scheduledTime ? new Date(scheduledTime).toISOString() : null
    };

    const response = await fetch('https://api.instantly.ai/api/v1/send/email', {
        method: 'POST',
        headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
        },
      body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Instantly API error response:', errorText);
        
        // Check for specific API key errors
        if (errorText.toLowerCase().includes('invalid') && errorText.toLowerCase().includes('api')) {
          throw new Error(`Invalid Instantly API key. Please check your API key in settings. (${response.status})`);
        } else if (errorText.toLowerCase().includes('unauthorized')) {
          throw new Error(`Unauthorized Instantly API key. Please verify your API key. (${response.status})`);
        }
        
        throw new Error(`Instantly API error: ${response.status} - ${errorText}`);
      }

      // Handle Instantly response (can be JSON or plain text)
      const responseText = await response.text();
      console.log('📝 Raw Instantly response:', responseText);
      
      // Try to parse as JSON first
      try {
        const result = JSON.parse(responseText);
        console.log('✅ Instantly response (JSON):', result);
        return result;
      } catch (parseError) {
        // If not JSON, treat as plain text success if it looks positive
        if (responseText.includes('success') || responseText.includes('sent') || responseText.includes('queued')) {
          console.log('✅ Instantly success (plain text response)');
          return { success: true, message: responseText, provider: 'instantly' };
        }
        
        console.warn('⚠️ Instantly response is neither JSON nor obvious success:', responseText);
        return { success: true, message: responseText, provider: 'instantly' };
      }
  };

  // Update conversation in Supabase after successful send (no API keys sent)
  const updateConversationInSupabase = async (leadId, messageData, emailResult) => {
    console.log('💾 Updating conversation and lead status in Supabase...');
    
    try {
      // Get current lead data
      const { data: currentLead, error: fetchError } = await supabase
        .from('retention_harbor')
        .select('email_message_body')
        .eq('id', leadId)
        .single();

      if (fetchError) throw fetchError;

      // Parse existing conversation
      let conversation = [];
      if (currentLead.email_message_body) {
        try {
          conversation = JSON.parse(currentLead.email_message_body);
        } catch (err) {
          console.warn('Failed to parse existing conversation:', err);
        }
      }

      // Add new sent message to conversation (match existing message structure)
      const newMessage = {
        from: 'user',
        to: currentLead.sl_lead_email || currentLead.email || 'N/A',
        cc: null,
        type: 'SENT',
        time: messageData.sent_at,
        content: extractTextFromHTML(messageData.message), // Extract plain text for display
        email_body: messageData.message, // Store original HTML like existing messages
        subject: currentLead.subject || '',
        opened: false,
        clicked: false,
        response_time: undefined,
        // Additional metadata for our sent messages
        id: crypto.randomUUID(),
        scheduled_time: messageData.scheduled_time,
        esp_provider: messageData.esp_provider,
        account_name: messageData.account_name,
        message_id: emailResult?.message_id || emailResult?.id || null,
        smartlead_response: emailResult // Store full response for reference
      };

      conversation.push(newMessage);

      // Update the lead record with new conversation and metadata
      const { error: updateError } = await supabase
        .from('retention_harbor')
        .update({
          email_message_body: JSON.stringify(conversation),
          // Update status to show it's been responded to
          status: 'replied'
        })
        .eq('id', leadId);

      if (updateError) throw updateError;

      console.log('✅ Conversation and lead status updated in Supabase');
      console.log('📊 Updated fields:', {
        email_message_body: 'JSON conversation array',
        status: 'replied',
        conversation_length: conversation.length,
        latest_message_time: messageData.sent_at,
        message_id: newMessage.message_id
      });
      
      return true;
    } catch (error) {
      console.error('❌ Failed to update conversation:', error);
      throw error;
    }
  };

  // SECURE: Send message directly from frontend (API keys never leave device)
  const sendMessage = async () => {
    const textContent = document.querySelector('[contenteditable]')?.textContent || draftResponse;
    const rawHtmlContent = document.querySelector('[contenteditable]')?.innerHTML || convertToHtml(draftResponse);
    
    console.log('🔐 SECURE SEND: API keys will never leave this device');
    console.log('📧 Processing message for secure direct send...');
    
    const htmlContent = sanitizeHtml(cleanFormattingHtml(rawHtmlContent));
    
    if (!textContent.trim()) return;
    
    setIsSending(true);
    try {
      // Get the appropriate API key for this lead
      const leadApiKey = getApiKeyForLead(selectedLead, apiKeys);
      
      console.log('🔍 API Key Debug Info:');
      console.log('- Available accounts:', apiKeys.accounts.length);
              console.log('- Selected lead email_account_id:', selectedLead.email_account_id);
      console.log('- Matched account:', leadApiKey);
      console.log('- ESP provider:', leadApiKey?.esp?.provider);
      console.log('- Has API key:', !!leadApiKey?.esp?.key);
      console.log('- API key length:', leadApiKey?.esp?.key?.length || 0);
      
      if (!leadApiKey || !leadApiKey.esp.key) {
        throw new Error('No API key available for sending messages. Please check your API settings.');
      }

      console.log(`🎯 Using ${leadApiKey.esp.provider} provider (Account: ${leadApiKey.name})`);

             // Prepare lead data for sending (with required API fields)
       const leadForSending = {
         ...selectedLead,
         sl_lead_email: editableToEmail.trim(), // Use editable email
         to_name: selectedLead.to_name || selectedLead.first_name,
         email: editableToEmail.trim() // Fallback email field
       };

       console.log('📋 Lead data for API call:', {
         campaign_id: leadForSending.campaign_id,
         email_stats_id: leadForSending.email_stats_id,
         to_email: leadForSending.sl_lead_email,
         provider: leadApiKey.esp.provider
       });

      // Send email directly based on ESP provider (API key stays local)
      let emailResult;
      console.log('🚀 Sending directly via ESP API...');
      switch (leadApiKey.esp.provider) {
        case 'smartlead':
          emailResult = await sendViaSmartlead(leadApiKey.esp.key, leadForSending, htmlContent, scheduledTime);
          break;
        case 'email_bison':
          emailResult = await sendViaEmailBison(leadApiKey.esp.key, leadForSending, htmlContent, scheduledTime);
          break;
        case 'instantly':
          emailResult = await sendViaInstantly(leadApiKey.esp.key, leadForSending, htmlContent, scheduledTime);
          break;
        default:
          throw new Error(`Unsupported ESP provider: ${leadApiKey.esp.provider}`);
      }

      console.log('✅ Email sent successfully via', leadApiKey.esp.provider, 'direct API');
      console.log('🔐 SECURE: API key never left your device');

             // Update Supabase with the sent message (NO API KEYS in this request)
       await updateConversationInSupabase(selectedLead.id, {
         message: htmlContent,
         sent_at: new Date().toISOString(),
         scheduled_time: scheduledTime ? scheduledTime.toISOString() : null,
         esp_provider: leadApiKey.esp.provider,
         account_name: leadApiKey.name
       }, emailResult);

      console.log('💾 Conversation updated in database (securely)');

      // Show success modal
      setShowSentConfirm(true);
      
      // Clear draft and editor
      setDraftResponse('');
      setDraftHtml('');
      const editor = document.querySelector('[contenteditable]');
      if (editor) {
        editor.innerHTML = '';
        // Remove any cursor artifacts or focus
        editor.blur();
        // Clear any selections
        if (window.getSelection) {
          window.getSelection().removeAllRanges();
        }
      }
      
      // Clear attachments
      setAttachedFiles([]);
      
      // Clear scheduling
      setScheduledTime(null);
      setShowScheduler(false);
      
      // Refresh leads to get updated conversation
      await fetchLeads();
      
      console.log('🎯 SECURE SEND COMPLETE: No API keys were transmitted over network');
      
    } catch (error) {
      console.error('❌ Secure send failed:', error);
      
      // Show user-friendly error message
      let userMessage = 'Failed to send message. ';
      if (error.message.includes('API key') && error.message.includes('missing')) {
        userMessage += 'No API key available for sending messages. Please add API keys in the settings and try again.';
      } else if (error.message.includes('Invalid') && error.message.includes('API key')) {
        userMessage += 'Invalid API key. Please check your API keys in the settings and make sure they are correct.';
      } else if (error.message.includes('missing')) {
        userMessage += 'Required information is missing. Please check the lead data and try again.';
      } else if (error.message.includes('Campaign ID') || error.message.includes('Email Stats ID')) {
        userMessage += 'This lead is missing required Smartlead information. Please check the lead data.';
      } else {
        userMessage += error.message;
      }
      
      alert(userMessage);
    } finally {
      setIsSending(false);
    }
  };

  // Add enrichment function
  const enrichLeadData = async (lead) => {
    setEnrichingLeads(prev => new Set([...prev, lead.id]));
    try {
      const response = await fetch('https://reidsickels.app.n8n.cloud/webhook/9894a38a-ac26-46b8-89a2-ef2e80e83504', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...lead,
          ...((() => {
            const leadApiKey = getApiKeyForLead(lead, apiKeys);
            return {
              esp_provider: leadApiKey?.esp.provider || '',
              esp_api_key: leadApiKey?.esp.key || '',
              account_name: leadApiKey?.name || '',
              account_id: leadApiKey?.id || '',
          fullenrich_api_key: apiKeys.fullenrich
            };
          })())
        })
      });

      if (!response.ok) {
        throw new Error('Failed to enrich lead data');
      }

      const enrichedData = await response.json();
      console.log('Raw webhook response:', enrichedData);

      // Create a new lead object with the enriched data
      const updatedLead = {
        ...lead,
        role: enrichedData.Role || null,
        company_data: enrichedData["Company Summary"] || null,
        personal_linkedin_url: enrichedData["Personal LinkedIn"] || null,
        business_linkedin_url: enrichedData["Business LinkedIn"] || null,
        last_name: enrichedData["Last Name"] || lead.last_name || ''
      };

      // Update the leads array
      setLeads(prevLeads => prevLeads.map(l => 
        l.id === lead.id ? updatedLead : l
      ));

      // If this is the selected lead, update it with a new object reference
      if (selectedLead?.id === lead.id) {
        setSelectedLead(updatedLead);
      }

      // Show success/not found toast with lead name
      const leadName = `${lead.first_name} ${lead.last_name}`.trim();
      if (enrichedData.Role || enrichedData["Company Summary"] || enrichedData["Personal LinkedIn"] || enrichedData["Business LinkedIn"]) {
        showToast(`Data enriched for ${leadName}`, 'success', lead.id);
      } else {
        showToast(`No additional data found for ${leadName}`, 'error', lead.id);
      }

    } catch (error) {
      console.error('Error enriching lead:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      const leadName = `${lead.first_name} ${lead.last_name}`.trim();
      showToast(`Error enriching data for ${leadName}`, 'error', lead.id);
    } finally {
      setEnrichingLeads(prev => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center" style={{backgroundColor: '#1A1C1A'}}>
        <div className="text-center p-8 rounded-2xl shadow-xl mb-6" style={{backgroundColor: 'rgba(26, 28, 26, 0.8)', border: '1px solid white'}}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{borderColor: '#54FCFF'}}></div>
          <p className="text-white">Loading leads...</p>
        </div>
        {/* Show user info and sign out button while loading */}
        {user && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-white text-sm">Logged in as <span className="font-semibold">{user.email}</span></div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-red-500/10 flex items-center gap-2"
                style={{color: '#ef4444', border: '1px solid #ef4444'}}>
                Sign Out
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center" style={{backgroundColor: '#1A1C1A'}}>
        <div className="text-center">
          <p className="text-red-400 mb-6 font-medium">Error loading leads: {error}</p>
          <button 
            onClick={fetchLeads}
            className="px-4 py-2 text-white rounded-lg hover:opacity-80 transition-colors"
            style={{backgroundColor: '#54FCFF', color: '#1A1C1A', border: '1px solid white'}}>
            Retry
          </button>
        </div>
        {user && (
          <div className="flex flex-col items-center gap-2 mt-6">
            <div className="text-white text-sm">Logged in as <span className="font-semibold">{user.email}</span></div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-red-500/10 flex items-center gap-2"
                style={{color: '#ef4444', border: '1px solid #ef4444'}}>
                Sign Out
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // If brandId is '1', show subscribe overlay and blur the rest of the UI
  if (brandId === '1') {
    return (
      <div className="relative h-screen flex flex-col items-center justify-center" style={{backgroundColor: '#1A1C1A'}}>
        {/* Blurred background */}
        <div className="absolute inset-0 backdrop-blur-sm z-0" />
        {/* Main content blurred */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full w-full">
          <div className="bg-white/90 dark:bg-gray-900/90 p-10 rounded-2xl shadow-2xl border-2 border-blue-400 flex flex-col items-center max-w-lg mx-auto">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Subscribe to unlock the inbox</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">Your account is not yet associated with a brand. Please subscribe or contact Navvii support to unlock your inbox.</p>
            <div className="text-gray-500 dark:text-gray-400 text-sm">No leads are currently associated with your account.</div>
          </div>
        </div>
        {/* User info and sign out button */}
        {user && (
          <div className="absolute top-6 right-6 flex flex-col items-end gap-2 z-20">
            <div className="text-white text-sm">Logged in as <span className="font-semibold">{user.email}</span></div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-red-500/10 flex items-center gap-2"
                style={{color: '#ef4444', border: '1px solid #ef4444'}}>
                Sign Out
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Function to handle API key updates (updated for multiple accounts)
  const handleApiKeyChange = (key, value) => {
    if (key === 'fullenrich') {
      // For fullenrich, direct update (shared across all accounts)
      setApiKeys(prev => ({
          ...prev,
        fullenrich: value
      }));
    }
    // For account-specific changes, use updateAccount function
  };







  // Function to add a new email account
  const addEmailAccount = () => {
    const newAccount = {
      // Don't set id - database will auto-assign integer ID
      account_id: crypto.randomUUID(), // UUID for webhook routing
      name: `Account ${apiKeys.accounts.length + 1}`,
      esp: {
        provider: '',
        key: ''
      },
      is_primary: apiKeys.accounts.length === 0 // First account is primary
    };

    setApiKeys(prev => ({
        ...prev,
      accounts: [...prev.accounts, newAccount]
    }));
  };

    // CASCADE DELETE: Remove account and all associated leads
  const removeEmailAccount = async (accountId) => {
    console.log('🗑️ Removing account and all associated leads:', accountId);
    console.log('🔍 Account ID type:', typeof accountId);
    console.log('🔍 Account ID value:', accountId);
    console.log('🔍 Available accounts:', apiKeys.accounts.map(acc => ({ id: acc.id, name: acc.name })));
    
    // Get confirmation with context about whether this is the last account
    const isLastAccount = apiKeys.accounts.length === 1;
    const confirmMessage = isLastAccount 
      ? `This will delete your LAST API account and ALL associated leads. You'll need to add a new account after this. This cannot be undone. Continue?`
      : `This will delete the API account AND all associated leads. This cannot be undone. Continue?`;
      
    if (!confirm(confirmMessage)) {
      return;
    }
    
    setIsSavingApi(true);
    try {
      if (brandId && user) {
        console.log('🗑️ Deleting account (CASCADE will handle associated leads):', accountId);
        
        // Find the account to validate it exists
        const accountToDelete = apiKeys.accounts.find(acc => acc.id == accountId);
        console.log('🔍 Found account to delete:', accountToDelete);
        
        if (!accountToDelete) {
          console.error('❌ Account not found. Available accounts:', apiKeys.accounts);
          throw new Error('Account not found');
        }
        
        // Validate accountId before deletion
        const accountIdInt = parseInt(accountId);
        if (isNaN(accountIdInt) || accountIdInt <= 0) {
          throw new Error(`Invalid account ID: "${accountId}". Account may not be saved yet. Please save API keys first, then try deleting.`);
        }
        
        console.log('🗑️ Deleting API account (let CASCADE handle leads):', accountIdInt);
        
        // First, check how many leads will be affected
        const { data: existingLeads, error: countError } = await supabase
          .from('retention_harbor')
          .select('id, lead_email, email_account_id')
          .eq('email_account_id', accountToDelete.account_id)
          .eq('brand_id', brandId);
          
        if (!countError && existingLeads) {
          console.log(`🔍 CASCADE will delete ${existingLeads.length} leads:`, existingLeads.slice(0, 3).map(lead => ({ id: lead.id, email: lead.lead_email })));
        }
        
        // Delete the API account - CASCADE will automatically delete associated leads
        const { error: accountDeleteError } = await supabase
          .from('api_settings')
          .delete()
          .eq('id', accountIdInt)
          .eq('brand_id', String(brandId));
          
        if (accountDeleteError) {
          console.error('❌ Failed to delete account:', accountDeleteError);
          console.error('🔍 Account deletion attempted with:', { id: accountIdInt, brand_id: String(brandId) });
          throw new Error('Failed to delete API account: ' + accountDeleteError.message);
        }
        
        console.log('✅ Account deleted - CASCADE automatically removed associated leads');
      }
      
      // STEP 3: Update local state
      const updatedAccounts = apiKeys.accounts.filter(acc => acc.id !== accountId);
      
      // Make first account primary if needed
      if (updatedAccounts.length > 0 && !updatedAccounts.some(acc => acc.is_primary)) {
        updatedAccounts[0].is_primary = true;
      }
      
      const newApiKeys = { ...apiKeys, accounts: updatedAccounts };
      setApiKeys(newApiKeys);
      
      // Update localStorage
      localStorage.setItem('apiKeys_backup', JSON.stringify(newApiKeys));
      
      // STEP 4: Refresh leads to show the deletions
      await fetchLeads();
      
      console.log('✅ Account and associated leads removed successfully');
      
      // Show success message
      setApiToastMessage({
        type: 'success',
        message: 'Account and associated leads deleted successfully'
      });
      setShowApiToast(true);
      setTimeout(() => setShowApiToast(false), 3000);
      
    } catch (error) {
      console.error('❌ Failed to delete account:', error);
      
      // Provide more user-friendly error messages
      let userMessage = error.message;
      if (error.message.includes('foreign key constraint')) {
        userMessage = 'Cannot delete account: Some leads or data are still referencing this account. Check console for details.';
      } else if (error.message.includes('Account not found')) {
        userMessage = 'Account not found. It may have already been deleted or not saved properly.';
      } else if (error.message.includes('Failed to delete all leads')) {
        userMessage = 'Could not delete all associated leads. Some leads may still reference this account.';
      }
      
      setApiToastMessage({
        type: 'error',
        message: 'Failed to delete account: ' + userMessage
      });
      setShowApiToast(true);
      setTimeout(() => setShowApiToast(false), 5000);
    } finally {
      setIsSavingApi(false);
    }
  };

  // Function to update an account
  const updateAccount = (accountId, updates) => {
    console.log(`📝 Updating account ${accountId}:`, updates);
    setApiKeys(prev => ({
      ...prev,
      accounts: prev.accounts.map(acc => 
        acc.id === accountId ? { ...acc, ...updates } : acc
      )
    }));
    
    // Show reminder to save if they're updating API keys
    if (updates.esp && updates.esp.key) {
      console.log(`⚠️ Remember to click "Save API Keys" to persist changes to database`);
    }
  };

  // Function to set primary account
  const setPrimaryAccount = (accountId) => {
    setApiKeys(prev => ({
      ...prev,
      accounts: prev.accounts.map(acc => ({
        ...acc,
        is_primary: acc.id === accountId
      }))
    }));
  };

  // ===== LEAD BACKFILL FUNCTIONALITY =====
  
  // Fetch all campaigns from Smartlead
  const fetchSmartleadCampaigns = async (apiKey) => {
    const response = await fetch(`https://server.smartlead.ai/api/v1/campaigns/?api_key=${apiKey}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch campaigns: ${response.status}`);
    }
    return await response.json();
  };

  // Fetch leads for a campaign from all categories (1-8)
  const fetchLeadsForCampaign = async (apiKey, campaignId) => {
    const categories = [1, 2, 3, 4, 5, 6, 7, 8];
    const leadPromises = categories.map(async (categoryId) => {
      try {
        const response = await fetch(`https://server.smartlead.ai/api/v1/campaigns/${campaignId}/leads?api_key=${apiKey}&lead_category_id=${categoryId}`);
        if (!response.ok) {
          console.warn(`Failed to fetch leads for campaign ${campaignId}, category ${categoryId}: ${response.status}`);
          return { data: [] };
        }
        return await response.json();
      } catch (error) {
        console.warn(`Error fetching leads for campaign ${campaignId}, category ${categoryId}:`, error);
        return { data: [] };
      }
    });

    const results = await Promise.all(leadPromises);
    
    // Merge all leads from different categories
    const allLeads = [];
    results.forEach((result, index) => {
      if (result.data && Array.isArray(result.data)) {
        result.data.forEach(lead => {
          allLeads.push({
            ...lead,
            lead_category_id: categories[index],
            campaign_id: campaignId
          });
        });
      }
    });

    return allLeads;
  };

  // Fetch message history for a specific lead
  const fetchMessageHistory = async (apiKey, campaignId, leadId) => {
    try {
      const response = await fetch(`https://server.smartlead.ai/api/v1/campaigns/${campaignId}/leads/${leadId}/message-history?api_key=${apiKey}`);
      if (!response.ok) {
        console.warn(`Failed to fetch message history for lead ${leadId}: ${response.status}`);
        return { history: [] };
      }
      return await response.json();
    } catch (error) {
      console.warn(`Error fetching message history for lead ${leadId}:`, error);
      return { history: [] };
    }
  };

  // Parse conversation history into lightweight format for AI analysis
  const parseConversationForIntent = (chatHistory) => {
    // Parse the conversation JSON from the history field
    let conversation = [];
    try {
      // If history is already parsed, use it directly, otherwise parse it
      conversation = typeof chatHistory === 'string' ? JSON.parse(chatHistory) : chatHistory;
    } catch (e) {
      console.log('Failed to parse chat history:', e);
      return null;
    }

    // Extract only essential data for intent scoring
    const conversationSummary = conversation.map(msg => {
      // Clean the HTML email body
      const cleanContent = (msg.email_body || '')
        .replace(/<[^>]*>/g, ' ')           // Remove HTML tags
        .replace(/\s+/g, ' ')              // Normalize whitespace
        .replace(/\r\n/g, '\n')            // Fix line breaks
        .trim()                            // Remove leading/trailing space
        .substring(0, 400);                // Limit to 400 chars per message
     
      return {
        type: msg.type,                    // SENT or REPLY
        time: msg.time,                    // Timestamp
        from: msg.from,                    // Sender email
        content: cleanContent,             // Cleaned content
        subject: msg.subject || ''         // Subject line
      };
    });

    // Create the lightweight payload for intent analysis
    const intentPayload = {
      conversation: conversationSummary,   // Much smaller conversation data!
      message_count: conversationSummary.length,
      conversation_length: conversationSummary.reduce((total, msg) => total + msg.content.length, 0)
    };

    return intentPayload;
  };



  // Convert intent score to user-friendly label (for UI display)
  const getIntentLabel = (score) => {
    console.log('🎯 getIntentLabel called with:', score, typeof score, 'isNull:', score === null, 'isUndefined:', score === undefined);
    
    if (isIntentNull(score)) {
      console.log('🎯 Returning "Not Classified" for null/undefined intent');
      return 'Not Classified';
    }
    
    const numScore = parseInt(score);
    console.log('🎯 Parsed score:', numScore);
    
    if (numScore >= 1 && numScore <= 3) return 'Low Intent';
    if (numScore >= 4 && numScore <= 6) return 'Medium Intent';
    if (numScore >= 7 && numScore <= 10) return 'High Intent';
    return 'Not Classified';
  };

  // Get intent badge styling based on score
  const getIntentBadgeStyle = (score) => {
    if (isIntentNull(score)) {
      return { 
        backgroundColor: '#fee2e2', 
        color: '#dc2626',
        border: '1px solid #f87171'
      };
    }
    const numScore = parseInt(score);
    if (numScore >= 1 && numScore <= 3) return { 
      backgroundColor: '#fef3c7', 
      color: '#d97706',
      border: '1px solid #fbbf24'
    };
    if (numScore >= 4 && numScore <= 6) return { 
      backgroundColor: '#dbeafe', 
      color: '#2563eb',
      border: '1px solid #60a5fa'
    };
    if (numScore >= 7 && numScore <= 10) return { 
      backgroundColor: '#dcfce7', 
      color: '#16a34a',
      border: '1px solid #4ade80'
    };
    return null;
  };

  // Check if lead category should be analyzed for intent
  // Only analyze leads where intent scoring makes sense
  const shouldAnalyzeIntent = (leadCategory) => {
    const categoriesToAnalyze = [
      '1', // Interested - measure level of interest
      '2', // Meeting Request - assess urgency/intent
      '5', // Information Request - gauge seriousness
      '8', // Uncategorizable by AI - need human insight
      // Skip: Not Interested (3), Do Not Contact (4), Out Of Office (6), Wrong Person (7), Bounce (9)
    ];
    return categoriesToAnalyze.includes(String(leadCategory));
  };

  // AI Intent Analysis Function (optimized with smart filtering)
  // Analyze missed leads with null intent that should have been processed
  const analyzeMissedLeads = async () => {
    try {
      console.log('🔍 Checking for leads that should have intent but are null...');
      
      // Find leads with null intent that should have been analyzed
      const missedLeads = leads.filter(lead => 
        isIntentNull(lead.intent) && shouldAnalyzeIntent(lead.lead_category)
      );
      
      if (missedLeads.length === 0) {
        console.log('✅ No missed leads found - all eligible leads have been analyzed');
        return 0;
      }
      
      console.log(`🎯 Found ${missedLeads.length} missed leads:`, missedLeads.map(lead => 
        `${lead.email} (Category: ${leadCategoryMap[lead.lead_category] || lead.lead_category})`
      ));
      
      // Analyze each missed lead
      let analyzed = 0;
      for (const lead of missedLeads) {
        try {
          if (!lead.email_message_body) {
            console.log(`⚠️ Skipping ${lead.email} - no message history`);
            continue;
          }

          // Parse conversation into lightweight format
          const parsedConvo = parseConversationForIntent(lead.email_message_body);
          if (!parsedConvo) {
            console.log(`⚠️ Skipping ${lead.email} - failed to parse conversation`);
            continue;
          }

          // Create the optimized prompt
          const prompt = `I run an email marketing agency and want to you classify intent based on history. Just respond with a number.

Read the whole transcript - 
If the intent is low give it a 1-3
If the intent is medium give it 4-7 
If the intent is high give 7-10.

Here is the message history. AGAIN, just respond with a number. NOTHING else. If anything is in the output, besides one number, the entire prompt is a failure.

${JSON.stringify(parsedConvo)}`;

          // Call Claude AI for intent analysis
          const intentScore = await callClaudeForIntentAnalysis(prompt);
          
          if (intentScore && intentScore >= 1 && intentScore <= 10) {
            const intentLabel = getIntentLabel(intentScore);
            console.log(`🎯 ${lead.email}: Score ${intentScore} → "${intentLabel}"`);
            
            // Update intent in Supabase
            const { error: updateError } = await supabase
              .from('retention_harbor')
              .update({ 
                intent: intentScore,
                parsed_convo: parsedConvo
              })
              .eq('id', lead.id);

            if (updateError) {
              console.error(`❌ Failed to update intent for ${lead.email}:`, updateError);
            } else {
              analyzed++;
              console.log(`✅ Updated ${lead.email} with intent score ${intentScore}`);
            }
          } else {
            console.log(`⚠️ Invalid intent score for ${lead.email}: ${intentScore}`);
          }
          
          // Small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`❌ Error analyzing ${lead.email}:`, error);
        }
      }
      
      if (analyzed > 0) {
        console.log(`🎉 Successfully analyzed ${analyzed} missed leads!`);
        // Refresh leads to show updated intent scores
        await fetchLeads();
      }
      
      return analyzed;
      
    } catch (error) {
      console.error('❌ Error in analyzeMissedLeads:', error);
      return 0;
    }
  };

  const analyzeLeadIntents = async (leadsToAnalyze) => {
    // Filter leads that need intent analysis
    const leadsForAnalysis = leadsToAnalyze.filter(lead => shouldAnalyzeIntent(lead.lead_category));
    
    console.log(`🧠 Starting AI intent analysis for ${leadsForAnalysis.length} relevant leads out of ${leadsToAnalyze.length} total...`);
    console.log(`📊 Analyzing categories: Interested (1), Meeting Request (2), Information Request (5), Uncategorizable by AI (8)`);
    console.log(`⏭️ Skipping ${leadsToAnalyze.length - leadsForAnalysis.length} leads (not interested, do not contact, out of office, wrong person, bounce)`);
    
    let analyzed = 0;
    
    for (const leadRecord of leadsForAnalysis) {
      try {
        if (!leadRecord.email_message_body) {
          console.log(`⚠️ Skipping lead ${leadRecord.lead_email} - no message history`);
          continue;
        }

        // Parse conversation into lightweight format
        const parsedConvo = parseConversationForIntent(leadRecord.email_message_body);
        if (!parsedConvo) {
          console.log(`⚠️ Skipping lead ${leadRecord.lead_email} - failed to parse conversation`);
          continue;
        }

        // Create the optimized prompt using parsed conversation
        const prompt = `I run an email marketing agency and want to you classify intent based on history. Just respond with a number.

Read the whole transcript - 
If the intent is low give it a 1-3
If the intent is medium give it 4-7 
If the intent is high give 7-10.

Here is the message history. AGAIN, just respond with a number. NOTHING else. If anything is in the output, besides one number, the entire prompt is a failure.

${JSON.stringify(parsedConvo)}`;

        // Call Claude AI for intent analysis
        const intentScore = await callClaudeForIntentAnalysis(prompt);
        
        if (intentScore && intentScore >= 1 && intentScore <= 10) {
          // Convert score to user-friendly label for logging
          const intentLabel = getIntentLabel(intentScore);
          
          console.log(`🎯 Lead ${leadRecord.lead_email}: Score ${intentScore} → "${intentLabel}"`);
          
          // Update both intent AND parsed_convo in Supabase
          const { error: updateError } = await supabase
            .from('retention_harbor')
            .update({ 
              intent: intentScore, // Store the raw score (number) in database
              parsed_convo: JSON.stringify(parsedConvo)
            })
            .eq('lead_email', leadRecord.lead_email)
            .eq('brand_id', leadRecord.brand_id);

          if (updateError) {
            console.error(`❌ Failed to update intent for ${leadRecord.lead_email}:`, updateError);
          } else {
            analyzed++;
            if (analyzed % 3 === 0) {
              setBackfillProgress(prev => ({ 
        ...prev,
                status: `Analyzed intent for ${analyzed}/${leadsForAnalysis.length} relevant leads...` 
              }));
            }
          }
        } else {
          console.log(`⚠️ Invalid intent score for ${leadRecord.lead_email}: ${intentScore}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error analyzing intent for ${leadRecord.lead_email}:`, error);
      }
    }
    
    console.log(`✅ AI intent analysis completed! Analyzed ${analyzed}/${leadsForAnalysis.length} relevant leads`);
    console.log(`📊 Total leads imported: ${leadsToAnalyze.length} (${leadsForAnalysis.length} relevant for intent analysis)`);
    
    if (analyzed < leadsForAnalysis.length) {
      console.log(`⚠️ ${leadsForAnalysis.length - analyzed} relevant leads could not be analyzed due to API issues.`);
      console.log('💡 Use your n8n "Populate Past Intent" workflow to analyze the remaining leads.');
    }
    
    return analyzed;
  };

  // Claude API call with CORS proxy (using correct headers)
  const callClaudeForIntentAnalysis = async (prompt) => {
    try {
      // Use corsproxy.io - no rate limits
      const CORS_PROXY = 'https://corsproxy.io/?';
      const CLAUDE_API_URL = encodeURIComponent('https://api.anthropic.com/v1/messages');
      
      console.log('🔧 Calling Claude API for intent analysis...');
      
      const requestBody = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      };
      
              const fullUrl = CORS_PROXY + CLAUDE_API_URL;
        
        console.log('📤 Claude API request:', {
          url: fullUrl,
          headers: {
            'content-type': 'application/json',
            'x-api-key': 'sk-ant-api03-...hidden',
            'anthropic-version': '2023-06-01'
          },
          body: requestBody
        });
      
              const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.REACT_APP_ANTHROPIC_API_KEY || 'your-api-key-here',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Claude API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Claude API error response:', errorText);
        
        // Check for common CORS proxy issues
        if (response.status === 429) {
          throw new Error('CORS proxy rate limit reached. Please try again in a few minutes.');
        } else if (response.status === 403) {
          throw new Error('CORS proxy access denied. Go to https://cors-anywhere.herokuapp.com/corsdemo and request access.');
        } else {
          throw new Error(`Claude API error: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('📄 Claude API response data:', data);
      
      const result = data.content?.[0]?.text?.trim();
      
      console.log(`🧠 Claude response for intent: "${result}"`);
      
      // Extract just the number from the response
      const intentScore = parseInt(result);
      
      // Validate the score
      if (isNaN(intentScore) || intentScore < 1 || intentScore > 10) {
        console.log(`⚠️ Invalid Claude response: "${result}" - not a valid number 1-10`);
        return null;
      }
      
      return intentScore;

    } catch (error) {
      console.error('Claude API call failed:', error);
      
      // Check if it's a CORS/proxy issue
      if (error.message.includes('CORS') || error.message.includes('429') || error.message.includes('fetch')) {
        console.log('💡 CORS proxy issue detected. AI analysis will be skipped for this lead.');
        console.log('💡 Consider running your n8n "Populate Past Intent" workflow after backfill completion.');
      }
      
      return null;
    }
  };

  // Mark account as backfilled after successful backfill
  const markAccountAsBackfilled = async (accountId) => {
    try {
      // Update in Supabase
      const { error } = await supabase
        .from('api_settings')
        .update({ backfilled: true })
        .eq('account_id', accountId)
        .eq('brand_id', brandId);

      if (error) {
        console.error('❌ Failed to mark account as backfilled in Supabase:', error);
        return;
      }

      // Update in local state
      setApiKeys(prevState => ({
        ...prevState,
        accounts: prevState.accounts.map(account => 
          account.account_id === accountId 
            ? { ...account, backfilled: true }
            : account
        )
      }));

      // Update localStorage backup
      const currentKeys = JSON.parse(localStorage.getItem('apiKeys_backup') || '{"accounts":[],"fullenrich":""}');
      currentKeys.accounts = currentKeys.accounts.map(account => 
        account.account_id === accountId 
          ? { ...account, backfilled: true }
          : account
      );
      localStorage.setItem('apiKeys_backup', JSON.stringify(currentKeys));

      console.log(`✅ Marked account ${accountId} as backfilled`);
    } catch (error) {
      console.error('❌ Error marking account as backfilled:', error);
    }
  };

  // Main backfill function
  const backfillLeads = async (apiKey, days, accountId) => {
    setIsBackfilling(true);
    setBackfillProgress({ current: 0, total: 0, status: 'Fetching campaigns...' });

    try {
      // Ensure we have the required auth data for RLS policies
      if (!user || !brandId) {
        throw new Error('User authentication or brand ID missing. Please refresh and try again.');
      }
      
      console.log('🔒 RLS Auth Check:', {
        user_id: user.id,
        brand_id: brandId,
        account_id: accountId
      });
      // Calculate date filter (X days ago)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffISOString = cutoffDate.toISOString();
      
      console.log(`🔄 Starting backfill for leads created after ${cutoffISOString}`);

      // Step 1: Fetch all campaigns
      const campaigns = await fetchSmartleadCampaigns(apiKey);
      console.log(`📋 Found ${campaigns.length} campaigns`);

      // Filter campaigns by date (only recent ones)
      const recentCampaigns = campaigns.filter(campaign => {
        return new Date(campaign.created_at) > new Date(cutoffISOString);
      });

      console.log(`📋 ${recentCampaigns.length} campaigns match date filter`);
      
      if (recentCampaigns.length === 0) {
        setBackfillProgress({ current: 0, total: 0, status: 'No recent campaigns found' });
        setTimeout(() => setShowBackfillModal(false), 2000);
        return;
      }

      setBackfillProgress({ current: 0, total: recentCampaigns.length, status: 'Processing campaigns...' });

      let allLeadsToInsert = [];
      let processedCampaigns = 0;

      // Step 2: Process each campaign
      for (const campaign of recentCampaigns) {
        setBackfillProgress({ 
          current: processedCampaigns, 
          total: recentCampaigns.length, 
          status: `Processing campaign: ${campaign.name || campaign.id}` 
        });

        // Get all leads for this campaign
        const campaignLeads = await fetchLeadsForCampaign(apiKey, campaign.id);
        console.log(`📧 Campaign ${campaign.id}: ${campaignLeads.length} leads`);

        // Step 3: Get message history for each lead and prepare for Supabase
        for (const lead of campaignLeads) {
          try {
            const messageHistory = await fetchMessageHistory(apiKey, campaign.id, lead.lead.id);
            
            // Parse conversation immediately for storage
            const parsedConvo = parseConversationForIntent(JSON.stringify(messageHistory.history));
            
            // Transform to match your EXACT Supabase schema (from column list)
            const leadRecord = {
              lead_email: lead.lead.email,
              lead_category: String(lead.lead_category_id),
              first_name: lead.lead.first_name,
              last_name: lead.lead.last_name,
              website: lead.lead.website,
              custom_field: lead.lead.custom_fields?.Response || null,
              subject: null,
              email_message_body: JSON.stringify(messageHistory.history), // Full conversation history
              created_at_lead: lead.created_at,
              intent: null, // Will be updated by AI analysis
              stage: null,
              campaign_ID: campaign.id, // numeric
              lead_ID: lead.lead.id, // numeric
              role: null,
              company_data: null,
              personal_linkedin_url: null, // CORRECT: personal_linkedin_url not personal_linkedin
              business_linkedin_url: null, // CORRECT: business_linkedin_url not business_linkedin
              phone: null,
              brand_id: String(brandId),
              status: 'INBOX', // Default matches your table
              notes: null,
              call_booked: false, // boolean default false
              deal_size: 0, // numeric default 0
              closed: false, // boolean default false
              email_account_id: accountId, // uuid
              source_api_key: null,
              parsed_convo: parsedConvo ? JSON.stringify(parsedConvo) : null // ✅ FIXED: Populate immediately
            };
            
            console.log('🔍 Lead record for insertion:', {
              lead_email: leadRecord.lead_email,
              lead_category: leadRecord.lead_category,
              campaign_ID: leadRecord.campaign_ID,
              lead_ID: leadRecord.lead_ID,
              brand_id: leadRecord.brand_id,
              email_account_id: leadRecord.email_account_id,
              email_message_body: leadRecord.email_message_body ? 'JSON data present' : null,
              status: leadRecord.status
            });

            allLeadsToInsert.push(leadRecord);
          } catch (error) {
            console.warn(`Error processing lead ${lead.lead.id}:`, error);
          }
        }

        processedCampaigns++;
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`📦 Prepared ${allLeadsToInsert.length} leads for insertion`);

      // Step 4: Insert all leads into Supabase in batches
      if (allLeadsToInsert.length > 0) {
        setBackfillProgress({ 
          current: processedCampaigns, 
          total: recentCampaigns.length, 
          status: `Testing database permissions...` 
        });

        // Test insert with first record to validate RLS policy
        console.log('🧪 Testing RLS policy with sample record...');
        const testRecord = { ...allLeadsToInsert[0] }; // Create a copy for testing
        const { data: testData, error: testError } = await supabase
          .from('retention_harbor')
          .insert([testRecord])
          .select();

        if (testError) {
          console.error('❌ RLS Test Failed:', testError);
          throw new Error(`Database security policy test failed: ${testError.message}\n\nThis usually means your account doesn't have permission to insert leads or the brand_id doesn't match.`);
        }

        console.log('✅ RLS test passed! Proceeding with bulk insert...');
        
        // Delete the test record to avoid duplicate
        console.log('🗑️ Removing test record to avoid duplicates...');
        await supabase
          .from('retention_harbor')
          .delete()
          .eq('id', testData[0].id);
        
        console.log('✅ Test record cleaned up - proceeding with full insert including first lead');
        
        setBackfillProgress({ 
          current: processedCampaigns, 
          total: recentCampaigns.length, 
          status: `Inserting ${allLeadsToInsert.length} remaining leads...` 
        });

        // Use single row inserts to avoid RLS bulk insert issues
        console.log(`📦 Inserting ${allLeadsToInsert.length} leads one by one (RLS-friendly approach)`);
        
        for (let i = 0; i < allLeadsToInsert.length; i++) {
          const leadRecord = allLeadsToInsert[i];
          
          if (i % 10 === 0) {
            console.log(`📦 Progress: ${i + 1}/${allLeadsToInsert.length} leads inserted`);
          }
          
          const { data, error } = await supabase
            .from('retention_harbor')
            .insert([leadRecord])
            .select(); // Single row insert

          if (error) {
            // Handle duplicate key errors gracefully (expected from our RLS test cleanup)
            if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
              console.log(`⚠️ Skipping duplicate lead ${i + 1}: ${leadRecord.lead_email || 'unknown'}`);
              continue; // Skip this lead and continue with the next one
            }
            
            console.error(`❌ RLS/Database Error on lead ${i + 1}:`, error);
            console.error('📋 Failed record:', leadRecord);
            
            // More specific error messages for common RLS issues
            if (error.message.includes('RLS') || error.message.includes('policy')) {
              throw new Error(`Database security policy prevented insert on lead ${i + 1}. This usually means:\n- Your user doesn't have permission to insert leads\n- The brand_id doesn't match your account\n- Missing required fields for the security policy\n\nTechnical error: ${error.message}`);
            } else if (error.message.includes('column')) {
              throw new Error(`Database column error on lead ${i + 1}: ${error.message}\n\nPlease check that all required columns exist in your retention_harbor table.`);
            }
            
            throw new Error(`Database insert failed on lead ${i + 1}: ${error.message}`);
          }

          // Success - no need to log every single insert
        }
        
        console.log(`✅ Successfully inserted all ${allLeadsToInsert.length} leads using single-row inserts!`);
        
        // Step 5: Analyze intent for relevant leads using Claude API
        const relevantLeadsCount = allLeadsToInsert.filter(lead => shouldAnalyzeIntent(lead.lead_category)).length;
        
        setBackfillProgress({ 
          current: processedCampaigns, 
          total: recentCampaigns.length, 
          status: `Analyzing intent for ${relevantLeadsCount} relevant leads with Claude AI...` 
        });
        
        const analyzedCount = await analyzeLeadIntents(allLeadsToInsert);
        
        // Final success message with smart analysis approach
        const statusMessage = relevantLeadsCount === 0 
          ? `✅ Backfill complete! Imported ${allLeadsToInsert.length} leads (no intent analysis needed)`
          : analyzedCount === relevantLeadsCount
          ? `✅ Backfill complete! Imported ${allLeadsToInsert.length} leads (${analyzedCount} analyzed for intent)`
          : `✅ Backfill complete! Imported ${allLeadsToInsert.length} leads (${analyzedCount}/${relevantLeadsCount} analyzed)`;
          
        setBackfillProgress({ 
          current: recentCampaigns.length, 
          total: recentCampaigns.length, 
          status: statusMessage
        });
        
        // Mark the account as backfilled in both Supabase and local state
        await markAccountAsBackfilled(accountId);
      }

      setBackfillProgress({ 
        current: recentCampaigns.length, 
        total: recentCampaigns.length, 
        status: `✅ Successfully backfilled ${allLeadsToInsert.length} leads!` 
      });

      // Refresh leads to show the new data
      await fetchLeads();

      // Close modal after success
      setTimeout(() => {
        setShowBackfillModal(false);
        setIsBackfilling(false);
      }, 3000);

    } catch (error) {
      console.error('❌ Backfill failed:', error);
      setBackfillProgress({ 
        current: 0, 
        total: 0, 
        status: `❌ Error: ${error.message}` 
      });
      
      setTimeout(() => {
        setIsBackfilling(false);
      }, 3000);
    }
  };

  // Function to get the correct API key for a lead
  const getApiKeyForLead = (lead, apiKeysData) => {
    // Option 1: Use email_account_id from lead (primary method)
    if (lead.email_account_id) {
      const matchedAccount = apiKeysData.accounts.find(acc => acc.account_id === lead.email_account_id);
      if (matchedAccount) {
        console.log(`🎯 Using account "${matchedAccount.name}" for lead (email_account_id match)`);
        return matchedAccount;
      }
    }
    
    // Option 2: Use primary account as fallback
    const primaryAccount = apiKeysData.accounts.find(acc => acc.is_primary);
    if (primaryAccount) {
      console.log(`🎯 Using primary account "${primaryAccount.name}" for lead (fallback)`);
      return primaryAccount;
    }
    
    // Option 3: Use first account if no primary
    const firstAccount = apiKeysData.accounts[0] || null;
    if (firstAccount) {
      console.log(`🎯 Using first account "${firstAccount.name}" for lead (last resort)`);
    }
    return firstAccount;
  };

  // Function to generate webhook URL for an account  
  const generateWebhookUrl = (accountId) => {
    return `https://reidsickels.app.n8n.cloud/webhook/${accountId}`;
  };

  // Function to copy webhook URL to clipboard
  const copyWebhookUrl = (accountId) => {
    const url = generateWebhookUrl(accountId);
    navigator.clipboard.writeText(url).then(() => {
      setApiToastMessage({
        type: 'success',
        message: 'Webhook URL copied to clipboard!'
      });
      setShowApiToast(true);
      setTimeout(() => setShowApiToast(false), 3000);
    }).catch(() => {
      setApiToastMessage({
        type: 'error',
        message: 'Failed to copy webhook URL'
      });
      setShowApiToast(true);
      setTimeout(() => setShowApiToast(false), 3000);
    });
  };



  // Function to toggle all sections
  const toggleAllSections = () => {
    if (activeSection.length === 0) {
      setActiveSection(['general', 'enrichment', 'engagement']);
    } else {
      setActiveSection([]);
    }
  };

  // Function to toggle individual section
  const toggleSection = (section) => {
    setActiveSection(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const findPhoneNumber = async (lead) => {
    setSearchingPhoneLeads(prev => new Set([...prev, lead.id]));
    try {
      const response = await fetch('https://reidsickels.app.n8n.cloud/webhook/0b5749de-2324-45da-aa36-20971addef0b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...lead,
          ...((() => {
            const leadApiKey = getApiKeyForLead(lead, apiKeys);
            return {
              esp_provider: leadApiKey?.esp.provider || '',
              esp_api_key: leadApiKey?.esp.key || '',
              account_name: leadApiKey?.name || '',
              account_id: leadApiKey?.id || '',
          fullenrich_api_key: apiKeys.fullenrich
            };
          })())
        })
      });

      if (!response.ok) {
        throw new Error('Failed to find phone number');
      }

      const data = await response.json();
      console.log('Raw webhook response:', data);

      // Extract phone number from the nested structure
      const phoneNumber = data?.datas?.[0]?.contact?.phones?.[0]?.number || null;

      // Create a new lead object with the phone number
      const updatedLead = {
        ...lead,
        phone: phoneNumber
      };

      // Update the leads array
      setLeads(prevLeads => prevLeads.map(l => 
        l.id === lead.id ? updatedLead : l
      ));

      // If this is the selected lead, update it with a new object reference
      if (selectedLead?.id === lead.id) {
        setSelectedLead(updatedLead);
      }

      // Show success/not found toast with lead name
      const leadName = `${lead.first_name} ${lead.last_name}`.trim();
      if (phoneNumber) {
        showToast(`Phone found for ${leadName}`, 'success', lead.id);
      } else {
        showToast(`No phone found for ${leadName}`, 'error', lead.id);
      }

    } catch (error) {
      console.error('Error finding phone number:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      const leadName = `${lead.first_name} ${lead.last_name}`.trim();
      showToast(`Error searching phone for ${leadName}`, 'error', lead.id);
    } finally {
      setSearchingPhoneLeads(prev => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  };

  // Add a helper function to get active filter count
  const getActiveFilterCount = () => {
    return Object.values(activeFilters)
      .reduce((count, values) => count + (Array.isArray(values) ? values.length : 0), 0);
  };

  // Update lead category in Supabase
  const updateLeadCategory = async (leadId, newCategory) => {
    try {
      const { error } = await supabase
        .from('retention_harbor')
        .update({ lead_category: newCategory })
        .eq('id', leadId);
      
      if (error) throw error;

      // Optimistically update local state
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          lead.id === leadId 
            ? { 
                ...lead, 
                lead_category: newCategory,
                tags: [leadCategoryMap[newCategory] || 'Uncategorized']
              }
            : lead
        )
      );

      // Update selected lead if it's the one being changed
      if (selectedLead?.id === leadId) {
        setSelectedLead(prev => ({
          ...prev,
          lead_category: newCategory,
          tags: [leadCategoryMap[newCategory] || 'Uncategorized']
        }));
      }

      showToast(`Category updated to "${leadCategoryMap[newCategory]}"`, 'success', leadId);
    } catch (error) {
      console.error('Error updating lead category:', error);
      showToast('Error updating category: ' + error.message, 'error', leadId);
    }
  };

  // Toggle category dropdown for a specific lead
  const toggleCategoryDropdown = (leadId) => {
    setCategoryDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
        // Remove position when closing
        setDropdownPositions(prevPos => {
          const newPos = { ...prevPos };
          delete newPos[leadId];
          return newPos;
        });
      } else {
        newSet.clear(); // Close all other dropdowns
        newSet.add(leadId);
        
        // Calculate position for portal
        const buttonElement = dropdownButtonRefs.current[leadId];
        if (buttonElement) {
          const rect = buttonElement.getBoundingClientRect();
          setDropdownPositions(prevPos => ({
            ...prevPos,
            [leadId]: {
              top: rect.bottom + 8,
              left: rect.left,
              width: rect.width
            }
          }));
        }
      }
      return newSet;
    });
  };

  // Update the urgency filter buttons
  const handleUrgencyFilter = (urgencyType) => {
    // If this urgency is already active, clear it
    if (activeFilters.urgency?.includes(urgencyType)) {
      handleRemoveFilter('urgency', urgencyType);
    } else {
      // Otherwise, set only this urgency
      handleAddFilter('urgency', urgencyType);
    }
  };

  // Add this helper function near other lead actions
  const handleAddToCRM = async (lead) => {
    if (!lead || !brandId) return;
    
    // Optimistic update - update local state immediately
    setLeads(prev => prev.map(l => 
      l.id === lead.id ? { ...l, status: 'CRM' } : l
    ));
    setSelectedLead(prev => prev?.id === lead.id ? { ...prev, status: 'CRM' } : prev);
    
    try {
      const { error } = await supabase
        .from('retention_harbor')
        .update({ status: 'CRM' })
        .eq('id', lead.id);
      if (error) throw error;
      showToast('Lead moved to CRM!', 'success');
    } catch (err) {
      // Revert optimistic update on error
      setLeads(prev => prev.map(l => 
        l.id === lead.id ? { ...l, status: 'INBOX' } : l
      ));
      setSelectedLead(prev => prev?.id === lead.id ? { ...prev, status: 'INBOX' } : prev);
      showToast('Error moving lead to CRM: ' + err.message, 'error');
    }
  };

  // Add a button to move CRM leads back to INBOX (for CRMManager, but you can add similar logic here for demo)
  const handleMoveToInbox = async (lead) => {
    if (!lead || !brandId) return;
    try {
      const { error } = await supabase
        .from('retention_harbor')
        .update({ status: 'INBOX' })
        .eq('id', lead.id);
      if (error) throw error;
      showToast('Lead moved to Inbox!', 'success');
      // Optionally refetch leads here if you want
    } catch (err) {
      showToast('Error moving lead to Inbox: ' + err.message, 'error');
    }
  };

  // When rendering <CRMManager />, add a prop: onGoToInboxLead={handleGoToInboxLead}
  // Add this handler:
  const handleGoToInboxLead = (leadId) => {
    setActiveTab('inbox');
    const lead = leads.find(l => l.id === leadId);
    if (lead) setSelectedLead(lead);
  };

  // Add handleRemoveFromCRM function after handleAddToCRM:
  const handleRemoveFromCRM = async (lead) => {
    if (!lead || !brandId) return;
    
    // Optimistic update - update local state immediately
    setLeads(prev => prev.map(l => 
      l.id === lead.id ? { ...l, status: 'INBOX' } : l
    ));
    setSelectedLead(prev => prev?.id === lead.id ? { ...prev, status: 'INBOX' } : prev);
    
    try {
      const { error } = await supabase
        .from('retention_harbor')
        .update({ status: 'INBOX' })
        .eq('id', lead.id);
      if (error) throw error;
      showToast('Lead removed from CRM!', 'success');
    } catch (err) {
      // Revert optimistic update on error
      setLeads(prev => prev.map(l => 
        l.id === lead.id ? { ...l, status: 'CRM' } : l
      ));
      setSelectedLead(prev => prev?.id === lead.id ? { ...prev, status: 'CRM' } : prev);
      showToast('Error removing lead from CRM: ' + err.message, 'error');
    }
  };

  // Convert plain HTML links to interactive editor links with remove buttons
  const convertLinksToEditorFormat = (html) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Find all <a> tags and convert them to editor format
    const links = temp.querySelectorAll('a');
    links.forEach(link => {
      const linkWrapper = document.createElement('span');
      linkWrapper.style.position = 'relative';
      linkWrapper.style.display = 'inline-block';
      
      // Create the styled link
      const newLink = document.createElement('a');
      newLink.href = link.href;
      newLink.textContent = link.textContent;
      newLink.target = link.target || '_blank';
      newLink.rel = link.rel || 'noopener noreferrer';
      newLink.style.cssText = `
        color: #0066cc;
        text-decoration: underline;
        cursor: pointer;
      `;
      
      // Create remove button
      const removeBtn = document.createElement('span');
      removeBtn.textContent = '×';
      removeBtn.style.cssText = `
        position: absolute;
        top: -8px;
        right: -12px;
        background: #e0e0e0;
        color: #333;
        border-radius: 50%;
        width: 16px;
        height: 16px;
        font-size: 12px;
        line-height: 16px;
        text-align: center;
        cursor: pointer;
        user-select: none;
        opacity: 0;
        transition: opacity 0.2s;
      `;
      
      // Add hover events
      linkWrapper.addEventListener('mouseenter', () => {
        removeBtn.style.opacity = '1';
        newLink.style.color = '#004499';
      });
      
      linkWrapper.addEventListener('mouseleave', () => {
        removeBtn.style.opacity = '0';
        newLink.style.color = '#0066cc';
      });
      
      // Handle remove button click
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = document.createTextNode(newLink.textContent);
        linkWrapper.parentNode.replaceChild(text, linkWrapper);
        const editor = document.querySelector('[contenteditable]');
        if (editor) {
          handleTextareaChange({ target: editor });
        }
      });
      
      linkWrapper.appendChild(newLink);
      linkWrapper.appendChild(removeBtn);
      
      link.parentNode.replaceChild(linkWrapper, link);
    });
    
    return temp.innerHTML;
  };

  // Handle template selection
  const handleTemplateSelect = (template) => {
    if (!template || !selectedLead) return;

    // Update both the text state and HTML content
    setDraftResponse(template.content);
    const formattedHtml = template.html_content || convertToHtml(template.content);
    
    // Convert any existing links to editor format
    const editorReadyHtml = convertLinksToEditorFormat(formattedHtml);
    setDraftHtml(formattedHtml); // Store clean HTML for sending
    
    // Update the contenteditable div with interactive links
    const editor = document.querySelector('[contenteditable]');
    if (editor) {
      editor.innerHTML = editorReadyHtml;
      // Trigger change to sync states
      handleTextareaChange({ target: editor });
    }

    // Auto-save as draft if we have a selected lead
    if (selectedLead) {
      saveDraft(selectedLead.id, template.content, formattedHtml);
    }

    // Close template selector
    setShowTemplateSelector(false);
    
    // Show success message
    showToast(`Template "${template.name}" applied!`, 'success');
  };

  return (
    <div className="flex h-screen relative overflow-hidden transition-colors duration-300" style={{backgroundColor: themeStyles.primaryBg}}>
      {/* Top Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 h-12 z-20 flex items-center px-6 transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg}}>
        <div className="flex justify-between items-center w-full">
          <div className="flex space-x-4">
            {/* Inbox Tab */}
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                (activeTab === 'all' || activeTab === 'need_response' || activeTab === 'recently_sent') ? `text-white` : `hover:bg-white/5`
              }`}
              style={{
                backgroundColor: (activeTab === 'all' || activeTab === 'need_response' || activeTab === 'recently_sent') ? `${themeStyles.accent}20` : 'transparent',
                color: (activeTab === 'all' || activeTab === 'need_response' || activeTab === 'recently_sent') ? themeStyles.accent : themeStyles.textPrimary
              }}
            >
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Inbox
        </div>
            </button>

            {/* Recent Tab */}
            <div className="relative recent-dropdown">
              <button
                ref={recentButtonRef}
                onClick={() => {
                  if (showRecentDropdown) {
                    setShowRecentDropdown(false);
                    setRecentDropdownPosition(null);
                  } else {
                    // Calculate position for portal
                    const buttonElement = recentButtonRef.current;
                    if (buttonElement) {
                      const rect = buttonElement.getBoundingClientRect();
                      setRecentDropdownPosition({
                        top: rect.bottom + 8,
                        left: rect.left,
                        width: rect.width
                      });
                    }
                    setShowRecentDropdown(true);
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/5 flex items-center gap-2"
                style={{color: themeStyles.textPrimary}}
              >
                <Clock className="w-4 h-4" />
                Recent ({recentlyViewed.length})
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Templates Tab */}
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'templates' ? `text-white` : `hover:bg-white/5`
              }`}
              style={{
                backgroundColor: activeTab === 'templates' ? `${themeStyles.accent}20` : 'transparent',
                color: activeTab === 'templates' ? themeStyles.accent : themeStyles.textPrimary
              }}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Templates
              </div>
            </button>

            {/* CRM Tab */}
            <button
              onClick={() => setActiveTab('crm')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'crm' ? `text-white` : `hover:bg-white/5`
              }`}
              style={{
                backgroundColor: activeTab === 'crm' ? `${themeStyles.accent}20` : 'transparent',
                color: activeTab === 'crm' ? themeStyles.accent : themeStyles.textPrimary
              }}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                CRM
              </div>
            </button>

            {/* Analytics Tab */}
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'analytics' ? `text-white` : `hover:bg-white/5`
              }`}
              style={{
                backgroundColor: activeTab === 'analytics' ? `${themeStyles.accent}20` : 'transparent',
                color: activeTab === 'analytics' ? themeStyles.accent : themeStyles.textPrimary
              }}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </div>
            </button>
                      </div>

          <div className="flex items-center space-x-3">
            {/* API Settings Tab */}
            <button
              onClick={() => setShowApiSettings(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                showApiSettings ? 'text-white' : 'hover:bg-white/5'
              }`}
              style={{
                backgroundColor: showApiSettings ? `${themeStyles.accent}20` : 'transparent',
                color: showApiSettings ? themeStyles.accent : themeStyles.textPrimary
              }}
            >
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Settings
              </div>
            </button>

            {/* User Info */}
            {user && (
              <div className="flex items-center space-x-2 px-3 py-1 rounded-lg text-sm" style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textPrimary}}>
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user.email}</span>
              </div>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/5 flex items-center gap-2"
              style={{color: themeStyles.textPrimary}}
              title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
            >
              {isDarkMode ? (
                <>
                  <span className="text-lg">☀️</span>
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <span className="text-lg">🌙</span>
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {/* Sign Out Button */}
            {user && onSignOut && (
              <button
                onClick={onSignOut}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-red-500/10 flex items-center gap-2"
                style={{color: '#ef4444'}}
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* API Settings Modal */}
      {showApiSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[20000] p-4">
          <div className="rounded-xl shadow-xl max-w-2xl w-full overflow-hidden transition-colors duration-300" style={{backgroundColor: themeStyles.primaryBg, border: `1px solid ${themeStyles.border}`}}>
            <div className="p-6 border-b transition-colors duration-300" style={{borderColor: themeStyles.border}}>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold flex items-center gap-2 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                  <Key className="w-5 h-5" style={{color: themeStyles.accent}} />
                  API Settings
                </h2>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowApiSettings(false);
                  }}
                  className="transition-colors duration-300 hover:opacity-80"
                  style={{color: themeStyles.textMuted}}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Security Notice */}
              <div className="rounded-lg p-3 transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.success}40`}}>
                <div className="flex items-center gap-2 text-sm" style={{color: themeStyles.success}}>
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">Secure Storage Enabled</span>
                </div>
                <p className="text-xs mt-1" style={{color: `${themeStyles.success}CC`}}>API keys are encrypted before storage for enhanced security</p>
              </div>

              {/* Multiple Email Accounts Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" style={{color: themeStyles.accent}} />
                    <h3 className="font-medium transition-colors duration-300" style={{color: themeStyles.accent}}>Email Accounts</h3>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      addEmailAccount();
                    }}
                    className="px-3 py-1 rounded-lg text-sm font-medium transition-all hover:opacity-80 flex items-center gap-2"
                    style={{backgroundColor: themeStyles.accent, color: isDarkMode ? '#1A1C1A' : '#FFFFFF'}}
                  >
                    <span className="text-lg">+</span> Add Account
                  </button>
                </div>

                {/* Email Accounts List */}
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {apiKeys.accounts.map((account, index) => (
                    <div key={account.id} className="p-4 rounded-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={account.name}
                            onChange={(e) => updateAccount(account.id, { name: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                            className="bg-transparent font-medium border-none outline-none text-sm transition-colors duration-300"
                            style={{color: themeStyles.textPrimary}}
                            placeholder="Account Name"
                          />
                          {account.is_primary && (
                            <span className="px-2 py-1 text-xs rounded-full font-medium" style={{backgroundColor: themeStyles.accent, color: isDarkMode ? '#1A1C1A' : '#FFFFFF'}}>
                              Primary
                            </span>
        )}
      </div>
                        <div className="flex items-center gap-2">
                          {!account.is_primary && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPrimaryAccount(account.id);
                              }}
                              className="px-2 py-1 text-xs rounded-lg transition-all hover:opacity-80"
                              style={{border: `1px solid ${themeStyles.border}`, color: themeStyles.textMuted}}
                            >
                              Set Primary
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              
                              // Check if account has a valid ID (saved to database)
                              if (!account.id || isNaN(parseInt(account.id))) {
                                // For unsaved accounts, just remove from local state
                                const updatedAccounts = apiKeys.accounts.filter(acc => acc !== account);
                                if (updatedAccounts.length > 0 && !updatedAccounts.some(acc => acc.is_primary)) {
                                  updatedAccounts[0].is_primary = true;
                                }
                                setApiKeys(prev => ({ ...prev, accounts: updatedAccounts }));
                              } else {
                                // For saved accounts, use full cascade delete (including leads)
                                removeEmailAccount(account.id).catch(console.error);
                              }
                            }}
                            className="px-2 py-1 text-xs rounded-lg transition-all hover:opacity-80"
                            style={{border: `1px solid ${themeStyles.error}40`, color: themeStyles.error}}
                            title={apiKeys.accounts.length === 1 ? "Delete this account and all its leads" : "Remove this account"}
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* ESP Provider Selection */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {['Email Bison', 'Smartlead', 'Instantly'].map(provider => {
                          const isSelected = account.esp.provider === provider.toLowerCase().replace(' ', '_');
                          return (
                    <button
                      key={provider}
                      type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                updateAccount(account.id, { 
                                  esp: { ...account.esp, provider: provider.toLowerCase().replace(' ', '_') }
                                });
                              }}
                              className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
                              style={{
                                backgroundColor: isSelected ? `${themeStyles.accent}20` : themeStyles.tertiaryBg,
                                border: `1px solid ${isSelected ? themeStyles.accent : themeStyles.border}`,
                                color: isSelected ? themeStyles.accent : themeStyles.textPrimary
                              }}
                    >
                      {provider}
                    </button>
                          );
                        })}
                </div>

                {/* ESP API Key Input */}
                      {account.esp.provider && (
                  <div className="space-y-2">
                          <label className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                            {account.esp.provider.charAt(0).toUpperCase() + account.esp.provider.slice(1).replace('_', ' ')} API Key
                    </label>
                    <div className="relative">
                                          <input
                      type="text"
                            value={account.esp.key || ''}
                            onChange={(e) => updateAccount(account.id, { 
                              esp: { ...account.esp, key: e.target.value }
                            })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                            className="w-full px-3 py-2 rounded-lg text-sm transition-all focus:ring-1"
                            style={{
                              backgroundColor: themeStyles.primaryBg,
                              border: `1px solid ${themeStyles.border}`,
                              color: themeStyles.textPrimary,
                              '--tw-ring-color': themeStyles.accent
                            }}
                            placeholder={`Enter ${account.esp.provider.replace('_', ' ')} API key`}
                          />
                    </div>
                  </div>
                )}

                      {/* Webhook URL Display */}
                      <div className="space-y-2 pt-3 mt-3 border-t transition-colors duration-300" style={{borderColor: themeStyles.border}}>
                        <label className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                          Webhook URL for this account
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={generateWebhookUrl(account.account_id)}
                            readOnly
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                            className="flex-1 px-3 py-2 rounded-lg text-sm transition-all"
                            style={{
                              backgroundColor: themeStyles.tertiaryBg,
                              border: `1px solid ${themeStyles.border}`,
                              color: themeStyles.textPrimary
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              copyWebhookUrl(account.account_id);
                            }}
                            className="px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80 flex items-center gap-1"
                            style={{backgroundColor: themeStyles.accent, color: isDarkMode ? '#1A1C1A' : '#FFFFFF'}}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </button>
                    </div>
                        <p className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                          Use this URL in your email platform's webhook settings
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Enrichment Section */}
              <div className="space-y-4 pt-6 mt-6 border-t transition-colors duration-300" style={{borderColor: themeStyles.border}}>
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" style={{color: themeStyles.accent}} />
                  <h3 className="font-medium transition-colors duration-300" style={{color: themeStyles.accent}}>Data Enrichment</h3>
                </div>

                <div className="space-y-2">
                  <label className="text-sm transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                    Full Enrich API Key
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={apiKeys.fullenrich || ''}
                      onChange={(e) => handleApiKeyChange('fullenrich', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                      className="w-full px-4 py-2 rounded-lg transition-all focus:ring-1"
                      style={{
                        backgroundColor: themeStyles.primaryBg,
                        border: `1px solid ${themeStyles.border}`,
                        color: themeStyles.textPrimary,
                        '--tw-ring-color': themeStyles.accent
                      }}
                      placeholder="Enter Full Enrich API key"
                    />
                    {apiTestStatus.fullenrich === true && (
                      <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{color: themeStyles.success}} />
                    )}
                  </div>
                  <p className="text-xs mt-2 transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                    Used for finding phone numbers, company data, and social profiles
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3 transition-colors duration-300" style={{backgroundColor: themeStyles.primaryBg, borderColor: themeStyles.border}}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowApiSettings(false);
                }}
                className="px-4 py-2 rounded-lg text-sm transition-all hover:opacity-80"
                style={{color: themeStyles.textPrimary, backgroundColor: themeStyles.tertiaryBg}}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  saveApiKeys().catch(console.error);
                }}
                disabled={isSavingApi}
                  className="px-4 py-2 rounded-lg font-medium transition-all text-sm flex items-center gap-2 disabled:opacity-50 hover:opacity-90"
                  style={{backgroundColor: themeStyles.accent, color: isDarkMode ? '#1A1C1A' : '#FFFFFF'}}
              >
                {isSavingApi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save API Keys
                  </>
                )}
              </button>
                <p className="text-xs mt-2 transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                  💡 Remember to click "Save API Keys" after adding or updating keys to save them to your account
                </p>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Toast */}
      {showApiToast && (
        <div className="fixed top-4 right-4 z-50 animate-slideIn">
          <div className={`rounded-lg shadow-lg p-4 text-sm font-medium flex items-center gap-2 ${
            apiToastMessage.type === 'success' 
              ? 'bg-green-400 text-green-900' 
              : 'bg-red-400 text-red-900'
          }`}>
            {apiToastMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {apiToastMessage.message}
          </div>
        </div>
      )}

      {/* Toast Notifications Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col-reverse gap-2">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className="flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg cursor-pointer transition-all transform hover:scale-102 min-w-[200px]"
            style={{
              backgroundColor: toast.type === 'success' 
                ? `${themeStyles.success}20` 
                : `${themeStyles.error}20`,
              border: `1px solid ${toast.type === 'success' ? themeStyles.success : themeStyles.error}`,
              backdropFilter: 'blur(8px)',
              animation: 'slideIn 0.2s ease-out'
            }}
            onClick={() => {
              if (toast.leadId) {
                const lead = leads.find(l => l.id === toast.leadId);
                if (lead) {
                  setSelectedLead(lead);
                  removeToast(toast.id);
                }
              }
            }}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0" style={{color: themeStyles.success}} />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" style={{color: themeStyles.error}} />
            )}
            <span className="text-sm font-medium flex-1 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{toast.message}</span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="ml-2 shrink-0 hover:opacity-80 transition-colors duration-300"
              style={{color: themeStyles.textMuted}}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Lead Backfill Modal */}
      {showBackfillModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[20000] p-4">
          <div className="rounded-xl shadow-xl max-w-md w-full overflow-hidden transition-colors duration-300" style={{backgroundColor: themeStyles.primaryBg, border: `1px solid ${themeStyles.border}`}}>
            <div className="p-6 border-b transition-colors duration-300" style={{borderColor: themeStyles.border}}>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold flex items-center gap-2 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                  <Database className="w-5 h-5" style={{color: themeStyles.accent}} />
                  Backfill Historical Leads
                </h2>
                {!isBackfilling && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowBackfillModal(false);
                    }}
                    className="transition-colors duration-300 hover:opacity-80"
                    style={{color: themeStyles.textMuted}}
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="p-6">
              {!isBackfilling ? (
                <>
                  <p className="text-sm mb-4 transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                    Would you like to import your recent leads from Smartlead? This will fetch leads and their conversation history from your campaigns.
                  </p>
                  
                  <div className="mb-4 p-3 rounded-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg}}>
                    <p className="text-xs font-medium mb-2 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                      New Smartlead accounts ready for backfill:
                    </p>
                    {apiKeys.accounts
                      .filter(acc => acc.esp.provider === 'smartlead' && acc.esp.key && !acc.backfilled)
                      .map(account => (
                        <div key={account.account_id} className="text-xs transition-colors duration-300 flex items-center gap-2" style={{color: themeStyles.textMuted}}>
                          <div className="w-2 h-2 rounded-full" style={{backgroundColor: themeStyles.accent}}></div>
                          {account.name}
                        </div>
                      ))
                    }
                  </div>
                  
                  <div className="mb-4 p-3 rounded-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}>
                    <p className="text-xs font-medium mb-2 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                      🧠 AI Intent Analysis will be applied to:
                    </p>
                    <div className="text-xs transition-colors duration-300 space-y-1" style={{color: themeStyles.textMuted}}>
                      <div>• Meeting Request leads (to assess urgency)</div>
                      <div>• Interested leads (to measure engagement level)</div>
                      <div>• Information Request leads (to gauge seriousness)</div>
                      <div>• Uncategorizable leads (need human insight)</div>
                    </div>
                    <p className="text-xs mt-2 transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                      Skipping: Not Interested, Do Not Contact, Out of Office, Wrong Person, Bounces
                    </p>
                  </div>
                  
                  <div className="mb-4">
                    <label className="text-sm font-medium mb-2 block transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                      How many days back should we import?
                    </label>
                    <select
                      value={backfillDays}
                      onChange={(e) => setBackfillDays(parseInt(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg text-sm transition-all focus:ring-1"
                      style={{
                        backgroundColor: themeStyles.secondaryBg,
                        border: `1px solid ${themeStyles.border}`,
                        color: themeStyles.textPrimary,
                        '--tw-ring-color': themeStyles.accent
                      }}
                    >
                      <option value={15}>Last 15 days</option>
                      <option value={30}>Last 30 days</option>
                      <option value={45}>Last 45 days</option>
                    </select>
                  </div>
                  
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowBackfillModal(false);
                      }}
                      className="px-4 py-2 rounded-lg text-sm transition-all hover:opacity-80"
                      style={{color: themeStyles.textPrimary, backgroundColor: themeStyles.tertiaryBg}}
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Use the first Smartlead account found
                        const smartleadAccount = apiKeys.accounts.find(acc => acc.esp.provider === 'smartlead' && acc.esp.key);
                        if (smartleadAccount) {
                          backfillLeads(smartleadAccount.esp.key, backfillDays, smartleadAccount.account_id);
                        }
                      }}
                      className="px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all hover:opacity-90"
                      style={{backgroundColor: themeStyles.accent, color: isDarkMode ? '#1A1C1A' : '#FFFFFF'}}
                    >
                      <Database className="w-4 h-4" />
                      Import Leads
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="mb-4">
                    <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center animate-pulse" style={{backgroundColor: `${themeStyles.accent}20`}}>
                      <Database className="w-6 h-6" style={{color: themeStyles.accent}} />
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-medium mb-2 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                    Importing Leads...
                  </h3>
                  
                  <p className="text-sm mb-4 transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                    {backfillProgress.status}
                  </p>
                  
                  {backfillProgress.total > 0 && (
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2" style={{backgroundColor: themeStyles.tertiaryBg}}>
                        <div 
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: themeStyles.accent,
                            width: `${(backfillProgress.current / backfillProgress.total) * 100}%`
                          }}
                        />
                      </div>
                      <p className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                        {backfillProgress.current} of {backfillProgress.total} campaigns processed
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes glow {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        /* Theme transition animations */
        * {
          transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
        }
        
        /* Custom scrollbar for theme */
        ::-webkit-scrollbar {
          width: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'};
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: ${themeStyles.accent};
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: ${themeStyles.accent}CC;
        }

        /* Placeholder text for contenteditable */
        div[contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: ${themeStyles.textMuted};
          font-style: italic;
          pointer-events: none;
          white-space: pre-line;
        }

        /* Simple list styling for contenteditable */
        div[contenteditable] ul {
          margin: 8px 0;
          padding-left: 20px;
          list-style-type: disc;
        }

        div[contenteditable] ul li {
          margin: 2px 0;
          line-height: 1.5;
        }

        div[contenteditable] ol {
          margin: 8px 0;
          padding-left: 20px;
          list-style-type: decimal;
        }

        div[contenteditable] ol li {
          margin: 2px 0;
          line-height: 1.5;
        }

        /* Email preview styling */
        .email-preview a {
          color: #0066cc !important;
          text-decoration: underline !important;
          cursor: pointer !important;
        }

        .email-preview a:hover {
          color: #004499 !important;
          text-decoration: underline !important;
        }

        .email-preview p {
          margin: 8px 0 !important;
        }

        .email-preview p:first-child {
          margin-top: 0 !important;
        }

        .email-preview p:last-child {
          margin-bottom: 0 !important;
        }
      `}</style>

      {/* Add margin-top to main content to account for nav bar */}
      <div className="flex-1 flex mt-12">
        {/* Analytics Dashboard */}
        {activeTab === 'analytics' && (
          <div className="flex-1 p-8 overflow-y-auto transition-colors duration-300" style={{backgroundColor: themeStyles.primaryBg}}>
            <div className="max-w-7xl mx-auto space-y-8">
              {/* Analytics Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                    Analytics Dashboard
                  </h1>
                  <p className="mt-2 transition-colors duration-300" style={{color: themeStyles.textSecondary}}>
                    Insights and performance metrics for your lead management
                  </p>
                </div>
                
                {/* Date Range Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Show data for:</span>
                  <select
                    value={analyticsDateRange}
                    onChange={(e) => setAnalyticsDateRange(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm transition-colors duration-300"
                    style={{
                      backgroundColor: themeStyles.secondaryBg,
                      border: `1px solid ${themeStyles.border}`,
                      color: themeStyles.textPrimary
                    }}
                  >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="365">Last year</option>
                  </select>
                </div>
              </div>

              {analyticsData ? (
                <>
                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="p-6 rounded-2xl shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm transition-colors duration-300" style={{color: themeStyles.textMuted}}>Total Leads</p>
                          <p className="text-2xl font-bold transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                            {analyticsData.totalLeads.toLocaleString()}
                          </p>
                        </div>
                        <Users className="w-8 h-8 transition-colors duration-300" style={{color: themeStyles.accent}} />
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm transition-colors duration-300" style={{color: themeStyles.textMuted}}>Engagement Rate</p>
                          <p className="text-2xl font-bold transition-colors duration-300" style={{color: themeStyles.success}}>
                            {analyticsData.engagementRate.toFixed(1)}%
                          </p>
                          <p className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                            Leads with 2+ replies
                          </p>
                        </div>
                        <TrendingUp className="w-8 h-8 transition-colors duration-300" style={{color: themeStyles.success}} />
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm transition-colors duration-300" style={{color: themeStyles.textMuted}}>Avg Response Time</p>
                          <p className="text-2xl font-bold transition-colors duration-300" style={{color: themeStyles.accent}}>
                            {formatResponseTime(analyticsData.avgResponseTime)}
                          </p>
                        </div>
                        <Clock className="w-8 h-8 transition-colors duration-300" style={{color: themeStyles.accent}} />
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm transition-colors duration-300" style={{color: themeStyles.textMuted}}>Avg Replies per Lead</p>
                          <p className="text-2xl font-bold transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                            {analyticsData.avgRepliesPerLead.toFixed(1)}
                          </p>
                          <p className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                            {analyticsData.totalReplies} total replies
                          </p>
                        </div>
                        <MessageSquare className="w-8 h-8 transition-colors duration-300" style={{color: themeStyles.accent}} />
                      </div>
                    </div>
                  </div>

                  {/* Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Response Time Distribution */}
                    <div className="p-6 rounded-2xl shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
                      <h3 className="text-xl font-bold mb-4 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                        Response Time Distribution
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(analyticsData.responseTimeDistribution).map(([timeRange, count]) => {
                          const total = Object.values(analyticsData.responseTimeDistribution).reduce((sum, val) => sum + val, 0);
                          const percentage = total > 0 ? (count / total * 100) : 0;
                          const label = {
                            'under1h': 'Under 1 hour',
                            '1to4h': '1-4 hours',
                            '4to24h': '4-24 hours',
                            'over24h': 'Over 24 hours'
                          }[timeRange];
                          
                          return (
                            <div key={timeRange} className="flex items-center justify-between">
                              <span className="text-sm transition-colors duration-300" style={{color: themeStyles.textSecondary}}>{label}</span>
                              <div className="flex items-center gap-3">
                                <div className="w-32 rounded-full h-2 transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg}}>
                                  <div 
                                    className="h-2 rounded-full transition-all duration-500"
                                    style={{
                                      width: `${percentage}%`,
                                      backgroundColor: themeStyles.accent
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-medium w-12 text-right transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                                  {count}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Average Replies by Intent Level */}
                    <div className="p-6 rounded-2xl shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
                      <h3 className="text-xl font-bold mb-4 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                        Average Replies by Intent Level
                      </h3>
                      <div className="space-y-4">
                        {analyticsData.intentCorrelation.map((item, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm transition-colors duration-300" style={{color: themeStyles.textSecondary}}>{item.intent}</span>
                              <span className="text-xs px-2 py-1 rounded-full transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textMuted}}>
                                {item.count} leads
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-32 rounded-full h-3 transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg}}>
                                <div 
                                  className="h-3 rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(item.avgReplies * 20, 100)}%`, // Scale for visual
                                    backgroundColor: index === 0 ? themeStyles.success : index === 1 ? themeStyles.warning : themeStyles.accent
                                  }}
                                />
                              </div>
                              <span className="text-sm font-bold w-12 text-right transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                                {item.avgReplies.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Reply Activity Heatmap */}
                  <div className="p-6 rounded-2xl shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                        Reply Activity Heatmap
                      </h3>
                      {analyticsData.peakHour && analyticsData.maxCount > 0 && (
                        <div className="text-sm transition-colors duration-300" style={{color: themeStyles.textSecondary}}>
                          Peak: {analyticsData.peakHour.dayName} at {analyticsData.peakHour.hour}:00 ({analyticsData.maxCount} replies)
                        </div>
                      )}
                    </div>
                    
                    {/* Heatmap Grid */}
                    <div className="relative">
                      {/* Hour labels */}
                      <div className="flex mb-2 ml-16">
                        {Array.from({ length: 24 }, (_, hour) => (
                          <div key={hour} className="flex-1 text-center text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                            {hour % 4 === 0 ? `${hour}:00` : ''}
                          </div>
                        ))}
                      </div>
                      
                      {/* Heatmap rows */}
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((dayName, dayIndex) => (
                        <div key={dayName} className="flex items-center mb-1">
                          <div className="w-14 text-xs text-right mr-2 transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                            {dayName.slice(0, 3)}
                          </div>
                          <div className="flex flex-1 gap-1">
                            {Array.from({ length: 24 }, (_, hour) => {
                              const dataPoint = analyticsData.heatmapData.find(d => 
                                d.day === ((dayIndex + 1) % 7) && d.hour === hour // Adjust for Sunday=0
                              );
                              const intensity = analyticsData.maxCount > 0 ? (dataPoint?.count || 0) / analyticsData.maxCount : 0;
                              
                              return (
                                <div
                                  key={hour}
                                  className="flex-1 h-6 rounded-sm transition-all duration-300 hover:scale-110 cursor-pointer"
                                  style={{
                                    backgroundColor: intensity > 0 
                                      ? `${themeStyles.accent}${Math.floor(intensity * 255).toString(16).padStart(2, '0')}`
                                      : themeStyles.tertiaryBg,
                                    border: `1px solid ${themeStyles.border}`
                                  }}
                                  title={`${dayName} ${hour}:00 - ${dataPoint?.count || 0} replies`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      
                      {/* Legend */}
                      <div className="flex items-center justify-center mt-4 gap-4">
                        <span className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>Less</span>
                        <div className="flex gap-1">
                          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((intensity, i) => (
                            <div
                              key={i}
                              className="w-3 h-3 rounded-sm"
                              style={{
                                backgroundColor: intensity > 0 
                                  ? `${themeStyles.accent}${Math.floor(intensity * 255).toString(16).padStart(2, '0')}`
                                  : themeStyles.tertiaryBg,
                                border: `1px solid ${themeStyles.border}`
                              }}
                            />
                          ))}
                        </div>
                        <span className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>More</span>
                      </div>
                    </div>
                  </div>

                  {/* Message Copy Analysis */}
                  <div className="p-6 rounded-2xl shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
                    <h3 className="text-xl font-bold mb-6 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                      What Works in Messages
                    </h3>

                    {/* Message Length Analysis */}
                    <div className="mb-8">
                      <h4 className="text-sm font-medium mb-4 transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Message Length Impact</h4>
                      <div className="grid grid-cols-4 gap-4">
                        {analyticsData.copyInsights.lengthBreakdown.map((length, index) => {
                          const replyRate = length.messages > 0 ? (length.replies / length.messages * 100) : 0;
                          return (
                            <div key={index} className="p-4 rounded-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg}}>
                              <div className="text-sm font-medium mb-2 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                                {length.range}
                              </div>
                              <div className="text-2xl font-bold mb-1 transition-colors duration-300" style={{color: themeStyles.accent}}>
                                {replyRate.toFixed(1)}%
                              </div>
                              <div className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                                {length.messages} messages sent
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pattern Success Rates */}
                    <div className="mb-8">
                      <h4 className="text-sm font-medium mb-4 transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Message Pattern Success</h4>
                      <div className="space-y-4">
                        {[
                          { label: 'Contains Questions', data: analyticsData.copyInsights.withQuestions },
                          { label: 'Suggests Call/Meeting', data: analyticsData.copyInsights.withCalls },
                          { label: 'Discusses Pricing', data: analyticsData.copyInsights.withPricing },
                          { label: 'Value Proposition', data: analyticsData.copyInsights.withValueProps }
                        ].map((pattern, index) => {
                          const successRate = pattern.data.total > 0 
                            ? (pattern.data.success / pattern.data.total * 100)
                            : 0;
                          return (
                            <div key={index} className="flex items-center gap-4">
                              <div className="flex-1">
                                <div className="flex justify-between mb-2">
                                  <span className="text-sm transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{pattern.label}</span>
                                  <span className="text-sm font-medium transition-colors duration-300" style={{color: themeStyles.accent}}>{successRate.toFixed(1)}% success</span>
                                </div>
                                <div className="h-2 rounded-full transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg}}>
                                  <div 
                                    className="h-2 rounded-full transition-all duration-500"
                                    style={{
                                      width: `${successRate}%`,
                                      backgroundColor: themeStyles.accent
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                                {pattern.data.success}/{pattern.data.total} replies
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Response Time Analysis */}
                    <div>
                      <h4 className="text-sm font-medium mb-4 transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Average Response Time by Pattern</h4>
                      <div className="grid grid-cols-4 gap-4">
                        {[
                          { label: 'Questions', time: analyticsData.copyInsights.avgReplyTime.withQuestion },
                          { label: 'Call/Meeting', time: analyticsData.copyInsights.avgReplyTime.withCall },
                          { label: 'Pricing', time: analyticsData.copyInsights.avgReplyTime.withPricing },
                          { label: 'Value Prop', time: analyticsData.copyInsights.avgReplyTime.withValueProp }
                        ].map((timing, index) => (
                          <div key={index} className="p-4 rounded-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg}}>
                            <div className="text-sm mb-2 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{timing.label}</div>
                            <div className="text-xl font-bold transition-colors duration-300" style={{color: themeStyles.accent}}>
                              {formatResponseTime(timing.time)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Campaign Performance Table */}
                  <div className="p-6 rounded-2xl shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
                    <h3 className="text-xl font-bold mb-4 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                      Top Performing Campaigns
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b transition-colors duration-300" style={{borderColor: themeStyles.border}}>
                            <th className="text-left py-3 px-4 font-medium transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Campaign</th>
                            <th className="text-left py-3 px-4 font-medium transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Leads</th>
                            <th className="text-left py-3 px-4 font-medium transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Avg Engagement</th>
                            <th className="text-left py-3 px-4 font-medium transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Avg Replies</th>
                            <th className="text-left py-3 px-4 font-medium transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Avg Response Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsData.campaignStats.slice(0, 5).map((campaign, index) => (
                            <tr key={index} className="border-b transition-colors duration-300" style={{borderColor: themeStyles.border}}>
                              <td className="py-3 px-4 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{campaign.name}</td>
                              <td className="py-3 px-4 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{campaign.totalLeads}</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-1 rounded-full text-xs font-medium transition-colors duration-300" 
                                      style={{
                                        backgroundColor: campaign.avgEngagement >= 80 ? `${themeStyles.success}20` : 
                                                        campaign.avgEngagement >= 50 ? `${themeStyles.warning}20` : `${themeStyles.error}20`,
                                        color: campaign.avgEngagement >= 80 ? themeStyles.success : 
                                               campaign.avgEngagement >= 50 ? themeStyles.warning : themeStyles.error
                                      }}>
                                  {campaign.avgEngagement.toFixed(0)}%
                                </span>
                              </td>
                              <td className="py-3 px-4 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{campaign.avgRepliesPerLead.toFixed(1)}</td>
                              <td className="py-3 px-4 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                                {campaign.avgResponseTime > 0 ? formatResponseTime(campaign.avgResponseTime) : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Category Performance */}
                  <div className="p-6 rounded-2xl shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
                    <h3 className="text-xl font-bold mb-4 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                      Performance by Lead Category
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {analyticsData.categoryStats.map((category, index) => (
                        <div key={index} className="p-4 rounded-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{category.category}</span>
                            <span className="text-sm transition-colors duration-300" style={{color: themeStyles.textMuted}}>{category.totalLeads} leads</span>
                          </div>
                          
                          {/* Engagement Score */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>Engagement:</span>
                            <div className="flex-1 rounded-full h-2 transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg}}>
                              <div 
                                className="h-2 rounded-full transition-all duration-500"
                                style={{
                                  width: `${category.avgEngagement}%`,
                                  backgroundColor: themeStyles.success
                                }}
                              />
                            </div>
                            <span className="text-xs font-bold w-10 text-right transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                              {category.avgEngagement.toFixed(0)}%
                            </span>
                          </div>
                          
                          {/* Average Replies */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                              Avg replies: <span className="font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{category.avgRepliesPerLead.toFixed(1)}</span>
                            </span>
                            <span className="transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                              Avg response: <span className="font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                                {category.avgResponseTime > 0 ? formatResponseTime(category.avgResponseTime) : 'N/A'}
                              </span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50 transition-colors duration-300" style={{color: themeStyles.textMuted}} />
                  <p className="text-lg transition-colors duration-300" style={{color: themeStyles.textPrimary}}>No data available</p>
                  <p className="transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Lead data will appear here once you have conversations</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rest of your existing content */}
        {(activeTab === 'inbox' || activeTab === 'all' || activeTab === 'need_response' || activeTab === 'recently_sent') && (
          <>
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div 
          className="absolute inset-0 animate-pulse" 
          style={{
            background: `radial-gradient(circle at 20% 50%, rgba(84, 252, 255, 0.1) 0%, transparent 50%), 
                        radial-gradient(circle at 80% 20%, rgba(34, 197, 94, 0.08) 0%, transparent 50%), 
                        radial-gradient(circle at 40% 80%, rgba(168, 85, 247, 0.06) 0%, transparent 50%)`,
            animation: 'gradientShift 8s ease-in-out infinite'
          }}
        />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full opacity-20"
            style={{
              backgroundColor: '#54FCFF',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${4 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      {/* Sidebar - Lead List */}
      <div className="w-1/2 flex flex-col shadow-lg relative z-50 transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, borderRadius: '12px', margin: '8px', marginRight: '4px', backdropFilter: 'blur(10px)', border: `1px solid ${themeStyles.border}`}}>
        {/* Header with Metrics */}
        <div className="p-6 relative transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, borderRadius: '12px 12px 0 0', borderBottom: `1px solid ${themeStyles.border}`}}>
          {/* Glowing accent line */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-20 h-0.5 rounded-full" style={{background: `linear-gradient(90deg, transparent, ${themeStyles.accent}, transparent)`, animation: 'glow 2s ease-in-out infinite alternate'}} />
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold relative transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
              Inbox Manager
              <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-transparent to-transparent opacity-50" style={{background: `linear-gradient(90deg, transparent, ${themeStyles.accent}, transparent)`}} />
            </h1>
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className="text-sm transition-all duration-300 hover:scale-105 relative group"
              style={{color: themeStyles.accent}}
            >
              <span className="relative z-10">{showMetrics ? 'Hide' : 'Show'} Metrics</span>
              <div className="absolute inset-0 rounded opacity-0 group-hover:opacity-20 transition-opacity duration-300" style={{backgroundColor: themeStyles.accent}} />
            </button>
          </div>

          {/* Dashboard Metrics with breathing animation */}
          {showMetrics && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <button
                onClick={() => handleUrgencyFilter('urgent-response')}
                className="p-6 rounded-xl shadow-lg backdrop-blur-sm flex-1 text-left hover:scale-105 transition-all duration-300 cursor-pointer relative group active:animate-gradient-flash"
                style={{backgroundColor: 'rgba(239, 68, 68, 0.5)'}}
              >
                <div className="absolute inset-0 bg-red-400 rounded-xl opacity-0 group-hover:opacity-20 group-active:opacity-40 transition-opacity duration-300" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4" style={{color: themeStyles.textPrimary}} />
                    <span className="font-bold text-sm" style={{color: themeStyles.textPrimary}}>🚨 URGENT</span>
                    {activeFilters.urgency?.includes('urgent-response') && (
                      <span className="text-xs px-2 py-1 rounded-full" style={{backgroundColor: `${themeStyles.textPrimary}20`, color: themeStyles.textPrimary}}>ACTIVE</span>
                    )}
                  </div>
                  <div className="text-2xl font-bold" style={{color: themeStyles.textPrimary}}>
                    {leads.filter(lead => getResponseUrgency(lead) === 'urgent-response' && lead.intent !== null && lead.intent !== undefined).length}
                  </div>
                  <div className="text-xs mt-1" style={{color: themeStyles.textSecondary}}>Needs attention (they replied, 24h+ ago)</div>
                </div>
              </button>

              <button
                onClick={() => handleUrgencyFilter('needs-response')}
                className="p-6 rounded-xl shadow-lg backdrop-blur-sm flex-1 text-left hover:scale-105 transition-all duration-300 cursor-pointer relative group active:animate-gradient-flash"
                style={{backgroundColor: 'rgba(234, 179, 8, 0.5)'}}
              >
                <div className="absolute inset-0 bg-yellow-400 rounded-xl opacity-0 group-hover:opacity-20 group-active:opacity-40 transition-opacity duration-300" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4" style={{color: themeStyles.textPrimary}} />
                    <span className="font-bold text-sm" style={{color: themeStyles.textPrimary}}>⚡ NEEDS RESPONSE</span>
                    {activeFilters.urgency?.includes('needs-response') && (
                      <span className="text-xs px-2 py-1 rounded-full" style={{backgroundColor: `${themeStyles.textPrimary}20`, color: themeStyles.textPrimary}}>ACTIVE</span>
                    )}
                  </div>
                  <div className="text-2xl font-bold" style={{color: themeStyles.textPrimary}}>
                    {leads.filter(lead => getResponseUrgency(lead) === 'needs-response' && lead.intent !== null && lead.intent !== undefined).length}
                  </div>
                  <div className="text-xs mt-1" style={{color: themeStyles.textSecondary}}>They replied, awaiting your response (&lt;24h)</div>
                </div>
              </button>

              <button
                onClick={() => handleUrgencyFilter('needs-followup')}
                className="p-6 rounded-xl shadow-lg backdrop-blur-sm flex-1 text-left hover:scale-105 transition-all duration-300 cursor-pointer relative group active:animate-gradient-flash"
                style={{backgroundColor: 'rgba(34, 197, 94, 0.5)'}}
              >
                <div className="absolute inset-0 bg-green-400 rounded-xl opacity-0 group-hover:opacity-20 group-active:opacity-40 transition-opacity duration-300" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4" style={{color: themeStyles.textPrimary}} />
                    <span className="font-bold text-sm" style={{color: themeStyles.textPrimary}}>📞 NEEDS FOLLOWUP</span>
                    {activeFilters.urgency?.includes('needs-followup') && (
                      <span className="text-xs px-2 py-1 rounded-full" style={{backgroundColor: `${themeStyles.textPrimary}20`, color: themeStyles.textPrimary}}>ACTIVE</span>
                    )}
                  </div>
                  <div className="text-2xl font-bold" style={{color: themeStyles.textPrimary}}>
                    {leads.filter(lead => getResponseUrgency(lead) === 'needs-followup' && lead.intent !== null && lead.intent !== undefined).length}
                  </div>
                  <div className="text-xs mt-1" style={{color: themeStyles.textSecondary}}>You sent last, no reply 3+ days</div>
                </div>
              </button>
            </div>
          )}
          
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 transition-colors duration-300" style={{color: themeStyles.accent}} />
            <input
              type="text"
              placeholder="Search leads, tags, emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg backdrop-blur-sm focus:ring-2 transition-colors duration-300"
              style={{
                backgroundColor: themeStyles.tertiaryBg, 
                border: `1px solid ${themeStyles.border}`, 
                color: themeStyles.textPrimary,
                '--tw-ring-color': themeStyles.accent
              }}
            />
          </div>

          {/* Sort and Filter Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="relative">
              <button
                onClick={() => setShowSortPopup(!showSortPopup)}
                className="w-full flex items-center justify-between px-4 py-2 rounded-lg hover:opacity-80 backdrop-blur-sm transition-all"
                style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" style={{color: themeStyles.accent}} />
                  <span className="text-sm font-medium" style={{color: themeStyles.textPrimary}}>Sort</span>
                  {activeSorts.length > 0 && (
                    <span className="px-2 py-1 rounded-full text-xs" style={{backgroundColor: `${themeStyles.accent}20`, color: themeStyles.accent}}>
                      {activeSorts.length}
                    </span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4" style={{color: themeStyles.textMuted}} />
              </button>

              {/* Sort Popup */}
              {showSortPopup && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto transition-colors duration-300" style={{backgroundColor: themeStyles.primaryBg, border: `1px solid ${themeStyles.border}`}}>
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>Sort Options</h4>
                      <button
                        onClick={() => setShowSortPopup(false)}
                        className="transition-colors duration-300 hover:opacity-80"
                        style={{color: themeStyles.textMuted}}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Active Sorts */}
                    {activeSorts.length > 0 && (
                      <div className="mb-4">
                        <h5 className="text-xs font-medium mb-2 transition-colors duration-300" style={{color: themeStyles.textSecondary}}>ACTIVE SORTS</h5>
                        <div className="space-y-2">
                          {activeSorts.map((sort, index) => {
                            const option = sortOptions.find(opt => opt.field === sort.field);
                            return (
                              <div key={sort.field} className="flex items-center justify-between px-3 py-2 rounded-lg transition-colors duration-300" style={{backgroundColor: `${themeStyles.accent}20`, border: `1px solid ${themeStyles.accent}`}}>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-2 py-1 rounded transition-colors duration-300" style={{backgroundColor: themeStyles.accent, color: isDarkMode ? '#1A1C1A' : '#FFFFFF'}}>
                                    {index + 1}
                                  </span>
                                  <span className="text-sm transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{option?.label}</span>
                                  <button
                                    onClick={() => handleAddSort(sort.field, sort.direction === 'desc' ? 'asc' : 'desc')}
                                    className="text-xs hover:opacity-80 transition-colors duration-300"
                                    style={{color: themeStyles.accent}}
                                  >
                                    {sort.direction === 'desc' ? '↓' : '↑'}
                                  </button>
                                </div>
                                <button
                                  onClick={() => handleRemoveSort(sort.field)}
                                  className="hover:opacity-80 transition-colors duration-300"
                                  style={{color: themeStyles.textMuted}}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Available Sort Options */}
                    <div>
                      <h5 className="text-xs font-medium mb-2 transition-colors duration-300" style={{color: themeStyles.textSecondary}}>ADD SORT</h5>
                      <div className="space-y-1">
                        {sortOptions.map((option) => {
                          const isActive = activeSorts.some(s => s.field === option.field);
                          return (
                            <button
                              key={option.field}
                              onClick={() => !isActive && handleAddSort(option.field)}
                              disabled={isActive}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-300`}
                              style={{
                                backgroundColor: themeStyles.tertiaryBg,
                                color: isActive ? themeStyles.textMuted : themeStyles.textPrimary,
                                cursor: isActive ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {option.label}
                              {isActive && <span className="text-xs ml-2" style={{color: themeStyles.textMuted}}>(active)</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowFilterPopup(!showFilterPopup)}
                className="w-full flex items-center justify-between px-4 py-2 rounded-lg hover:opacity-80 backdrop-blur-sm transition-all"
                style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" style={{color: themeStyles.accent}} />
                  <span className="text-sm font-medium" style={{color: themeStyles.textPrimary}}>Filter</span>
                  {getActiveFilterCount() > 0 && (
                    <span className="px-2 py-1 rounded-full text-xs" style={{backgroundColor: `${themeStyles.accent}20`, color: themeStyles.accent}}>
                      {getActiveFilterCount()}
                    </span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4" style={{color: themeStyles.textMuted}} />
              </button>

                              {/* Filter Popup */}
                {showFilterPopup && (
                  <div className="absolute top-full left-0 right-0 mt-2 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto transition-colors duration-300" style={{backgroundColor: themeStyles.primaryBg, border: `1px solid ${themeStyles.border}`}}>
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>Filter Options</h4>
                        <div className="flex gap-2">
                          {getActiveFilterCount() > 0 && (
                            <button
                              onClick={handleClearAllFilters}
                              className="text-xs transition-colors duration-300"
                              style={{color: themeStyles.error}}
                            >
                              Clear All
                            </button>
                          )}
                          <button
                            onClick={() => setShowFilterPopup(false)}
                            className="transition-colors duration-300 hover:opacity-80"
                            style={{color: themeStyles.textMuted}}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Active Filters */}
                      {getActiveFilterCount() > 0 && (
                        <div className="mb-4">
                          <h5 className="text-xs font-medium mb-2 transition-colors duration-300" style={{color: themeStyles.textSecondary}}>ACTIVE FILTERS</h5>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(activeFilters).map(([category, values]) =>
                              (values || []).map((value) => {
                                const categoryOption = filterOptions[category];
                                const valueOption = categoryOption?.options.find(opt => opt.value === value);
                                if (!valueOption) return null;
                                
                                return (
                                  <span
                                    key={`${category}-${value}`}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                                    style={{backgroundColor: themeStyles.accent, color: isDarkMode ? '#1A1C1A' : '#FFFFFF'}}
                                  >
                                    {valueOption.label}
                                    <button
                                      onClick={() => handleRemoveFilter(category, value)}
                                      className="hover:opacity-80"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      {/* Filter Categories */}
                      <div className="space-y-4">
                        {Object.entries(filterOptions).map(([category, config]) => (
                          <div key={category}>
                            <h5 className="text-xs font-medium mb-2 uppercase transition-colors duration-300" style={{color: themeStyles.textSecondary}}>
                              {config.label}
                            </h5>
                            <div className="space-y-1">
                              {config.options.map((option) => {
                                const isActive = activeFilters[category]?.includes(option.value);
                                return (
                                  <button
                                    key={option.value}
                                    onClick={() => {
                                      if (isActive) {
                                        handleRemoveFilter(category, option.value);
                                      } else {
                                        handleAddFilter(category, option.value);
                                      }
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-300`}
                                    style={{
                                      backgroundColor: isActive ? `${themeStyles.accent}20` : themeStyles.tertiaryBg,
                                      color: themeStyles.textPrimary,
                                      border: isActive ? `1px solid ${themeStyles.accent}` : `1px solid ${themeStyles.border}`
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      {option.label}
                                      {isActive && <span style={{color: themeStyles.accent}}>✓</span>}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>



          {/* Intent Filter Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setIntentFilter('positive')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all backdrop-blur-sm ${
                intentFilter === 'positive'
                  ? 'opacity-100' 
                  : 'opacity-80 hover:opacity-90'
              }`}
              style={{
                backgroundColor: intentFilter === 'positive' ? `${themeStyles.accent}20` : themeStyles.tertiaryBg, 
                color: intentFilter === 'positive' ? themeStyles.accent : themeStyles.textPrimary, 
                border: `1px solid ${themeStyles.border}`
              }}
              disabled={loading}
            >
              Positive Intent
              <span className="ml-2 px-2 py-1 rounded-full text-xs" style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textMuted}}>
                {leads.filter(lead => !isIntentNull(lead.intent)).length}
              </span>
            </button>
            <button
              onClick={() => setIntentFilter('negative')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all backdrop-blur-sm ${
                intentFilter === 'negative'
                  ? 'opacity-100'
                  : 'opacity-80 hover:opacity-90'
              }`}
              style={{
                backgroundColor: intentFilter === 'negative' ? `${themeStyles.accent}20` : themeStyles.tertiaryBg, 
                color: intentFilter === 'negative' ? themeStyles.accent : themeStyles.textPrimary, 
                border: `1px solid ${themeStyles.border}`
              }}
              disabled={loading}
            >
              Negative Intent
                    <span className="ml-2 px-2 py-1 rounded-full text-xs" style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textMuted}}>
                {leads.filter(lead => isIntentNull(lead.intent)).length}
                    </span>
            </button>
            <button
              onClick={() => setIntentFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all backdrop-blur-sm ${
                intentFilter === 'all'
                  ? 'opacity-100'
                  : 'opacity-80 hover:opacity-90'
              }`}
              style={{
                backgroundColor: intentFilter === 'all' ? `${themeStyles.accent}20` : themeStyles.tertiaryBg, 
                color: intentFilter === 'all' ? themeStyles.accent : themeStyles.textPrimary, 
                border: `1px solid ${themeStyles.border}`
              }}
              disabled={loading}
            >
              All
                    <span className="ml-2 px-2 py-1 rounded-full text-xs" style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textMuted}}>
                {leads.length}
                    </span>
            </button>
          </div>




        </div>

        {/* Lead List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{scrollbarWidth: 'thin', scrollbarColor: '#54FCFF rgba(26, 28, 26, 0.5)', minHeight: 0}}>
          <div className="pb-4">
            {filteredAndSortedLeads.length === 0 ? (
              <div className="text-center p-8 text-white">
                <p>No leads found for current filter</p>
              </div>
            ) : null}
            {filteredAndSortedLeads.map((lead, index) => {
            try {
              const intentStyle = getIntentStyle(lead.intent);
              const lastMessage = lead.conversation && lead.conversation.length > 0 ? lead.conversation[lead.conversation.length - 1] : null;
              const urgency = getResponseUrgency(lead);
              const displayTags = generateAutoTags(lead.conversation, lead);
            
            // Get the response badge for top of card
            const getResponseBadge = () => {
              if (urgency === 'urgent-response') {
                return (
                  <div className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold mb-3 shadow-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-white opacity-20 animate-pulse" />
                    <span className="relative z-10">🚨 URGENT NEEDS RESPONSE</span>
                  </div>
                );
              } else if (urgency === 'needs-response') {
                return (
                  <div className="bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-medium mb-3 shadow-md relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10 transform -skew-x-12 animate-shimmer" />
                    <span className="relative z-10">⚡ NEEDS RESPONSE</span>
                  </div>
                );
              } else if (urgency === 'needs-followup') {
                return (
                  <div className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-medium mb-3 shadow-md relative overflow-hidden">
                    <div className="absolute inset-0 bg-white opacity-10 animate-pulse" />
                    <span className="relative z-10">📞 NEEDS FOLLOWUP</span>
                  </div>
                );
              }
              return null;
            };
            
            return (
              <div
                key={lead.id}
                onClick={() => {
                  setSelectedLead(lead);
                  // Clear attachments and scheduling when switching leads
                  setAttachedFiles([]);
                  setScheduledTime(null);
                  setShowScheduler(false);
                }}
                className={`p-5 cursor-pointer transition-all duration-300 ease-out relative m-2 rounded-lg group`}
                style={{
                  backgroundColor: selectedLead?.id === lead.id ? `${themeStyles.accent}20` : themeStyles.tertiaryBg,
                  border: selectedLead?.id === lead.id ? `2px solid ${themeStyles.accent}80` : `1px solid ${themeStyles.border}`,
                  borderLeft: urgency !== 'none' ? `4px solid ${themeStyles.accent}` : `1px solid ${themeStyles.border}`,
                  boxShadow: selectedLead?.id === lead.id ? `0 0 30px ${themeStyles.accent}30` : 'none',
                  animationDelay: `${index * 0.1}s`,
                  backdropFilter: 'blur(5px)'
                }}
              >
                {/* Hover glow effect */}
                <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" 
                     style={{background: `linear-gradient(45deg, ${themeStyles.accent}10 0%, ${themeStyles.accent}05 100%)`}} />
                
                <div className="relative z-10">
                  {/* Response Badge at Top */}
                  {getResponseBadge()}
                  
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`transition-all duration-300 ${urgency !== 'none' ? 'font-bold' : 'font-medium'} flex items-center gap-2`}
                        style={{color: selectedLead?.id === lead.id ? themeStyles.accent : themeStyles.textPrimary}}>
                      <span>{lead.first_name} {lead.last_name}</span>
                      {urgency !== 'none' && <span className="text-sm animate-pulse" style={{color: themeStyles.error}}>●</span>}
                      {drafts[lead.id] && (
                        <span 
                          className="px-2 py-1 text-xs rounded-full transition-all duration-300 flex items-center gap-1"
                          style={{backgroundColor: `${themeStyles.warning}20`, border: `1px solid ${themeStyles.warning}`, color: themeStyles.warning}}
                          title="Has unsaved draft"
                        >
                          <Edit3 className="w-3 h-3" />
                          Draft
                        </span>
                      )}
                      {lead.status === 'CRM' && (
                        <span className="ml-2 px-2 py-1 rounded-full text-xs bg-blue-900 text-blue-300">CRM</span>
                      )}
                    </h3>
                    <div className="flex items-center gap-1">
                      <span className="px-2 py-1 text-xs rounded-full transition-all duration-300 transform group-hover:scale-110" 
                            style={{backgroundColor: intentStyle.bg, border: intentStyle.border, color: intentStyle.text}}>
                        {intentStyle.label}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm mb-1 transition-colors duration-300" style={{color: themeStyles.textSecondary}}>{lead.email}</p>
                  <p className={`text-sm mb-2 transition-all duration-300 ${urgency !== 'none' ? 'font-bold' : 'font-medium'}`}
                     style={{color: selectedLead?.id === lead.id ? themeStyles.accent : themeStyles.textPrimary}}>
                    {lead.subject}
                  </p>
                  

                  
                  {/* Interactive Category Dropdown */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <div className="relative category-dropdown" style={{zIndex: 10000}}>
                      {(() => {
                        const currentCategory = CATEGORY_OPTIONS.find(opt => opt.value === lead.lead_category) || CATEGORY_OPTIONS[0];
                        const isDropdownOpen = categoryDropdowns.has(lead.id);
                        
                        return (
                          <>
                            <button
                              ref={(el) => {
                                if (el) {
                                  dropdownButtonRefs.current[lead.id] = el;
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCategoryDropdown(lead.id);
                              }}
                              className="text-sm px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2 font-semibold"
                              style={{
                                backgroundColor: `${currentCategory.color}30`,
                                color: '#ffffff',
                                border: `2px solid ${currentCategory.color}`,
                                animation: `tagFadeIn 0.5s ease-out ${index * 0.1}s both`,
                                boxShadow: `0 2px 8px ${currentCategory.color}20`
                              }}
                            >
                              <span>{currentCategory.label}</span>
                              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {/* Portal dropdown is rendered separately */}
                          </>
                        );
                      })()}
                    </div>
                    
                    {/* Show additional tags if any exist beyond the main category */}
                    {displayTags.slice(1, 3).map((tag, tagIndex) => (
                      <span key={tag} 
                            className="text-xs px-3 py-1 rounded-full transition-all duration-300 transform hover:scale-110" 
                            style={{
                              backgroundColor: `${themeStyles.accent}15`, 
                              color: themeStyles.textPrimary, 
                              border: `1px solid ${themeStyles.border}`,
                              animation: `tagFadeIn 0.5s ease-out ${(index * 0.1) + ((tagIndex + 1) * 0.1)}s both`
                            }}>
                        {tag}
                      </span>
                    ))}
                    {displayTags.length > 3 && (
                      <span className="text-xs transition-colors duration-300" style={{color: themeStyles.textSecondary}}>+{displayTags.length - 3}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs" style={{color: themeStyles.textSecondary}}>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center transition-all duration-300">
                        <Timer className="w-3 h-3 mr-1 transition-transform duration-300 group-hover:rotate-12" />
                        Last followup: {(() => {
                          const lastSent = lead.conversation.filter(m => m.type === 'SENT');
                          if (lastSent.length === 0) return 'N/A';
                          const daysSince = Math.floor((new Date() - new Date(lastSent[lastSent.length - 1].time)) / (1000 * 60 * 60 * 24));
                          return `${daysSince}d ago`;
                        })()}
                      </div>
                      <div className="flex items-center transition-all duration-300">
                        <Clock className="w-3 h-3 mr-1 transition-transform duration-300 group-hover:rotate-12" />
                        Last reply: {(() => {
                          const lastReply = getLastResponseFromThem(lead.conversation);
                          if (!lastReply) return 'None';
                          const daysSince = Math.floor((new Date() - new Date(lastReply)) / (1000 * 60 * 60 * 24));
                          return `${daysSince}d ago`;
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs transition-all duration-300 transform group-hover:scale-105" 
                            style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`, color: themeStyles.textPrimary}}>
                        {lead.conversation.length} messages
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
            } catch (error) {
              console.error('Error rendering lead:', lead.first_name, error);
              return (
                <div key={lead.id || index} className="p-4 m-2 bg-red-500/20 text-white rounded">
                  Error rendering {lead.first_name || 'Unknown'}: {error.message}
                </div>
              );
            }
          })}
          </div>
        </div>
      </div>

      {/* Main Content - Lead Details */}
      <div className="flex-1 flex flex-col shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, borderRadius: '12px', margin: '8px', marginLeft: '4px', border: `1px solid ${themeStyles.border}`}}>
        {selectedLead ? (
          <>
            {/* Lead Header */}
            <div className="p-8 transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, borderRadius: '12px 12px 0 0', borderBottom: `1px solid ${themeStyles.border}`}}>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-bold transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                    {selectedLead.first_name} {selectedLead.last_name}
                  </h2>
                  <p className="mt-2 font-medium transition-colors duration-300" style={{color: themeStyles.textSecondary}}>{selectedLead.email}</p>
                  {selectedLead.phone ? (
                    <p className="text-sm mt-2 flex items-center gap-2 transition-colors duration-300" style={{color: themeStyles.accent}}>
                      <Phone className="w-3 h-3" />
                      <span className="font-medium">{selectedLead.phone}</span>
                    </p>
                  ) : (
                    <p className="text-sm mt-2 flex items-center gap-2 transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                      <Phone className="w-3 h-3" />
                      <span>No phone number found</span>
                    </p>
                  )}
                  {selectedLead.website && (
                    <p className="text-sm mt-2">
                      <a href={`https://${selectedLead.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-colors duration-300" style={{color: themeStyles.accent}}>
                        {selectedLead.website}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {(() => {
                    const intentStyle = getIntentStyle(selectedLead.intent);
                    return (
                      <span className="px-3 py-1 rounded-full text-sm font-medium transition-colors duration-300" style={{backgroundColor: intentStyle.bg, border: intentStyle.border, color: intentStyle.text}}>
                        {intentStyle.label} ({selectedLead.intent}/10)
                      </span>
                    );
                  })()}
                  <button
                    onClick={() => showDeleteConfirmation(selectedLead)}
                    className="px-3 py-2 rounded-lg transition-colors duration-300 flex items-center gap-2 text-sm hover:opacity-80"
                    title="Delete lead"
                    style={{border: `1px solid ${themeStyles.border}`, backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textPrimary}}
                  >
                    <X className="w-4 h-4" />
                    Delete
                  </button>
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="p-2 rounded-lg transition-colors duration-300 hover:opacity-80"
                    style={{border: `1px solid ${themeStyles.border}`, backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textMuted}}
                  >
                    <X className="w-5 h-5" />
                  </button>
                  {selectedLead && selectedLead.status !== 'CRM' && (
                    <button
                      onClick={() => handleAddToCRM(selectedLead)}
                      className="px-3 py-2 rounded-lg transition-colors duration-300 flex items-center gap-2 text-sm bg-blue-600 text-white hover:bg-blue-700"
                      style={{marginRight: '8px'}}
                      title="Move to CRM"
                    >
                      Add to CRM
                    </button>
                  )}
                  {selectedLead && selectedLead.status === 'CRM' && (
                    <button
                      onClick={() => handleRemoveFromCRM(selectedLead)}
                      className="px-3 py-2 rounded-lg transition-colors duration-300 flex items-center gap-2 text-sm bg-red-600 text-white hover:bg-red-700"
                      style={{marginRight: '8px'}}
                      title="Remove from CRM"
                    >
                      Remove from CRM
                    </button>
                  )}
                  {selectedLead.status === 'CRM' && (
                    <span className="ml-2 px-2 py-1 rounded-full text-xs bg-blue-900 text-blue-300">CRM</span>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 transition-colors duration-300" style={{scrollbarWidth: 'thin', scrollbarColor: `${themeStyles.accent} ${themeStyles.primaryBg}50`}}>
              <div className="space-y-8">
                      {/* Unified Lead Information Section */}
                <div className="rounded-2xl p-6 shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}>
                        <div className="flex justify-between items-center mb-6">
                          <h3 className="font-bold flex items-center text-lg transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                    <User className="w-4 h-4 mr-2 transition-colors duration-300" style={{color: themeStyles.accent}} />
                    Lead Information
                  </h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => findPhoneNumber(selectedLead)}
                              disabled={searchingPhoneLeads.has(selectedLead.id)}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-all backdrop-blur-sm hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
                              style={{backgroundColor: `${themeStyles.accent}20`, color: themeStyles.accent, border: `1px solid ${themeStyles.accent}30`}}
                            >
                              {searchingPhoneLeads.has(selectedLead.id) ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{borderColor: themeStyles.accent}} />
                                  Searching...
                                </>
                              ) : (
                                <>
                                  <Phone className="w-4 h-4" />
                                  Find Phone
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => enrichLeadData(selectedLead)}
                              disabled={enrichingLeads.has(selectedLead.id)}
                              className="px-4 py-2 rounded-lg text-sm font-medium transition-all backdrop-blur-sm hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
                              style={{backgroundColor: `${themeStyles.accent}20`, color: themeStyles.accent, border: `1px solid ${themeStyles.accent}30`}}
                            >
                              {enrichingLeads.has(selectedLead.id) ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{borderColor: themeStyles.accent}} />
                                  Enriching...
                                </>
                              ) : (
                                <>
                                  <Zap className="w-4 h-4" />
                                  Enrich
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Communication Timeline */}
                        <div className="mb-6 p-4 rounded-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-6">
                              <div>
                                <span className="transition-colors duration-300" style={{color: themeStyles.textMuted}}>Last Reply</span>
                                <p className="font-medium mt-1 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                                  {(() => {
                                    const lastReply = getLastResponseFromThem(selectedLead.conversation);
                                    return lastReply ? formatTime(lastReply) : 'No replies yet';
                                  })()}
                                </p>
                              </div>
                              <div>
                                <span className="transition-colors duration-300" style={{color: themeStyles.textMuted}}>Last Followup</span>
                                <p className="font-medium mt-1 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                                  {(() => {
                                    const lastSent = selectedLead.conversation.filter(m => m.type === 'SENT');
                                    return lastSent.length > 0 ? formatTime(lastSent[lastSent.length - 1].time) : 'N/A';
                                  })()}
                                </p>
                              </div>
                              <div>
                                <span className="transition-colors duration-300" style={{color: themeStyles.textMuted}}>Avg Response</span>
                                <p className="font-medium mt-1 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{formatResponseTime(selectedLead.response_time_avg)}</p>
                              </div>
                            </div>
                            <div className="px-3 py-1 rounded-full text-sm transition-colors duration-300" style={{backgroundColor: `${themeStyles.accent}15`, border: `1px solid ${themeStyles.accent}20`}}>
                              <span className="font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{selectedLead.conversation.filter(m => m.type === 'REPLY').length}</span>
                              <span className="transition-colors duration-300" style={{color: themeStyles.textMuted}}> replies</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {/* General Info Subsection */}
                          <div className="rounded-lg overflow-hidden transition-all duration-200" style={{backgroundColor: themeStyles.tertiaryBg}}>
                            <button 
                              onClick={() => toggleSection('general')}
                              className="w-full px-4 py-3 flex items-center justify-between hover:opacity-80 transition-colors duration-300"
                            >
                              <div className="flex items-center gap-2">
                                <ChevronRight 
                                  className={`w-4 h-4 transition-transform duration-200 ${activeSection.includes('general') ? 'rotate-90' : ''}`} 
                                  style={{color: themeStyles.accent}} 
                                />
                                <span className="font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>General Information</span>
                              </div>
                            </button>
                            {activeSection.includes('general') && (
                              <div className="px-4 pb-4">
                                <div className="grid grid-cols-2 gap-4 text-sm pl-6">
                    <div>
                      <span className="transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Subject:</span>
                      <p className="font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{selectedLead.subject}</p>
                    </div>
                    <div>
                      <span className="transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Website:</span>
                      <p className="font-medium">
                        {selectedLead.website ? (
                          <a href={`https://${selectedLead.website}`} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 flex items-center gap-1 transition-colors duration-300" style={{color: themeStyles.accent}}>
                            {selectedLead.website}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : <span className="transition-colors duration-300" style={{color: themeStyles.textPrimary}}>N/A</span>}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Tags:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedLead.tags.map(tag => (
                          <span key={tag} className="text-xs px-2 py-1 rounded-full transition-colors duration-300" style={{backgroundColor: `${themeStyles.accent}15`, border: `1px solid ${themeStyles.border}`, color: themeStyles.textPrimary}}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                              </div>
                            )}
                </div>

                          {/* Enrichment Data Subsection */}
                          <div className="rounded-lg overflow-hidden transition-all duration-200" style={{backgroundColor: themeStyles.tertiaryBg}}>
                            <button 
                              onClick={() => toggleSection('enrichment')}
                              className="w-full px-4 py-3 flex items-center justify-between hover:opacity-80 transition-colors duration-300"
                            >
                              <div className="flex items-center gap-2">
                                <ChevronRight 
                                  className={`w-4 h-4 transition-transform duration-200 ${activeSection.includes('enrichment') ? 'rotate-90' : ''}`} 
                                  style={{color: themeStyles.accent}} 
                                />
                                <span className="font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>Enrichment Data</span>
                      </div>
                              {(!selectedLead.role && !selectedLead.company_data && !selectedLead.personal_linkedin_url && !selectedLead.business_linkedin_url) && (
                                <span className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>No data yet</span>
                              )}
                            </button>
                            {activeSection.includes('enrichment') && (
                              <div className="px-4 pb-4">
                                {(!selectedLead.role && !selectedLead.company_data && !selectedLead.personal_linkedin_url && !selectedLead.business_linkedin_url) ? (
                                  <div className="text-center py-6 rounded-lg mx-6 transition-colors duration-300" style={{color: themeStyles.textMuted, border: `1px solid ${themeStyles.border}`}}>
                                    <Zap className="w-8 h-8 mx-auto mb-3 opacity-50" />
                                    <p className="text-sm">Click the Enrich button above to fetch additional data</p>
                      </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-4 text-sm pl-6">
                                    <div>
                                      <span className="transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Role:</span>
                                      <p className="font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{selectedLead.role || 'N/A'}</p>
                    </div>
                                    <div className="col-span-2">
                                      <span className="transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Company Summary:</span>
                                      <p className="font-medium mt-1 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{selectedLead.company_data || 'N/A'}</p>
                      </div>
                                    <div>
                                      <span className="transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Personal LinkedIn:</span>
                                      {selectedLead.personal_linkedin_url ? (
                                        <a
                                          href={selectedLead.personal_linkedin_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-medium hover:opacity-80 flex items-center gap-1 transition-colors duration-300"
                                          style={{color: themeStyles.accent}}
                                        >
                                          View Profile
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      ) : (
                                        <p className="font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>N/A</p>
                                      )}
                      </div>
                                    <div>
                                      <span className="transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Company LinkedIn:</span>
                                      {selectedLead.business_linkedin_url ? (
                                        <a
                                          href={selectedLead.business_linkedin_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-medium hover:opacity-80 flex items-center gap-1 transition-colors duration-300"
                                          style={{color: themeStyles.accent}}
                                        >
                                          View Company
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      ) : (
                                        <p className="font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>N/A</p>
                                      )}
                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Engagement Metrics Subsection */}
                          <div className="rounded-lg overflow-hidden transition-all duration-200" style={{backgroundColor: themeStyles.tertiaryBg}}>
                            <button 
                              onClick={() => toggleSection('engagement')}
                              className="w-full px-4 py-3 flex items-center justify-between hover:opacity-80 transition-colors duration-300"
                            >
                              <div className="flex items-center gap-2">
                                <ChevronRight 
                                  className={`w-4 h-4 transition-transform duration-200 ${activeSection.includes('engagement') ? 'rotate-90' : ''}`} 
                                  style={{color: themeStyles.accent}} 
                                />
                                <span className="font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>Engagement Metrics</span>
                              </div>
                            </button>
                            {activeSection.includes('engagement') && (
                              <div className="px-4 pb-4">
                                <div className="grid grid-cols-3 gap-4 text-sm pl-6">
                                  <div className="col-span-3 p-4 rounded-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}>
                                    <div className="grid grid-cols-3 gap-8">
                                      <div>
                                        <span className="transition-colors duration-300" style={{color: themeStyles.textMuted}}>Avg Response Time</span>
                                        <p className="text-2xl font-bold mt-1 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                                          {formatResponseTime(selectedLead.response_time_avg)}
                                        </p>
                                      </div>
                                      <div>
                                        <span className="transition-colors duration-300" style={{color: themeStyles.textMuted}}>Intent Score</span>
                                        <p className="text-2xl font-bold mt-1 transition-colors duration-300" style={{color: themeStyles.accent}}>
                          {selectedLead.intent !== null && selectedLead.intent !== undefined 
                            ? `${getIntentLabel(selectedLead.intent)} (${selectedLead.intent}/10)`
                            : getIntentLabel(selectedLead.intent)
                          }
                                        </p>
                                      </div>
                                      <div>
                                        <span className="transition-colors duration-300" style={{color: themeStyles.textMuted}}>Reply Rate</span>
                                        <p className="text-2xl font-bold mt-1 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                        {selectedLead.conversation.filter(msg => msg.type === 'REPLY').length}/{selectedLead.conversation.filter(msg => msg.type === 'SENT').length}
                                        </p>
                      </div>
                      </div>
                                  </div>
                                </div>
                              </div>
                            )}
                    </div>
                  </div>
                </div>

                {/* Conversation History */}
                <div className="rounded-2xl p-6 shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}>
                  <h3 className="font-bold mb-4 flex items-center text-lg transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                    <MessageSquare className="w-4 h-4 mr-2 transition-colors duration-300" style={{color: themeStyles.accent}} />
                    Conversation History ({selectedLead.conversation.length} messages)
                  </h3>
                  <div className="space-y-6 max-h-96 overflow-y-auto" style={{scrollbarWidth: 'thin', scrollbarColor: `${themeStyles.accent} ${themeStyles.primaryBg}50`}}>
                                          {selectedLead.conversation.map((message, index) => (
                        <div key={index} className={`p-5 rounded-xl border shadow-sm transition-colors duration-300`} style={{
                          backgroundColor: message.type === 'SENT' 
                            ? `${themeStyles.accent}08` 
                            : themeStyles.tertiaryBg,
                          borderColor: message.type === 'SENT' 
                            ? `${themeStyles.accent}30` 
                            : themeStyles.border
                        }}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="text-sm">
                              <span className={`font-medium transition-colors duration-300`} style={{color: message.type === 'SENT' ? themeStyles.accent : themeStyles.textPrimary}}>
                                {message.type === 'SENT' ? 'Outbound' : 'Reply'} 
                              </span>
                              <span className="ml-2 transition-colors duration-300" style={{color: themeStyles.textSecondary}}>
                                {formatTime(message.time)}
                              </span>
                              {message.response_time && (
                                <span className="ml-2 text-xs transition-colors duration-300" style={{color: themeStyles.success}}>
                                  • {formatResponseTime(message.response_time)} response
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs rounded-full transition-colors duration-300`} style={{
                                backgroundColor: message.type === 'SENT' 
                                  ? `${themeStyles.accent}15` 
                                  : themeStyles.tertiaryBg,
                                border: `1px solid ${themeStyles.border}`,
                                color: message.type === 'SENT' ? themeStyles.accent : themeStyles.textPrimary
                              }}>
                                {message.type}
                              </span>
                            </div>
                          </div>

                          {/* Email routing information */}
                          <div className="mb-3 text-xs space-y-1 transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                            <div className="flex flex-wrap gap-4">
                              <span><strong>From:</strong> {message.from || 'N/A'}</span>
                              <span><strong>To:</strong> {message.to || 'N/A'}</span>
                            </div>
                            {message.cc && Array.isArray(message.cc) && message.cc.length > 0 && (
                              <div>
                                <strong>CC:</strong> {message.cc.map(cc => {
                                  if (typeof cc === 'string') return cc;
                                  if (cc && cc.address) return cc.address;
                                  if (cc && cc.name && cc.name.trim() !== '') return cc.name;
                                  return '';
                                }).filter(Boolean).join(', ')}
                              </div>
                            )}
                            {message.subject && (
                              <div>
                                <strong>Subject:</strong> {message.subject}
                              </div>
                            )}
                          </div>

                          <div className="text-sm whitespace-pre-wrap leading-relaxed transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                            {message.content}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Response Section */}
                <div className="rounded-2xl p-6 shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold flex items-center text-lg transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                      <Mail className="w-4 h-4 mr-2 transition-colors duration-300" style={{color: themeStyles.accent}} />
                      Compose Response
                    </h3>
                    {/* Draft Status Indicator */}
                    <div className="flex items-center gap-2 text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                      {isDraftSaving && (
                        <span className="flex items-center gap-1">
                          <div className="animate-spin w-3 h-3 border border-t-transparent rounded-full" style={{borderColor: themeStyles.accent}} />
                          Saving draft...
                        </span>
                      )}
                      {selectedLead && drafts[selectedLead.id] && !isDraftSaving && (
                        <span className="flex items-center gap-1" style={{color: themeStyles.success}}>
                          <CheckCircle className="w-3 h-3" />
                          Draft saved {new Date(drafts[selectedLead.id].savedAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {/* Editable Email Recipients */}
                    <div className="p-4 rounded-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}>
                      <h4 className="font-medium mb-3 flex items-center text-sm transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                        <Mail className="w-4 h-4 mr-2 transition-colors duration-300" style={{color: themeStyles.accent}} />
                        Email Recipients
                      </h4>
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="text-xs block mb-1 transition-colors duration-300" style={{color: themeStyles.textSecondary}}>To:</label>
                          <input
                            type="email"
                            value={editableToEmail}
                            onChange={(e) => setEditableToEmail(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm focus:ring-2 transition-colors duration-300"
                            style={{
                              backgroundColor: themeStyles.secondaryBg, 
                              border: `1px solid ${themeStyles.border}`, 
                              color: themeStyles.textPrimary,
                              '--tw-ring-color': themeStyles.accent
                            }}
                            placeholder="Primary recipient email"
                          />
                        </div>
                        <div>
                          <label className="text-xs block mb-1 transition-colors duration-300" style={{color: themeStyles.textSecondary}}>CC: (separate multiple emails with commas)</label>
                          <input
                            type="text"
                            value={editableCcEmails}
                            onChange={(e) => setEditableCcEmails(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg text-sm focus:ring-2 transition-colors duration-300"
                            style={{
                              backgroundColor: themeStyles.secondaryBg, 
                              border: `1px solid ${themeStyles.border}`, 
                              color: themeStyles.textPrimary,
                              '--tw-ring-color': themeStyles.accent
                            }}
                            placeholder="CC recipients (optional)"
                          />
                        </div>
                        <div className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                          Auto-populated based on conversation. Edit as needed before sending.
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={generateDraft}
                        disabled={isGeneratingDraft}
                        className="px-4 py-2 rounded-lg hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-300"
                        style={{backgroundColor: themeStyles.accent, color: isDarkMode ? '#1A1C1A' : '#FFFFFF'}}
                      >
                        <Edit3 className="w-4 h-4" />
                        {isGeneratingDraft ? 'Generating...' : 'Generate Smart Draft'}
                      </button>
                      
                      <button
                        onClick={() => setShowTemplateSelector(true)}
                        className="px-4 py-2 rounded-lg hover:opacity-80 flex items-center gap-2 transition-all duration-300"
                        style={{backgroundColor: `${themeStyles.accent}20`, color: themeStyles.accent, border: `1px solid ${themeStyles.accent}30`}}
                      >
                        <FileText className="w-4 h-4" />
                        Use Template
                      </button>
                    </div>

                    {/* Rich Text Editor with Formatting */}
                    <div className="space-y-3">
                      {/* Formatting Toolbar */}
                      <div className="flex flex-wrap gap-2 p-3 rounded-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}>
                        <button
                          type="button"
                          onClick={() => formatText('bold')}
                          className="px-3 py-1 rounded text-xs font-bold hover:opacity-80 transition-all duration-300"
                          style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textPrimary}}
                          title="Bold"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => formatText('italic')}
                          className="px-3 py-1 rounded text-xs italic hover:opacity-80 transition-all duration-300"
                          style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textPrimary}}
                          title="Italic"
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={() => formatText('underline')}
                          className="px-3 py-1 rounded text-xs underline hover:opacity-80 transition-all duration-300"
                          style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textPrimary}}
                          title="Underline"
                        >
                          U
                        </button>
                        <button
                          type="button"
                          onClick={insertLink}
                          className="px-3 py-1 rounded text-xs hover:opacity-80 transition-all duration-300 flex items-center gap-1"
                          style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textPrimary}}
                          title="Insert Link"
                        >
                          🔗 Link
                        </button>
                        <button
                          type="button"
                          onClick={insertList}
                          className="px-3 py-1 rounded text-xs hover:opacity-80 transition-all duration-300"
                          style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textPrimary}}
                          title="Bullet List"
                        >
                          • List
                        </button>

                        <div className="mx-2" style={{borderLeft: `1px solid ${themeStyles.border}`}}></div>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                          className="hidden"
                          id="attachment-input"
                          onChange={handleFileAttachment}
                        />
                        <label
                          htmlFor="attachment-input"
                          className="px-3 py-1 rounded text-xs hover:opacity-80 transition-all duration-300 cursor-pointer flex items-center gap-1"
                          style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textPrimary}}
                          title="Attach File"
                        >
                          📎 Attach
                        </label>
                      </div>

                      {/* Attached Files Display */}
                      {attachedFiles.length > 0 && (
                        <div className="p-3 rounded-lg transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}>
                          <h4 className="text-sm font-medium mb-2 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                            Attached Files ({attachedFiles.length})
                          </h4>
                          <div className="space-y-2">
                            {attachedFiles.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="flex items-center justify-between p-2 rounded-lg transition-colors duration-300"
                                style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="flex-shrink-0">
                                    {attachment.type.startsWith('image/') ? (
                                      <span className="text-lg">🖼️</span>
                                    ) : attachment.type.includes('pdf') ? (
                                      <span className="text-lg">📄</span>
                                    ) : attachment.type.includes('doc') ? (
                                      <span className="text-lg">📝</span>
                                    ) : (
                                      <span className="text-lg">📎</span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                                      {attachment.name}
                                    </p>
                                    <p className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                                      {formatFileSize(attachment.size)}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeAttachment(attachment.id)}
                                  className="flex-shrink-0 p-1 rounded-lg hover:opacity-80 transition-all duration-300"
                                  style={{color: themeStyles.error}}
                                  title="Remove attachment"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rich Text Editor */}
                      <div
                        contentEditable
                        suppressContentEditableWarning={true}
                        onInput={handleTextareaChange}
                        onKeyDown={(e) => {
                          // Handle common keyboard shortcuts
                          if (e.ctrlKey || e.metaKey) {
                            switch(e.key) {
                              case 'b':
                                e.preventDefault();
                                formatText('bold');
                                break;
                              case 'i':
                                e.preventDefault();
                                formatText('italic');
                                break;
                              case 'u':
                                e.preventDefault();
                                formatText('underline');
                                break;
                              case 'z':
                                e.preventDefault();
                                if (e.shiftKey) {
                                  document.execCommand('redo', false, null);
                                } else {
                                  document.execCommand('undo', false, null);
                                }
                                handleTextareaChange({ target: e.target });
                                break;
                              case 'y':
                                // Ctrl+Y for redo (alternative to Ctrl+Shift+Z)
                                e.preventDefault();
                                document.execCommand('redo', false, null);
                                handleTextareaChange({ target: e.target });
                                break;
                              case 'a':
                                // Let Ctrl+A work naturally - don't prevent default
                                break;
                              case 'c':
                              case 'v':
                              case 'x':
                                // Let copy/paste/cut work naturally
                                break;
                            }
                          } else if (e.key === 'Enter' && e.shiftKey) {
                            // Handle Shift+Enter to exit lists and create new normal line (keeping current bullet)
                                  const selection = window.getSelection();
                                  if (selection.rangeCount > 0) {
                                    const range = selection.getRangeAt(0);
                              let currentElement = range.startContainer;
                              
                              // Find the list item we're in (if any)
                              while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
                                currentElement = currentElement.parentNode;
                              }
                              
                              // Check if we're in a list item
                              if (currentElement && currentElement.tagName === 'LI') {
                                      e.preventDefault();
                                      
                                // Find the parent list (ul or ol)
                                const list = currentElement.closest('ul, ol');
                                if (list) {
                                  // Create a new div for normal text after the list
                                  const newDiv = document.createElement('div');
                                  newDiv.innerHTML = '<br>';
                                  
                                  // Insert the new div after the list
                                  list.parentNode.insertBefore(newDiv, list.nextSibling);
                                  
                                  // Move cursor to the new div
                                        const newRange = document.createRange();
                                  newRange.setStart(newDiv, 0);
                                        newRange.collapse(true);
                                        selection.removeAllRanges();
                                        selection.addRange(newRange);
                                  
                                  // Update content
                                  handleTextareaChange({ target: e.target });
                                }
                              }
                            }
                          } else if (e.key === 'Tab') {
                            // Handle Tab for indent/outdent
                            e.preventDefault();
                            const selection = window.getSelection();
                            
                            if (selection.rangeCount > 0) {
                              let currentElement = selection.getRangeAt(0).startContainer;
                              while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
                                currentElement = currentElement.parentNode;
                              }
                              
                              // If we're in a list, use list indenting
                              if (currentElement && (currentElement.tagName === 'LI' || currentElement.closest('ul, ol'))) {
                                if (e.shiftKey) {
                                  document.execCommand('outdent', false, null);
                                } else {
                                  document.execCommand('indent', false, null);
                                }
                              } else {
                                // For normal text, insert tab spaces or indent the paragraph
                                if (e.shiftKey) {
                                  document.execCommand('outdent', false, null);
                                } else {
                                  // Insert 4 spaces as tab
                                  document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
                                }
                              }
                            }
                            
                            // Update content
                            handleTextareaChange({ target: e.target });
                          } else if (e.key === 'Backspace') {
                            // Handle exiting lists when backspacing at the beginning of an empty list item
                            const selection = window.getSelection();
                            if (selection.rangeCount > 0) {
                              const range = selection.getRangeAt(0);
                              let currentElement = range.startContainer;
                              
                              // Find the list item we're in (if any)
                              while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
                                currentElement = currentElement.parentNode;
                              }
                              
                              // Check if we're at the beginning of an empty list item
                              if (currentElement && currentElement.tagName === 'LI') {
                                const isEmpty = currentElement.textContent.trim() === '';
                                const atStart = range.startOffset === 0;
                                
                                if (isEmpty && atStart) {
                                  e.preventDefault();
                                  // Use the browser's outdent command to exit the list
                                  document.execCommand('outdent', false, null);
                                      // Update content
                                      handleTextareaChange({ target: e.target });
                                }
                                    }
                            }
                          }
                        }}
                        className="w-full p-3 rounded-lg resize-none focus:ring-2 focus:outline-none overflow-y-auto transition-colors duration-300"
                        style={{
                          backgroundColor: themeStyles.secondaryBg, 
                          border: `1px solid ${themeStyles.border}`, 
                          color: themeStyles.textPrimary,
                          '--tw-ring-color': themeStyles.accent,
                          minHeight: '320px'
                        }}
                        data-placeholder="Start typing your response...

Keyboard shortcuts:
• Ctrl+B/I/U - Bold/Italic/Underline
• Ctrl+Z/Y - Undo/Redo  
• Tab/Shift+Tab - Indent/Outdent
• Bullet button - Toggle lists
• Backspace on empty bullet - Exit list
• Shift+Enter in bullet - Exit to normal text"
                      />
                      
                      {/* Show actual HTML preview */}
                      {draftHtml && (
                        <details className="text-xs">
                          <summary className="cursor-pointer transition-colors duration-300" style={{color: themeStyles.textMuted}}>Email Preview</summary>
                          <div 
                            className="mt-2 p-4 rounded border transition-colors duration-300 email-preview" 
                            style={{
                              backgroundColor: '#ffffff', 
                              color: '#000000',
                              border: `1px solid ${themeStyles.border}`,
                              fontFamily: 'Arial, sans-serif',
                              lineHeight: '1.6'
                            }}
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(cleanFormattingHtml(draftHtml)) }}
                          />

                        </details>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      {/* Schedule Button */}
                      <div className="relative scheduler-container">
                        <button
                          onClick={() => setShowScheduler(!showScheduler)}
                          className="px-4 py-2 rounded-lg hover:opacity-80 flex items-center gap-2 transition-all duration-300"
                          style={{backgroundColor: `${themeStyles.accent}20`, color: themeStyles.accent, border: `1px solid ${themeStyles.accent}30`}}
                        >
                          <Clock className="w-4 h-4" />
                          {scheduledTime ? 'Scheduled' : 'Schedule'}
                        </button>
                        
                        {/* Schedule Picker */}
                        {showScheduler && (
                          <div className="absolute left-0 bottom-full mb-2 p-4 rounded-lg shadow-lg z-50 min-w-[300px] transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
                            <h4 className="font-medium mb-3 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>Schedule Message</h4>
                            
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs block mb-1 transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Send Date & Time:</label>
                                <input
                                  type="datetime-local"
                                  value={scheduledTime ? new Date(scheduledTime.getTime() - scheduledTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      setScheduledTime(new Date(e.target.value));
                                    } else {
                                      setScheduledTime(null);
                                    }
                                  }}
                                  min={new Date().toISOString().slice(0, 16)}
                                  className="w-full px-3 py-2 rounded-lg text-sm focus:ring-2 transition-colors duration-300"
                                  style={{
                                    backgroundColor: themeStyles.tertiaryBg, 
                                    border: `1px solid ${themeStyles.border}`, 
                                    color: themeStyles.textPrimary,
                                    '--tw-ring-color': themeStyles.accent
                                  }}
                                />
                              </div>
                              
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setScheduledTime(null);
                                    setShowScheduler(false);
                                  }}
                                  className="flex-1 px-3 py-2 rounded-lg text-sm hover:opacity-80 transition-all duration-300"
                                  style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textMuted, border: `1px solid ${themeStyles.border}`}}
                                >
                                  Clear
                                </button>
                                <button
                                  onClick={() => setShowScheduler(false)}
                                  className="flex-1 px-3 py-2 rounded-lg text-sm hover:opacity-80 transition-all duration-300"
                                  style={{backgroundColor: themeStyles.accent, color: isDarkMode ? '#1A1C1A' : '#FFFFFF'}}
                                >
                                  Done
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Send Button */}
                      <div className="flex items-center gap-2">
                        {scheduledTime && (
                          <span className="text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                            Scheduled for {scheduledTime.toLocaleString()}
                          </span>
                        )}
                      <button
                        onClick={sendMessage}
                        disabled={!draftResponse.trim() || isSending}
                        className="px-6 py-2 rounded-lg hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-300"
                        style={{backgroundColor: themeStyles.success, color: '#FFFFFF'}}
                      >
                        <Send className="w-4 h-4" />
                          {isSending ? 'Sending...' : scheduledTime ? 'Schedule Message' : 'Send Message'}
                      </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center transition-colors duration-300" style={{color: themeStyles.textMuted}}>
            <div className="text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 transition-colors duration-300" style={{color: themeStyles.accent}} />
              <p className="text-lg font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>Select a lead to view details</p>
              <p className="text-sm transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Choose a lead from the inbox to see their conversation history and respond</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Popup */}
      {showDeleteConfirm && leadToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="rounded-lg p-6 max-w-md w-mx mx-4 shadow-xl" style={{backgroundColor: '#1A1C1A', border: '1px solid white'}}>
            <h3 className="text-lg font-semibold text-white mb-2">Delete Lead</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete <strong className="text-white">{leadToDelete.first_name} {leadToDelete.last_name}</strong>? 
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setLeadToDelete(null);
                }}
                className="px-4 py-2 text-white hover:opacity-80 rounded-lg transition-colors"
                style={{border: '1px solid white'}}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteLead(leadToDelete)}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Sent Confirmation Popup */}
      {showSentConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="rounded-lg p-6 max-w-md w-mx mx-4 shadow-xl" style={{backgroundColor: '#1A1C1A', border: '1px solid white'}}>
            <h3 className="text-lg font-semibold text-green-400 mb-2">Message Sent Successfully!</h3>
            <p className="text-gray-300 mb-6">
              Your message has been sent and the conversation has been updated.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowSentConfirm(false);
                  setSelectedLead(null);
                }}
                className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Add Enrichment Popup */}
            {showEnrichmentPopup && enrichmentData && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="rounded-lg p-6 max-w-md w-full mx-4 shadow-xl" style={{backgroundColor: '#1A1C1A', border: '1px solid rgba(84, 252, 255, 0.3)'}}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold" style={{color: '#54FCFF'}}>Enriched Lead Data</h3>
                    <button
                      onClick={() => setShowEnrichmentPopup(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-gray-400 text-sm">Role</label>
                      <p className="text-white font-medium">{enrichmentData.role || 'N/A'}</p>
                    </div>
                    
                    <div>
                      <label className="text-gray-400 text-sm">Company Summary</label>
                      <p className="text-white font-medium">{enrichmentData.companySummary || 'N/A'}</p>
                    </div>
                    
                    <div>
                      <label className="text-gray-400 text-sm">LinkedIn</label>
                      {enrichmentData.linkedin ? (
                        <a
                          href={enrichmentData.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 hover:opacity-80 transition-colors mt-1"
                          style={{color: '#54FCFF'}}
                        >
                          {enrichmentData.linkedin}
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <p className="text-white">N/A</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      {/* Main Content - CRM */}
      {activeTab === 'crm' && (
        <div className="w-full flex flex-col shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, borderRadius: '12px', margin: '8px', border: `1px solid ${themeStyles.border}`}}>
          <CRMManager brandId={brandId} onGoToInboxLead={handleGoToInboxLead} />
        </div>
        )}

        {/* Main Content - Templates */}
        {activeTab === 'templates' && (
          <div className="w-full flex flex-col shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, borderRadius: '12px', margin: '8px', border: `1px solid ${themeStyles.border}`}}>
            <TemplateManager user={user} brandId={brandId} />
          </div>
        )}
      </div>

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[20000] p-4">
          <div className="w-full max-w-4xl h-[80vh] rounded-xl shadow-xl overflow-hidden" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
            <TemplateManager 
              user={user} 
              brandId={brandId} 
              selectionMode={true}
              onTemplateSelect={handleTemplateSelect}
              onClose={() => setShowTemplateSelector(false)}
            />
          </div>
        </div>
      )}

      {/* Portal Dropdowns - Rendered outside container hierarchy */}
      {filteredAndSortedLeads.map((lead) => {
        const isDropdownOpen = categoryDropdowns.has(lead.id);
        const position = dropdownPositions[lead.id];
        
        return isDropdownOpen ? (
          <PortalDropdown
            key={`dropdown-${lead.id}`}
            leadId={lead.id}
            lead={lead}
            position={position}
            onClose={() => setCategoryDropdowns(new Set())}
            onSelect={updateLeadCategory}
          />
        ) : null;
      })}

      {/* Recent Portal Dropdown */}
      {showRecentDropdown && (
        <RecentPortalDropdown
          position={recentDropdownPosition}
          onClose={() => {
            setShowRecentDropdown(false);
            setRecentDropdownPosition(null);
          }}
        />
      )}
    </div>
  );
};

export default InboxManager;
