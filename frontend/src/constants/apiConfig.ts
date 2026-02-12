// API Configuration for Production Deployment
// This ensures the frontend works in deployed environments without backend

// Determine if we're in production/deployed environment
const isDeployed = typeof window !== 'undefined' && 
                  window.location.hostname !== 'localhost' && 
                  !window.location.hostname.startsWith('127.') &&
                  !window.location.hostname.startsWith('192.') &&
                  !window.location.hostname.includes('ngrok.io') &&
                  !window.location.hostname.includes('localtunnel.me');

// API Base URL - use environment variable or fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || (isDeployed ? '' : 'http://localhost:5001');

// Force mock mode in deployed environments
export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  USE_MOCK: isDeployed, // Always use mock in deployed environments
  TIMEOUT: 10000,
  RETRY_COUNT: 1
};

// For deployed environments, we'll always use mock mode regardless of VITE_API_URL
export const FORCE_MOCK_MODE = isDeployed;