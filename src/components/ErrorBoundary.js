import React from 'react';
import { AlertCircle, RefreshCw, Home, Bug } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Generate unique error ID for tracking
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.setState({
      error: error,
      errorInfo: errorInfo,
      errorId: errorId
    });

    // Log error details for debugging
    console.error('🚨 ERROR BOUNDARY CAUGHT ERROR:', {
      errorId,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // In production, you would send this to your error reporting service
    this.reportError(error, errorInfo, errorId);
  }

  reportError = (error, errorInfo, errorId) => {
    // This is where you'd integrate with Sentry, LogRocket, or your error service
    try {
      // For now, we'll just log it. In production, replace with your error service:
      // Sentry.captureException(error, { extra: errorInfo, tags: { errorId } });
      
      const errorReport = {
        errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      };

      // You can send this to your backend or error service
      console.log('📊 ERROR REPORT:', errorReport);
      
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full">
            {/* Error Icon */}
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>

            {/* Error Title */}
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-4">
              Something went wrong
            </h1>

            {/* Error Description */}
            <p className="text-gray-600 text-center mb-6">
              We encountered an unexpected error. Don't worry - your data is safe and this has been reported to our team.
            </p>

            {/* Error ID for Support */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2">
                <Bug className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Error ID:</span>
                <code className="text-sm font-mono bg-white px-2 py-1 rounded border">
                  {this.state.errorId}
                </code>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center space-x-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>Go Home</span>
              </button>
            </div>

            {/* Development Error Details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
                <summary className="font-medium text-red-800 cursor-pointer">
                  Development Error Details
                </summary>
                <div className="mt-3 text-sm">
                  <div className="mb-2">
                    <strong className="text-red-700">Error:</strong>
                    <pre className="mt-1 text-red-600 whitespace-pre-wrap bg-white p-2 rounded border">
                      {this.state.error.message}
                    </pre>
                  </div>
                  <div className="mb-2">
                    <strong className="text-red-700">Stack Trace:</strong>
                    <pre className="mt-1 text-red-600 text-xs whitespace-pre-wrap bg-white p-2 rounded border max-h-40 overflow-auto">
                      {this.state.error.stack}
                    </pre>
                  </div>
                  <div>
                    <strong className="text-red-700">Component Stack:</strong>
                    <pre className="mt-1 text-red-600 text-xs whitespace-pre-wrap bg-white p-2 rounded border max-h-40 overflow-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;



