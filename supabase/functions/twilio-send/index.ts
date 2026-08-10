import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, message } = await req.json();
    
    if (!to || !message) {
      return new Response(JSON.stringify({ error: "Missing to or message parameter" }), {
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

    const fromNumber = `whatsapp:${botSettings.wa_phone_number.replace('whatsapp:', '')}`;
    const toNumber = `whatsapp:${to.replace('whatsapp:', '')}`;

    // Send via Twilio
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    const data = new URLSearchParams();
    data.append("To", toNumber);
    data.append("From", fromNumber);
    data.append("Body", message);

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

    if (!twilioRes.ok) {
      const errorText = await twilioRes.text();
      console.error("[TWILIO ERROR]", errorText);
      return new Response(JSON.stringify({ error: "Twilio API error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Save outbound log to database
    await supabase.from("whatsapp_logs").insert({
      user_id: userId,
      direction: "outbound",
      from_number: botSettings.wa_phone_number.replace('whatsapp:', ''),
      to_number: to.replace('whatsapp:', ''),
      message_body: message,
      ai_reply: "",
      status: "sent"
    });

    return new Response(JSON.stringify({ success: true }), {
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
