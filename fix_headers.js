const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

// Use regex to remove app-screen-header divs safely across different line endings
const screensToFix = ['team', 'analytics', 'bot_builder', 'broadcasts', 'ai_setup', 'pricing'];

screensToFix.forEach(screenId => {
    // Regex matches the start of the screen div, then any whitespace, then the app-screen-header div and its contents up to its closing </div>
    const regex = new RegExp(`(<div class="screen" id="${screenId}">\\s*)<div class="app-screen-header"[^>]*>[\\s\\S]*?<\\/div>`, 'i');
    code = code.replace(regex, '$1');
});

fs.writeFileSync('index.html', code, 'utf8');
console.log('Removed duplicate app-screen-headers');
