// Uraai Live Simulator Application Logic

// --- STATE MANAGEMENT ---
const state = {
  activeScreen: 'onboarding',
  currentPlan: 'starter', // starter, pro, max
  welcomeMessage: "",
  openTime: "9:00 AM",
  closeTime: "8:00 PM",
  languages: ['tamil', 'english'], // tamil, english, hindi, telugu, malayalam
  
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
    activeBots: 1,
    repliesThisMonth: 0
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
    waNumber: "",
    igHandle: "",
    busEmail: "",
    supabaseId: null,
    teamRole: 'admin',
    metaWabaId: "",
    metaPhoneId: "",
    metaAccessToken: ""
  }
};

// --- NOTIFICATION SYSTEM ---
window.triggerNotification = function(type, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  const isError = type.toLowerCase() === 'error';
  toast.className = `toast ${isError ? 'error' : 'success'}`;
  
  let icon = isError ? '⚠️' : '✅';
  
  toast.innerHTML = `
    <div style="font-size:20px;">${icon}</div>
    <div>
      <span class="toast-title">${type}</span>
      <span class="toast-msg">${message}</span>
    </div>
  `;
  
  container.appendChild(toast);
  
  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // Remove after 4 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
};

let menuItemsData = [];

function renderMenuItems() {
  const list = document.getElementById('menu-items-list');
  if (!list) return;
  list.innerHTML = '';
  if (menuItemsData.length === 0) {
    list.innerHTML = `<div style="color:var(--ink-40); font-size:12px; font-style:italic;">No services added yet.</div>`;
    return;
  }
  menuItemsData.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = 'menu-item-card';
    el.innerHTML = `
      <div class="menu-item-info">
        <span class="menu-item-name">${item.name}</span>
        <span class="menu-item-price">${item.price}</span>
      </div>
      <div class="menu-item-delete" data-index="${index}">🗑️</div>
    `;
    list.appendChild(el);
  });
  
  // Attach delete events
  list.querySelectorAll('.menu-item-delete').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute('data-index'));
      menuItemsData.splice(idx, 1);
      renderMenuItems();
    };
  });
}

function attachMenuBuilderEvents() {
  const addBtn = document.getElementById('btn-add-menu-item');
  const nameInp = document.getElementById('new-menu-item-name');
  const priceInp = document.getElementById('new-menu-item-price');
  if (addBtn && nameInp && priceInp) {
    addBtn.onclick = () => {
      const name = nameInp.value.trim();
      const price = priceInp.value.trim();
      if (!name || !price) {
        triggerNotification('Error', 'Please enter both name and price.');
        return;
      }
      menuItemsData.push({ name, price });
      nameInp.value = '';
      priceInp.value = '';
      renderMenuItems();
    };
  }
}

// Ensure attachMenuBuilderEvents is called when DOM loads

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
    monthlyReport: false,
    removeWatermark: false
  },
  pro: {
    maxBots: 3,
    maxRepliesPerMonth: 2000,
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
    broadcastLimit: 500,
    leadScoring: false,
    multiStepFollowUp: false,
    monthlyReport: false,
    removeWatermark: true
  },
  max: {
    maxBots: Infinity,
    maxRepliesPerMonth: 10000,
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
    broadcastLimit: 5000,
    leadScoring: true,
    multiStepFollowUp: true,
    monthlyReport: true,
    removeWatermark: true
  }
};

// Helper to get current user's limits anywhere in the app
function getCurrentLimits() {
  return PLAN_LIMITS[state.currentPlan] || PLAN_LIMITS.starter;
}

// --- PLAN ENFORCEMENT ---
function getPlanLevel(planStr) {
  if (planStr === 'max') return 3;
  if (planStr === 'pro') return 2;
  return 1; // starter
}

function requirePlan(minTier, featureName) {
  const currentLevel = getPlanLevel(state.currentPlan);
  const requiredLevel = getPlanLevel(minTier);
  
  if (currentLevel < requiredLevel) {
    triggerNotification('🔒 Premium Feature', `Please upgrade to ${minTier.toUpperCase()} to use ${featureName}.`);
    openPaymentModal(minTier);
    return false;
  }
  return true;
}

function enforcePlanLimits() {
  const isStarter = state.currentPlan === 'starter';
  const isPro = state.currentPlan === 'pro';

  // 1. Language Checkboxes
  const proLangs = ['telugu', 'malayalam'];
  const maxLangs = ['kannada', 'bengali', 'marathi'];
  
  proLangs.forEach(lang => {
    const cb = document.getElementById(`prof-lang-${lang}`);
    if (cb) {
      cb.disabled = isStarter;
      cb.parentElement.classList.toggle('locked-feature', isStarter);
      if (isStarter) {
        if (!cb.nextElementSibling.innerText.includes('🔒')) cb.nextElementSibling.innerHTML += ' <span class="lock-icon">🔒</span>';
      } else {
        cb.nextElementSibling.innerHTML = cb.nextElementSibling.innerHTML.replace(' <span class="lock-icon">🔒</span>', '');
      }
    }
  });

  maxLangs.forEach(lang => {
    const cb = document.getElementById(`prof-lang-${lang}`);
    if (cb) {
      const isLocked = isStarter || isPro;
      cb.disabled = isLocked;
      cb.parentElement.classList.toggle('locked-feature', isLocked);
      if (isLocked) {
        if (!cb.nextElementSibling.innerText.includes('🔒')) cb.nextElementSibling.innerHTML += ' <span class="lock-icon">🔒</span>';
      } else {
        cb.nextElementSibling.innerHTML = cb.nextElementSibling.innerHTML.replace(' <span class="lock-icon">🔒</span>', '');
      }
    }
  });

  // 2. Export Button
  const exportBtn = document.getElementById('btn-export-leads');
  if (exportBtn) {
    exportBtn.classList.toggle('locked-feature', isStarter);
    if (isStarter && !exportBtn.innerHTML.includes('🔒')) exportBtn.innerHTML += ' <span class="lock-icon">🔒</span>';
    if (!isStarter) exportBtn.innerHTML = exportBtn.innerHTML.replace(' <span class="lock-icon">🔒</span>', '');
  }

  // 3. Instagram & Email Buttons
  const igBtn = document.getElementById('ig-connect-btn');
  if (igBtn) {
    igBtn.classList.toggle('locked-feature', isStarter);
    if (isStarter && !igBtn.innerHTML.includes('🔒')) igBtn.innerHTML += ' <span class="lock-icon">🔒</span>';
    if (!isStarter) igBtn.innerHTML = igBtn.innerHTML.replace(' <span class="lock-icon">🔒</span>', '');
  }
  
  const emailBtn = document.getElementById('email-connect-btn');
  if (emailBtn) {
    emailBtn.classList.toggle('locked-feature', isStarter);
    if (isStarter && !emailBtn.innerHTML.includes('🔒')) emailBtn.innerHTML += ' <span class="lock-icon">🔒</span>';
    if (!isStarter) emailBtn.innerHTML = emailBtn.innerHTML.replace(' <span class="lock-icon">🔒</span>', '');
  }

  // 4. Broadcast Button
  const broadcastBtn = document.getElementById('btn-send-broadcast');
  if (broadcastBtn) {
    broadcastBtn.classList.toggle('locked-feature', isStarter);
    if (isStarter && !broadcastBtn.innerHTML.includes('🔒')) broadcastBtn.innerHTML += ' <span class="lock-icon">🔒</span>';
    if (!isStarter) broadcastBtn.innerHTML = broadcastBtn.innerHTML.replace(' <span class="lock-icon">🔒</span>', '');
  }
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
    if (screenId === 'analytics') {
      title = 'Analytics';
      setTimeout(() => initAnalytics(), 100);
    }
    if (screenId === 'pricing') title = 'Billing & Plans';
    if (screenId === 'onboarding') title = 'Setup Guide';
    if (screenId === 'ai_setup') {
      title = 'AI Setup';
      if (!state.businessKnowledge) {
        setTimeout(() => initAISetup(), 300);
      }
    }
    if (screenId === 'team') {
      title = 'Team Settings';
      setTimeout(() => renderTeamMembers(), 100);
    }
    if (screenId === 'inbox') {
      title = 'Live Inbox';
      setTimeout(() => initLiveInbox(), 100);
    }
    if (screenId === 'crm') {
      title = 'CRM & Bookings';
      setTimeout(() => initCRM(), 100);
    }
    if (screenId === 'broadcasts') {
      title = 'Mass Broadcasts';
      setTimeout(() => initBroadcasts(), 100);
    }
    headerTitle.innerText = title;
  }

  // Update nav highlights
  updateNavHighlights();
}

