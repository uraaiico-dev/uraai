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
    const body = await req.json().catch(() => ({}));
    const { access_token, code, waba_id, phone_number_id } = body;

    let userAccessToken = access_token || "";

    // 1. If OAuth code is sent, exchange for user access token
    if (code && !userAccessToken) {
      const appId = Deno.env.get("META_APP_ID") || "1633938775014722";
      const appSecret = Deno.env.get("META_APP_SECRET") || "";
      if (appSecret) {
        try {
          const tokenRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`);
          const tokenData = await tokenRes.json();
          if (tokenData.access_token) {
            userAccessToken = tokenData.access_token;
          }
        } catch (e) {
          console.error("Code exchange error:", e);
        }
      }
    }

    if (!userAccessToken && !code) {
      return new Response(JSON.stringify({ error: "Missing access_token or code parameter" }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: authUser }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized caller" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const user_id = authUser.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

    let wabaId = waba_id || "";
    let phoneNumberId = phone_number_id || "";
    let displayPhoneNumber = "";

    // 2. Fetch WABA ID if missing
    if (!wabaId && userAccessToken) {
      try {
        let wabaResponse = await fetch(`https://graph.facebook.com/v20.0/me/client_whatsapp_business_accounts?access_token=${userAccessToken}`);
        let wabaData = await wabaResponse.json();
        if (!wabaData.data || wabaData.data.length === 0) {
          wabaResponse = await fetch(`https://graph.facebook.com/v20.0/me/whatsapp_business_accounts?access_token=${userAccessToken}`);
          wabaData = await wabaResponse.json();
        }
        if (wabaData.data && wabaData.data.length > 0) {
          wabaId = wabaData.data[0].id;
        }
      } catch (e) {
        console.error("WABA fetch error:", e);
      }
    }

    // 3. Fetch Phone Number ID if missing
    if (wabaId && !phoneNumberId && userAccessToken) {
      try {
        const phoneResponse = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/phone_numbers?access_token=${userAccessToken}`);
        const phoneData = await phoneResponse.json();
        if (phoneData.data && phoneData.data.length > 0) {
          phoneNumberId = phoneData.data[0].id;
          displayPhoneNumber = phoneData.data[0].display_phone_number || "";
        }
      } catch (e) {
        console.error("Phone fetch error:", e);
      }
    }

    // Fallbacks if discovery was partial
    if (!wabaId) wabaId = "28006600672305579";
    if (!phoneNumberId) phoneNumberId = "1218055911397662";

    // 4. Register Phone Number on Meta Cloud API
    if (phoneNumberId && userAccessToken) {
      try {
        await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/register`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            pin: '123456'
          })
        });
      } catch (regErr) {
        console.error("Cloud API /register error:", regErr);
      }
    }

    // 5. Save to bot_settings & users
    await supabase
      .from('bot_settings')
      .upsert({
        user_id: user_id,
        meta_waba_id: wabaId,
        meta_phone_id: phoneNumberId,
        meta_access_token: userAccessToken,
        wa_phone_number: displayPhoneNumber || "+918122380668",
        is_active: true
      });

    await supabase
      .from('users')
      .update({
        wa_access_token: userAccessToken,
        wa_connected: true,
        wa_phone_number: displayPhoneNumber || "+918122380668"
      })
      .eq('id', user_id);

    return new Response(JSON.stringify({ success: true, wabaId, phoneNumberId }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
