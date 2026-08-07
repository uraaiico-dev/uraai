const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Update bubble sent background
code = code.replace(
  /bubble\.style = 'align-self: flex-end; background: #d9fdd3; padding: 6px 7px 8px 9px; border-radius: 8px 0 8px 8px; max-width: 65%; box-shadow: 0 1px 0\.5px rgba\(11,20,26,\.13\); position: relative; font-size: 14\.2px; color: #111b21; margin-bottom: 4px;';/g,
  "bubble.style = 'align-self: flex-end; background: #F0EEFF; padding: 8px 12px; border-radius: 12px 12px 0 12px; max-width: 65%; box-shadow: 0 1px 2px rgba(0,0,0,0.05); position: relative; font-size: 14.2px; color: #5B3FD9; margin-bottom: 6px;';"
);

// Update ticks/color for read receipts in outbound bubbles
code = code.replace(
  /<path fill="#53bdeb"/g,
  '<path fill="#7B61FF"'
);
code = code.replace(
  /<path fill="#8696a0"/g,
  '<path fill="#7B61FF"'
);
code = code.replace(
  /color: #667781;/g,
  'color: #8C7DE6;'
);

fs.writeFileSync('app.js', code, 'utf8');
console.log('Styles updated in app.js');
