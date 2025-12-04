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
    baseUrl: 'http://localhost:5000/api' // .NET backend URL (use http for local development)
  },
  
  // Supabase Configuration
  supabase: {
    url: 'https://izhnkpxnjqgpuavxrain.supabase.co', // e.g., 'https://your-project.supabase.co'
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6aG5rcHhuanFncHVhdnhyYWluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MjUxNTksImV4cCI6MjA4MDIwMTE1OX0.VY3SMpVU5UmU-NBMs1uXVN-GjkYprUt0jLyMzuHBuWc' // Your Supabase anonymous/public key
  },
  
  // SnapTrade configuration removed - now handled by backend
};
