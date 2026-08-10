import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { recipients, message } = await req.json();
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0 || !message) {
      return new Response(JSON.stringify({ error: "Missing recipients array or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY") || "";

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: authUser }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized caller" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const userId = authUser.id;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the bot settings for this user to get the 'from' number
    const { data: botSettings } = await supabase
      .from("bot_settings")
      .select("wa_phone_number")
      .eq("user_id", userId)
      .single();

    if (!botSettings || !botSettings.wa_phone_number) {
      return new Response(JSON.stringify({ error: "No active WhatsApp number configured for this user." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Load user limits
    const { data: user } = await supabase
      .from("users")
      .select("plan, subscription_end_date, broadcast_count_this_month, broadcast_reset_date")
      .eq("id", userId)
      .single();

    let plan = user?.plan || "starter";
    
    // Check subscription expiration
    if (user?.subscription_end_date) {
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
    let currentCount = user?.broadcast_count_this_month || 0;
    const resetDate = user?.broadcast_reset_date;
    const today = new Date().toISOString().split("T")[0];

    if (resetDate && resetDate < today.substring(0, 7) + "-01") {
      currentCount = 0;
    }

    if (currentCount + recipients.length > limit) {
      return new Response(JSON.stringify({ error: `Broadcast limit exceeded. Your ${plan} plan allows ${limit} messages/month. You have ${limit - currentCount} remaining.` }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const fromNumber = `whatsapp:${botSettings.wa_phone_number.replace('whatsapp:', '')}`;
    
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    
    let successCount = 0;
    let failCount = 0;

    for (const to of recipients) {
      const toNumber = `whatsapp:${to.replace('whatsapp:', '')}`;
      const data = new URLSearchParams();
      data.append("To", toNumber);
      data.append("From", fromNumber);
      data.append("Body", message);

      try {
        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
            },
            body: data,
          }
        );

        if (twilioRes.ok) {
          successCount++;
          // Save outbound log
          await supabase.from("whatsapp_logs").insert({
            user_id: userId,
            direction: "outbound",
            from_number: botSettings.wa_phone_number.replace('whatsapp:', ''),
            to_number: to.replace('whatsapp:', ''),
            message_body: message,
            ai_reply: "",
            status: "sent"
          });
        } else {
          failCount++;
        }
      } catch (err) {
        console.error("Broadcast failed for", to, err);
        failCount++;
      }
    }

    if (successCount > 0) {
      await supabase
        .from('users')
        .update({
          broadcast_count_this_month: currentCount + successCount,
          broadcast_reset_date: today
        })
        .eq('id', userId);
    }

    return new Response(JSON.stringify({ success: true, successCount, failCount }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
