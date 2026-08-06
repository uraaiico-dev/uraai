import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the user ID from the Auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { toPhone, messageBody } = await req.json();
    if (!toPhone || !messageBody) throw new Error("Missing parameters");

    // 1. Fetch the user's bot settings (to get the Meta Token)
    const { data: botSettings, error: botError } = await supabase
      .from("bot_settings")
      .select("meta_phone_id, meta_access_token")
      .eq("user_id", user.id)
      .single();

    if (botError || !botSettings || !botSettings.meta_access_token) {
      throw new Error("No active Meta connection found");
    }

    // 2. Call Meta Graph API
    const url = `https://graph.facebook.com/v19.0/${botSettings.meta_phone_id}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone,
      type: "text",
      text: { body: messageBody }
    };

    const metaRes = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${botSettings.meta_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error("[META API ERROR]", errText);
      throw new Error(`Meta API Error: ${errText}`);
    }

    // 3. Log to whatsapp_logs as outbound
    await supabase.from("whatsapp_logs").insert({
      user_id: user.id,
      direction: "outbound",
      from_number: botSettings.meta_phone_id,
      to_number: toPhone,
      message_body: messageBody,
      ai_reply: null,
      status: "sent"
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
