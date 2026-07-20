// Uraai Live Simulator Application Logic

// --- STATE MANAGEMENT ---
const state = {
  activeScreen: 'onboarding',
  currentPlan: 'starter', // starter, pro, max
  welcomeMessage: "",
  openTime: "9:00 AM",
  closeTime: "8:00 PM",
  languages: ['tamil', 'english'], // tamil, english, hindi, telugu, malayalam
  faqs: [
    { q: "Timings?", a: "We're open Mon–Sat, 9am to 8pm." },
    { q: "Booking an appointment?", a: "Share your date & time and we'll confirm." }
  ],
  channels: {
    whatsapp: false,
    instagram: false,
    email: false
  },
  stats: {
    repliesToday: 0,
    leadsSaved: 0,
    avgResponse: 2.1,
    satisfaction: 98,
    missedChats: 0,
    activeBots: 1
  },
  analyticsSegment: 'week', // today, week, month
  
  // Extended user auth/profile states
  userProfile: {
    loggedIn: false,
    supabaseId: null,
    fullName: "Sanjay",
    email: "",
    password: "",
    phone: "",
    businessName: "Priya Beauty Salon",
    businessType: "Salon & Beauty",
    city: "Chennai",
    category: "Beauty Parlour & Hair Styling",
    waNumber: "+91 98450 12345",
    igHandle: "",
    busEmail: "",
    logoFile: null
  }
};

// --- PLAN LIMITS CONFIG (single source of truth) ---
const PLAN_LIMITS = {
  starter: {
    maxBots: 1,
    maxRepliesPerMonth: 50,
    maxFaqTemplates: 5,
    languages: ['tamil', 'hindi', 'english'],
    channels: ['whatsapp'],
    leadInbox: true,
    replyHistoryDays: 7,
    weeklySummaryEmail: true,
    maxTeamMembers: 1,
    autoFollowUp: false,
    bookingCalendar: false,
    leadExport: false,
    broadcastLimit: 0,
    leadScoring: false,
    multiStepFollowUp: false,
    monthlyReport: false
  },
  pro: {
    maxBots: 3,
    maxRepliesPerMonth: Infinity,
    maxFaqTemplates: Infinity,
    languages: ['tamil', 'hindi', 'english', 'telugu', 'malayalam'],
    channels: ['whatsapp', 'instagram', 'email'],
    leadInbox: true,
    replyHistoryDays: Infinity,
    weeklySummaryEmail: true,
    maxTeamMembers: 3,
    autoFollowUp: true,
    bookingCalendar: true,
    leadExport: true,
    broadcastLimit: 50,
    leadScoring: false,
    multiStepFollowUp: false,
    monthlyReport: false
  },
  max: {
    maxBots: Infinity,
    maxRepliesPerMonth: Infinity,
    maxFaqTemplates: Infinity,
    languages: ['tamil', 'hindi', 'english', 'telugu', 'malayalam', 'kannada', 'bengali', 'marathi'],
    channels: ['whatsapp', 'instagram', 'email'],
    leadInbox: true,
    replyHistoryDays: Infinity,
    weeklySummaryEmail: true,
    maxTeamMembers: 10,
    autoFollowUp: true,
    bookingCalendar: true,
    leadExport: true,
    broadcastLimit: Infinity,
    leadScoring: true,
    multiStepFollowUp: true,
    monthlyReport: true
  }
};

// Helper to get current user's limits anywhere in the app
function getCurrentLimits() {
  return PLAN_LIMITS[state.currentPlan] || PLAN_LIMITS.starter;
}


// --- LOGGING UTILITY ---
function addLog(source, message, type = 'default') {
  const consoleBody = document.getElementById('console-body');
  if (!consoleBody) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const logRow = document.createElement('div');
  logRow.className = `log-entry`;

  let sourceSpan = '';
  if (source === 'system') {
    sourceSpan = `<span class="log-system">[SYS]</span>`;
  } else if (source === 'engine') {
    sourceSpan = `<span class="log-engine">[BOT]</span>`;
  } else if (source === 'user') {
    sourceSpan = `<span class="log-user">[USR]</span>`;
  }

  logRow.innerHTML = `<span class="log-time">[${timeStr}]</span> ${sourceSpan} <span class="log-${type}">${message}</span>`;
  consoleBody.appendChild(logRow);
  consoleBody.scrollTop = consoleBody.scrollHeight;
}

// --- SCREEN NAVIGATION ---
function navigateTo(screenId) {
  // Hide current screens
  document.querySelectorAll('.screen').forEach(scr => {
    scr.classList.remove('active');
  });

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
    state.activeScreen = screenId;
    addLog('system', `Navigated to screen: ${screenId.toUpperCase()}`, 'default');
  }

  // Update Header Title in App Viewport
  const headerTitle = document.getElementById('app-header-view-title');
  if (headerTitle) {
    let title = 'Dashboard';
    if (screenId === 'bot_builder') title = 'Bot Builder';
    if (screenId === 'analytics') title = 'Analytics';
    if (screenId === 'pricing') title = 'Billing & Plans';
    if (screenId === 'onboarding') title = 'Setup Guide';
    headerTitle.innerText = title;
  }

  // Update nav highlights
  updateNavHighlights();
}

