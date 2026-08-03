// --- CONVERSATIONAL AUTH UI BOT ---
const authBotState = {
  mode: 'signup',
  stepIndex: 0,
  data: {}
};

const authBotFlows = {
  signup: [
    { key: 'name', type: 'text', q: 'Hello there! 👋 I am Uraai, your new AI assistant. Let\'s get you set up! What is your full name? 😊', err: 'Hmm, that doesn\'t look like a real name. Could you try again? 🥺' },
    { key: 'email', type: 'email', q: 'Awesome name! ✨ What is your email address? 📧', err: 'Oops! 😅 That doesn\'t look like a valid email. Are you sure you typed it correctly?' },
    { key: 'password', type: 'password', q: 'Got it! Now, please create a super strong password (min 6 chars) 🔒', err: 'Uh oh! 😬 Your password is too short. It must be at least 6 characters!' },
    { key: 'phone', type: 'tel', q: 'Perfect! 🎉 What is the best phone number to reach you on? 📱', err: 'That doesn\'t look right! Please enter a valid phone number 📞' },
    { key: 'busname', type: 'text', q: 'We\'re flying! 🚀 What is the name of your business? 🏪', err: 'Please don\'t leave this blank! We need your business name! 🏢' },
    { key: 'city', type: 'text', q: 'And finally, what city are you located in? 🌍', err: 'Almost there... please tell me your city! 🏙️' }
  ],
  login: [
    { key: 'email', type: 'email', q: 'Welcome back to Uraai! 👋 So great to see you again! What is your email address?', err: 'Oops! 😅 That doesn\'t look like a valid email. Please check it and try again.' },
    { key: 'password', type: 'password', q: 'Awesome. And your password? 🤫', err: 'Don\'t forget your password! 😬 Please type it in.' }
  ]
};

function initAuthBot(mode) {
  authBotState.mode = mode;
  authBotState.stepIndex = 0;
  authBotState.data = {};
  
  const history = document.getElementById('auth-chat-history');
  if(history) history.innerHTML = '';
  
  // Highlight tab
  const suTab = document.getElementById('tab-opt-signup');
  const liTab = document.getElementById('tab-opt-login');
  if(suTab && liTab) {
    if (mode === 'signup') {
      suTab.classList.add('active');
      liTab.classList.remove('active');
    } else {
      suTab.classList.remove('active');
      liTab.classList.add('active');
    }
  }

  clearTimeout(window.authBotTimeout);
  window.authBotTimeout = setTimeout(askNextAuthQuestion, 300);
}

function askNextAuthQuestion() {
  const flow = authBotFlows[authBotState.mode];
  if (authBotState.stepIndex >= flow.length) {
    finishAuthFlow();
    return;
  }
  
  const step = flow[authBotState.stepIndex];
  addAuthBubble(step.q, 'bot');
  
  const inputEl = document.getElementById('auth-bot-input');
  if(inputEl) {
    inputEl.type = step.type;
    inputEl.value = '';
    inputEl.placeholder = 'Type your answer here...';
    setTimeout(() => inputEl.focus(), 100);
  }
}

function addAuthBubble(text, sender) {
  const history = document.getElementById('auth-chat-history');
  if(!history) return;
  
  const container = document.createElement('div');
  container.className = 'auth-bubble-container ' + sender;
  
  if (sender === 'bot') {
    const avatar = document.createElement('div');
    avatar.className = 'auth-bot-avatar';
    avatar.innerText = '🤖';
    container.appendChild(avatar);
  }
  
  const bubble = document.createElement('div');
  bubble.className = 'auth-bubble ' + (sender === 'bot' ? 'auth-bot' : 'auth-user');
  bubble.innerText = text;
  
  container.appendChild(bubble);
  history.appendChild(container);
  history.scrollTop = history.scrollHeight;
}

function validateAuthInput(val, type) {
  if (!val || val.trim().length === 0) return false;
  if (type === 'email' && !val.includes('@')) return false;
  if (type === 'password' && val.length < 6) return false;
  return true;
}

function handleAuthSubmit() {
  const inputEl = document.getElementById('auth-bot-input');
  if(!inputEl) return;
  const val = inputEl.value;
  const flow = authBotFlows[authBotState.mode];
  const step = flow[authBotState.stepIndex];
  
  if (!validateAuthInput(val, step.type)) {
    addAuthBubble(step.err, 'bot');
    return;
  }
  
  // User bubble
  addAuthBubble(step.type === 'password' ? '••••••••' : val, 'user');
  
  // Save data
  authBotState.data[step.key] = val;
  
  authBotState.stepIndex++;
  clearTimeout(window.authBotTimeout);
  window.authBotTimeout = setTimeout(askNextAuthQuestion, 400);
}

function finishAuthFlow() {
  addAuthBubble('Processing your request... ⚙️', 'bot');
  
  if (authBotState.mode === 'signup') {
    document.getElementById('su-fullname').value = authBotState.data.name || '';
    document.getElementById('su-email').value = authBotState.data.email || '';
    document.getElementById('su-password').value = authBotState.data.password || '';
    document.getElementById('su-phone').value = authBotState.data.phone || '';
    document.getElementById('su-busname').value = authBotState.data.busname || '';
    document.getElementById('su-city').value = authBotState.data.city || '';
    
    // Simulate click
    const btn = document.getElementById('su-btn-submit');
    if (btn) btn.click();
  } else {
    document.getElementById('li-email').value = authBotState.data.email || '';
    document.getElementById('li-password').value = authBotState.data.password || '';
    
    // Simulate click
    const btn = document.getElementById('li-btn-submit');
    if (btn) btn.click();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const sendBtn = document.getElementById('auth-bot-send');
  const inputEl = document.getElementById('auth-bot-input');
  if(sendBtn) {
    sendBtn.addEventListener('click', handleAuthSubmit);
  }
  if(inputEl) {
    inputEl.addEventListener('keypress', (e) => {
      if(e.key === 'Enter') handleAuthSubmit();
    });
  }
  
  // Overwrite openAuthModal from app.js
  window.openAuthModal = function(mode = 'signup') {
    const modal = document.getElementById('auth-modal');
    if(modal) modal.classList.add('active');
    initAuthBot(mode);
  }
  
  // Handle Tabs
  const suTab = document.getElementById('tab-opt-signup');
  const liTab = document.getElementById('tab-opt-login');
  if(suTab) suTab.addEventListener('click', () => initAuthBot('signup'));
  if(liTab) liTab.addEventListener('click', () => initAuthBot('login'));
});
