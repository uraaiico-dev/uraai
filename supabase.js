// supabase.js — Uraai Backend Integration

// ─── CONFIG ───
// Replace these with your actual Supabase project values
const SUPABASE_URL = 'https://fmqgxctgowrpepbnccwq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcWd4Y3Rnb3dycGVwYm5jY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDg5ODQsImV4cCI6MjA5ODEyNDk4NH0.jUepygo2S74_1csPoqsgfEPvr1osG5_KCk7uC-PzkR8';

// ─── CLIENT INIT ───
// Import Supabase via CDN (add this to index.html <head> first)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
const { createClient } = supabase;
let db;
try {
  db = createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
  console.warn("Supabase client failed to initialize. Please configure your SUPABASE_URL and SUPABASE_KEY inside supabase.js.", e);
}

// ─── AUTH FUNCTIONS ───

// Sign up new user
async function authSignUp(email, password) {
  if (!db) throw new Error("Supabase is not configured.");
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

// Log in existing user
async function authLogIn(email, password) {
  if (!db) throw new Error("Supabase is not configured.");
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Log out
async function authLogOut() {
  if (!db) throw new Error("Supabase is not configured.");
  const { error } = await db.auth.signOut();
  if (error) throw error;
}

// Get current logged in user
async function getCurrentUser() {
  if (!db) return null;
  const { data } = await db.auth.getUser();
  return data?.user || null;
}

// ─── USER PROFILE FUNCTIONS ───

// Save user profile to users table
async function saveUserProfile(userId, profileData) {
  if (!db) throw new Error("Supabase is not configured.");
  const { data, error } = await db
    .from('users')
    .upsert({
      id: userId,
      full_name: profileData.fullName,
      email: profileData.email,
      phone: profileData.phone,
      business_name: profileData.businessName,
      business_type: profileData.businessType,
      city: profileData.city,
      plan: profileData.plan || 'starter'
    });
  if (error) throw error;
  return data;
}

// Get user profile from users table
async function getUserProfile(userId) {
  if (!db) throw new Error("Supabase is not configured.");
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// Update user plan after payment
async function updateUserPlan(userId, newPlan) {
  if (!db) throw new Error("Supabase is not configured.");
  const { data, error } = await db
    .from('users')
    .update({ plan: newPlan })
    .eq('id', userId);
  if (error) throw error;
  return data;
}

// Update business profile
async function updateBusinessProfile(userId, updates) {
  if (!db) return null;
  const { error } = await db
    .from('users')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
  return true;
}

// ─── TEAM MEMBERS FUNCTIONS ───

async function inviteTeamMember(ownerId, memberEmail, role) {
  if (!db) return null;
  const { error } = await db
    .from('team_members')
    .insert({ owner_id: ownerId, member_email: memberEmail, role: role });
  if (error) throw error;
  return true;
}

async function getTeamMembers(ownerId) {
  if (!db) return [];
  const { data, error } = await db
    .from('team_members')
    .select('*')
    .eq('owner_id', ownerId)
    .order('invited_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── BOT SETTINGS FUNCTIONS ───

// Save bot settings
async function saveBotSettings(userId, settings) {
  if (!db) throw new Error("Supabase is not configured.");
  const { data, error } = await db
    .from('bot_settings')
    .upsert({
      user_id: userId,
      welcome_message: settings.welcomeMessage,
      open_time: settings.openTime,
      close_time: settings.closeTime,
      languages: settings.languages,
      whatsapp_number: settings.waNumber,
      wa_phone_number: settings.waNumber, // ← ADD THIS for routing
      instagram_handle: settings.igHandle,
      business_email: settings.busEmail,
      is_active: true, // ← ADD THIS
      meta_waba_id: settings.metaWabaId,
      meta_phone_id: settings.metaPhoneId,
      meta_access_token: settings.metaAccessToken,
      menu_items: settings.menuItems,
      business_category: settings.businessCategory || 'general',
      primary_goal: settings.primaryGoal || 'general'
    });
  if (error) throw error;
  return data;
}

// Load bot settings
async function getBotSettings(userId) {
  if (!db) return null;
  const { data, error } = await db
    .from('bot_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data;
}

// ─── FAQ FUNCTIONS ───

// Load all FAQs for user
async function getFaqs(userId) {
  if (!db) return [];
  const { data, error } = await db
    .from('faqs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Add new FAQ
async function addFaq(userId, question, answer) {
  if (!db) throw new Error("Supabase is not configured.");
  const { data, error } = await db
    .from('faqs')
    .insert({ user_id: userId, question, answer });
  if (error) throw error;
  return data;
}

// Update existing FAQ
async function updateFaq(faqId, question, answer) {
  if (!db) throw new Error("Supabase is not configured.");
  const { data, error } = await db
    .from('faqs')
    .update({ question, answer })
    .eq('id', faqId);
  if (error) throw error;
  return data;
}

// Delete FAQ
async function deleteFaq(faqId) {
  if (!db) throw new Error("Supabase is not configured.");
  const { data, error } = await db
    .from('faqs')
    .delete()
    .eq('id', faqId);
  if (error) throw error;
  return data;
}

// ─── LEADS FUNCTIONS ───

// Save a new lead
async function saveLead(userId, name, phone, channel, message) {
  if (!db) throw new Error("Supabase is not configured.");
  const { data, error } = await db
    .from('leads')
    .insert({ user_id: userId, name, phone, channel, message });
  if (error) throw error;
  return data;
}

// Get all leads for user
async function getLeads(userId) {
  if (!db) return [];
  const { data, error } = await db
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── DASHBOARD ANALYTICS FUNCTIONS ───

// Fetch stats for dashboard
async function getDashboardStats(userId) {
  if (!db) return { replies: 0, leads: 0, inbound: 0, avgTime: '2.1s', satisfaction: '98%' };
  
  // Get leads count
  const { count: leadsCount } = await db
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
    
  // Get whatsapp replies count
  const { count: repliesCount } = await db
    .from('whatsapp_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('direction', 'outbound');
    
  // Get inbound messages count
  const { count: inboundCount } = await db
    .from('whatsapp_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('direction', 'inbound');

  return {
    replies: repliesCount || 0,
    leads: leadsCount || 0,
    inbound: inboundCount || 0,
    avgTime: '1.4s', // Mocked generic stat
    satisfaction: '99%' // Mocked generic stat
  };
}

// ─── TEAM MEMBERS FUNCTIONS ───

async function getTeamMembers(userId) {
  if (!db) return [];
  const { data, error } = await db
    .from('team_members')
    .select('*')
    .eq('owner_id', userId)
    .order('invited_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function inviteTeamMember(userId, email, role) {
  if (!db) throw new Error("Supabase is not configured.");
  const { data, error } = await db
    .from('team_members')
    .insert({ owner_id: userId, member_email: email, role });
  if (error) throw error;
  return data;
}

async function removeTeamMember(inviteId) {
  if (!db) throw new Error("Supabase is not configured.");
  const { data, error } = await db
    .from('team_members')
    .delete()
    .eq('id', inviteId);
  if (error) throw error;
  return data;
}

// ─── INBOX FUNCTIONS ───

async function getInboxContacts(userId) {
  if (!db) return [];
  // Get unique numbers from whatsapp_logs
  const { data, error } = await db
    .from('whatsapp_logs')
    .select('from_number, to_number, created_at, message_body')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  
  // Group by unique contact
  const contactsMap = new Map();
  for (const log of data || []) {
    // If we sent it, to_number is the contact. If received, from_number is the contact.
    // For simplicity, we just look at from_number for inbound, to_number for outbound.
    // Wait, the webhook saves: inbound -> from_number = customer. outbound -> to_number = customer.
    // So the customer number is always the one that isn't the bot's number.
    // Actually, webhook saves outbound with to_number = customer. Inbound with from_number = customer.
    // It's easier if we just fetch leads to get customer names, then join logs. 
    // But let's do a simple grouping.
    const isOutbound = log.direction === 'outbound';
    const contactNumber = isOutbound ? log.to_number : log.from_number;
    
    if (!contactsMap.has(contactNumber)) {
      contactsMap.set(contactNumber, {
        phone: contactNumber,
        lastMessage: log.message_body || log.ai_reply || 'Media message',
        lastTime: log.created_at
      });
    }
  }
  return Array.from(contactsMap.values());
}
// ─── BROADCAST & SIMULATOR FUNCTIONS ───

async function sendBroadcastMessage(userId, recipients, message) {
  const { data, error } = await db.functions.invoke('twilio-broadcast', {
    body: { recipients, message, userId }
  });
  if (error) throw error;
  return data;
}

async function simulateChat(userId, message, customerPhone) {
  const { data, error } = await db.functions.invoke('chat-simulator', {
    body: { userId, message, customerPhone }
  });
  if (error) throw error;
  return data;
}
async function getChatHistory(userId, contactPhone) {
  if (!db) return [];
  const { data, error } = await db
    .from('whatsapp_logs')
    .select('*')
    .eq('user_id', userId)
    .or(`from_number.eq.${contactPhone},to_number.eq.${contactPhone}`)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function sendWhatsAppMessage(toPhone, message) {
  const { data, error } = await db.functions.invoke('send-whatsapp', {
    body: { to_number: toPhone, message_body: message }
  });
  if (error) throw error;
  return data;
}

// ─── CRM FUNCTIONS ───

async function getAppointments(userId) {
  if (!db) return [];
  const { data, error } = await db
    .from('appointments')
    .select('*')
    .eq('user_id', userId)
    .order('appointment_date', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getLeadsCRM(userId) {
  if (!db) return [];
  const { data, error } = await db
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── BILLING FUNCTIONS ───

async function upgradeUserPlan(userId, newPlan) {
  if (!db) throw new Error("Supabase is not configured.");
  const { data, error } = await db
    .from('users')
    .update({ plan: newPlan })
    .eq('id', userId);
  if (error) throw error;
  return data;
}

// ─── ANALYTICS FUNCTIONS ───

async function getAnalyticsData(userId) {
  if (!db) return { logs: [], leadsCount: 0 };
  
  // Get logs from last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: logs, error: logsError } = await db
    .from('whatsapp_logs')
    .select('direction, created_at')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo.toISOString());
    
  if (logsError) throw logsError;
  
  // Get total leads
  const { count, error: leadsError } = await db
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
    
  if (leadsError) throw leadsError;
  
  return { logs: logs || [], leadsCount: count || 0 };
}
