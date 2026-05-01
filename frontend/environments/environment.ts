// Environment configuration
// Set production: true for production builds, false for development

export const environment = {
  production: false, // Set to true for production builds
  
  // Twelve Data API Configuration
  stockApi: {
    apiUrl: 'https://api.twelvedata.com',
    apiKey: 'YOUR_TWELVE_DATA_API_KEY_HERE'
  },
  
  // Backend API Configuration
  api: {
    baseUrl: '/api'
  },
  // SnapTrade configuration removed - now handled by backend
};