function updateNavHighlights() {
  const currentTab = state.activeScreen;

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
  enforcePlanLimits();
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

  // RBAC for Staff Members
  const restrictedTabs = ['bot_builder', 'ai_setup', 'pricing'];
  document.querySelectorAll('.sidebar-item, .mobile-nav-item').forEach(el => {
    const tabId = el.getAttribute('data-tab');
    if (restrictedTabs.includes(tabId)) {
      if (state.userProfile.teamRole === 'staff') {
        el.style.display = 'none';
      } else {
        el.style.display = 'flex';
      }
    }
  });

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

  // Enforce RBAC
  if (state.userProfile.teamRole === 'staff') {
    document.querySelectorAll('[data-tab="bot_builder"], [data-tab="ai_setup"], [data-tab="pricing"], [data-tab="team"]').forEach(el => {
      el.style.display = 'none';
    });
  } else {
    document.querySelectorAll('[data-tab="bot_builder"], [data-tab="ai_setup"], [data-tab="pricing"], [data-tab="team"]').forEach(el => {
      el.style.display = 'flex';
    });
  }

  // Stats Counters
  document.getElementById('stat-replies').innerText = Number(state.stats.repliesToday).toLocaleString();
  document.getElementById('stat-leads').innerText = state.stats.leadsSaved;
  document.getElementById('stat-avg-time').innerHTML = `${state.stats.avgResponse}<span style="font-size:14px;font-weight:500">s</span>`;
  document.getElementById('stat-satisfaction').innerHTML = `${state.stats.satisfaction}<span style="font-size:14px;font-weight:500">%</span>`;
  document.getElementById('stat-missed').innerText = state.stats.missedChats;
  document.getElementById('stat-bots-active').innerText = state.stats.activeBots;

  // Limit Notification Bar Logic
  const limitBar = document.getElementById('limit-notification-bar');
  if (limitBar) {
    if (state.currentPlan === 'starter' && state.stats.repliesThisMonth >= 50) {
      limitBar.style.display = 'flex';
    } else {
      limitBar.style.display = 'none';
    }
  }

  // Render active channels on dashboard
  updateWhatsAppChannelCard(state.channels.whatsapp);

  // 2. Bot Builder Data
  document.getElementById('welcome-msg-input').value = state.welcomeMessage;
  document.getElementById('open-time-input').value = state.openTime;
  document.getElementById('close-time-input').value = state.closeTime;
  document.getElementById('meta-waba-id').value = state.userProfile.metaWabaId || '';
  document.getElementById('meta-phone-id').value = state.userProfile.metaPhoneId || '';
  document.getElementById('meta-access-token').value = state.userProfile.metaAccessToken || '';

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


  } else {
    // Pro/Max limits
    state.stats.activeBots = (state.channels.whatsapp ? 1 : 0) + (state.channels.instagram ? 1 : 0) + (state.channels.email ? 1 : 0);
    document.getElementById('stat-bots-active').innerText = state.stats.activeBots;

    langWrapper.querySelectorAll('.tag').forEach(tag => {
      tag.classList.remove('disabled-feature');
    });


  }
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

  if (tier === 'starter') {
    // Starter downgrade triggers instantly
    state.currentPlan = 'starter';
    state.languages = ['english'];
    syncUI();
    updateWhatsAppChips();
    addLog('system', 'Downgraded account subscription plan to: STARTER (Free)', 'default');
    triggerNotification('Plan Updated', 'Your bot is now operating under the Free Starter limitations.');
    return;
  }

  // Directly initialize real Razorpay flow instead of the mock HTML modal
  initiateRazorpayCheckout(tier);
}

async function initiateRazorpayCheckout(tier) {
  try {
    if (!state.userProfile.supabaseId) throw new Error("Not logged in");

    // Show processing notification while we generate the order ID
    triggerNotification('Processing', 'Generating secure checkout session...');

    // 1. Call our Supabase Edge Function to create an order
    const { data, error } = await db.functions.invoke('create-razorpay-order', {
      body: { tier: tier, user_id: state.userProfile.supabaseId }
    });
    
    if (error) throw error;
    if (data && data.error) throw new Error(data.error);
    if (!data || !data.order_id) throw new Error("Failed to create order");

    // 2. Initialize Razorpay Checkout
    const options = {
      key: "rzp_test_TM2yt4p5jRcL6A",
      amount: data.amount,
      currency: "INR",
      name: "Uraai AI",
      description: `Upgrade to ${tier.toUpperCase()} Plan`,
      order_id: data.order_id,
      handler: async function (response) {
        triggerNotification("Processing", "Verifying payment...");
        try {
          const { data: vData, error: vError } = await db.functions.invoke('verify-razorpay-payment', {
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              tier: tier,
              user_id: state.userProfile.supabaseId
            }
          });
          
          if (vError) throw vError;
          if (vData && vData.error) throw new Error(vData.error);
          
          triggerNotification("✅ Payment Successful", "Your plan has been upgraded!");
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } catch (err) {
          console.error("Verification error:", err);
          triggerNotification("Verification Failed", err.message);
        }
      },
      prefill: {
        name: state.userProfile.fullName,
        email: state.userProfile.email,
        contact: state.userProfile.phone
      },
      theme: {
        color: "#5B3FD9"
      }
    };
    
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response){
      triggerNotification("Payment Failed", response.error.description);
    });
    rzp.open();
    
  } catch(err) {
    console.error(err);
    triggerNotification("Checkout Error", err.message);
  }
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



  // Language check chip
  const chipLang = document.createElement('div');
  chipLang.className = 'wa-chip';
  chipLang.innerText = "Do you speak Tamil?";
  chipLang.onclick = () => sendCustomerMessage("Do you speak Tamil?");
  chipsRow.appendChild(chipLang);
}

