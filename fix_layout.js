const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');

// 1. Add subtitle to the global header
const oldHeader = `<div class="app-header-title">
          <h2 id="app-header-view-title">Dashboard</h2>
        </div>`;
const newHeader = `<div class="app-header-title" style="display:flex; flex-direction:column; justify-content:center;">
          <h2 id="app-header-view-title" style="margin-bottom:0;">Dashboard</h2>
          <p id="app-header-view-subtitle" style="font-size:12px; color:var(--ink-60); margin:2px 0 0 0; font-weight:500;">Here is what's happening with your business channels today.</p>
        </div>`;
indexHtml = indexHtml.replace(oldHeader, newHeader);

// 2. Remove .app-screen-header from Team Settings
const oldTeam = `<div class="screen" id="team">
            <div class="app-screen-header">
              <h3>Team Settings</h3>
              <p>Manage access and roles for your staff members.</p>
            </div>`;
const newTeam = `<div class="screen" id="team">`;
indexHtml = indexHtml.replace(oldTeam, newTeam);

// 3. Remove .app-screen-header from Analytics
const oldAnalytics = `<div class="screen" id="analytics">
            <div class="app-screen-header">
              <h3>Analytics Dashboard</h3>
              <p>Visualizing total response queries, lead generation speeds, and satisfaction scores.</p>
            </div>`;
const newAnalytics = `<div class="screen" id="analytics">`;
indexHtml = indexHtml.replace(oldAnalytics, newAnalytics);

// 4. Remove .app-screen-header from Bot Builder
const oldBotBuilder = `<div class="screen" id="bot_builder">
            <div class="app-screen-header">
              <h3>Bot Configuration</h3>
              <p id="builder-business-name-sub">Salon — Active</p>
            </div>`;
const newBotBuilder = `<div class="screen" id="bot_builder">`;
indexHtml = indexHtml.replace(oldBotBuilder, newBotBuilder);

// 5. Remove .app-screen-header from Broadcasts
const oldBroadcasts = `<div class="screen" id="broadcasts">
            <div class="app-screen-header">
              <h3>Mass Broadcasts</h3>
              <p>Send promotional messages to your CRM leads.</p>
            </div>`;
const newBroadcasts = `<div class="screen" id="broadcasts">`;
indexHtml = indexHtml.replace(oldBroadcasts, newBroadcasts);

// 6. Remove .app-screen-header from AI Setup
const oldAiSetup = `<div class="screen" id="ai_setup">
            <div class="app-screen-header">
              <h2 class="app-screen-title">AI Setup</h2>
              <p class="app-screen-subtitle">Train your bot by answering a few questions</p>
            </div>`;
const newAiSetup = `<div class="screen" id="ai_setup">`;
indexHtml = indexHtml.replace(oldAiSetup, newAiSetup);

// 7. Remove .app-screen-header from Pricing
const oldPricing = `<div class="screen" id="pricing">
            <div class="app-screen-header">
              <h3>Manage Plan & Billing</h3>
              <p>Upgrade or modify your automated responder subscription limits.</p>
            </div>`;
const newPricing = `<div class="screen" id="pricing">`;
indexHtml = indexHtml.replace(oldPricing, newPricing);

fs.writeFileSync('index.html', indexHtml, 'utf8');

// UPDATE APP.JS NAVIGATION
let appJs = fs.readFileSync('app.js', 'utf8');
const oldNav = /const headerTitle = document\.getElementById\('app-header-view-title'\);[\s\S]*?if \(screenId === 'ai_setup'\) \{\s*title = 'AI Setup';\s*\}/m;
const newNav = `const headerTitle = document.getElementById('app-header-view-title');
    const headerSub = document.getElementById('app-header-view-subtitle');
    if (headerTitle) {
      let title = 'Dashboard';
      let sub = 'Here is what\\'s happening with your business channels today.';
      if (screenId === 'bot_builder') { title = 'Bot Builder'; sub = 'Configure your automated responder behavior.'; }
      if (screenId === 'analytics') { title = 'Analytics'; sub = 'Visualizing total response queries, lead generation speeds, and satisfaction.'; setTimeout(() => initAnalytics(), 100); }
      if (screenId === 'pricing') { title = 'Billing & Plans'; sub = 'Upgrade or modify your automated responder subscription limits.'; }
      if (screenId === 'onboarding') { title = 'Setup Guide'; sub = ''; }
      if (screenId === 'ai_setup') { title = 'AI Setup'; sub = 'Train your bot by answering a few questions.'; }
      if (screenId === 'team') { title = 'Team Settings'; sub = 'Manage access and roles for your staff members.'; }
      if (screenId === 'broadcasts') { title = 'Mass Broadcasts'; sub = 'Send promotional messages to your CRM leads.'; }
      headerTitle.innerText = title;
      if (headerSub) headerSub.innerText = sub;
    }`;
// Let's replace the whole block more safely
const oldNavBlock = `const headerTitle = document.getElementById('app-header-view-title');
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
      }
      headerTitle.innerText = title;
    }`;
appJs = appJs.replace(oldNavBlock, newNav);

fs.writeFileSync('app.js', appJs, 'utf8');
console.log('Layout fixed successfully');
