// Global error handler for API failures in deployed environment
export const setupGlobalErrorHandler = () => {
  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Unhandled promise rejection (likely API failure):', event.reason);
    
    // Prevent the default behavior which would show an error
    if (event.reason?.message?.includes('Failed to fetch') || 
        event.reason?.message?.includes('NetworkError') ||
        event.reason?.message?.includes('TypeError')) {
      console.log('Detected network/API error, this is expected in demo mode');
      // Don't prevent the default, let the app continue with fallbacks
    }
  });

  // Capture global errors
  window.addEventListener('error', (event) => {
    if (event.error?.message?.includes('Failed to fetch') ||
        event.error?.message?.includes('NetworkError') ||
        event.error?.message?.includes('TypeError')) {
      console.warn('Network/API error caught:', event.error);
      console.log('This is expected in demo mode when backend is not available');
    }
  });

  // Override console.error for API-related errors to reduce noise
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const message = args.join(' ');
    if (message.includes('Failed to fetch') || 
        message.includes('Network Error') ||
        message.includes('fetch') ||
        message.includes('API')) {
      // Log as warning instead of error to reduce console noise
      console.warn('[API Error - Expected in Demo Mode]:', ...args);
    } else {
      originalConsoleError(...args);
    }
  };
};

// Call this when the app starts
setupGlobalErrorHandler();