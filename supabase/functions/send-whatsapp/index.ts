import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK_META_TOKEN = "EAAXODwREZCUIBSY9NYtXAUSOzOLnNvZClZA3PerQBg3vLPBovDkqPrJLjwLKLZCc19CwVXwZA0MFJ6LlfGzP7A2bRYjLd9zuLBWAvtCu7gJUq7pd8IdHXbKJeV3a23aPsmwZCbm6meU0XN3xHYV9Fq2akGYLi3qVNDJEK7IwGZCrc9x9CJoNN3zLAlqTZA8IdqgjXgZDZD";

serve(async (req) => {
  const method = (req.method || "").toUpperCase();

  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. Meta Webhook Verification (GET)
  if (method === 'GET') {
    try {
      const u = new URL(req.url, "https://uraai.in");
      const challenge = u.searchParams.get("hub.challenge") || u.searchParams.get("challenge") || "SUCCESS123";
      console.log("[META GET VERIFY] Challenge:", challenge);
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain", ...corsHeaders }
      });
    } catch (_e) {
      return new Response("SUCCESS123", {
        status: 200,
        headers: { "Content-Type": "text/plain", ...corsHeaders }
      });
    }
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let customerMessage = "";
    let fromNumber = "";
    let toNumber = "";
    let phoneNumberId = "";

    // 2. Handle Meta JSON Webhook POST
    if (contentType.includes("application/json") || method === 'POST') {
      const rawBody = await req.text();
      let body: any = {};
      try {
        body = JSON.parse(rawBody || "{}");
        if (typeof body === "string") {
          body = JSON.parse(body);
        }
      } catch (_e) {
        body = {};
      }

      console.log("[DEBUG POST WEBHOOK BODY]", JSON.stringify(body));

      if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
        const value = body.entry[0].changes[0].value;
        const messageObj = value.messages[0];

        if (messageObj.type !== 'text' && messageObj.type !== 'interactive') {
          return new Response("OK", { status: 200, headers: corsHeaders });
        }

        fromNumber = messageObj.from || "";
        customerMessage = messageObj.text?.body || messageObj.interactive?.button_reply?.title || "Hello";
        toNumber = value.metadata?.display_phone_number || "";
        phoneNumberId = value.metadata?.phone_number_id || "";

        console.log(`[INCOMING] From: ${fromNumber} | To: ${toNumber} | Msg: ${customerMessage}`);

        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://fmqgxctgowrpepbnccwq.supabase.co";
        const fallbackKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcWd4Y3Rnb3dycGVwYm5jY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDg5ODQsImV4cCI6MjA5ODEyNDk4NH0.jUepygo2S74_1csPoqsgfEPvr1osG5_KCk7uC-PzkR8";
        const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || fallbackKey;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        let botSettings: any = null;
        try {
          if (phoneNumberId) {
            const { data } = await supabase
              .from("bot_settings")
              .select("*")
              .eq("meta_phone_id", String(phoneNumberId))
              .limit(1);
            if (data && data.length > 0) botSettings = data[0];
          }
          if (!botSettings) {
            const { data } = await supabase
              .from("bot_settings")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(1);
            if (data && data.length > 0) botSettings = data[0];
          }
        } catch (dbErr) {
          console.error("[DB ROUTING ERROR]", dbErr);
        }

        if (!botSettings) {
          console.error(`[ROUTING] No bot found for message`);
          return new Response("OK", { status: 200, headers: corsHeaders });
        }

        let business_name = "Slam Gym";
        let faqs: any[] = [];
        try {
          const { data: user } = await supabase
            .from("users")
            .select("business_name")
            .eq("id", botSettings.user_id)
            .maybeSingle();
          if (user?.business_name) business_name = user.business_name;

          const { data: faqData } = await supabase
            .from("faqs")
            .select("question, answer")
            .eq("user_id", botSettings.user_id);
          if (faqData) faqs = faqData;
        } catch (dbErr2) {
          console.error("[DB USER/FAQ ERROR]", dbErr2);
        }

        const knowledgeBase = faqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n") || botSettings.welcome_message || "We offer gym memberships, personal training, and workout facilities.";

        const systemPrompt = `You are a friendly WhatsApp AI sales assistant for ${business_name}. Help customers with prices, timings, and memberships based on this knowledge:\n${knowledgeBase}`;

        const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
        let replyMessage = "";

        if (geminiApiKey) {
          try {
            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: systemPrompt + "\n\nCustomer: " + customerMessage }] }],
                }),
              }
            );
            const gData = await geminiRes.json();
            replyMessage = gData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          } catch (e) {
            console.error("Gemini API error:", e);
          }
        }

        if (!replyMessage) {
          replyMessage = `வணக்கம்! Welcome to ${business_name}. How can we help you today?`;
        }

        // Send Meta Graph API reply if token exists
        const pId = (botSettings && botSettings.meta_phone_id) || phoneNumberId;
        const cleanToken = (botSettings && botSettings.meta_access_token && botSettings.meta_access_token.trim()) ? botSettings.meta_access_token.trim() : FALLBACK_META_TOKEN;
        const cleanToNumber = fromNumber.replace(/[^0-9]/g, "");

        if (cleanToken && pId && cleanToNumber) {
          try {
            console.log(`[SENDING META MESSAGE] To: ${cleanToNumber} via PhoneId: ${pId}`);
            const metaRes = await fetch(`https://graph.facebook.com/v20.0/${pId}/messages`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${cleanToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: cleanToNumber,
                type: "text",
                text: { body: replyMessage }
              }),
            });
            const metaResText = await metaRes.text();
            console.log("[META GRAPH API REPLY STATUS]", metaRes.status, metaResText);
          } catch (mErr) {
            console.error("[META FETCH ERROR]", mErr);
          }
        } else {
          console.warn("[WARNING] Missing meta_access_token, meta_phone_id, or valid recipient number!", {
            token_present: !!cleanToken,
            pId,
            cleanToNumber
          });
        }

        try {
          await supabase.from("whatsapp_logs").insert({
            user_id: botSettings.user_id,
            direction: "inbound",
            from_number: fromNumber,
            to_number: toNumber,
            message_body: customerMessage,
            ai_reply: replyMessage,
            status: "replied",
          });
        } catch (dbLogErr) {
          console.error("[DB LOG ERROR]", dbLogErr);
        }

        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // 3. Outbound UI Broadcast message handling
      const { to_number, message_body } = body;
      if (!to_number || !message_body) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { 
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

      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://fmqgxctgowrpepbnccwq.supabase.co";
      const fallbackKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcWd4Y3Rnb3dycGVwYm5jY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDg5ODQsImV4cCI6MjA5ODEyNDk4NH0.jUepygo2S74_1csPoqsgfEPvr1osG5_KCk7uC-PzkR8";
      const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || fallbackKey;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Verify JWT
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Fetch Bot Settings
      const { data: botSettings, error: botError } = await supabase
        .from("bot_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (botError || !botSettings || !botSettings.meta_access_token) {
        return new Response(JSON.stringify({ error: "WhatsApp integration not configured" }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Send WhatsApp message via Meta Graph API
      const metaRes = await fetch(
        `https://graph.facebook.com/v20.0/${botSettings.meta_phone_id}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${botSettings.meta_access_token.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: to_number.replace(/[^0-9]/g, ""),
            type: "text",
            text: { body: message_body }
          }),
        }
      );

      const metaData = await metaRes.json();
      if (!metaRes.ok) {
        console.error("Meta API error:", metaData);
        return new Response(JSON.stringify({ error: metaData.error?.message || "Failed to send WhatsApp message" }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Log outbound message
      await supabase.from("whatsapp_logs").insert({
        user_id: user.id,
        direction: "outbound",
        from_number: botSettings.whatsapp_number,
        to_number: to_number,
        message_body: message_body,
        status: "sent",
      });

      return new Response(JSON.stringify({ status: "success", message_id: metaData.messages?.[0]?.id }), { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response("OK", { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error("[ERROR] send-whatsapp:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
