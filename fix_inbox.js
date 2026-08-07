const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const target = '<div class="screen" id="inbox" style="padding:0; height:100%; display:flex; flex-direction:column; background:var(--surface);">';
const replacement = '<div class="screen" id="inbox" style="padding:0; height:100%; flex-direction:column; background:var(--surface);">';

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('index.html', code, 'utf8');
    console.log('Fixed inbox inline display');
} else {
    console.log('Target string not found!');
}
