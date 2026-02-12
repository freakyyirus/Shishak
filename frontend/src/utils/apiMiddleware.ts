import { FORCE_MOCK_MODE } from '../constants/apiConfig';

// Enhanced API middleware with fallback capability
export class ApiMiddleware {
  static async execute<T>(
    apiCall: () => Promise<T>,
    mockCall: () => Promise<T>,
    endpointName: string
  ): Promise<T> {
    if (FORCE_MOCK_MODE) {
      console.log(`Using mock API for ${endpointName}`);
      return mockCall();
    }

    try {
      console.log(`Attempting real API call for ${endpointName}`);
      const result = await apiCall();
      console.log(`Real API call succeeded for ${endpointName}`);
      return result;
    } catch (error) {
      console.warn(`Real API call failed for ${endpointName}:`, error);
      console.log(`Falling back to mock API for ${endpointName}`);
      return mockCall();
    }
  }

  // Specific handler for fetch requests that might fail
  static async handleFetch(
    input: RequestInfo | URL,
    init?: RequestInit | undefined,
    mockResponse?: any
  ): Promise<Response> {
    if (FORCE_MOCK_MODE && mockResponse) {
      return new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const response = await fetch(input, init);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      console.warn(`Fetch failed for ${input}:`, error);
      if (mockResponse) {
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw error;
    }
  }
}