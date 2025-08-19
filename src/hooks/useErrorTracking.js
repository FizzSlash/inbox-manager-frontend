import { useEffect, useCallback, useRef } from 'react';

/**
 * Simple error tracking and monitoring system
 * Tracks errors, performance metrics, and user behavior for production debugging
 */
class ErrorTracker {
  constructor() {
    this.errors = [];
    this.performance = [];
    this.userActions = [];
    this.sessionId = this.generateSessionId();
    this.maxEntries = 100; // Keep last 100 entries
    
    this.setupGlobalErrorHandlers();
    console.log(`🔍 Error Tracker initialized (Session: ${this.sessionId})`);
  }

  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  setupGlobalErrorHandlers() {
    // Catch JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError({
        type: 'javascript',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        type: 'promise',
        message: event.reason?.message || 'Unhandled Promise Rejection',
        reason: event.reason,
        stack: event.reason?.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Track performance issues
    if ('PerformanceObserver' in window) {
      try {
        // Track long tasks (> 50ms)
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              this.logPerformance({
                type: 'long-task',
                duration: entry.duration,
                startTime: entry.startTime,
                timestamp: new Date().toISOString()
              });
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });

        // Track layout shifts
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.value > 0.1) { // CLS threshold
              this.logPerformance({
                type: 'layout-shift',
                value: entry.value,
                timestamp: new Date().toISOString()
              });
            }
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.warn('Performance Observer not fully supported:', e);
      }
    }
  }

  logError(errorData) {
    const error = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...errorData
    };

    this.errors.push(error);
    this.trimArray(this.errors);

    // Log to console for development
    console.error('🐛 Error tracked:', error);

    // In production, you could send to an error tracking service here
    // this.sendToErrorService(error);
  }

  logPerformance(perfData) {
    const performance = {
      id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      ...perfData
    };

    this.performance.push(performance);
    this.trimArray(this.performance);

    console.warn('⚠️ Performance issue:', performance);
  }

  logUserAction(action, details = {}) {
    const userAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      action,
      ...details
    };

    this.userActions.push(userAction);
    this.trimArray(this.userActions);

    console.log('👤 User action:', userAction);
  }

  trimArray(array) {
    if (array.length > this.maxEntries) {
      array.splice(0, array.length - this.maxEntries);
    }
  }

  // Get recent errors for debugging
  getRecentErrors(count = 10) {
    return this.errors.slice(-count);
  }

  // Get performance issues
  getPerformanceIssues(count = 10) {
    return this.performance.slice(-count);
  }

  // Get user actions for debugging flow
  getUserActions(count = 20) {
    return this.userActions.slice(-count);
  }

  // Export all data for debugging
  exportDiagnostics() {
    return {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      errors: this.errors,
      performance: this.performance,
      userActions: this.userActions,
      browser: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        connection: navigator.connection ? {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink
        } : null
      }
    };
  }

  // Clear all tracking data
  clear() {
    this.errors = [];
    this.performance = [];
    this.userActions = [];
    console.log('🧹 Error tracking data cleared');
  }
}

// Global error tracker instance
const globalErrorTracker = new ErrorTracker();

/**
 * React hook for error tracking and monitoring
 */
const useErrorTracking = (componentName = 'Unknown') => {
  const actionCountRef = useRef(0);

  // Track component mount/unmount
  useEffect(() => {
    globalErrorTracker.logUserAction('component_mount', { componentName });
    
    return () => {
      globalErrorTracker.logUserAction('component_unmount', { 
        componentName,
        actionsPerformed: actionCountRef.current
      });
    };
  }, [componentName]);

  // Log error manually
  const logError = useCallback((error, context = {}) => {
    globalErrorTracker.logError({
      type: 'manual',
      message: error.message || error,
      stack: error.stack,
      componentName,
      context,
      timestamp: new Date().toISOString()
    });
  }, [componentName]);

  // Log user action
  const logAction = useCallback((action, details = {}) => {
    actionCountRef.current++;
    globalErrorTracker.logUserAction(action, {
      componentName,
      ...details
    });
  }, [componentName]);

  // Log API call performance
  const logApiCall = useCallback((endpoint, duration, success = true, details = {}) => {
    const perfData = {
      type: 'api-call',
      endpoint,
      duration,
      success,
      componentName,
      ...details
    };

    if (duration > 5000) { // Log slow API calls (> 5s)
      globalErrorTracker.logPerformance(perfData);
    }

    // Log all API calls as user actions for debugging
    globalErrorTracker.logUserAction('api_call', perfData);
  }, [componentName]);

  // Wrap async operations with error tracking
  const withErrorTracking = useCallback((asyncFn, actionName) => {
    return async (...args) => {
      const startTime = performance.now();
      
      try {
        logAction(`${actionName}_start`);
        const result = await asyncFn(...args);
        
        const duration = performance.now() - startTime;
        logAction(`${actionName}_success`, { duration });
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        logError(error, { 
          actionName, 
          duration,
          args: args.length > 0 ? 'provided' : 'none'
        });
        logAction(`${actionName}_error`, { duration, error: error.message });
        
        throw error;
      }
    };
  }, [logAction, logError]);

  // Get diagnostics for debugging
  const getDiagnostics = useCallback(() => {
    return globalErrorTracker.exportDiagnostics();
  }, []);

  // Copy diagnostics to clipboard for easy sharing
  const copyDiagnostics = useCallback(async () => {
    try {
      const diagnostics = globalErrorTracker.exportDiagnostics();
      const jsonString = JSON.stringify(diagnostics, null, 2);
      
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(jsonString);
        console.log('📋 Diagnostics copied to clipboard');
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = jsonString;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        console.log('📋 Diagnostics copied to clipboard (fallback)');
        return true;
      }
    } catch (error) {
      console.error('Failed to copy diagnostics:', error);
      return false;
    }
  }, []);

  return {
    logError,
    logAction,
    logApiCall,
    withErrorTracking,
    getDiagnostics,
    copyDiagnostics,
    getRecentErrors: () => globalErrorTracker.getRecentErrors(),
    getPerformanceIssues: () => globalErrorTracker.getPerformanceIssues()
  };
};

// Export error tracker for direct access
export { globalErrorTracker };
export default useErrorTracking;