// Production environment configuration
// This file is used when building for production (e.g., Vercel deployment)

export const environment = {
  production: true,
  
  // Backend API Configuration - default to your Railway backend URL
  // The build script (scripts/build-env.js) can override this via API_BASE_URL env var
  api: {
    baseUrl: 'https://stockanalyzer-production.up.railway.app/api'
  },
  
  // Twelve Data API Configuration (not used in frontend - handled by backend)
  stockApi: {
    apiUrl: 'https://api.twelvedata.com',
    apiKey: '' // Not needed - handled by backend
  },
  
  // Supabase Configuration
  supabase: {
    url: '',
    anonKey: ''
  }
};

