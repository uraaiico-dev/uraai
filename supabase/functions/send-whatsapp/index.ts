import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to_number, message_body, user_id } = await req.json();

    if (!to_number || !message_body || !user_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify user, get plan details AND bot settings (for Meta tokens)
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("plan, subscription_end_date, broadcast_count_this_month")
      .eq("id", user_id)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not found" }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: botSettings, error: botError } = await supabase
      .from("bot_settings")
      .select("meta_phone_id, meta_access_token, wa_phone_number")
      .eq("user_id", user_id)
      .single();

    if (botError || !botSettings || !botSettings.meta_phone_id || !botSettings.meta_access_token) {
      return new Response(JSON.stringify({ error: "Meta WhatsApp not configured for this user" }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Check plan limits & subscription expiration
    let plan = user.plan || "starter";
    if (user.subscription_end_date) {
      const subEnd = new Date(user.subscription_end_date);
      if (new Date() > subEnd) {
        plan = "starter";
      }
    }

    const BROADCAST_LIMITS: Record<string, number> = {
      starter: 0,
      pro: 500,
      max: 5000,
    };

    const limit = BROADCAST_LIMITS[plan] ?? 0;
    const broadcastCount = user.broadcast_count_this_month || 0;

    if (plan === "starter" || limit === 0) {
      return new Response(JSON.stringify({ error: "Broadcasts not allowed on Starter plan" }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else if (broadcastCount >= limit) {
      return new Response(JSON.stringify({ error: `Your ${plan.toUpperCase()} plan broadcast limit (${limit}) reached for this month` }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Send message via Meta Graph API
    const phoneNumberId = botSettings.meta_phone_id;
    const accessToken = botSettings.meta_access_token;
    
    // Clean to_number in case it has whatsapp: prefix
    const cleanToNumber = to_number.replace("whatsapp:", "").trim();

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanToNumber,
      type: "text",
      text: { body: message_body }
    };

    const metaResponse = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!metaResponse.ok) {
      const errorText = await metaResponse.text();
      console.error("Meta Error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to send WhatsApp message" }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Log to whatsapp_logs table
    await supabase.from("whatsapp_logs").insert({
      user_id: user_id,
      direction: "outbound",
      from_number: botSettings.wa_phone_number || phoneNumberId,
      to_number: cleanToNumber,
      message_body: message_body,
      status: "replied", 
    });

    // 5. Increment broadcast_count_this_month
    await supabase
      .from("users")
      .update({ broadcast_count_this_month: broadcastCount + 1 })
      .eq("id", user_id);

    return new Response(JSON.stringify({ success: true }), { 
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
