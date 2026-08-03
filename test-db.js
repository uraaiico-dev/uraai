const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fmqgxctgowrpepbnccwq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcWd4Y3Rnb3dycGVwYm5jY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDg5ODQsImV4cCI6MjA5ODEyNDk4NH0.jUepygo2S74_1csPoqsgfEPvr1osG5_KCk7uC-PzkR8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data: users } = await supabase.from('users').select('*');
  const { data: bots } = await supabase.from('bot_settings').select('*');
  console.log("Users:", users?.length);
  console.log("Bots:", bots?.length);
  console.log("Bot Data:", JSON.stringify(bots, null, 2));
}
check();
