import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { access_token, user_id } = await req.json();

    if (!access_token || !user_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get WABA ID from Meta
    const wabaResponse = await fetch(`https://graph.facebook.com/v19.0/me/client_whatsapp_business_accounts?access_token=${access_token}`);
    const wabaData = await wabaResponse.json();

    if (!wabaResponse.ok || !wabaData.data || wabaData.data.length === 0) {
      console.error("WABA fetch error:", wabaData);
      return new Response(JSON.stringify({ error: "Could not find WhatsApp Business Account" }), { status: 400, headers: corsHeaders });
    }

    const wabaId = wabaData.data[0].id;

    // 2. Get Phone Number ID from Meta
    const phoneResponse = await fetch(`https://graph.facebook.com/v19.0/${wabaId}/phone_numbers?access_token=${access_token}`);
    const phoneData = await phoneResponse.json();

    if (!phoneResponse.ok || !phoneData.data || phoneData.data.length === 0) {
      console.error("Phone fetch error:", phoneData);
      return new Response(JSON.stringify({ error: "Could not find Phone Number for WABA" }), { status: 400, headers: corsHeaders });
    }

    const phoneNumberId = phoneData.data[0].id;
    const displayPhoneNumber = phoneData.data[0].display_phone_number;

    // 2.5 Register Phone Number on Meta Cloud API (creates Cloud API account if not yet registered)
    try {
      const regResponse = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          pin: '123456'
        })
      });
      const regData = await regResponse.json();
      console.log("Cloud API /register response:", regData);
    } catch (regErr) {
      console.error("Cloud API /register fetch error:", regErr);
    }

    // 3. Save to bot_settings
    await supabase
      .from('bot_settings')
      .update({
        meta_waba_id: wabaId,
        meta_phone_id: phoneNumberId,
        meta_access_token: access_token,
        wa_phone_number: displayPhoneNumber
      })
      .eq('user_id', user_id);

    // 4. Update users table
    await supabase
      .from('users')
      .update({
        wa_access_token: access_token,
        wa_connected: true,
        wa_phone_number: displayPhoneNumber
      })
      .eq('id', user_id);

    return new Response(JSON.stringify({ success: true, wabaId, phoneNumberId }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
