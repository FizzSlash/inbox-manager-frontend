import React, { useState, useEffect, useMemo } from 'react';
import { File, Plus, Edit3, Trash2, Save, X, Eye, Copy, Search, FileText, Calendar, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

// HTML sanitization function (basic XSS protection)
const sanitizeHtml = (html) => {
  if (!html) return '';
  
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  const dangerousElements = ['script', 'object', 'embed', 'iframe', 'form'];
  const dangerousAttributes = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'];
  
  dangerousElements.forEach(tagName => {
    const elements = temp.querySelectorAll(tagName);
    elements.forEach(el => el.remove());
  });
  
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    dangerousAttributes.forEach(attr => {
      if (el.hasAttribute(attr)) {
        el.removeAttribute(attr);
      }
    });
    
    ['href', 'src'].forEach(attr => {
      const value = el.getAttribute(attr);
      if (value && value.toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr);
      }
    });
  });
  
  return temp.innerHTML;
};

const TemplateManager = ({ user, brandId, selectionMode = false, onTemplateSelect = null, onClose = null }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    html_content: ''
  });

  // Theme management (using same pattern as InboxManager)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('inbox_manager_theme');
    return savedTheme ? savedTheme === 'dark' : true;
  });

  const themeStyles = isDarkMode ? {
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

  // Fetch templates for the brand
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!brandId) return;
      
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });
        
      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (brandId) {
      fetchTemplates();
    }
  }, [brandId]);

  // Filter templates based on search
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    
    const query = searchQuery.toLowerCase();
    return templates.filter(template => 
      template.name.toLowerCase().includes(query) ||
      template.description?.toLowerCase().includes(query) ||
      template.content.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle rich text editor changes
  const handleContentChange = (e) => {
    const rawHtml = e.target.innerHTML;
    const sanitizedHtml = sanitizeHtml(rawHtml);
    const textContent = e.target.textContent || e.target.innerText;
    
    setFormData(prev => ({
      ...prev,
      content: textContent,
      html_content: sanitizedHtml
    }));
    
    if (rawHtml !== sanitizedHtml) {
      e.target.innerHTML = sanitizedHtml;
      console.warn('HTML content was sanitized for security');
    }
  };

  // Rich text formatting functions
  const formatText = (command, value = null) => {
    document.execCommand(command, false, value);
    // Update content after formatting
    const editor = document.querySelector('[contenteditable]');
    if (editor) {
      handleContentChange({ target: editor });
    }
  };

  const insertList = () => {
    document.execCommand('insertUnorderedList', false, null);
    // Update content
    const editor = document.querySelector('[contenteditable]');
    if (editor) {
      handleContentChange({ target: editor });
    }
  };

  const insertLink = () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    const url = prompt('Enter URL:', 'https://');
    
    if (url && url.trim() !== '' && url !== 'https://') {
      const linkText = selectedText || url;
      document.execCommand('createLink', false, url);
      
      // Update content
      const editor = document.querySelector('[contenteditable]');
      if (editor) {
        handleContentChange({ target: editor });
      }
    }
  };

  // Save template
  const saveTemplate = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      setError('Name and content are required');
      return;
    }

    setSaving(true);
    try {
      const templateData = {
        brand_id: brandId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        content: formData.content.trim(),
        html_content: formData.html_content || null,
        created_by: user.id,
        updated_at: new Date().toISOString()
      };

      if (editingTemplate) {
        // Update existing template
        const { error } = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);
          
        if (error) throw error;
      } else {
        // Create new template
        const { error } = await supabase
          .from('email_templates')
          .insert([templateData]);
          
        if (error) throw error;
      }

      // Refresh templates and close editor
      await fetchTemplates();
      closeEditor();
      
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete template
  const deleteTemplate = async (template) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .update({ is_active: false })
        .eq('id', template.id);
        
      if (error) throw error;
      
      await fetchTemplates();
      setShowDeleteConfirm(false);
      setTemplateToDelete(null);
    } catch (err) {
      console.error('Error deleting template:', err);
      setError(err.message);
    }
  };

  // Open editor for new template
  const openNewTemplate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      content: '',
      html_content: ''
    });
    setShowEditor(true);
  };

  // Open editor for existing template
  const openEditTemplate = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      content: template.content,
      html_content: template.html_content || ''
    });
    setShowEditor(true);
    
    // Set the HTML content in the editor
    setTimeout(() => {
      const editor = document.querySelector('[contenteditable]');
      if (editor && template.html_content) {
        editor.innerHTML = template.html_content;
      }
    }, 100);
  };

  // Close editor
  const closeEditor = () => {
    setShowEditor(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      content: '',
      html_content: ''
    });
    setError(null);
  };

  // Copy template content to clipboard
  const copyTemplate = async (template) => {
    try {
      await navigator.clipboard.writeText(template.content);
      // Could add a toast notification here
      console.log('Template copied to clipboard');
    } catch (err) {
      console.error('Failed to copy template:', err);
    }
  };

  // Clone template (create duplicate)
  const cloneTemplate = async (template) => {
    if (!template || !brandId) return;

    setSaving(true);
    try {
      const clonedTemplateData = {
        brand_id: brandId,
        name: `${template.name} (Copy)`,
        description: template.description ? `${template.description} (Cloned)` : 'Cloned template',
        content: template.content,
        html_content: template.html_content || null,
        created_by: user.id,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('email_templates')
        .insert([clonedTemplateData]);
        
      if (error) throw error;

      // Refresh templates list
      await fetchTemplates();
      
      console.log('Template cloned successfully');
    } catch (err) {
      console.error('Error cloning template:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Show preview
  const showTemplatePreview = (template) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center" style={{backgroundColor: themeStyles.primaryBg}}>
        <div className="text-center p-8 rounded-2xl shadow-xl" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{borderColor: themeStyles.accent}}></div>
          <p className="transition-colors duration-300" style={{color: themeStyles.textPrimary}}>Loading templates...</p>
        </div>
      </div>
    );
  }

  if (error && !showEditor) {
    return (
      <div className="flex h-full flex-col items-center justify-center" style={{backgroundColor: themeStyles.primaryBg}}>
        <div className="text-center">
          <p className="font-medium mb-6 transition-colors duration-300" style={{color: themeStyles.error}}>Error loading templates: {error}</p>
          <button 
            onClick={fetchTemplates}
            className="px-4 py-2 rounded-lg hover:opacity-80 transition-colors"
            style={{backgroundColor: themeStyles.accent, color: isDarkMode ? '#1A1C1A' : '#FFFFFF', border: `1px solid ${themeStyles.border}`}}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        /* Rich text editor styling for templates */
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

        /* Placeholder text for contenteditable */
        div[contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9CA3AF;
          font-style: italic;
          pointer-events: none;
          white-space: pre-line;
        }
      `}</style>
      
      <div className="flex h-full overflow-hidden transition-colors duration-300" style={{backgroundColor: themeStyles.primaryBg}}>
      {/* Template List */}
      <div className={`${selectionMode ? 'w-full' : 'w-1/2'} flex flex-col shadow-lg relative z-50 transition-colors duration-300`} style={{backgroundColor: themeStyles.secondaryBg, borderRadius: '12px', margin: '8px', marginRight: selectionMode ? '8px' : '4px', border: `1px solid ${themeStyles.border}`}}>
        {/* Header */}
        <div className="p-6 transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, borderRadius: '12px 12px 0 0', borderBottom: `1px solid ${themeStyles.border}`}}>
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
              {selectionMode ? 'Select Template' : 'Email Templates'}
            </h1>
            <div className="flex items-center gap-2">
              {selectionMode ? (
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg hover:opacity-80 transition-colors flex items-center gap-2"
                  style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textPrimary, border: `1px solid ${themeStyles.border}`}}
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              ) : (
                <button
                  onClick={openNewTemplate}
                  className="px-4 py-2 rounded-lg hover:opacity-80 transition-colors flex items-center gap-2"
                  style={{backgroundColor: themeStyles.accent, color: isDarkMode ? '#1A1C1A' : '#FFFFFF'}}
                >
                  <Plus className="w-4 h-4" />
                  New Template
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 transition-colors duration-300" style={{color: themeStyles.accent}} />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg focus:ring-2 transition-colors duration-300"
              style={{
                backgroundColor: themeStyles.tertiaryBg, 
                border: `1px solid ${themeStyles.border}`, 
                color: themeStyles.textPrimary,
                '--tw-ring-color': themeStyles.accent
              }}
            />
          </div>

          {/* Stats */}
          <div className="text-sm transition-colors duration-300" style={{color: themeStyles.textSecondary}}>
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
            {searchQuery && ` (filtered from ${templates.length})`}
          </div>
        </div>

        {/* Template List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50 transition-colors duration-300" style={{color: themeStyles.textMuted}} />
              <p className="text-lg font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                {searchQuery ? 'No templates found' : selectionMode ? 'No templates available' : 'No templates yet'}
              </p>
              <p className="transition-colors duration-300" style={{color: themeStyles.textSecondary}}>
                {searchQuery ? 'Try adjusting your search' : selectionMode ? 'Create templates first to use them here' : 'Create your first email template to get started'}
              </p>
              {!searchQuery && !selectionMode && (
                <button
                  onClick={openNewTemplate}
                  className="mt-4 px-4 py-2 rounded-lg hover:opacity-80 transition-colors flex items-center gap-2 mx-auto"
                  style={{backgroundColor: themeStyles.accent, color: isDarkMode ? '#1A1C1A' : '#FFFFFF'}}
                >
                  <Plus className="w-4 h-4" />
                  Create Template
                </button>
              )}
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="p-4 rounded-lg border hover:opacity-90 transition-all duration-300 cursor-pointer"
                style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}
                onClick={selectionMode ? () => {
                  if (onTemplateSelect) {
                    onTemplateSelect(template);
                  }
                } : () => {
                  // In normal mode, clicking the card opens edit mode
                  openEditTemplate(template);
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                    {template.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    {selectionMode ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onTemplateSelect) {
                            onTemplateSelect(template);
                          }
                        }}
                        className="px-3 py-2 rounded-lg hover:opacity-80 transition-colors flex items-center gap-2"
                        style={{backgroundColor: themeStyles.success, color: '#FFFFFF'}}
                        title="Use This Template"
                      >
                        <Plus className="w-4 h-4" />
                        Use Template
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            showTemplatePreview(template);
                          }}
                          className="p-1 rounded hover:opacity-80 transition-colors"
                          style={{color: themeStyles.accent}}
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cloneTemplate(template);
                          }}
                          className="p-1 rounded hover:opacity-80 transition-colors"
                          style={{color: themeStyles.success}}
                          title="Clone Template"
                          disabled={saving}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditTemplate(template);
                          }}
                          className="p-1 rounded hover:opacity-80 transition-colors"
                          style={{color: themeStyles.warning}}
                          title="Edit Template (or click anywhere on card)"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTemplateToDelete(template);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-1 rounded hover:opacity-80 transition-colors"
                          style={{color: themeStyles.error}}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                {template.description && (
                  <p className="text-sm mb-2 transition-colors duration-300" style={{color: themeStyles.textSecondary}}>
                    {template.description}
                  </p>
                )}
                
                <p className="text-sm mb-3 line-clamp-2 transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                  {template.content.substring(0, 150)}
                  {template.content.length > 150 ? '...' : ''}
                </p>
                
                <div className="flex items-center justify-between text-xs transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {formatDate(template.updated_at)}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>You</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Panel - Hidden in selection mode */}
      {!selectionMode && (
        <div className="flex-1 flex flex-col shadow-lg transition-colors duration-300" style={{backgroundColor: themeStyles.secondaryBg, borderRadius: '12px', margin: '8px', marginLeft: '4px', border: `1px solid ${themeStyles.border}`}}>
        {showEditor ? (
          <>
            {/* Editor Header */}
            <div className="p-6 transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, borderRadius: '12px 12px 0 0', borderBottom: `1px solid ${themeStyles.border}`}}>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                  {editingTemplate ? 'Edit Template' : 'New Template'}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveTemplate}
                    disabled={saving || !formData.name.trim() || !formData.content.trim()}
                    className="px-4 py-2 rounded-lg hover:opacity-80 disabled:opacity-50 transition-colors flex items-center gap-2"
                    style={{backgroundColor: themeStyles.success, color: '#FFFFFF'}}
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={closeEditor}
                    className="p-2 rounded-lg hover:opacity-80 transition-colors"
                    style={{border: `1px solid ${themeStyles.border}`, backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textMuted}}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {error && (
                <div className="p-4 rounded-lg transition-colors duration-300" style={{backgroundColor: `${themeStyles.error}20`, border: `1px solid ${themeStyles.error}`}}>
                  <p className="text-sm transition-colors duration-300" style={{color: themeStyles.error}}>{error}</p>
                </div>
              )}

              {/* Name Field */}
              <div>
                <label className="text-sm font-medium mb-2 block transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 transition-colors duration-300"
                  style={{
                    backgroundColor: themeStyles.tertiaryBg, 
                    border: `1px solid ${themeStyles.border}`, 
                    color: themeStyles.textPrimary,
                    '--tw-ring-color': themeStyles.accent
                  }}
                  placeholder="Enter template name"
                />
              </div>

              {/* Description Field */}
              <div>
                <label className="text-sm font-medium mb-2 block transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 transition-colors duration-300"
                  style={{
                    backgroundColor: themeStyles.tertiaryBg, 
                    border: `1px solid ${themeStyles.border}`, 
                    color: themeStyles.textPrimary,
                    '--tw-ring-color': themeStyles.accent
                  }}
                  placeholder="Optional description"
                />
              </div>

              {/* Content Editor */}
              <div>
                <label className="text-sm font-medium mb-2 block transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                  Template Content *
                </label>
                
                {/* Formatting Toolbar */}
                <div className="flex flex-wrap gap-2 p-3 rounded-lg mb-3 transition-colors duration-300" style={{backgroundColor: themeStyles.tertiaryBg, border: `1px solid ${themeStyles.border}`}}>
                  <button
                    type="button"
                    onClick={() => formatText('bold')}
                    className="px-3 py-1 rounded text-xs font-bold hover:opacity-80 transition-all duration-300"
                    style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textPrimary}}
                    title="Bold (Ctrl+B)"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => formatText('italic')}
                    className="px-3 py-1 rounded text-xs italic hover:opacity-80 transition-all duration-300"
                    style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textPrimary}}
                    title="Italic (Ctrl+I)"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => formatText('underline')}
                    className="px-3 py-1 rounded text-xs underline hover:opacity-80 transition-all duration-300"
                    style={{backgroundColor: themeStyles.tertiaryBg, color: themeStyles.textPrimary}}
                    title="Underline (Ctrl+U)"
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
                </div>

                <div
                  contentEditable
                  suppressContentEditableWarning={true}
                  onInput={handleContentChange}
                  onKeyDown={(e) => {
                    // Handle keyboard shortcuts
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
                          handleContentChange({ target: e.target });
                          break;
                        case 'y':
                          e.preventDefault();
                          document.execCommand('redo', false, null);
                          handleContentChange({ target: e.target });
                          break;
                      }
                    } else if (e.key === 'Enter' && e.shiftKey) {
                      // Handle Shift+Enter to exit lists
                      const selection = window.getSelection();
                      if (selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        let currentElement = range.startContainer;
                        
                        while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
                          currentElement = currentElement.parentNode;
                        }
                        
                        if (currentElement && currentElement.tagName === 'LI') {
                          e.preventDefault();
                          const list = currentElement.closest('ul, ol');
                          if (list) {
                            const newDiv = document.createElement('div');
                            newDiv.innerHTML = '<br>';
                            list.parentNode.insertBefore(newDiv, list.nextSibling);
                            
                            const newRange = document.createRange();
                            newRange.setStart(newDiv, 0);
                            newRange.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                            
                            handleContentChange({ target: e.target });
                          }
                        }
                      }
                    } else if (e.key === 'Tab') {
                      // Handle Tab for indenting
                      e.preventDefault();
                      const selection = window.getSelection();
                      
                      if (selection.rangeCount > 0) {
                        let currentElement = selection.getRangeAt(0).startContainer;
                        while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
                          currentElement = currentElement.parentNode;
                        }
                        
                        if (currentElement && (currentElement.tagName === 'LI' || currentElement.closest('ul, ol'))) {
                          if (e.shiftKey) {
                            document.execCommand('outdent', false, null);
                          } else {
                            document.execCommand('indent', false, null);
                          }
                        } else {
                          if (e.shiftKey) {
                            document.execCommand('outdent', false, null);
                          } else {
                            document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
                          }
                        }
                      }
                      
                      handleContentChange({ target: e.target });
                    } else if (e.key === 'Backspace') {
                      // Handle exiting lists
                      const selection = window.getSelection();
                      if (selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        let currentElement = range.startContainer;
                        
                        while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
                          currentElement = currentElement.parentNode;
                        }
                        
                        if (currentElement && currentElement.tagName === 'LI') {
                          const isEmpty = currentElement.textContent.trim() === '';
                          const atStart = range.startOffset === 0;
                          
                          if (isEmpty && atStart) {
                            e.preventDefault();
                            document.execCommand('outdent', false, null);
                            handleContentChange({ target: e.target });
                          }
                        }
                      }
                    }
                  }}
                  className="w-full h-64 p-3 rounded-lg resize-none focus:ring-2 focus:outline-none overflow-y-auto transition-colors duration-300"
                  style={{
                    backgroundColor: themeStyles.tertiaryBg, 
                    border: `1px solid ${themeStyles.border}`, 
                    color: themeStyles.textPrimary,
                    '--tw-ring-color': themeStyles.accent,
                    minHeight: '256px'
                  }}
                  data-placeholder="Start typing your template content...

Keyboard shortcuts:
• Ctrl+B/I/U - Bold/Italic/Underline
• Ctrl+Z/Y - Undo/Redo
• Tab/Shift+Tab - Indent/Outdent
• Bullet button - Toggle lists
• Backspace on empty bullet - Exit list
• Shift+Enter in bullet - Exit to normal text"
                />
                <p className="text-xs mt-2 transition-colors duration-300" style={{color: themeStyles.textMuted}}>
                  Rich text editor with full formatting support - Bold, italic, links, bullet points, and more!
                </p>
              </div>
            </div>
          </>
        ) : (
          /* Default State */
          <div className="flex-1 flex items-center justify-center transition-colors duration-300" style={{color: themeStyles.textMuted}}>
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 transition-colors duration-300" style={{color: themeStyles.accent}} />
              <p className="text-lg font-medium transition-colors duration-300" style={{color: themeStyles.textPrimary}}>Select a template or create a new one</p>
              <p className="text-sm transition-colors duration-300" style={{color: themeStyles.textSecondary}}>Choose a template from the list to edit, or click "New Template" to get started</p>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && templateToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="rounded-lg p-6 max-w-md w-mx mx-4 shadow-xl" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
            <h3 className="text-lg font-semibold mb-2 transition-colors duration-300" style={{color: themeStyles.textPrimary}}>Delete Template</h3>
            <p className="mb-6 transition-colors duration-300" style={{color: themeStyles.textSecondary}}>
              Are you sure you want to delete <strong className="transition-colors duration-300" style={{color: themeStyles.textPrimary}}>{templateToDelete.name}</strong>? 
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setTemplateToDelete(null);
                }}
                className="px-4 py-2 hover:opacity-80 rounded-lg transition-colors"
                style={{border: `1px solid ${themeStyles.border}`, color: themeStyles.textPrimary}}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTemplate(templateToDelete)}
                className="px-4 py-2 hover:opacity-80 rounded-lg transition-colors"
                style={{backgroundColor: themeStyles.error, color: '#FFFFFF'}}
              >
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-2xl w-full max-h-[80vh] shadow-xl overflow-hidden" style={{backgroundColor: themeStyles.secondaryBg, border: `1px solid ${themeStyles.border}`}}>
            <div className="p-4 border-b flex justify-between items-center" style={{borderColor: themeStyles.border}}>
              <h3 className="text-lg font-semibold transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                Preview: {previewTemplate.name}
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 rounded hover:opacity-80 transition-colors"
                style={{color: themeStyles.textMuted}}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-96">
              {previewTemplate.html_content ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: previewTemplate.html_content }}
                  className="prose max-w-none transition-colors duration-300"
                  style={{color: themeStyles.textPrimary}}
                />
              ) : (
                <div className="whitespace-pre-wrap transition-colors duration-300" style={{color: themeStyles.textPrimary}}>
                  {previewTemplate.content}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default TemplateManager; 