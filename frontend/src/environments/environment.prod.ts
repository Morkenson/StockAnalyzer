// Production environment configuration
// This file is used when building for production (e.g., Vercel deployment)

export const environment = {
  production: true,
  
  // Backend API Configuration - Replace with your Railway backend URL
  // Format: https://your-app-name.up.railway.app/api
  api: {
    baseUrl: 'https://stockanalyzer-production.up.railway.app/api' // TODO: Replace with your actual Railway URL
  },
  
  // Twelve Data API Configuration (not used in frontend - handled by backend)
  stockApi: {
    apiUrl: 'https://api.twelvedata.com',
    apiKey: '' // Not needed - handled by backend
  }
};

