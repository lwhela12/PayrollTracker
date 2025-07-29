const fs = require('fs');

// Read the broken routes file
let content = fs.readFileSync('routes.ts', 'utf8');

// Fix the broken conditional statements systematically
content = content.replace(
  /if \(!employer \|\| !\(await hasAccessToEmployer\(req\.user\.claims\.sub, employerId \|\| payPeriodData\.employerId \|\| payPeriod\.employerId \|\| employee\.employerId\)\)\)/g,
  'if (!(await hasAccessToEmployer(req.user.claims.sub, employerId)))'
);

// Fix specific cases where we need different variable names
content = content.replace(
  /if \(!\(await hasAccessToEmployer\(req\.user\.claims\.sub, employerId\)\)\) return res\.status\(403\)\.json\(\{ message: 'Access denied' \}\);/g,
  'if (!(await hasAccessToEmployer(req.user.claims.sub, employerId))) return res.status(403).json({ message: "Access denied" });'
);

// Write the fixed content back
fs.writeFileSync('routes.ts', content);
console.log('Routes file has been fixed');
