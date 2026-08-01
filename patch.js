const fs = require('fs');
let code = fs.readFileSync('c:/Uraai/app.js', 'utf8');
let originalCode = code;

code = code.replace(/faqs: \[\s*\{ q: "Timings\?", a: "We're open Mon–Sat, 9am to 8pm." \},\s*\{ q: "Booking an appointment\?", a: "Share your date & time and we'll confirm." \}\s*\],/, '');
code = code.replace(/\s*renderFAQsList\(\);\n/, '\n');

const faqListRegex = /function renderFAQsList\(\) \{[\s\S]*?\}\n/;
code = code.replace(faqListRegex, '');

const faqLimitRegex = /    const addFaqBtn = document\.getElementById\('add-faq-btn'\);\s*const faqLimit = getCurrentLimits\(\)\.maxFaqTemplates;\s*if \(state\.faqs\.length >= faqLimit\) \{[\s\S]*?addFaqBtn\.disabled = false;\s*\}/;
code = code.replace(faqLimitRegex, '');

const faqBtnRegex = /    const addFaqBtn = document\.getElementById\('add-faq-btn'\);\s*addFaqBtn\.innerHTML = `\+ Add FAQ reply`;\s*addFaqBtn\.disabled = false;/;
code = code.replace(faqBtnRegex, '');

const faqModalRegex = /\/\/ --- FAQ MODAL MANAGEMENT ---[\s\S]*?updateWhatsAppChips\(\);\n\}/;
code = code.replace(faqModalRegex, '');

const dynamicFaqRegex = /  \/\/ Dynamic FAQ chips\s*state\.faqs\.forEach\(faq => \{[\s\S]*?chipsRow\.appendChild\(chip\);\s*\}\);/;
code = code.replace(dynamicFaqRegex, '');

const exactMatchRegex = /  \/\/ 2\. Exact match check from user-defined FAQs\s*for \(let faq of state\.faqs\) \{[\s\S]*?\}\s*\}/;
code = code.replace(exactMatchRegex, '');

code = code.replace(/\s*const userFaqs = await getFaqs\(userId\);/, '');
code = code.replace(/    if \(userFaqs\.length > 0\) \{[\s\S]*?\}\n/, '');

code = code.replace(/\s*const userFaqs = await getFaqs\(existingUser\.id\);/, '');
code = code.replace(/      if \(userFaqs\.length > 0\) \{[\s\S]*?\}\n/, '');

const crudBindingsRegex = /  \/\/ FAQ CRUD bindings\s*const addFaqBtn = document\.getElementById\('add-faq-btn'\);[\s\S]*?cancelFaqBtn\.onclick = closeFaqModal;/;
code = code.replace(crudBindingsRegex, '');

const newAiFinishBlock = `  if (state.userProfile.supabaseId) {
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
  }`;

const oldAiFinishRegex = /  if \(state\.userProfile\.supabaseId\) \{\s*await db\.from\('bot_settings'\)\.upsert\(\{\s*user_id: state\.userProfile\.supabaseId,\s*business_knowledge: knowledge,\s*onboarding_complete: true\s*\}\);\s*\}/;
code = code.replace(oldAiFinishRegex, newAiFinishBlock);

fs.writeFileSync('c:/Uraai/app.js', code);
if (originalCode !== code) console.log('Successfully replaced parts of app.js');
else console.log('No changes were made');