async function sendCustomerMessage(text) {
  if (!text.trim()) return;

  appendWAMessage('sent', text);
  addLog('user', `Inbound WhatsApp text: "${text}"`, 'user');

  const input = document.getElementById('wa-input-field');
  if (input) input.value = '';

  showWATypingIndicator();
  waChatArea.scrollTop = waChatArea.scrollHeight;

  const useAI = document.getElementById('simulator-ai-toggle')?.checked;
  const limits = getCurrentLimits();
  const formatBotReply = (msg) => limits.removeWatermark ? msg : `${msg}\n\n_Powered by Uraai_`;

  if (useAI) {
    try {
      if (!state.userProfile.supabaseId) throw new Error("Not logged in");
      const res = await simulateChat(state.userProfile.supabaseId, text, "Simulator Tester");
      
      removeWATypingIndicator();
      const finalReply = formatBotReply(res.reply);
      appendWAMessage('received', finalReply, true);
      addLog('engine', `AI Edge Function reply received.`, 'success');

      if (res.bookingMade) {
        addLog('engine', `AI Booking Tag extracted and saved!`, 'success');
        triggerNotification(`📅 New Booking!`, `An appointment was automatically saved.`);
        if (state.activeScreen === 'crm') initCRM(); // Refresh CRM if open
      }
    } catch (e) {
      removeWATypingIndicator();
      appendWAMessage('received', `[Simulator Error: ${e.message}]`, true);
      addLog('engine', `AI Simulator failed: ${e.message}`, 'error');
    }
  } else {
    setTimeout(() => {
      removeWATypingIndicator();
      const replyText = formatBotReply(processBotEngine(text));
      appendWAMessage('received', replyText, true);
      addLog('engine', `Outbound WhatsApp auto-reply sent.`, 'success');

      if (state.activeScreen !== 'bot_builder' && state.activeScreen !== 'dashboard') {
        triggerNotification(`💬 Msg from +91 ${state.userProfile.phone.slice(-5) || '98450'}`, `Auto-responded: "${replyText.substring(0, 30)}..."`);
      }
    }, 1000);
  }

  state.stats.repliesToday++;
  document.getElementById('stat-replies').innerText = Number(state.stats.repliesToday).toLocaleString();
  waChatArea.scrollTop = waChatArea.scrollHeight;
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
    
    let timingStr = `Mon–Sat, ${state.openTime || '9 AM'}–${state.closeTime || '8 PM'}`;
    if (state.businessKnowledge && state.businessKnowledge.includes('Timings:')) {
      const match = state.businessKnowledge.match(/Timings:\s*([^\n]+)/);
      if (match) timingStr = match[1].trim();
    }
    
    return `Sure! Share your preferred date and time 📅\nWe're open ${timingStr}.`;
  }

  // 4b. Location check
  if (cleanText.includes('location') || cleanText.includes('where') || cleanText.includes('address')) {
    addLog('engine', `Rule match: Dynamic Location`, 'success');
    let locStr = `📍 We are located in ${state.userProfile?.city || 'your city'}.`;
    if (state.businessKnowledge && state.businessKnowledge.includes('Location:')) {
      const match = state.businessKnowledge.match(/Location:\s*([^\n]+)/);
      if (match) locStr = `📍 You can find us at: ${match[1].trim()}`;
    }
    return locStr;
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
    triggerNotification('Error', 'Please fill out all signup fields.');
    return;
  }

  try {
    // Show loading state
    const btn = document.getElementById('su-btn-submit');
    btn.classList.add('loading');
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
    return true;
  } catch (err) {
    triggerNotification('Error', err.message || 'Signup failed.');
    const btn = document.getElementById('su-btn-submit');
    btn.classList.remove('loading');
    btn.disabled = false;
    return false;
  }
}

// Log In Handler
async function handleLogInSubmit() {
  const email = document.getElementById('li-email').value.trim();
  const password = document.getElementById('li-password').value.trim();

  if (!email || !password) {
    triggerNotification('Error', 'Please fill out email and password.');
    return;
  }

  try {
    const btn = document.getElementById('li-btn-submit');
    btn.classList.add('loading');
    btn.disabled = true;

    // 1. Auth with Supabase
    const authData = await authLogIn(email, password);
    const userId = authData.user.id;

    // 2. Load profile from database
    const profile = await getUserProfile(userId);
    const botSettings = await getBotSettings(userId);

    // 3. Load into state
    state.userProfile.loggedIn = true;
    state.userProfile.supabaseId = userId;
    state.userProfile.fullName = profile.full_name;
    state.userProfile.email = profile.email;
    state.userProfile.businessName = profile.business_name;
    state.userProfile.businessType = profile.business_type;
    state.userProfile.teamRole = profile.team_role || 'admin';
    
    let activePlan = profile.plan || 'starter';
    if (profile.subscription_end_date) {
      const subEnd = new Date(profile.subscription_end_date);
      if (new Date() > subEnd) {
        activePlan = 'starter';
      }
    }
    state.currentPlan = activePlan;

    if (botSettings) {
      state.welcomeMessage = botSettings.welcome_message;
      state.openTime = botSettings.open_time;
      state.closeTime = botSettings.close_time;
      state.languages = botSettings.languages || ['english'];
      state.businessKnowledge = botSettings.business_knowledge || '';
      menuItemsData = botSettings.menu_items || [];
      renderMenuItems();
      
      state.userProfile.metaWabaId = botSettings.meta_waba_id || '';
      state.userProfile.metaPhoneId = botSettings.meta_phone_id || '';
      state.userProfile.metaAccessToken = botSettings.meta_access_token || '';
      state.stats.repliesThisMonth = botSettings.reply_count_this_month || 0;
    }

    if (!botSettings || !botSettings.welcome_message) {
      state.welcomeMessage = `வணக்கம்! Welcome to ${profile.business_name}.\nHow can I help you today?`;
    }

    // Load actual dashboard stats
    try {
      const statsData = await getDashboardStats(userId);
      if (statsData) {
        state.stats.repliesToday = statsData.replies;
        state.stats.leadsSaved = statsData.leads;
        state.stats.avgResponse = statsData.avgTime;
        state.stats.satisfaction = statsData.satisfaction;
      }
    } catch (e) {
      console.warn("Failed to load dashboard stats", e);
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
    return true;
  } catch (err) {
    triggerNotification('Error', err.message || 'Login failed.');
    const btn = document.getElementById('li-btn-submit');
    btn.classList.remove('loading');
    btn.disabled = false;
    return false;
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
    triggerNotification('Error', 'Please fill out WhatsApp number and hours.');
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
function handleLogout() {
  document.getElementById('logout-confirm-modal').classList.add('active');
}

async function executeLogout() {

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
  
  document.getElementById('logout-confirm-modal').classList.remove('active');
}

// Hook up logout modal buttons
document.addEventListener('DOMContentLoaded', () => {
  const cancelLogoutBtn = document.getElementById('cancel-logout-btn');
  const confirmLogoutBtn = document.getElementById('confirm-logout-btn');
  
  if (cancelLogoutBtn) {
    cancelLogoutBtn.addEventListener('click', () => {
      document.getElementById('logout-confirm-modal').classList.remove('active');
    });
  }
  
  if (confirmLogoutBtn) {
    confirmLogoutBtn.addEventListener('click', async () => {
      confirmLogoutBtn.classList.add('loading');
      await executeLogout();
      confirmLogoutBtn.classList.remove('loading');
    });
  }
});

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

    const chargeAmount = selectedUpgradeTier === 'pro' ? '₹1,999' : '₹3,999';
    document.getElementById('payment-success-msg').innerText = `Charged ${chargeAmount} successfully via secure Razorpay checkout.`;

    addLog('system', `Payment Authorization Success. Gateway Token: RP_${Math.floor(Math.random() * 900000 + 100000)}`, 'success');
    addLog('system', `Generated Invoice for billing name: ${payName}`, 'success');
  }, 1500);
}

