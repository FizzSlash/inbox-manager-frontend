// ========================================
// ERROR REPORTING & MONITORING SYSTEM
// ========================================
// Production-ready error tracking and performance monitoring

class ErrorReporter {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.userId = null;
    this.brandId = null;
    this.sessionId = this.generateSessionId();
    this.errorQueue = [];
    this.performanceMetrics = new Map();
    
    // Initialize error reporting
    this.init();
  }

  init() {
    // Global error handlers
    window.addEventListener('error', this.handleGlobalError.bind(this));
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    
    // Performance monitoring
    this.startPerformanceMonitoring();
    
    console.log('🔍 Error Reporting System initialized');
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setUser(userId, brandId = null) {
    this.userId = userId;
    this.brandId = brandId;
  }

  // ========================================
  // ERROR REPORTING
  // ========================================

  reportError(error, context = {}) {
    const errorReport = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      brandId: this.brandId,
      
      // Error details
      message: error.message || 'Unknown error',
      stack: error.stack || '',
      name: error.name || 'Error',
      
      // Context
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      context: context,
      
      // App state
      timestamp: Date.now(),
      level: 'error'
    };

    this.processErrorReport(errorReport);
    return errorReport.id;
  }

  reportWarning(message, context = {}) {
    const warningReport = {
      id: `warning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      brandId: this.brandId,
      message: message,
      context: context,
      level: 'warning'
    };

    this.processErrorReport(warningReport);
    return warningReport.id;
  }

  reportInfo(message, context = {}) {
    const infoReport = {
      id: `info_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      brandId: this.brandId,
      message: message,
      context: context,
      level: 'info'
    };

    if (!this.isProduction) {
      console.log('📊 INFO:', infoReport);
    }
  }

  // ========================================
  // GLOBAL ERROR HANDLERS
  // ========================================

  handleGlobalError(event) {
    const error = {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    };

    this.reportError(error, {
      type: 'global_error',
      filename: event.filename,
      line: event.lineno,
      column: event.colno
    });
  }

  handleUnhandledRejection(event) {
    const error = {
      message: event.reason?.message || 'Unhandled Promise Rejection',
      stack: event.reason?.stack || ''
    };

    this.reportError(error, {
      type: 'unhandled_rejection',
      reason: event.reason
    });
  }

  // ========================================
  // PERFORMANCE MONITORING
  // ========================================

  startPerformanceMonitoring() {
    // Monitor page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = this.getPerformanceData();
        this.reportInfo('Page load performance', perfData);
      }, 0);
    });

    // Monitor long tasks (> 50ms)
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              this.reportWarning('Long task detected', {
                duration: entry.duration,
                startTime: entry.startTime,
                name: entry.name
              });
            }
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // Long task API not supported
      }
    }
  }

  getPerformanceData() {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (!navigation) return {};

    return {
      pageLoadTime: navigation.loadEventEnd - navigation.loadEventStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      firstPaint: this.getFirstPaint(),
      memoryUsage: this.getMemoryUsage()
    };
  }

  getFirstPaint() {
    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? firstPaint.startTime : null;
  }

  getMemoryUsage() {
    if ('memory' in performance) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }
    return null;
  }

  // Track API call performance
  trackAPICall(endpoint, duration, success, statusCode = null) {
    const metric = {
      endpoint,
      duration,
      success,
      statusCode,
      timestamp: Date.now()
    };

    // Store in performance metrics
    if (!this.performanceMetrics.has(endpoint)) {
      this.performanceMetrics.set(endpoint, []);
    }
    
    const metrics = this.performanceMetrics.get(endpoint);
    metrics.push(metric);
    
    // Keep only last 100 metrics per endpoint
    if (metrics.length > 100) {
      metrics.shift();
    }

    // Report slow API calls
    if (duration > 5000) { // 5 seconds
      this.reportWarning('Slow API call', metric);
    }

    // Report failed API calls
    if (!success) {
      this.reportError(new Error(`API call failed: ${endpoint}`), {
        endpoint,
        duration,
        statusCode,
        type: 'api_error'
      });
    }
  }

  // ========================================
  // ERROR PROCESSING
  // ========================================

  processErrorReport(report) {
    // Always log in development
    if (!this.isProduction) {
      console.error('🚨 ERROR REPORT:', report);
    }

    // Add to queue
    this.errorQueue.push(report);

    // In production, you would send to your error service
    if (this.isProduction) {
      this.sendToErrorService(report);
    }

    // Keep queue size manageable
    if (this.errorQueue.length > 100) {
      this.errorQueue.shift();
    }
  }

  async sendToErrorService(report) {
    try {
      // Replace this with your actual error reporting service
      // Examples: Sentry, LogRocket, Bugsnag, or your own backend
      
      // Example for custom backend:
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(report)
      // });

      // Example for Sentry:
      // Sentry.captureException(new Error(report.message), {
      //   extra: report.context,
      //   tags: { sessionId: report.sessionId, userId: report.userId }
      // });

      console.log('📡 Would send to error service:', report);
      
    } catch (error) {
      console.error('Failed to send error report:', error);
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  getErrorSummary() {
    const summary = {
      totalErrors: this.errorQueue.filter(r => r.level === 'error').length,
      totalWarnings: this.errorQueue.filter(r => r.level === 'warning').length,
      sessionId: this.sessionId,
      userId: this.userId,
      brandId: this.brandId,
      recentErrors: this.errorQueue.slice(-10)
    };

    return summary;
  }

  clearErrorQueue() {
    this.errorQueue = [];
  }

  // Export error data for debugging
  exportErrorData() {
    const data = {
      errors: this.errorQueue,
      performance: Object.fromEntries(this.performanceMetrics),
      session: {
        sessionId: this.sessionId,
        userId: this.userId,
        brandId: this.brandId,
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

const errorReporter = new ErrorReporter();

// ========================================
// CONVENIENCE FUNCTIONS
// ========================================

export const reportError = (error, context) => errorReporter.reportError(error, context);
export const reportWarning = (message, context) => errorReporter.reportWarning(message, context);
export const reportInfo = (message, context) => errorReporter.reportInfo(message, context);
export const trackAPICall = (endpoint, duration, success, statusCode) => 
  errorReporter.trackAPICall(endpoint, duration, success, statusCode);
export const setUser = (userId, brandId) => errorReporter.setUser(userId, brandId);
export const getErrorSummary = () => errorReporter.getErrorSummary();
export const exportErrorData = () => errorReporter.exportErrorData();

export default errorReporter;





