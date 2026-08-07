const fs = require('fs');
const code = fs.readFileSync('inbox_logic.js', 'utf8');
fs.appendFileSync('app.js', '\n' + code, 'utf8');
console.log('Appended successfully');
