const fs = require('fs');

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function pct(value) {
  return `${Number(value).toFixed(2)}%`;
}

const backend = readJson('coverage/backend/coverage.json');
const frontend = readJson('coverage/frontend/coverage-summary.json');

console.error('');
console.error('Coverage Summary');
console.error('----------------');
console.error(
  `Backend  line: ${pct(backend.totals.percent_covered)}  statements: ${pct(backend.totals.percent_statements_covered)}`
);
console.error(
  `Frontend line: ${pct(frontend.total.lines.pct)}  statements: ${pct(frontend.total.statements.pct)}`
);
