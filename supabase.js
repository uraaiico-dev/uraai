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
      is_active: true // ← ADD THIS
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