async function handlePaymentSuccessClose() {
  state.currentPlan = selectedUpgradeTier;
  if (state.userProfile?.supabaseId) {
    try {
      await upgradeUserPlan(state.userProfile.supabaseId, selectedUpgradeTier);
    } catch(e) {
      console.error('Failed to upgrade plan in DB', e);
    }
  }
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

      state.userProfile.loggedIn = true;
      state.userProfile.supabaseId = existingUser.id;
      state.userProfile.fullName = profile.full_name;
      state.userProfile.email = profile.email;
      state.userProfile.businessName = profile.business_name;
      state.userProfile.businessType = profile.business_type;
      
      let activePlan = profile.plan || 'starter';
      if (profile.subscription_end_date) {
        const subEnd = new Date(profile.subscription_end_date);
        if (new Date() > subEnd) {
          activePlan = 'starter';
        }
      }
      state.currentPlan = activePlan;

      if (botSettings) {
        state.welcomeMessage = botSettings.welcome_message;
        state.openTime = botSettings.open_time;
        state.closeTime = botSettings.close_time;
        state.languages = botSettings.languages || ['english'];
        state.businessKnowledge = botSettings.business_knowledge || '';
        menuItemsData = botSettings.menu_items || [];
        renderMenuItems();
        state.stats.repliesThisMonth = botSettings.reply_count_this_month || 0;
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

  attachMenuBuilderEvents();
  renderMenuItems();

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



  // Settings Save loading simulator
  const saveChangesBtn = document.getElementById('save-changes-btn');
  if (saveChangesBtn) {
    saveChangesBtn.onclick = async () => {
      saveChangesBtn.disabled = true;
      saveChangesBtn.classList.add('loading');
      const textSpan = saveChangesBtn.querySelector('span');

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
          busEmail: state.userProfile.busEmail,
          metaWabaId: document.getElementById('meta-waba-id').value.trim(),
          metaPhoneId: document.getElementById('meta-phone-id').value.trim(),
          metaAccessToken: document.getElementById('meta-access-token').value.trim(),
          menuItems: menuItemsData
        });

        // update local state
        state.userProfile.metaWabaId = document.getElementById('meta-waba-id').value.trim();
        state.userProfile.metaPhoneId = document.getElementById('meta-phone-id').value.trim();
        state.userProfile.metaAccessToken = document.getElementById('meta-access-token').value.trim();

        console.log('Save successful!');
        addLog('system', 'Bot settings saved to Supabase database.', 'success');
        triggerNotification('✓ Settings Saved', 'Bot configuration synced to cloud.');

      } catch (err) {
        console.error('Save failed:', err);
        triggerNotification('⚠️ Save Failed', err.message);
      }

      saveChangesBtn.disabled = false;
      saveChangesBtn.classList.remove('loading');
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

  // Team Invite Button
  const btnInvite = document.getElementById('btn-invite-team');
  if (btnInvite) {
    btnInvite.addEventListener('click', async () => {
      if (!requirePlan('pro', 'Team Management')) return;
      const email = document.getElementById('team-invite-email').value.trim();
      const role = document.getElementById('team-invite-role').value;
      if (!email) return triggerNotification('Error', 'Enter an email address');
      btnInvite.innerText = 'Sending...';
      btnInvite.disabled = true;
      try {
        await inviteTeamMember(state.userProfile.supabaseId, email, role);
        document.getElementById('team-invite-email').value = '';
        addLog('system', `Invited team member: ${email} as ${role}`, 'success');
        await renderTeamMembers();
      } catch (err) {
        alert('Failed to invite: ' + err.message);
      }
      btnInvite.innerText = 'Send Invite';
      btnInvite.disabled = false;
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
    config_id: '4551130871834024'
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
    // Exchange token and save Meta credentials via Edge Function
    if (state.userProfile.supabaseId) {
      const { data, error } = await db.functions.invoke('exchange-meta-token', {
        body: { 
          access_token: accessToken,
          user_id: state.userProfile.supabaseId
        }
      });

      if (error) {
        console.error('Error exchanging Meta token:', error);
        throw error;
      }
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
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-title">No leads yet</div>
          <div class="empty-state-desc">Leads appear here automatically when customers message your bot.</div>
        </div>`;
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
    triggerNotification('Error', 'Failed to load recent leads.');
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

// ═══ AI SETUP PAGE ═══
let aiStep = 0;
let aiAnswers = [];
let aiQuestions = [];
let aiTyping = false;

const AI_BUSINESS_QUESTIONS = {
  'Salon & Beauty': [
    { q: "What are your salon timings? 🕐", label: "Timings", placeholder: "e.g. 9am–9pm, Mon–Sat", chips: ["9am–9pm daily", "10am–8pm Mon–Sat"] },
    { q: "What services do you offer? ✂️\n(hair, skin, bridal, nails etc.)", label: "Services", placeholder: "e.g. Haircut, facial, bridal, hair color", chips: ["Hair services", "Skin & facial", "Bridal packages"] },
    { q: "What are your charges? 💰\nMen's cut, women's cut, facial prices?", label: "Prices", placeholder: "Men ₹150, Women ₹350, Facial ₹500...", chips: ["Starting ₹100", "Share price list", "Varies by service"] },
    { q: "Walk-ins or appointment needed? 📅", label: "Booking", placeholder: "e.g. Walk-ins welcome, call 9876543210 to book", chips: ["Walk-ins only", "Appointment needed", "Both welcome"] },
    { q: "Any ongoing offers or packages? 🎁\n(Type 'skip' if none)", label: "Offers", placeholder: "e.g. 10% off Sunday, monthly package ₹999", chips: ["No offers", "Weekend discount", "Membership"] }
  ],
  'Clinic / Hospital': [
    { q: "What are your clinic timings? 🏥", label: "Timings", placeholder: "e.g. Mon–Sat 9am–1pm, 5pm–9pm", chips: ["Morning & evening", "9am–9pm daily", "24/7 emergency"] },
    { q: "What treatments or specialties do you offer? 🩺", label: "Treatments", placeholder: "e.g. General, diabetes, dental, orthopedic", chips: ["General medicine", "Specialist clinic", "Dental care"] },
    { q: "What is your consultation fee? 💊", label: "Fees", placeholder: "e.g. General ₹300, Specialist ₹500", chips: ["₹200–₹500 range", "Free first visit", "Varies by doctor"] },
    { q: "How should patients book? 📞", label: "Booking", placeholder: "e.g. Call 9876543210 or walk in", chips: ["Walk-in only", "Call to book", "WhatsApp booking"] },
    { q: "Any facilities available? 🔬\n(lab, pharmacy, X-ray, ultrasound)", label: "Facilities", placeholder: "e.g. In-house lab, pharmacy, ECG", chips: ["Basic facilities", "Full diagnostic", "Skip"] }
  ],
  'Gym / Fitness': [
    { q: "What are your gym timings? 💪", label: "Timings", placeholder: "e.g. 5am–10pm all days", chips: ["5am–10pm daily", "6am–9pm daily", "24/7 gym"] },
    { q: "What facilities do you have? 🏋️", label: "Facilities", placeholder: "e.g. Cardio, weights, AC, trainer", chips: ["Basic gym", "Fully equipped", "With trainer"] },
    { q: "What are your membership plans? 💰", label: "Plans", placeholder: "Monthly ₹1000, Quarterly ₹2500, Annual ₹8000", chips: ["Share full plan", "Monthly only", "Varies"] },
    { q: "Personal training available? 🏃", label: "Training", placeholder: "e.g. PT at ₹500/session extra", chips: ["Included", "Extra charge", "Not available"] },
    { q: "Any offers for new members? 🎁\n(Type 'skip' if none)", label: "Offers", placeholder: "e.g. First month free, 3-day trial", chips: ["Free trial", "Joining offer", "Skip"] }
  ],
  'Coaching Center': [
    { q: "What subjects or courses do you teach? 📚", label: "Courses", placeholder: "e.g. Maths, Science, NEET, Spoken English", chips: ["School subjects", "Competitive exams", "Skill courses"] },
    { q: "What are your class timings? 🕐", label: "Timings", placeholder: "e.g. Morning 7–9am, Evening 5–8pm", chips: ["Morning batch", "Evening batch", "Both batches"] },
    { q: "What are your fees? 💰", label: "Fees", placeholder: "e.g. ₹1500/month per subject", chips: ["Share fee structure", "Subject-wise", "Package available"] },
    { q: "Which grades or levels do you teach? 🎓", label: "Grades", placeholder: "e.g. Class 6–12, College, All ages", chips: ["Class 6–10", "Class 11–12", "All grades"] },
    { q: "Demo class or free trial? 🎁\n(Type 'skip' if none)", label: "Trial", placeholder: "e.g. Free demo on Saturdays", chips: ["Free demo yes", "No trial", "Skip"] }
  ],
  'Restaurant / Food': [
    { q: "What type of food do you serve? 🍛", label: "Cuisine", placeholder: "e.g. South Indian, biryani, Chinese", chips: ["South Indian", "Multi-cuisine", "Biryani"] },
    { q: "What are your timings? 🕐", label: "Timings", placeholder: "e.g. 8am–10pm daily", chips: ["Open all days", "Lunch & dinner", "Breakfast too"] },
    { q: "Delivery or takeaway available? 🛵", label: "Delivery", placeholder: "e.g. Delivery via Swiggy/Zomato, pickup available", chips: ["Delivery yes", "Takeaway only", "Dine-in + delivery"] },
    { q: "Popular dish and price range? 💰", label: "Prices", placeholder: "e.g. Biryani ₹120, Meals ₹80", chips: ["Share menu price", "Budget-friendly", "Premium dining"] },
    { q: "Bulk orders or special offers? 🎁\n(Type 'skip' if none)", label: "Offers", placeholder: "e.g. Party orders, corporate lunch", chips: ["Bulk order", "No special offers", "Skip"] }
  ],
  'default': [
    { q: "What are your business timings? 🕐", label: "Timings", placeholder: "e.g. 9am–8pm, Mon–Sat", chips: ["9am–9pm daily", "10am–8pm Mon–Sat"] },
    { q: "What do you offer? 📦", label: "Services", placeholder: "Describe your products or services...", chips: [] },
    { q: "What are your prices? 💰", label: "Prices", placeholder: "Starting price or price range", chips: ["Share price list", "Varies by order"] },
    { q: "How should customers contact you? 📞", label: "Contact", placeholder: "e.g. WhatsApp, call, walk in", chips: ["WhatsApp only", "Call us", "Walk-in"] },
    { q: "Any offers? 🎁\n(Type 'skip' if none)", label: "Offers", placeholder: "Any discount or package?", chips: ["No offers", "Skip"] }
  ]
};

const AI_LOCATION_Q = {
  q: "Where is your business located? 📍\nType your address OR tap 'Share my location'",
  label: "Location",
  placeholder: "e.g. Near bus stand, Anna Nagar, Chennai",
  chips: ["📍 Share my location", "Type address"],
  isLocation: true
};

const AI_FINAL_Q = {
  q: "Almost done! 🎉\nAnything else you want your bot to know?\n(special instructions, parking, ladies only, etc.)\n\nType 'no' if nothing extra.",
  label: "Extra info",
  placeholder: "e.g. Parking available, Ladies only, Tamil preferred...",
  chips: ["Nothing extra", "Ladies only", "Parking available"]
};

const AI_BOOKING_REQS_Q = {
  q: "What details must the bot collect to confirm a booking? 📝",
  label: "Booking Details",
  placeholder: "e.g. Name, Phone, Service, Preferred Time, Staff member",
  chips: ["Name, Phone, Service, Time", "Name & Phone only", "Add Preferred Staff"]
};

const AI_PAYMENT_METHODS_Q = {
  q: "What payment methods do you accept? 💳",
  label: "Payment",
  placeholder: "e.g. Cash, UPI, Cards, Bank Transfer",
  chips: ["Cash & UPI only", "All cards & UPI", "Cash only"]
};

const AI_TONE_Q = {
  q: "How should the bot sound when talking to customers? 🎭",
  label: "Tone",
  placeholder: "e.g. Friendly and use emojis, strictly professional",
  chips: ["Friendly with emojis 😊", "Strictly Professional", "Casual & Short"]
};

function getAIQuestions() {
  const bizType = state.userProfile.businessType || 'default';
  const qs = AI_BUSINESS_QUESTIONS[bizType] || AI_BUSINESS_QUESTIONS['default'];
  return [...qs, AI_BOOKING_REQS_Q, AI_PAYMENT_METHODS_Q, AI_LOCATION_Q, AI_TONE_Q, AI_FINAL_Q];
}

function aiUpdateProgress(step) {
  const total = aiQuestions.length;
  const pct = total > 0 ? Math.round((step / total) * 100) : 0;
  const fill = document.getElementById('ai-progress-fill');
  const label = document.getElementById('ai-progress-label');
  const count = document.getElementById('ai-progress-count');
  if (fill) fill.style.width = pct + '%';
  if (count) count.textContent = step + ' / ' + total;
  const labels = ['Getting started...', 'Timings ✓', 'Services ✓', 'Prices ✓',
    'Booking ✓', 'Offers ✓', 'Details ✓', 'Payment ✓', 'Location ✓', 'Tone ✓', 'Almost there!', 'All done! 🎉'];
  if (label) label.textContent = labels[Math.min(step, labels.length - 1)];
}

function aiShowTyping() {
  const msgs = document.getElementById('ai-messages');
  if (!msgs) return;
  const wrap = document.createElement('div');
  wrap.className = 'ai-typing-wrap'; wrap.id = 'ai-typing';
  const icon = document.createElement('div');
  icon.className = 'ai-msg-icon'; icon.textContent = '🤖';
  const dots = document.createElement('div');
  dots.className = 'ai-typing-dots';
  for (let i = 0; i < 3; i++) { const s = document.createElement('span'); dots.appendChild(s); }
  wrap.appendChild(icon); wrap.appendChild(dots);
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}

function aiRemoveTyping() {
  const t = document.getElementById('ai-typing');
  if (t) t.remove();
}

function aiClearChips() {
  const chips = document.getElementById('ai-chips');
  if (chips) chips.innerHTML = '';
}

function aiShowChips(items, isLocation) {
  const chips = document.getElementById('ai-chips');
  if (!chips) return;
  chips.innerHTML = '';
  items.forEach(chip => {
    const btn = document.createElement('button');
    btn.className = 'ai-chip'; btn.textContent = chip;
    btn.onclick = () => {
      if (chip === '📍 Share my location') {
        aiRequestLocation();
      } else {
        const input = document.getElementById('ai-input');
        if (input) input.value = chip;
        aiHandleReply(chip);
      }
    };
    chips.appendChild(btn);
  });
}

function generateAIResponse(message) {
  // Uses Gemini endpoint natively via a fetch call to backend or we can mock it 
  // if not available in the frontend (it's mostly running via Webhook now).
  return "AI capability is routed through Twilio Webhook in production.";
}

// ─── INBOX UI ───
let currentInboxContact = null;

async function initInbox() {
  const contactList = document.getElementById('inbox-contact-list');
  contactList.innerHTML = `<p style="padding:16px; color:var(--ink-40); font-size:14px;">Loading chats...</p>`;
  
  try {
    const contacts = await getInboxContacts(state.userProfile.supabaseId);
    if (!contacts || contacts.length === 0) {
      contactList.innerHTML = `<p style="padding:16px; color:var(--ink-40); font-size:14px;">No conversations yet.</p>`;
      return;
    }
    
    contactList.innerHTML = contacts.map(c => `
      <div class="inbox-contact" onclick="openInboxChat('${c.phone}')" id="contact-${c.phone}">
        <div class="inbox-contact-name">${c.phone}</div>
        <div class="inbox-contact-preview">${c.lastMessage}</div>
      </div>
    `).join('');
  } catch(e) {
    console.error("Inbox load error", e);
    contactList.innerHTML = `<p style="padding:16px; color:var(--red); font-size:14px;">Error loading chats.</p>`;
  }
}

window.openInboxChat = async function(phone) {
  document.querySelectorAll('.inbox-contact').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`contact-${phone}`);
  if(el) el.classList.add('active');
  
  currentInboxContact = phone;
  document.getElementById('inbox-empty').style.display = 'none';
  document.getElementById('inbox-chat-area').style.display = 'flex';
  document.getElementById('inbox-active-contact').innerHTML = `<h4>${phone}</h4>`;
  
  const historyDiv = document.getElementById('inbox-history');
  historyDiv.innerHTML = `<div style="text-align:center; padding:20px;">Loading history...</div>`;
  
  try {
    const msgs = await getChatHistory(state.userProfile.supabaseId, phone);
    historyDiv.innerHTML = msgs.map(m => {
      const isOutbound = m.direction === 'outbound';
      const msgClass = isOutbound ? 'inbox-msg-out' : 'inbox-msg-in';
      const content = isOutbound ? (m.message_body || m.ai_reply) : m.message_body;
      return `<div class="inbox-msg ${msgClass}">${content}</div>`;
    }).join('');
    historyDiv.scrollTop = historyDiv.scrollHeight;
  } catch(e) {
    console.error(e);
  }
}

document.getElementById('btn-inbox-send')?.addEventListener('click', async () => {
  if (!currentInboxContact) return;
  const input = document.getElementById('inbox-reply-input');
  const text = input.value.trim();
  if (!text) return;
  
  const btn = document.getElementById('btn-inbox-send');
  btn.disabled = true;
  btn.innerText = '...';
  
  try {
    await sendWhatsAppMessage(state.userProfile.supabaseId, currentInboxContact, text);
    input.value = '';
    await openInboxChat(currentInboxContact);
  } catch (e) {
    alert("Failed to send: " + e.message);
  }
  btn.disabled = false;
  btn.innerText = 'Send';
});

// ─── CRM UI ───
async function initCRM() {
  const apptList = document.getElementById('crm-appointments-list');
  const leadsList = document.getElementById('crm-leads-list');
  
  try {
    const appts = await getAppointments(state.userProfile.supabaseId);
    if (!appts || appts.length === 0) {
      apptList.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:24px; color:#888;">No appointments yet.</td></tr>`;
    } else {
      apptList.innerHTML = appts.map(a => `
        <tr>
          <td><strong>${a.appointment_date}</strong></td>
          <td>${a.customer_phone}</td>
          <td>${a.service}</td>
          <td><span class="tag ${a.status === 'pending' ? 'on' : ''}">${a.status}</span></td>
        </tr>
      `).join('');
    }
    
    const leads = await getLeadsCRM(state.userProfile.supabaseId);
    if (!leads || leads.length === 0) {
      leadsList.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:24px; color:#888;">No leads yet.</td></tr>`;
    } else {
      leadsList.innerHTML = leads.map(l => `
        <tr>
          <td><strong>${l.phone}</strong></td>
          <td>${l.channel}</td>
          <td>${l.lead_score || 'New'}</td>
          <td>${new Date(l.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');
    }

    // Bind export button right away
    const btnExport = document.getElementById('btn-export-leads');
    if (btnExport) {
      btnExport.onclick = async () => {
        if (!requirePlan('pro', 'Lead Exporting (CSV)')) return;
        try {
          const exportLeads = await getLeadsCRM(state.userProfile.supabaseId);
          if (!exportLeads || exportLeads.length === 0) {
            alert('No leads to export.');
            return;
          }
          
          let csv = 'Phone,Channel,Status,Date\n';
          exportLeads.forEach(l => {
            csv += `"${l.phone}","${l.channel}","${l.lead_score || 'New'}","${new Date(l.created_at).toLocaleDateString()}"\n`;
          });
          
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.setAttribute('href', url);
          a.setAttribute('download', 'uraai_leads.csv');
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch(err) {
          alert('Export failed: ' + err.message);
        }
      };
    }
  } catch (e) {
    console.error("CRM load error", e);
  }
}

// ─── BROADCASTS UI ───
async function initBroadcasts() {
  const select = document.getElementById('broadcast-recipients');
  try {
    const leads = await getLeadsCRM(state.userProfile.supabaseId);
    select.innerHTML = leads.map(l => `<option value="${l.phone}">${l.phone}</option>`).join('');
  } catch (e) {
    console.error(e);
  }
}

document.getElementById('btn-send-broadcast')?.addEventListener('click', async () => {
  if (!requirePlan('pro', 'WhatsApp Broadcasts')) return;
  const select = document.getElementById('broadcast-recipients');
  const recipients = Array.from(select.selectedOptions).map(opt => opt.value);
  const message = document.getElementById('broadcast-message').value.trim();
  const statusEl = document.getElementById('broadcast-status');
  
  if (recipients.length === 0 || !message) {
    statusEl.innerText = 'Please select recipients and enter a message.';
    statusEl.style.color = 'var(--red)';
    return;
  }
  
  const btn = document.getElementById('btn-send-broadcast');
  btn.disabled = true;
  btn.innerText = 'Sending...';
  statusEl.innerText = '';
  
  try {
    const res = await sendBroadcastMessage(state.userProfile.supabaseId, recipients, message);
    statusEl.innerText = `Success! Sent to ${res.successCount} contacts. Failed: ${res.failCount}`;
    statusEl.style.color = 'var(--green)';
    document.getElementById('broadcast-message').value = '';
    select.selectedIndex = -1;
  } catch (e) {
    statusEl.innerText = 'Broadcast failed: ' + e.message;
    statusEl.style.color = 'var(--red)';
  }
  
  btn.disabled = false;
  btn.innerText = 'Blast Message 🚀';
});

// ─── ANALYTICS UI ───
let analyticsChartInstance = null;
async function initAnalytics() {
  try {
    const data = await getAnalyticsData(state.userProfile.supabaseId);
    
    // Update KPIs
    document.getElementById('kpi-total-replies').innerText = data.logs.length;
    document.getElementById('kpi-leads-saved').innerText = data.leadsCount;
    
    // Process logs for the last 7 days
    const today = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const labels = [];
    const inboundData = [];
    const outboundData = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      labels.push(days[d.getDay()]);
      
      const startOfDay = new Date(d.setHours(0,0,0,0)).getTime();
      const endOfDay = new Date(d.setHours(23,59,59,999)).getTime();
      
      const dayLogs = data.logs.filter(l => {
        const t = new Date(l.created_at).getTime();
        return t >= startOfDay && t <= endOfDay;
      });
      
      inboundData.push(dayLogs.filter(l => l.direction === 'inbound').length);
      outboundData.push(dayLogs.filter(l => l.direction === 'outbound').length);
    }
    
    const ctx = document.getElementById('analyticsChart').getContext('2d');
    if (analyticsChartInstance) {
      analyticsChartInstance.destroy();
    }
    
    analyticsChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Inbound (Customer)',
            data: inboundData,
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 4
          },
          {
            label: 'Outbound (Bot)',
            data: outboundData,
            backgroundColor: '#8b5cf6', // var(--violet)
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false, drawBorder: false }, ticks: { color: 'rgba(255,255,255,0.5)' } },
          y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }, ticks: { color: 'rgba(255,255,255,0.5)' } }
        },
        plugins: {
          legend: { labels: { color: 'rgba(255,255,255,0.7)' } }
        }
      }
    });
    
  } catch (err) {
    console.error("Failed to load analytics", err);
  }
}

// ─── TEAM MEMBERS UI ───
async function renderTeamMembers() {
  const tbody = document.getElementById('team-members-list');
  if (!tbody) return;
  
  try {
    const members = await getTeamMembers(state.userProfile.supabaseId);
    if (!members || members.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:24px; color:#888;">No team members yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = members.map(m => `
      <tr>
        <td><strong>${m.member_email}</strong></td>
        <td><span class="tag ${m.role === 'admin' ? 'on' : ''}">${m.role}</span></td>
        <td>${new Date(m.invited_at).toLocaleDateString()}</td>
        <td>
          <button class="btn-ghost" style="color:var(--text-light); padding:4px 8px;" onclick="handleRemoveTeamMember('${m.id}')">Remove</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error("Failed to load team members", err);
  }
}

window.handleRemoveTeamMember = async function(id) {
  if (!confirm("Are you sure you want to remove this member?")) return;
  try {
    await removeTeamMember(id);
    addLog('system', 'Removed team member.', 'default');
    renderTeamMembers();
  } catch (err) {
    alert("Failed to remove member: " + err.message);
  }
}

function aiRequestLocation() {
  if (!navigator.geolocation) {
    aiAddMessage('bot', "Location not available on this device. Please type your address below 👇");
    return;
  }
  aiAddMessage('bot', '📍 Getting your location...');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
      const data = await res.json();
      const address = data.display_name?.split(',').slice(0,4).join(',').trim() || 'Location found';
      aiHandleReply('📍 ' + address);
    } catch {
      aiHandleReply(`📍 GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
    }
  }, () => {
    aiAddMessage('bot', "Couldn't get location. Please type your address 👇");
  });
}

function aiAddMessage(sender, text, tag) {
  const msgs = document.getElementById('ai-messages');
  if (!msgs) return;
  const wrap = document.createElement('div');
  wrap.className = 'ai-msg ai-msg-' + sender;
  if (sender === 'bot') {
    const icon = document.createElement('div');
    icon.className = 'ai-msg-icon'; icon.textContent = '🤖';
    wrap.appendChild(icon);
  }
  const bubble = document.createElement('div');
  bubble.className = 'ai-bubble ai-bubble-' + sender;
  if (tag) {
    const tagEl = document.createElement('span');
    tagEl.className = 'ai-bubble-q-tag'; tagEl.textContent = tag;
    bubble.appendChild(tagEl);
  }
  const p = document.createElement('div');
  p.style.whiteSpace = 'pre-wrap'; p.textContent = text;
  bubble.appendChild(p);
  wrap.appendChild(bubble);
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}

function initAISetup() {
  const msgs = document.getElementById('ai-messages');
  if (!msgs) return;
  aiStep = 0; aiAnswers = []; aiTyping = false;
  aiQuestions = getAIQuestions();
  msgs.innerHTML = '';
  aiClearChips();
  aiUpdateProgress(0);
  const bizType = state.userProfile.businessType || 'Business';
  const icon = (AI_BUSINESS_QUESTIONS[bizType] || {}).icon || '🏪';
  aiTyping = true;
  aiShowTyping();
  setTimeout(() => {
    aiRemoveTyping();
    aiAddMessage('bot', `வணக்கம்! 🤖 I'm your Uraai setup assistant.\n\nI'll ask you ${aiQuestions.length} quick questions about ${state.userProfile.businessName || 'your business'} — then your bot will be ready to answer customers 24/7!\n\nLet's begin 🚀`);
    aiTyping = false;
    setTimeout(() => aiAskNext(), 700);
  }, 900);
}

function restartOnboarding() {
  initAISetup();
}

function aiAskNext() {
  if (aiStep >= aiQuestions.length) { aiFinish(); return; }
  const q = aiQuestions[aiStep];
  const input = document.getElementById('ai-input');
  if (input) input.placeholder = q.placeholder || 'Type your answer...';
  aiTyping = true;
  aiShowTyping();
  setTimeout(() => {
    aiRemoveTyping();
    aiAddMessage('bot', q.q, `Q ${aiStep + 1} of ${aiQuestions.length}`);
    aiTyping = false;
    if (q.chips?.length) aiShowChips(q.chips, q.isLocation);
    else aiClearChips();
    const input = document.getElementById('ai-input');
    if (input) input.focus();
  }, 700);
}

function aiHandleReply(text) {
  if (!text?.trim() || aiTyping) return;
  aiClearChips();
  aiAddMessage('user', text.trim());
  aiAnswers.push({ label: aiQuestions[aiStep]?.label || 'Info', value: text.trim() });
  aiStep++;
  aiUpdateProgress(aiStep);
  const input = document.getElementById('ai-input');
  if (input) { input.value = ''; input.style.height = 'auto'; }
  setTimeout(() => aiAskNext(), 300);
}

async function aiFinish() {
  aiTyping = true;
  aiShowTyping();
  const knowledge = aiAnswers.map(a => `${a.label}: ${a.value}`).join('\n');
  if (state.userProfile.supabaseId) {
    const { error } = await db.from('bot_settings').upsert({
      user_id: state.userProfile.supabaseId,
      business_knowledge: knowledge,
      onboarding_complete: true,
      updated_at: new Date().toISOString()
    });

    if (error) {
      console.error('[AI SETUP] Save failed:', error);
      addLog('system', 'AI setup save failed: ' + error.message, 'error');
    } else {
      console.log('[AI SETUP] Saved successfully:', knowledge);
      addLog('system', 'AI setup complete — bot knowledge saved ✅', 'success');
    }
  }
  state.businessKnowledge = knowledge;
  aiUpdateProgress(aiQuestions.length);
  setTimeout(() => {
    aiRemoveTyping();
    aiAddMessage('bot', "Your bot is ready! 🎉 Here's everything it now knows:");
    const msgs = document.getElementById('ai-messages');
    if (msgs) {
      const card = document.createElement('div');
      card.className = 'ai-done-card';
      const h4 = document.createElement('h4'); h4.textContent = '✅ Knowledge base saved';
      card.appendChild(h4);
      aiAnswers.forEach(a => {
        const row = document.createElement('div'); row.className = 'ai-done-row';
        const lbl = document.createElement('div'); lbl.className = 'ai-done-label'; lbl.textContent = a.label;
        const val = document.createElement('div'); val.className = 'ai-done-val'; val.textContent = a.value;
        row.appendChild(lbl); row.appendChild(val); card.appendChild(row);
      });
      msgs.appendChild(card); msgs.scrollTop = msgs.scrollHeight;
    }
    const preview = document.getElementById('ai-knowledge-preview');
    const content = document.getElementById('ai-knowledge-content');
    if (preview && content) {
      preview.style.display = 'block';
      content.innerHTML = aiAnswers.map(a =>
        `<div class="ai-knowledge-row"><span class="ai-knowledge-key">${a.label}</span><span class="ai-knowledge-val">${a.value}</span></div>`
      ).join('');
    }
    setTimeout(() => {
      aiAddMessage('bot', 'Your WhatsApp bot will now use this to reply to customers in Tamil, Hindi, and English — 24/7! 🚀\n\nClick "Restart" anytime to update your info.');
      const btn = document.getElementById('ai-send-btn');
      const input = document.getElementById('ai-input');
      if (btn) btn.disabled = true;
      if (input) { input.disabled = true; input.placeholder = 'Setup complete ✅'; }
      aiTyping = false;
    }, 500);
  }, 1200);
}

// Bind events when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const sendBtn = document.getElementById('ai-send-btn');
  const input = document.getElementById('ai-input');
  if (sendBtn && input) {
    sendBtn.onclick = () => aiHandleReply(input.value);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiHandleReply(input.value); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });
  }
});

