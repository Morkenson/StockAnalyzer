// Environment configuration
// Set production: true for production builds, false for development

export const environment = {
  production: false, // Set to true for production builds
  
  // Stock API Configuration
  stockApi: {
    apiUrl: 'https://api.example.com/stocks',
    apiKey: 'YOUR_STOCK_API_KEY_HERE'
  },
  
  // Backend API Configuration
  api: {
    baseUrl: 'https://localhost:5001/api' // .NET backend URL
  }
  
  // SnapTrade configuration removed - now handled by backend
};
