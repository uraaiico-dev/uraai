const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Replace the inside of toggleAIPause
const oldToggle = /async function toggleAIPause\(\) \{([\s\S]*?)try \{/m;
const newToggle = `async function toggleAIPause() {
  if (!activeInboxContact) return;
  
  const toggleCheckbox = document.getElementById('btn-toggle-ai');
  const toggleLabel = document.getElementById('ai-toggle-label');
  if (!toggleCheckbox || !toggleLabel) return;
  
  // Optimistic UI update
  const newPausedState = !toggleCheckbox.checked; // If it's unchecked, AI is paused
  toggleLabel.innerText = newPausedState ? '⏸️ AI: PAUSED' : '🤖 AI: ON';
  toggleLabel.style.color = newPausedState ? '#e1306c' : 'var(--ink-60)';
  
  try {`;

code = code.replace(oldToggle, newToggle);

// Replace the inside of loadInboxChat
const oldLoad = /const isPaused = lead\.is_ai_paused \|\| false;[\s\S]*?toggleLabel\.style\.color = isPaused \? '#e1306c' : '#111b21';/m;
const newLoad = `const isPaused = lead.is_ai_paused || false;
    toggleLabel.innerText = isPaused ? '⏸️ AI: PAUSED' : '🤖 AI: ON';
    toggleLabel.style.color = isPaused ? '#e1306c' : 'var(--ink-60)';
    const toggleCheckbox = document.getElementById('btn-toggle-ai');
    if (toggleCheckbox) toggleCheckbox.checked = !isPaused;`;

code = code.replace(oldLoad, newLoad);

fs.writeFileSync('app.js', code, 'utf8');
console.log('Toggle logic updated in app.js');