function updateNavHighlights() {
  const currentTab = state.activeScreen === 'dashboard' ? 'dashboard' :
                     state.activeScreen === 'bot_builder' ? 'bot_builder' :
                     state.activeScreen === 'analytics' ? 'analytics' :
                     state.activeScreen === 'pricing' ? 'pricing' : '';

  // Highlight Desktop Sidebar items
  document.querySelectorAll('.sidebar-item').forEach(item => {
    if (item.getAttribute('data-tab') === currentTab) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Highlight Mobile Bottom Navigation items
  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    if (item.getAttribute('data-tab') === currentTab) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

function bindNavbarListeners() {
  const navLogin = document.getElementById('nav-btn-login');
  const navSignup = document.getElementById('nav-btn-signup');
  if (navLogin) navLogin.onclick = () => openAuthModal('login');
  if (navSignup) navSignup.onclick = () => openAuthModal('signup');
}

// --- INITIAL DATA SYNC ---
function syncUI() {
  applyPlanGatingToUI();
  // Global Header Actions State (Logged in or out)
  const navActions = document.getElementById('header-nav-actions');
  if (navActions) {
    if (state.userProfile.loggedIn) {
      const firstLetter = state.userProfile.fullName.charAt(0).toUpperCase();
      navActions.innerHTML = `
        <div class="user-badge">
          <div class="user-badge-initial">${firstLetter}</div>
          <span class="user-badge-name">${state.userProfile.businessName}</span>
        </div>
      `;
    } else {
      navActions.innerHTML = `
        <button class="btn-nav-ghost" id="nav-btn-login">Log In</button>
        <button class="btn-nav-filled" id="nav-btn-signup">Start Free</button>
      `;
      // Re-bind navbar listeners since innerHTML refreshed
      bindNavbarListeners();
    }
  }

  // 1. Dashboard Info
  const initial = state.userProfile.fullName.charAt(0).toUpperCase();
  document.getElementById('dash-user-name').innerText = `${state.userProfile.fullName} 👋`;
  document.getElementById('dash-avatar-circle').innerText = initial;
  document.getElementById('builder-business-name-sub').innerText = `${state.userProfile.businessType} — Active`;

  // Sync Desktop Sidebar Profile Info
  const sidebarAvatar = document.getElementById('sidebar-avatar-circle');
  if (sidebarAvatar) sidebarAvatar.innerText = initial;
  
  const sidebarUser = document.getElementById('sidebar-user-name');
  if (sidebarUser) sidebarUser.innerText = state.userProfile.fullName;

  const sidebarBiz = document.getElementById('sidebar-business-name');
  if (sidebarBiz) sidebarBiz.innerText = state.userProfile.businessName;

  // Sync Header Plan Badge
  const planBadge = document.getElementById('app-header-plan-badge');
  if (planBadge) {
    planBadge.innerText = `${state.currentPlan.toUpperCase()} PLAN`;
  }

  // Stats Counters
  document.getElementById('stat-replies').innerText = Number(state.stats.repliesToday).toLocaleString();
  document.getElementById('stat-leads').innerText = state.stats.leadsSaved;
  document.getElementById('stat-avg-time').innerHTML = `${state.stats.avgResponse}<span style="font-size:14px;font-weight:500">s</span>`;
  document.getElementById('stat-satisfaction').innerHTML = `${state.stats.satisfaction}<span style="font-size:14px;font-weight:500">%</span>`;
  document.getElementById('stat-missed').innerText = state.stats.missedChats;
  document.getElementById('stat-bots-active').innerText = state.stats.activeBots;

  // Render active channels on dashboard
  updateWhatsAppChannelCard(state.channels.whatsapp);

  // 2. Bot Builder Data
  document.getElementById('welcome-msg-input').value = state.welcomeMessage;
  document.getElementById('open-time-input').value = state.openTime;
  document.getElementById('close-time-input').value = state.closeTime;

  // Sync Languages Tags
  document.querySelectorAll('#lang-tag-row .tag').forEach(tag => {
    const lang = tag.getAttribute('data-lang');
    if (state.languages.includes(lang)) {
      tag.classList.add('on');
    } else {
      tag.classList.remove('on');
    }
  });

  // Sync FAQs List
  renderFAQsList();

  // Sync Live Preview Card
  renderBotLivePreview();

  // 3. Pricing Active State (Sync both Webpage pricing and Phone Simulator pricing)
  document.querySelectorAll('.plan').forEach(planCard => {
    const cta = planCard.querySelector('.plan-cta');
    const tier = planCard.getAttribute('data-tier');
    
    if (tier === state.currentPlan) {
      planCard.style.borderColor = 'var(--violet)';
      if (cta) {
        cta.innerText = 'Current Plan';
        cta.className = 'plan-cta cta-outline';
        cta.setAttribute('data-tier', tier);
        cta.disabled = true;
      }
    } else {
      if (!planCard.classList.contains('featured')) {
        planCard.style.borderColor = 'var(--border)';
      }
      if (cta) {
        cta.disabled = false;
        if (tier === 'starter') {
          cta.innerText = 'Select Plan';
          cta.className = 'plan-cta cta-outline';
          cta.setAttribute('data-tier', tier);
        } else if (tier === 'pro') {
          cta.innerText = 'Upgrade to Pro';
          cta.className = 'plan-cta cta-fill';
          cta.setAttribute('data-tier', tier);
        } else if (tier === 'max') {
          cta.innerText = 'Get Max';
          cta.className = 'plan-cta cta-ember';
          cta.setAttribute('data-tier', tier);
        }
      }
    }
  });

  // 4. Customer Chat WhatsApp details sync
  document.getElementById('wa-avatar-char').innerText = state.userProfile.businessName.charAt(0).toUpperCase();
  document.getElementById('wa-header-business-name').innerHTML = `${state.userProfile.businessName} <span class="wa-business-verified">✓</span>`;

  // Enforce limitations based on pricing
  enforcePlanLimitations();
}



function renderFAQsList() {
  const container = document.getElementById('faq-replies-list');
  if (!container) return;

  container.innerHTML = '';
  state.faqs.forEach((faq, index) => {
    const item = document.createElement('div');
    item.className = 'faq-item';
    item.innerHTML = `
      <div>
        <div class="faq-q">${faq.q}</div>
        <div class="faq-a">${faq.a}</div>
      </div>
      <div class="faq-edit" onclick="openFaqModal(${index})">Edit</div>
    `;
    container.appendChild(item);
  });
}

function renderBotLivePreview() {
  const welcomeBubble = document.getElementById('preview-welcome-bubble');
  const timingsBubble = document.getElementById('preview-timings-bubble');

  if (welcomeBubble) {
    welcomeBubble.innerHTML = state.welcomeMessage.replace(/\n/g, '<br>');
  }
  if (timingsBubble) {
    timingsBubble.innerHTML = `Sure! Share your preferred date and time 📅<br>We're open Mon–Sat, ${state.openTime}–${state.closeTime}.`;
  }
}

// --- PLAN LIMITATIONS ---
function enforcePlanLimitations() {
  const langWrapper = document.getElementById('lang-tag-row');
  if (!langWrapper) return;

  if (state.currentPlan === 'starter') {
    state.channels.instagram = false;
    state.channels.email = false;
    state.stats.activeBots = 1;
    document.getElementById('stat-bots-active').innerText = 1;

    // Block non-english tags visually
    langWrapper.querySelectorAll('.tag').forEach(tag => {
      const lang = tag.getAttribute('data-lang');
      if (lang !== 'english') {
        tag.classList.add('disabled-feature');
      } else {
        tag.classList.remove('disabled-feature');
      }
    });

    const addFaqBtn = document.getElementById('add-faq-btn');
    const faqLimit = getCurrentLimits().maxFaqTemplates;
    if (state.faqs.length >= faqLimit) {
      addFaqBtn.innerHTML = `🔒 Limit reached (Upgrade for more)`;
      addFaqBtn.disabled = true;
    } else {
      addFaqBtn.innerHTML = `+ Add FAQ reply (${state.faqs.length}/${faqLimit === Infinity ? '∞' : faqLimit})`;
      addFaqBtn.disabled = false;
    }
  } else {
    // Pro/Max limits
    state.stats.activeBots = (state.channels.whatsapp ? 1 : 0) + (state.channels.instagram ? 1 : 0) + (state.channels.email ? 1 : 0);
    document.getElementById('stat-bots-active').innerText = state.stats.activeBots;

    langWrapper.querySelectorAll('.tag').forEach(tag => {
      tag.classList.remove('disabled-feature');
    });

    const addFaqBtn = document.getElementById('add-faq-btn');
    addFaqBtn.innerHTML = `+ Add FAQ reply`;
    addFaqBtn.disabled = false;
  }
}

// --- FAQ MODAL MANAGEMENT ---
let currentEditingIndex = -1;

function openFaqModal(index = -1) {
  currentEditingIndex = index;
  const overlay = document.getElementById('faq-modal');
  const title = document.getElementById('modal-title-text');
  const qField = document.getElementById('modal-q-input');
  const aField = document.getElementById('modal-a-input');

  if (index === -1) {
    title.innerText = 'Add FAQ Auto-Reply';
    qField.value = '';
    aField.value = '';
  } else {
    title.innerText = 'Edit FAQ Auto-Reply';
    qField.value = state.faqs[index].q;
    aField.value = state.faqs[index].a;
  }

  overlay.classList.add('active');
}

function closeFaqModal() {
  document.getElementById('faq-modal').classList.remove('active');
  currentEditingIndex = -1;
}

async function saveFaqModal() {
  const qVal = document.getElementById('modal-q-input').value.trim();
  const aVal = document.getElementById('modal-a-input').value.trim();

  if (!qVal || !aVal) {
    alert('Please fill out both fields.');
    return;
  }

  try {
    if (currentEditingIndex === -1) {
      // Add new FAQ
      if (state.faqs.length >= getCurrentLimits().maxFaqTemplates) {
        triggerNotification('🔒 FAQ Limit Reached', 'Upgrade to add more FAQs.');
        closeFaqModal();
        navigateTo('pricing');
        return;
      }
      // Save to Supabase if logged in
      if (state.userProfile.supabaseId) {
        await addFaq(state.userProfile.supabaseId, qVal, aVal);
      }
      state.faqs.push({ q: qVal, a: aVal });
      addLog('system', `FAQ saved to database: "${qVal}"`, 'success');
    } else {
      // Update existing FAQ
      const existingFaq = state.faqs[currentEditingIndex];
      if (state.userProfile.supabaseId && existingFaq.id) {
        await updateFaq(existingFaq.id, qVal, aVal);
      }
      state.faqs[currentEditingIndex] = { ...existingFaq, q: qVal, a: aVal };
      addLog('system', `FAQ updated in database: "${qVal}"`, 'success');
    }
  } catch (err) {
    triggerNotification('⚠️ Save Failed', 'Could not save FAQ: ' + err.message);
  }

  closeFaqModal();
  syncUI();
  updateWhatsAppChips();
}

// --- PORTAL MODALS CONTROLS ---

// 1. Auth Modals
function openAuthModal(mode = 'signup') {
  const modal = document.getElementById('auth-modal');
  const suPanel = document.getElementById('form-panel-signup');
  const liPanel = document.getElementById('form-panel-login');
  const suTab = document.getElementById('tab-opt-signup');
  const liTab = document.getElementById('tab-opt-login');

  if (mode === 'signup') {
    suPanel.style.display = 'block';
    liPanel.style.display = 'none';
    suTab.classList.add('active');
    liTab.classList.remove('active');
  } else {
    suPanel.style.display = 'none';
    liPanel.style.display = 'block';
    liTab.classList.add('active');
    suTab.classList.remove('active');
  }

  modal.classList.add('active');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('active');
}

// 2. Profile Setup Modal
function openProfileModal() {
  document.getElementById('profile-modal').classList.add('active');
}
function closeProfileModal() {
  document.getElementById('profile-modal').classList.remove('active');
}

// 3. Payment Checkout Modal
let selectedUpgradeTier = 'pro';

function openPaymentModal(tier) {
  selectedUpgradeTier = tier;
  const modal = document.getElementById('payment-modal');
  const summaryText = document.getElementById('payment-package-summary');

  // Set checkout summary text
  if (tier === 'pro') {
    summaryText.innerText = 'Pro Subscription Plan — ₹499/month';
  } else if (tier === 'max') {
    summaryText.innerText = 'Max Subscription Plan — ₹999/month';
  } else if (tier === 'starter') {
    // Starter downgrade triggers instantly
    state.currentPlan = 'starter';
    state.languages = ['english'];
    syncUI();
    updateWhatsAppChips();
    addLog('system', 'Downgraded account subscription plan to: STARTER (Free)', 'default');
    triggerNotification('Plan Updated', 'Your bot is now operating under the Free Starter limitations.');
    return;
  }

  // Clear modal panels
  document.getElementById('payment-inputs-panel').style.display = 'block';
  document.getElementById('payment-loading-panel').style.display = 'none';
  document.getElementById('payment-success-panel').style.display = 'none';

  modal.classList.add('active');
}

function closePaymentModal() {
  document.getElementById('payment-modal').classList.remove('active');
}

// --- DYNAMIC WHATSAPP SIMULATION ---
const waChatArea = document.getElementById('wa-chat-area');

function updateWhatsAppChips() {
  const chipsRow = document.getElementById('wa-chips-row');
  if (!chipsRow) return;

  chipsRow.innerHTML = '';

  // Standard chips
  const standardChips = ["Timings?", "Book Appointment"];
  standardChips.forEach(chipText => {
    const chip = document.createElement('div');
    chip.className = 'wa-chip';
    chip.innerText = chipText;
    chip.onclick = () => sendCustomerMessage(chipText);
    chipsRow.appendChild(chip);
  });

  // Dynamic FAQ chips
  state.faqs.forEach(faq => {
    if (faq.q.toLowerCase().includes('time') || faq.q.toLowerCase().includes('book')) return;
    const chip = document.createElement('div');
    chip.className = 'wa-chip';
    chip.innerText = faq.q;
    chip.onclick = () => sendCustomerMessage(faq.q);
    chipsRow.appendChild(chip);
  });

  // Language check chip
  const chipLang = document.createElement('div');
  chipLang.className = 'wa-chip';
  chipLang.innerText = "Do you speak Tamil?";
  chipLang.onclick = () => sendCustomerMessage("Do you speak Tamil?");
  chipsRow.appendChild(chipLang);
}

function sendCustomerMessage(text) {
  if (!text.trim()) return;

  appendWAMessage('sent', text);
  addLog('user', `Inbound WhatsApp text: "${text}"`, 'user');

  const input = document.getElementById('wa-input-field');
  if (input) input.value = '';

  showWATypingIndicator();
  waChatArea.scrollTop = waChatArea.scrollHeight;

  setTimeout(() => {
    removeWATypingIndicator();
    const replyText = processBotEngine(text);
    appendWAMessage('received', replyText, true);
    addLog('engine', `Outbound WhatsApp auto-reply sent.`, 'success');

    if (state.activeScreen !== 'bot_builder' && state.activeScreen !== 'dashboard') {
      triggerNotification(`💬 Msg from +91 ${state.userProfile.phone.slice(-5) || '98450'}`, `Auto-responded: "${replyText.substring(0, 30)}..."`);
    }

    state.stats.repliesToday++;
    document.getElementById('stat-replies').innerText = Number(state.stats.repliesToday).toLocaleString();
    waChatArea.scrollTop = waChatArea.scrollHeight;
  }, 1000);
}

function appendWAMessage(direction, text, isAutomated = false) {
  const msgObj = document.createElement('div');
  msgObj.className = `wa-msg wa-msg-${direction}`;

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let automatedBadge = '';
  if (isAutomated) {
    automatedBadge = `<div class="wa-msg-badge">⚡ Uraai Bot</div>`;
  }

  msgObj.innerHTML = `
    ${automatedBadge}
    <div>${text.replace(/\n/g, '<br>')}</div>
    <div class="wa-msg-meta">
      <span>${time}</span>
      ${direction === 'sent' ? '<span style="color:#53bdeb">✓✓</span>' : ''}
    </div>
  `;

  waChatArea.appendChild(msgObj);
}

let typingIndicatorElement = null;

function showWATypingIndicator() {
  if (typingIndicatorElement) return;

  typingIndicatorElement = document.createElement('div');
  typingIndicatorElement.className = 'wa-msg wa-msg-received typing-bubble';
  typingIndicatorElement.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  waChatArea.appendChild(typingIndicatorElement);
  waChatArea.scrollTop = waChatArea.scrollHeight;
}

function removeWATypingIndicator() {
  if (typingIndicatorElement) {
    typingIndicatorElement.remove();
    typingIndicatorElement = null;
  }
}

// --- BOT INTELLIGENCE ENGINE ---
function processBotEngine(text) {
  const cleanText = text.toLowerCase().trim();

  // 1. Language constraint simulation
  if (cleanText.includes('speak tamil') || cleanText.includes('tamil') || cleanText.includes('தமிழ்')) {
    if (state.languages.includes('tamil')) {
      return "ஆம், நான் தமிழில் பதிலளிக்க முடியும்! உங்களுக்கு என்ன உதவி வேண்டும்? (Yes, I can respond in Tamil! How can I help you?)";
    } else {
      return `Hello! Currently, Tamil response is disabled in our ${state.userProfile.businessName} settings. Speaking in English: How can we assist you?`;
    }
  }

  // 2. Exact match check from user-defined FAQs
  for (let faq of state.faqs) {
    if (cleanText.includes(faq.q.toLowerCase().replace('?', '')) || faq.q.toLowerCase().includes(cleanText)) {
      addLog('engine', `Rule match: FAQ template "${faq.q}"`, 'success');
      return faq.a;
    }
  }

  // 3. Welcome keyword check
  const welcomeKeywords = ['hi', 'hello', 'hey', 'start', 'greet', 'வணக்கம்', 'namaste', 'hola'];
  for (let kw of welcomeKeywords) {
    if (cleanText.includes(kw)) {
      addLog('engine', `Rule match: Welcome Greeting`, 'success');
      return state.welcomeMessage;
    }
  }

  // 4. Appointment reservation check
  if (cleanText.includes('book') || cleanText.includes('appointment') || cleanText.includes('reserve') || cleanText.includes('schedule') || cleanText.includes('timing')) {
    addLog('engine', `Rule match: Dynamic Bookings Reservation`, 'success');
    return `Sure! Share your preferred date and time 📅\nWe're open Mon–Sat, ${state.openTime}–${state.closeTime}.`;
  }

  // 5. Intelligent Fallback (Uraai Smart Core)
  addLog('engine', `No strict rule match. Initiating semantic fallback.`, 'default');
  if (state.currentPlan === 'starter') {
    return `Thank you for reaching out to ${state.userProfile.businessName}! We are currently busy. You can ask about our 'Timings?' or 'Booking an appointment?'.`;
  } else {
    // Pro/Max AI replies
    return `Hello! ${state.userProfile.businessName} auto-responder here ⚡. ${state.userProfile.fullName} has received your query: "${text}".\n\nFor instant replies, feel free to ask about our hours, location, or bookings! We will confirm your request shortly.`;
  }
}

// --- NOTIFICATION BANNER SYSTEM ---
let notificationTimeout = null;

function triggerNotification(title, text) {
  const banner = document.getElementById('notification-banner');
  if (!banner) return;

  if (notificationTimeout) clearTimeout(notificationTimeout);

  document.getElementById('notif-title').innerText = title;
  document.getElementById('notif-text').innerText = text;

  banner.classList.add('active');

  notificationTimeout = setTimeout(() => {
    banner.classList.remove('active');
  }, 4000);
}

// --- SIMULATION HELPERS ---
function simulateIncomingMessage() {
  const customerQueries = [
    "Are you open on Sunday?",
    "Timings?",
    "Need appointment for hair spa tomorrow 4pm",
    "What are your prices?",
    "Do you offer student discount?"
  ];
  const randomQuery = customerQueries[Math.floor(Math.random() * customerQueries.length)];
  addLog('system', `Simulating incoming customer message on sandbox...`, 'default');
  sendCustomerMessage(randomQuery);
}


// --- PORTAL STATE ACTIONS ---

// Sign Up Handler
async function handleSignUpSubmit() {
  const fullName = document.getElementById('su-fullname').value.trim();
  const email = document.getElementById('su-email').value.trim();
  const password = document.getElementById('su-password').value.trim();
  const phone = document.getElementById('su-phone').value.trim();
  const businessName = document.getElementById('su-busname').value.trim();
  const businessType = document.getElementById('su-bustype').value;
  const city = document.getElementById('su-city').value.trim();

  if (!fullName || !email || !password || !phone || !businessName || !city) {
    alert('Please fill out all signup fields.');
    return;
  }

  try {
    // Show loading state
    const btn = document.getElementById('su-btn-submit');
    btn.innerText = 'Creating account...';
    btn.disabled = true;

    // 1. Create auth account in Supabase
    const authData = await authSignUp(email, password);
    const userId = authData.user.id;

    // 2. Save profile to users table
    await saveUserProfile(userId, {
      fullName, email, phone,
      businessName, businessType, city, plan: 'starter'
    });

    // 3. Update local state
    state.userProfile.fullName = fullName;
    state.userProfile.email = email;
    state.userProfile.phone = phone;
    state.userProfile.businessName = businessName;
    state.userProfile.businessType = businessType;
    state.userProfile.city = city;
    state.userProfile.supabaseId = userId;

    addLog('system', `Account created in Supabase: ${email}`, 'success');

    // 4. Continue to profile setup
    btn.innerText = 'Continue to Profile Setup →';
    btn.disabled = false;
    closeAuthModal();
    document.getElementById('prof-wanumber').value = phone;
    document.getElementById('prof-email').value = email;
    setTimeout(() => openProfileModal(), 300);

  } catch (err) {
    alert('Signup failed: ' + err.message);
    const btn = document.getElementById('su-btn-submit');
    btn.innerText = 'Continue to Profile Setup →';
    btn.disabled = false;
  }
}

// Log In Handler
async function handleLogInSubmit() {
  const email = document.getElementById('li-email').value.trim();
  const password = document.getElementById('li-password').value.trim();

  if (!email || !password) {
    alert('Please fill out email and password.');
    return;
  }

  try {
    const btn = document.getElementById('li-btn-submit');
    btn.innerText = 'Logging in...';
    btn.disabled = true;

    // 1. Auth with Supabase
    const authData = await authLogIn(email, password);
    const userId = authData.user.id;

    // 2. Load profile from database
    const profile = await getUserProfile(userId);
    const botSettings = await getBotSettings(userId);
    const userFaqs = await getFaqs(userId);

    // 3. Load into state
    state.userProfile.loggedIn = true;
    state.userProfile.supabaseId = userId;
    state.userProfile.fullName = profile.full_name;
    state.userProfile.email = profile.email;
    state.userProfile.businessName = profile.business_name;
    state.userProfile.businessType = profile.business_type;
    state.currentPlan = profile.plan || 'starter';

    if (botSettings) {
      state.welcomeMessage = botSettings.welcome_message;
      state.openTime = botSettings.open_time;
      state.closeTime = botSettings.close_time;
      state.languages = botSettings.languages || ['english'];
    }

    if (!botSettings || !botSettings.welcome_message) {
      state.welcomeMessage = `வணக்கம்! Welcome to ${profile.business_name}.\nHow can I help you today?`;
    }

    if (userFaqs.length > 0) {
      state.faqs = userFaqs.map(f => ({ q: f.question, a: f.answer, id: f.id }));
    }

    addLog('system', `Login success. Loaded profile for ${profile.full_name}`, 'success');

    btn.innerText = 'Access Dashboard →';
    btn.disabled = false;
    closeAuthModal();
    document.body.classList.add('app-logged-in');

    // Set WhatsApp connection state from database
    state.channels.whatsapp = profile.wa_connected || false;
    state.userProfile.waConnected = profile.wa_connected || false;
    restoreWhatsAppConnectionState();

    syncUI();
    await renderRecentLeads();
    updateWhatsAppChips();

    // Reset WhatsApp first message bubble
    document.getElementById('wa-first-received-bubble').innerHTML = `
      <div class="wa-msg-badge">⚡ Uraai Bot</div>
      ${state.welcomeMessage.replace(/\n/g, '<br>')}
      <div class="wa-msg-meta"><span>09:41 AM</span></div>
    `;

    navigateTo('dashboard');

  } catch (err) {
    alert('Login failed: ' + err.message);
    const btn = document.getElementById('li-btn-submit');
    btn.innerText = 'Access Dashboard →';
    btn.disabled = false;
  }
}

// Complete Profile Onboarding Setup Handler
function handleProfileSubmit() {
  const category = document.getElementById('prof-category').value;
  const waNumber = document.getElementById('prof-wanumber').value.trim();
  const openTime = document.getElementById('prof-open').value.trim();
  const closeTime = document.getElementById('prof-close').value.trim();
  const igHandle = document.getElementById('prof-ighandle').value.trim();
  const busEmail = document.getElementById('prof-email').value.trim();

  if (!waNumber || !openTime || !closeTime) {
    alert('Please fill out WhatsApp number and hours.');
    return;
  }

  // Update profile
  state.userProfile.category = category;
  state.userProfile.waNumber = waNumber;
  state.userProfile.igHandle = igHandle;
  state.userProfile.busEmail = busEmail;
  state.openTime = openTime;
  state.closeTime = closeTime;

  // Language multiselect check
  const selectedLangs = ['english']; // English is default
  if (document.getElementById('prof-lang-tamil').checked) selectedLangs.push('tamil');
  if (document.getElementById('prof-lang-hindi').checked) selectedLangs.push('hindi');
  state.languages = selectedLangs;

  // Sync welcome messages
  state.welcomeMessage = `வணக்கம்! Welcome to ${state.userProfile.businessName} 💇‍♂️\nHow can I help you today?`;

  // Set logged in
  state.userProfile.loggedIn = true;

  // Logs
  addLog('system', `Business Profile setup completed. Webhooks created.`, 'success');
  addLog('system', `WhatsApp connection registered on webhook +91 ${waNumber.slice(-5)}`, 'success');
  if (igHandle) {
    addLog('system', `Instagram connection token generated for ${igHandle}`, 'success');
  }

  // Close onboarding
  closeProfileModal();
  document.body.classList.add('app-logged-in');
  syncUI();
  updateWhatsAppChips();

  // Reset WhatsApp first message bubble
  document.getElementById('wa-first-received-bubble').innerHTML = `
    <div class="wa-msg-badge">⚡ Uraai Bot</div>
    ${state.welcomeMessage.replace(/\n/g, '<br>')}
    <div class="wa-msg-meta"><span>09:41 AM</span></div>
  `;

  // Switch to Dashboard
  setTimeout(() => {
    navigateTo('dashboard');
    triggerNotification('🚀 Bot Active!', `${state.userProfile.businessName} auto-reply is live.`);
  }, 400);
}

// Guest Mode Login Handler
function handleGuestLogin() {
  state.userProfile.loggedIn = true;
  state.userProfile.fullName = "Guest Sanjay";
  state.userProfile.businessName = "Priya Beauty Salon";
  state.userProfile.businessType = "Salon & Beauty";
  state.userProfile.phone = "+91 98450 12345";
  state.userProfile.waNumber = "+91 98450 12345";
  state.openTime = "9:00 AM";
  state.closeTime = "8:00 PM";
  
  document.body.classList.add('app-logged-in');
  syncUI();
  updateWhatsAppChips();
  navigateTo('dashboard');
  
  addLog('system', 'Guest sandbox session initialized.', 'success');
  triggerNotification('🚀 Demo Mode Active', 'Welcome to the independent Uraai app dashboard!');
}

// Session Logout Handler
async function handleLogout() {
  try {
    await authLogOut();
  } catch (err) {
    console.warn('Supabase logout error:', err.message);
  }

  // Close any open modals first
  const waModal = document.getElementById('wa-setup-modal-overlay');
  if (waModal) waModal.remove();

  state.userProfile.loggedIn = false;
  state.userProfile.supabaseId = null;
  state.userProfile.waConnected = false;
  state.channels.whatsapp = false;
  state.channels.instagram = false;
  state.channels.email = false;
  state.stats.repliesToday = 0;
  state.stats.leadsSaved = 0;

  document.body.classList.remove('app-logged-in');
  document.body.classList.remove('mobile-tester-active');

  // Reset channel card UI
  updateWhatsAppChannelCard(false);

  syncUI();
  addLog('system', 'User logged out. Session destroyed.', 'default');
  triggerNotification('🔒 Logged Out', 'Your session has ended.');
}

// Authorize Razorpay checkout payment handler
function handlePaymentSubmit() {
  const payName = document.getElementById('pay-name').value.trim();
  const payDetails = document.getElementById('pay-details').value.trim();
  const billingAddr = document.getElementById('pay-address').value.trim();

  if (!payName || !payDetails || !billingAddr) {
    alert('Please enter billing name, card/UPI, and billing address.');
    return;
  }

  // Transition modal to Processing
  document.getElementById('payment-inputs-panel').style.display = 'none';
  document.getElementById('payment-loading-panel').style.display = 'flex';

  addLog('system', `Initializing transaction charge gateway...`, 'default');

  setTimeout(() => {
    // Process success
    document.getElementById('payment-loading-panel').style.display = 'none';
    document.getElementById('payment-success-panel').style.display = 'flex';

    const chargeAmount = selectedUpgradeTier === 'pro' ? '₹499' : '₹999';
    document.getElementById('payment-success-msg').innerText = `Charged ${chargeAmount} successfully via secure Razorpay checkout.`;

    addLog('system', `Payment Authorization Success. Gateway Token: RP_${Math.floor(Math.random() * 900000 + 100000)}`, 'success');
    addLog('system', `Generated Invoice for billing name: ${payName}`, 'success');
  }, 1500);
}

async function handlePaymentSuccessClose() {
  state.currentPlan = selectedUpgradeTier;
  syncUI();
  updateWhatsAppChips();
  closePaymentModal();

  // Save new plan to Supabase
  if (state.userProfile.supabaseId) {
    try {
      await updateUserPlan(state.userProfile.supabaseId, selectedUpgradeTier);
      addLog('system', `Plan saved to database: ${selectedUpgradeTier.toUpperCase()}`, 'success');
    } catch (err) {
      addLog('system', `Plan save failed: ${err.message}`, 'default');
    }
  }

  addLog('system', `Subscribed successfully. Active limits updated for ${selectedUpgradeTier.toUpperCase()}`, 'success');
  triggerNotification('✓ Subscription Active', `Upgraded to ${selectedUpgradeTier.toUpperCase()} successfully.`);
  navigateTo('bot_builder');
}

// --- EVENT LISTENERS BINDING ---
document.addEventListener('DOMContentLoaded', async () => {
  addLog('system', 'Uraai Platform Initialized.', 'success');

  // Show loading overlay during session check
  document.body.classList.add('app-loading');

  // Check for existing Supabase session on page load
  const existingUser = await getCurrentUser();
  if (existingUser) {
    try {
      const profile = await getUserProfile(existingUser.id);
      const botSettings = await getBotSettings(existingUser.id);
      const userFaqs = await getFaqs(existingUser.id);

      state.userProfile.loggedIn = true;
      state.userProfile.supabaseId = existingUser.id;
      state.userProfile.fullName = profile.full_name;
      state.userProfile.email = profile.email;
      state.userProfile.businessName = profile.business_name;
      state.userProfile.businessType = profile.business_type;
      state.currentPlan = profile.plan || 'starter';

      if (botSettings) {
        state.welcomeMessage = botSettings.welcome_message;
        state.openTime = botSettings.open_time;
        state.closeTime = botSettings.close_time;
        state.languages = botSettings.languages || ['english'];
      }

      if (userFaqs.length > 0) {
        state.faqs = userFaqs.map(f => ({
          q: f.question, a: f.answer, id: f.id
        }));
      }

      document.body.classList.add('app-logged-in');

      // Set WhatsApp connection state from database
      state.channels.whatsapp = profile.wa_connected || false;
      state.userProfile.waConnected = profile.wa_connected || false;
      restoreWhatsAppConnectionState();

      syncUI();
      await renderRecentLeads();
      updateWhatsAppChips();

      // Hide landing page, show dashboard
      document.getElementById('landing-page-root').style.display = 'none';
      document.getElementById('app-root').style.display = 'flex';
      navigateTo('dashboard');

      addLog('system', `Session restored for: ${profile.full_name}`, 'success');
    } catch (err) {
      addLog('system', 'Session restore failed: ' + err.message, 'default');
    }
  }

  document.body.classList.remove('app-loading');

  // Sidebar / Bottom Nav Click Navigation Event Delegation
  document.body.addEventListener('click', (e) => {
    // 1. Desktop Sidebar Item
    const sidebarItem = e.target.closest('.sidebar-item');
    if (sidebarItem) {
      e.preventDefault();
      const tab = sidebarItem.getAttribute('data-tab');
      navigateTo(tab);
      return;
    }

    // 2. Mobile Bottom Nav Item
    const mobileNavItem = e.target.closest('.mobile-nav-item');
    if (mobileNavItem) {
      e.preventDefault();
      const tab = mobileNavItem.getAttribute('data-tab');
      navigateTo(tab);
      return;
    }

    // 3. Back Button
    const backBtn = e.target.closest('.back');
    if (backBtn) {
      navigateTo('dashboard');
      return;
    }
  });

  // Main Page Action CTAs
  const heroBtnStart = document.getElementById('hero-btn-start');
  if (heroBtnStart) heroBtnStart.onclick = () => openAuthModal('signup');

  // Landing Guest Mode Sandbox Trigger
  const heroBtnSandbox = document.getElementById('hero-btn-sandbox');
  if (heroBtnSandbox) {
    heroBtnSandbox.onclick = () => {
      handleGuestLogin();
      navigateTo('bot_builder');
    };
  }

  // Logout Click Handler
  const logoutBtn = document.getElementById('app-logout-btn');
  if (logoutBtn) logoutBtn.onclick = () => handleLogout();

  // Mobile Bot Tester floating action handlers
  const mobileTesterTrigger = document.getElementById('mobile-chat-tester-trigger');
  if (mobileTesterTrigger) {
    mobileTesterTrigger.onclick = () => {
      document.body.classList.add('mobile-tester-active');
      addLog('system', 'Mobile: Live Chat Bot Tester opened.', 'default');
    };
  }

  const mobileTesterClose = document.getElementById('mobile-tester-close-btn');
  if (mobileTesterClose) {
    mobileTesterClose.onclick = () => {
      document.body.classList.remove('mobile-tester-active');
    };
  }

  // Auth Panel Tabs click
  const tabSignup = document.getElementById('tab-opt-signup');
  const tabLogin = document.getElementById('tab-opt-login');
  if (tabSignup && tabLogin) {
    tabSignup.onclick = () => openAuthModal('signup');
    tabLogin.onclick = () => openAuthModal('login');
  }

  // Auth Modals Close
  const closeAuthBtn = document.getElementById('auth-modal-close');
  if (closeAuthBtn) closeAuthBtn.onclick = closeAuthModal;

  // Submit Buttons Modals
  const signupSubmit = document.getElementById('su-btn-submit');
  if (signupSubmit) signupSubmit.onclick = handleSignUpSubmit;

  const loginSubmit = document.getElementById('li-btn-submit');
  if (loginSubmit) loginSubmit.onclick = handleLogInSubmit;

  const profileSubmit = document.getElementById('prof-btn-submit');
  if (profileSubmit) profileSubmit.onclick = handleProfileSubmit;

  const paymentSubmit = document.getElementById('pay-btn-submit');
  if (paymentSubmit) paymentSubmit.onclick = handlePaymentSubmit;

  const paymentSuccessClose = document.getElementById('payment-success-close-btn');
  if (paymentSuccessClose) paymentSuccessClose.onclick = handlePaymentSuccessClose;

  const paymentClose = document.getElementById('payment-modal-close');
  if (paymentClose) paymentClose.onclick = closePaymentModal;

  // App workspace onboarding buttons
  const s1BtnStart = document.getElementById('s1-btn-start');
  if (s1BtnStart) {
    s1BtnStart.onclick = () => {
      openAuthModal('signup');
    };
  }

  const s1BtnSignin = document.getElementById('s1-btn-signin');
  if (s1BtnSignin) {
    s1BtnSignin.onclick = () => {
      openAuthModal('login');
    };
  }

  // Pricing CTAs binding on landing page AND settings billing screen
  document.body.addEventListener('click', (e) => {
    const cta = e.target.closest('.plan-cta');
    
    if (cta) {
      const tier = cta.getAttribute('data-tier');
      openPaymentModal(tier);
    }
  });

  // Bot Settings Modifiers (Welcome message, Timings)
  const welcomeInput = document.getElementById('welcome-msg-input');
  if (welcomeInput) {
    welcomeInput.addEventListener('input', (e) => {
      state.welcomeMessage = e.target.value;
      renderBotLivePreview();
    });
  }

  const openTimeInput = document.getElementById('open-time-input');
  if (openTimeInput) {
    openTimeInput.addEventListener('change', (e) => {
      state.openTime = e.target.value;
      renderBotLivePreview();
      addLog('system', `Updated open hour parameter: ${state.openTime}`, 'default');
    });
  }

  const closeTimeInput = document.getElementById('close-time-input');
  if (closeTimeInput) {
    closeTimeInput.addEventListener('change', (e) => {
      state.closeTime = e.target.value;
      renderBotLivePreview();
      addLog('system', `Updated close hour parameter: ${state.closeTime}`, 'default');
    });
  }

  // Language tags clicking
  const langWrapper = document.getElementById('lang-tag-row');
  if (langWrapper) {
    langWrapper.addEventListener('click', (e) => {
      const tag = e.target.closest('.tag');
      if (!tag) return;

      const lang = tag.getAttribute('data-lang');

      // Starter plan restriction check
      if (!getCurrentLimits().languages.includes(lang)) {
        triggerNotification('🔒 Language Locked', 'Your plan does not support this language.');
        navigateTo('pricing');
        return;
      }

      if (state.languages.includes(lang)) {
        if (state.languages.length === 1) {
          triggerNotification('⚠️ Error', 'You must enable at least one language.');
          return;
        }
        state.languages = state.languages.filter(l => l !== lang);
        addLog('system', `Disabled language: ${lang.toUpperCase()}`, 'default');
      } else {
        state.languages.push(lang);
        addLog('system', `Enabled language: ${lang.toUpperCase()}`, 'success');
      }
      syncUI();
    });
  }

  // FAQ CRUD bindings
  const addFaqBtn = document.getElementById('add-faq-btn');
  if (addFaqBtn) addFaqBtn.onclick = () => openFaqModal(-1);

  const saveFaqBtn = document.getElementById('modal-save-btn');
  if (saveFaqBtn) saveFaqBtn.onclick = saveFaqModal;

  const cancelFaqBtn = document.getElementById('modal-cancel-btn');
  if (cancelFaqBtn) cancelFaqBtn.onclick = closeFaqModal;

  // Settings Save loading simulator
  const saveChangesBtn = document.getElementById('save-changes-btn');
  if (saveChangesBtn) {
    saveChangesBtn.onclick = async () => {
      saveChangesBtn.disabled = true;
      const textSpan = saveChangesBtn.querySelector('span');
      textSpan.innerText = 'Saving...';

      console.log('Save clicked — supabaseId:', state.userProfile.supabaseId);
      console.log('State to save:', {
        welcomeMessage: state.welcomeMessage,
        openTime: state.openTime,
        closeTime: state.closeTime,
        languages: state.languages
      });

      try {
        if (!state.userProfile.supabaseId) {
          throw new Error('Not logged in — please log out and log back in');
        }

        await saveBotSettings(state.userProfile.supabaseId, {
          welcomeMessage: state.welcomeMessage,
          openTime: state.openTime,
          closeTime: state.closeTime,
          languages: state.languages,
          waNumber: state.userProfile.waNumber,
          igHandle: state.userProfile.igHandle,
          busEmail: state.userProfile.busEmail
        });

        console.log('Save successful!');
        addLog('system', 'Bot settings saved to Supabase database.', 'success');
        triggerNotification('✓ Settings Saved', 'Bot configuration synced to cloud.');

      } catch (err) {
        console.error('Save failed:', err);
        triggerNotification('⚠️ Save Failed', err.message);
      }

      saveChangesBtn.disabled = false;
      textSpan.innerText = 'Save Changes';
    };
  }

  // WhatsApp input form send
  const waSendBtn = document.getElementById('wa-send-btn');
  const waInputField = document.getElementById('wa-input-field');

  if (waSendBtn && waInputField) {
    waSendBtn.onclick = () => sendCustomerMessage(waInputField.value);
    waInputField.onkeydown = (e) => {
      if (e.key === 'Enter') sendCustomerMessage(waInputField.value);
    };
  }

  // Segment Analytics Switcher
  const segWrapper = document.getElementById('analytics-segment');
  if (segWrapper) {
    segWrapper.addEventListener('click', (e) => {
      const opt = e.target.closest('.seg-opt');
      if (!opt) return;

      segWrapper.querySelectorAll('.seg-opt').forEach(o => o.classList.remove('on'));
      opt.classList.add('on');

      const text = opt.innerText.toLowerCase();
      addLog('system', `Switched analytics view range to: ${text}`, 'default');

      document.querySelectorAll('.bar-group .b').forEach(bar => {
        const randomHeight = Math.floor(Math.random() * 60) + 20;
        bar.style.height = `${randomHeight}px`;
      });
    });
  }

  // --- MOBILE VIEWS SWITCHERS ---
  const mobOptMerchant = document.getElementById('mob-opt-merchant');
  const mobOptCustomer = document.getElementById('mob-opt-customer');
  
  if (mobOptMerchant && mobOptCustomer) {
    mobOptMerchant.onclick = () => {
      document.body.classList.remove('mobile-show-customer');
      mobOptMerchant.classList.add('active');
      mobOptCustomer.classList.remove('active');
      addLog('system', 'Mobile switch: Viewing Merchant Dashboard', 'default');
    };
    
    mobOptCustomer.onclick = () => {
      document.body.classList.add('mobile-show-customer');
      mobOptCustomer.classList.add('active');
      mobOptMerchant.classList.remove('active');
      addLog('system', 'Mobile switch: Viewing WhatsApp Customer Chat', 'default');
    };
  }

  // Mobile Log Console Drawer Trigger
  const mobileConsoleTrigger = document.getElementById('mobile-console-trigger');
  const consolePanel = document.querySelector('.console-panel');
  const consoleCloseBtn = document.getElementById('console-close-btn');

  if (mobileConsoleTrigger && consolePanel) {
    mobileConsoleTrigger.onclick = () => {
      consolePanel.classList.toggle('mobile-active');
      addLog('system', 'Toggled Mobile Inspector logs drawer', 'default');
    };
  }
  if (consoleCloseBtn && consolePanel) {
    consoleCloseBtn.onclick = () => {
      consolePanel.classList.remove('mobile-active');
    };
  }

  // Initial bindings
  syncUI();
  updateWhatsAppChips();
});

function canSendBroadcast() {
  const limits = getCurrentLimits();
  if (limits.broadcastLimit === Infinity) return true;
  if (state.userProfile.broadcastCountThisMonth >= limits.broadcastLimit) {
    triggerNotification('🔒 Broadcast Limit Reached', `Upgrade to send more this month.`);
    return false;
  }
  return true;
}

function canAddTeamMember(currentTeamSize) {
  const limits = getCurrentLimits();
  if (currentTeamSize >= limits.maxTeamMembers) {
    triggerNotification('🔒 Team Limit Reached', `Your plan allows ${limits.maxTeamMembers} member(s). Upgrade for more.`);
    return false;
  }
  return true;
}

function applyPlanGatingToUI() {
  const limits = getCurrentLimits();
  
  toggleSection('booking-calendar-section', limits.bookingCalendar);
  toggleSection('lead-export-btn', limits.leadExport);
  toggleSection('lead-scoring-badge', limits.leadScoring);
  toggleSection('monthly-report-section', limits.monthlyReport);
  toggleSection('multi-step-followup-section', limits.multiStepFollowUp);
}

function toggleSection(elementId, isUnlocked) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.style.display = isUnlocked ? '' : 'none';
}
// ── WhatsApp Embedded Signup ──

function startWhatsAppEmbeddedSignup() {
  console.log('Connect button clicked, loggedIn:', state.userProfile.loggedIn);
  // Check if user is on correct plan
  if (state.currentPlan === 'starter' && state.userProfile.loggedIn) {
    // Starter can still connect — it's a free feature
  }
  // Show the setup modal first
  showWhatsAppSetupModal();
}

function showWhatsAppSetupModal() {
  // Remove existing modal if any
  const existing = document.getElementById('wa-setup-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'wa-setup-modal-overlay';
  overlay.id = 'wa-setup-modal-overlay';
  overlay.innerHTML = `
    <div class="wa-setup-modal">
      <h2>📱 Connect WhatsApp</h2>
      <p>Connect your WhatsApp Business number to Uraai. 
         Your customers will message your number and Uraai's 
         AI will reply automatically.</p>
      <div class="wa-setup-steps">
        <div class="wa-setup-step">
          <div class="wa-step-num">1</div>
          <div class="wa-step-text">
            <strong>Log in with Facebook</strong> — the account 
            linked to your WhatsApp Business
          </div>
        </div>
        <div class="wa-setup-step">
          <div class="wa-step-num">2</div>
          <div class="wa-step-text">
            <strong>Verify your business phone number</strong> 
            via OTP — this becomes your bot's number
          </div>
        </div>
        <div class="wa-setup-step">
          <div class="wa-step-num">3</div>
          <div class="wa-step-text">
            <strong>Done!</strong> — Uraai will automatically 
            reply to your customers 24/7
          </div>
        </div>
      </div>
      <div class="wa-setup-modal-actions">
        <button class="btn-wa-launch" id="btn-launch-fb-signup" onclick="launchFacebookEmbeddedSignup()">
          <span>🚀</span> Continue with Facebook
        </button>
        <button class="btn-wa-cancel" onclick="closeWhatsAppSetupModal()">
          Cancel
        </button>
      </div>
    </div>
  `;
  const appRoot = document.getElementById('app-root');
  (appRoot || document.body).appendChild(overlay);
}

function closeWhatsAppSetupModal() {
  const overlay = document.getElementById('wa-setup-modal-overlay');
  if (overlay) overlay.remove();
}

function launchFacebookEmbeddedSignup() {
  // Show connecting state in modal
  const modal = document.querySelector('.wa-setup-modal');
  modal.innerHTML = `
    <div class="wa-connecting-state">
      <div class="wa-connecting-spinner"></div>
      <h3 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:18px;font-weight:800;color:var(--ink);margin-bottom:8px;">
        Opening Facebook...
      </h3>
      <p style="font-size:13px;color:var(--ink-40);">
        Complete the steps in the popup window
      </p>
    </div>
  `;

  // Check if FB SDK is loaded
  if (typeof FB === 'undefined') {
    showWhatsAppSetupError('Facebook SDK not loaded. Please refresh and try again.');
    return;
  }

  // Launch Meta Embedded Signup
  FB.login(function(response) {
    if (response.authResponse) {
      const accessToken = response.authResponse.accessToken;
      console.log('FB Login success, token received');
      handleEmbeddedSignupSuccess(accessToken);
    } else {
      console.log('FB Login cancelled or failed');
      showWhatsAppSetupError('Connection cancelled. Please try again.');
    }
  }, {
    scope: 'whatsapp_business_management,whatsapp_business_messaging',
    extras: {
      setup: {},
      featureType: 'whatsapp_embedded_signup',
      sessionInfoVersion: '3',
    }
  });
}

async function handleEmbeddedSignupSuccess(accessToken) {
  const modal = document.querySelector('.wa-setup-modal');
  modal.innerHTML = `
    <div class="wa-connecting-state">
      <div class="wa-connecting-spinner"></div>
      <h3 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:18px;font-weight:800;color:var(--ink);margin-bottom:8px;">
        Connecting your number...
      </h3>
      <p style="font-size:13px;color:var(--ink-40);">
        Saving your WhatsApp Business credentials
      </p>
    </div>
  `;

  try {
    // Save access token to Supabase
    if (state.userProfile.supabaseId) {
      const { error } = await db
        .from('users')
        .update({
          wa_access_token: accessToken,
          wa_connected: true,
        })
        .eq('id', state.userProfile.supabaseId);

      if (error) throw error;
    }

    // Update local state
    state.channels.whatsapp = true;
    state.userProfile.waConnected = true;

    // Show success state
    modal.innerHTML = `
      <div class="wa-success-state">
        <div class="wa-success-icon">🎉</div>
        <h3 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:20px;font-weight:800;color:var(--ink);margin-bottom:8px;">
          WhatsApp Connected!
        </h3>
        <p style="font-size:14px;color:var(--ink-40);margin-bottom:24px;">
          Your bot is now live. Customers who message your 
          WhatsApp number will get instant AI replies.
        </p>
        <button onclick="closeWhatsAppSetupModal(); syncUI();" 
          style="width:100%;padding:14px;background:var(--green);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">
          ✅ Go to Dashboard
        </button>
      </div>
    `;

    // Update channel card UI
    updateWhatsAppChannelCard(true);
    syncUI();
    addLog('system', 'WhatsApp Business connected via Embedded Signup', 'success');

  } catch (err) {
    showWhatsAppSetupError('Failed to save credentials: ' + err.message);
  }
}

function showWhatsAppSetupError(message) {
  const modal = document.querySelector('.wa-setup-modal');
  if (!modal) return;
  modal.innerHTML = `
    <div class="wa-success-state">
      <div class="wa-success-icon">⚠️</div>
      <h3 style="font-family:'Plus Jakarta Sans',sans-serif;font-size:18px;font-weight:800;color:var(--ink);margin-bottom:8px;">
        Connection Failed
      </h3>
      <p style="font-size:13px;color:var(--ink-40);margin-bottom:24px;">${message}</p>
      <div style="display:flex;gap:10px;">
        <button onclick="showWhatsAppSetupModal()" 
          style="flex:1;padding:13px;background:var(--violet);color:white;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">
          Try Again
        </button>
        <button onclick="closeWhatsAppSetupModal()" 
          style="padding:13px 18px;background:var(--surface);color:var(--ink-70);border:1.5px solid var(--border);border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;">
          Cancel
        </button>
      </div>
    </div>
  `;
}

function updateWhatsAppChannelCard(isConnected) {
  const card = document.getElementById('wa-channel-card');
  const statusText = document.getElementById('wa-channel-status-text');
  const connectBtn = document.getElementById('wa-connect-btn');
  const connectedBadge = document.getElementById('wa-connected-badge');

  if (!card) return;

  if (isConnected) {
    card.classList.add('connected');
    if (statusText) statusText.textContent = 'Connected · Bot is live';
    if (connectBtn) connectBtn.style.display = 'none';
    if (connectedBadge) connectedBadge.style.display = 'flex';
  } else {
    card.classList.remove('connected');
    if (statusText) statusText.textContent = 'Not connected';
    if (connectBtn) connectBtn.style.display = 'block';
    if (connectedBadge) connectedBadge.style.display = 'none';
  }
}

// Call this on login to restore connection state
function restoreWhatsAppConnectionState() {
  if (state.userProfile.waConnected) {
    updateWhatsAppChannelCard(true);
  }
}

async function renderRecentLeads() {
  const containers = document.querySelectorAll('#recent-leads-container, #analytics-leads-container');
  if (containers.length === 0 || !state.userProfile.supabaseId) return;

  try {
    const leads = await getLeads(state.userProfile.supabaseId);

    let htmlContent = '';
    if (leads.length === 0) {
      htmlContent = `
        <p style="font-size:13px;color:var(--ink-40);text-align:center;padding:20px 0;">
          No leads yet — leads appear here when customers message your bot
        </p>`;
    } else {
      htmlContent = leads.slice(0, 5).map(lead => `
        <div class="lead-row">
          <div class="lead-av" style="background:var(--violet-bg);color:var(--violet);">
            ${(lead.name || 'U')[0].toUpperCase()}
          </div>
          <div class="lead-info">
            <h5>${lead.name || 'Unknown'}</h5>
            <p>${lead.message || 'No message'} · ${formatTimeAgo(lead.created_at)}</p>
          </div>
          <div class="lead-ch ${lead.channel || 'wa'}">${lead.channel?.toUpperCase() || 'WA'}</div>
        </div>
      `).join('');
    }

    containers.forEach(container => {
      container.innerHTML = htmlContent;
    });
  } catch (err) {
    console.error('Failed to load leads:', err);
  }
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}
