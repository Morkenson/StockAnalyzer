const fs = require('fs');
const path = require('path');

const apiBaseUrl =
  process.env.API_BASE_URL || 'https://stockanalyzer-production.up.railway.app/api';

const envProdPath = path.join(__dirname, '../environments/environment.prod.ts');
let content = fs.readFileSync(envProdPath, 'utf8');

content = content.replace(/baseUrl:\s*['"][^'"]*['"]/, `baseUrl: '${apiBaseUrl}'`);

fs.writeFileSync(envProdPath, content, 'utf8');
console.log('environment.prod.ts updated from environment variables');
