const fs = require('fs');
const path = require('path');

// Read environment variables provided by the hosting platform (e.g. Vercel)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const apiBaseUrl =
  process.env.API_BASE_URL || 'https://stockanalyzer-production.up.railway.app/api';

const envProdPath = path.join(__dirname, '../src/environments/environment.prod.ts');

let content = fs.readFileSync(envProdPath, 'utf8');

// Replace placeholders if they exist, or ensure the values are set
content = content
  .replace(/url:\s*['"].*['"]/, `url: '${supabaseUrl}'`)
  .replace(/anonKey:\s*['"].*['"]/, `anonKey: '${supabaseAnonKey}'`)
  .replace(
    /baseUrl:\s*['"]https:\/\/stockanalyzer-production\.up\.railway\.app\/api['"]/,
    `baseUrl: '${apiBaseUrl}'`
  );

fs.writeFileSync(envProdPath, content, 'utf8');
console.log('✅ environment.prod.ts updated from environment variables');