// Premium Channel Hooks
document.addEventListener('DOMContentLoaded', () => {
  const igBtn = document.getElementById('ig-connect-btn');
  const emailBtn = document.getElementById('email-connect-btn');

  if (igBtn) {
    igBtn.addEventListener('click', () => {
      if (!requirePlan('pro', 'Instagram Direct Connection')) return;
      triggerNotification('Coming Soon', 'Instagram API approval is pending for this workspace.');
    });
  }

  if (emailBtn) {
    emailBtn.addEventListener('click', () => {
      if (!requirePlan('pro', 'Email Connection')) return;
      triggerNotification('Coming Soon', 'Email forwarding setup will be available next week.');
    });
  }
});

// Logout Execution Bridge
window.executeLogout = async function() {
  const modal = document.getElementById('logout-confirm-modal');
  if (modal) modal.classList.remove('active');
  
  if (typeof authLogOut === 'function') {
    try {
      await authLogOut();
      window.location.reload();
    } catch(err) {
      console.error(err);
      window.location.reload();
    }
  } else {
    console.error('authLogOut function is not defined.');
    window.location.reload();
  }
};



// ==========================================
// LIVE INBOX ARCHITECTURE
// ==========================================
let activeInboxContact = null;
let inboxRealtimeChannel = null;

