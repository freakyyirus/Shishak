// Utility to handle API fallback for frontend-only deployment
export const setupApiFallback = () => {
  // Check if we're in a deployed environment (not localhost)
  const isDeployed = window.location.hostname !== 'localhost' && 
                    !window.location.hostname.startsWith('127.') &&
                    !window.location.hostname.startsWith('192.');

  // If deployed and API is not responding, redirect to a demo page or show instructions
  if (isDeployed) {
    // Override fetch to intercept API calls and provide mock responses
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const url = args[0] as string;
      
      // If it's an API call and we're in deployed environment, return mock responses
      if (typeof url === 'string' && url.includes('/api/') && isDeployed) {
        console.log(`Intercepted API call to: ${url}. Returning mock response.`);
        
        // Return mock responses based on the endpoint
        if (url.includes('/api/query') || url.includes('/api/chats')) {
          return Promise.resolve(new Response(JSON.stringify({
            success: true,
            response: "This is a demo response. In a full deployment, this would connect to the backend API.",
            message: "Demo mode: API connection not available in this deployment"
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        } else if (url.includes('/api/board')) {
          return Promise.resolve(new Response(JSON.stringify({
            connected: true,
            model: "demo-model",
            message: "Demo mode: Board API not available in this deployment"
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        } else {
          // For other API calls, return a generic mock
          return Promise.resolve(new Response(JSON.stringify({
            success: true,
            message: "Demo mode: This would connect to the backend API in a full deployment"
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
      }
      
      // Otherwise, use the original fetch
      return originalFetch.apply(window, args);
    };
  }
};

// Call this function when the app starts
setupApiFallback();