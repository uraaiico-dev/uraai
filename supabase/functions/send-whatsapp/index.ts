import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Add cors headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
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

    // Initialize Supabase Client (using service key for admin privileges)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify user and get plan details
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("plan, broadcast_count_this_month")
      .eq("id", user_id)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not found" }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Check plan limits
    const plan = user.plan || "starter";
    const broadcastCount = user.broadcast_count_this_month || 0;

    if (plan === "starter") {
      return new Response(JSON.stringify({ error: "Broadcasts not allowed on Starter plan" }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else if (plan === "pro" && broadcastCount >= 50) {
      return new Response(JSON.stringify({ error: "Pro plan broadcast limit (50) reached for this month" }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    // Max plan has no limits

    // 3. Send message via Twilio API
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_SANDBOX_NUMBER"); // Usually whatsapp:+14155238886

    const twilioData = new URLSearchParams();
    twilioData.append("To", to_number);
    twilioData.append("From", fromNumber || "whatsapp:+14155238886");
    twilioData.append("Body", message_body);

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        },
        body: twilioData,
      }
    );

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error("Twilio Error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to send WhatsApp message" }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Log to whatsapp_logs table
    await supabase.from("whatsapp_logs").insert({
      user_id: user_id,
      direction: "outbound",
      from_number: fromNumber,
      to_number: to_number,
      message_body: message_body,
      status: "replied", // or 'sent'
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