async function initLiveInbox() {
  console.log("Initializing Live Inbox...");
  const contactListEl = document.getElementById('inbox-contact-list');
  const chatAreaEl = document.getElementById('inbox-chat-area');
  const emptyStateEl = document.getElementById('inbox-empty');
  
  if (!contactListEl) return;
  
  contactListEl.innerHTML = '<div style="padding:20px; text-align:center; color:#667781;">Loading contacts...</div>';
  
  // Show empty state by default
  if (chatAreaEl) chatAreaEl.style.display = 'none';
  if (emptyStateEl) emptyStateEl.style.display = 'flex';
  
  try {
    // Query leads for contacts
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('last_interaction_at', { ascending: false });
      
    if (error) throw error;
    
    renderInboxContacts(leads || []);
  } catch (err) {
    console.error("Error loading inbox contacts:", err);
    contactListEl.innerHTML = '<div style="padding:20px; text-align:center; color:red;">Failed to load contacts.</div>';
  }
}

function renderInboxContacts(leads) {
  const contactListEl = document.getElementById('inbox-contact-list');
  if (!contactListEl) return;
  
  contactListEl.innerHTML = '';
  
  if (leads.length === 0) {
    contactListEl.innerHTML = '<div style="padding:20px; text-align:center; color:#667781;">No active conversations yet.</div>';
    return;
  }
  
  leads.forEach(lead => {
    const el = document.createElement('div');
    el.className = 'wa-contact-item';
    el.style = 'display: flex; align-items: center; padding: 0 12px; cursor: pointer; transition: background 0.2s;';
    
    // Add hover effect
    el.onmouseover = () => el.style.background = '#f5f6f6';
    el.onmouseout = () => {
      if (activeInboxContact !== lead.customer_phone) el.style.background = 'transparent';
    };
    
    const timeStr = lead.last_interaction_at 
      ? new Date(lead.last_interaction_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      : '';
      
    const nameStr = lead.customer_name || lead.customer_phone;
    
    el.innerHTML = `
      <div class="avatar" style="width: 49px; height: 49px; background: #dfe5e7; margin-right: 15px; flex-shrink: 0; display:flex; align-items:center; justify-content:center; border-radius:50%; font-size:20px;">👤</div>
      <div style="flex: 1; border-bottom: 1px solid #f2f2f2; padding: 12px 0; display:flex; flex-direction:column; justify-content:center;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size: 17px; color: #111b21;">${nameStr}</span>
          <span style="font-size: 12px; color: #667781;">${timeStr}</span>
        </div>
        <div style="font-size: 14px; color: #667781; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">
          Click to view messages...
        </div>
      </div>
    `;
    
    el.onclick = () => {
      // Clear previous active styles
      document.querySelectorAll('.wa-contact-item').forEach(item => item.style.background = 'transparent');
      el.style.background = '#f0f2f5';
      loadInboxChat(lead);
    };
    
    contactListEl.appendChild(el);
  });
}

async function loadInboxChat(lead) {
  activeInboxContact = lead.customer_phone;
  
  const chatAreaEl = document.getElementById('inbox-chat-area');
  const emptyStateEl = document.getElementById('inbox-empty');
  const activeContactEl = document.getElementById('inbox-active-contact');
  const historyEl = document.getElementById('inbox-history');
  const replyInput = document.getElementById('inbox-reply-input');
  
  if (chatAreaEl) chatAreaEl.style.display = 'flex';
  if (emptyStateEl) emptyStateEl.style.display = 'none';
  if (activeContactEl) activeContactEl.innerText = lead.customer_name || lead.customer_phone;
  if (replyInput) {
    replyInput.disabled = false;
    replyInput.placeholder = "Type a message";
  }
  
  if (historyEl) {
    historyEl.innerHTML = '<div style="text-align:center; padding:20px; color:#667781;">Loading messages...</div>';
  }
  
  try {
    // Fetch whatsapp_logs for this phone number
    const { data: logs, error } = await supabase
      .from('whatsapp_logs')
      .select('*')
      .eq('user_id', currentUser.id)
      .or(`from_number.eq.${lead.customer_phone},to_number.eq.${lead.customer_phone}`)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    renderChatHistory(logs || []);
    setupInboxRealtime(lead.customer_phone);
    
  } catch (err) {
    console.error("Error loading chat history:", err);
    if (historyEl) historyEl.innerHTML = '<div style="text-align:center; padding:20px; color:red;">Failed to load messages.</div>';
  }
}

function renderChatHistory(logs) {
  const historyEl = document.getElementById('inbox-history');
  if (!historyEl) return;
  
  historyEl.innerHTML = '<div style="align-self: center; background: white; padding: 5px 12px; border-radius: 8px; font-size: 12px; color: #54656f; box-shadow: 0 1px 0.5px rgba(11,20,26,.13); margin-bottom: 10px;">Chat History</div>';
  
  logs.forEach(log => {
    appendMessageBubble(log);
  });
  
  // Scroll to bottom
  historyEl.scrollTop = historyEl.scrollHeight;
}

function appendMessageBubble(log) {
  const historyEl = document.getElementById('inbox-history');
  if (!historyEl) return;
  
  const timeStr = new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  const isOutbound = log.direction === 'outbound';
  
  const bubble = document.createElement('div');
  bubble.className = isOutbound ? 'wa-bubble-sent' : 'wa-bubble-received';
  
  if (isOutbound) {
    bubble.style = 'align-self: flex-end; background: #d9fdd3; padding: 6px 7px 8px 9px; border-radius: 8px 0 8px 8px; max-width: 65%; box-shadow: 0 1px 0.5px rgba(11,20,26,.13); position: relative; font-size: 14.2px; color: #111b21; margin-bottom: 4px;';
    
    // Read receipts SVG
    const ticksSvg = log.status === 'read' 
      ? '<svg viewBox="0 0 16 15" width="16" height="15"><path fill="#53bdeb" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path></svg>'
      : '<svg viewBox="0 0 16 15" width="16" height="15"><path fill="#8696a0" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512z"></path></svg>';
      
    bubble.innerHTML = `
      ${log.message_body.replace(/\n/g, '<br>')}
      <span style="float: right; font-size: 11px; color: #667781; margin: 10px 0 -5px 10px; display:flex; align-items:center; gap:3px;">
        ${timeStr} ${ticksSvg}
      </span>
    `;
  } else {
    bubble.style = 'align-self: flex-start; background: #ffffff; padding: 6px 7px 8px 9px; border-radius: 0 8px 8px 8px; max-width: 65%; box-shadow: 0 1px 0.5px rgba(11,20,26,.13); position: relative; font-size: 14.2px; color: #111b21; margin-bottom: 4px;';
    bubble.innerHTML = `
      ${log.message_body.replace(/\n/g, '<br>')}
      <span style="float: right; font-size: 11px; color: #667781; margin: 10px 0 -5px 10px;">${timeStr}</span>
    `;
  }
  
  historyEl.appendChild(bubble);
}

function setupInboxRealtime(customerPhone) {
  // Remove existing channel if any
  if (inboxRealtimeChannel) {
    supabase.removeChannel(inboxRealtimeChannel);
  }
  
  inboxRealtimeChannel = supabase.channel('custom-inbox-channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'whatsapp_logs', filter: `user_id=eq.${currentUser.id}` },
      (payload) => {
        const newLog = payload.new;
        // Check if the message belongs to the active contact
        if (newLog.from_number === activeInboxContact || newLog.to_number === activeInboxContact) {
          appendMessageBubble(newLog);
          const historyEl = document.getElementById('inbox-history');
          if (historyEl) historyEl.scrollTop = historyEl.scrollHeight;
        }
      }
    )
    .subscribe((status) => {
      console.log("Realtime Sync Status:", status);
    });
}

// Send Manual Message Logic
async function handleSendInboxMessage() {
  const replyInput = document.getElementById('inbox-reply-input');
  const messageBody = replyInput.value.trim();
  
  if (!messageBody || !activeInboxContact) return;
  
  // Clear input
  replyInput.value = '';
  
  // Optimistically render
  const tempLog = {
    direction: 'outbound',
    message_body: messageBody,
    created_at: new Date().toISOString(),
    status: 'sending'
  };
  appendMessageBubble(tempLog);
  const historyEl = document.getElementById('inbox-history');
  if (historyEl) historyEl.scrollTop = historyEl.scrollHeight;
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Call Edge Function
    const res = await fetch(`${supabaseUrl}/functions/v1/send-manual-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        toPhone: activeInboxContact,
        messageBody: messageBody
      })
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to send");
    }
    
    // It was successful. Realtime will fetch the DB insert, we might see duplicates if we rely on optimistic.
    // For now it's fine.
    
  } catch (err) {
    console.error("Send message error:", err);
    alert("Failed to send message: " + err.message);
  }
}

// Setup Event Listeners for Inbox
setTimeout(() => {
  const sendBtn = document.getElementById('btn-inbox-send');
  const replyInput = document.getElementById('inbox-reply-input');
  
  if (sendBtn) {
    sendBtn.onclick = handleSendInboxMessage;
  }
  
  if (replyInput) {
    replyInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        handleSendInboxMessage();
      }
    });
  }
}, 2000);
