import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const config = {
  auth: false,
};

const PLAN_LIMITS: Record<string, number> = {
  starter: 50,
  pro: Infinity,
  max: Infinity,
};

serve(async (req) => {
  // ─── 1. Handle Webhook Verification (GET) ───
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // We can use SUPABASE_URL as a fallback verify token if META_WEBHOOK_VERIFY_TOKEN is missing
    const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || Deno.env.get("SUPABASE_URL") || "uraai_secret";

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Webhook verified!");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // ─── 2. Parse incoming Meta Webhook ───
    const body = await req.json();

    // Check if it's a WhatsApp status update (message read, delivered, etc)
    if (!body.entry?.[0]?.changes?.[0]?.value?.messages) {
      return new Response("OK", { status: 200 }); // Acknowledge status updates but ignore them
    }

    const value = body.entry[0].changes[0].value;
    const messageObj = value.messages[0];
    
    // Only handle text messages for now
    if (messageObj.type !== 'text') {
      return new Response("OK", { status: 200 });
    }

    const customerMessage = messageObj.text.body;
    const fromNumber = messageObj.from;
    const toNumber = value.metadata.display_phone_number;
    const phoneNumberId = value.metadata.phone_number_id;

    console.log(`[META INCOMING] From: ${fromNumber} | To: ${toNumber} | Msg: ${customerMessage}`);

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SERVICE_ROLE_KEY") || ""
    );

    // ─── 3. MULTI-TENANT ROUTING ───
    // Find which business owns the number that received this message
    const { data: botSettings, error: routingError } = await supabase
      .from("bot_settings")
      .select("*")
      .eq("meta_phone_id", phoneNumberId)
      .eq("is_active", true)
      .single();

    if (!botSettings || routingError) {
      console.error(`[ROUTING] No bot found for Meta Phone ID ${phoneNumberId} — dropping message`);
      return new Response("OK", { status: 200 });
    }

    // ─── 4. Load user profile and FAQs ───
    const { data: user } = await supabase
      .from("users")
      .select("id, business_name, plan, broadcast_count_this_month")
      .eq("id", botSettings.user_id)
      .single();

    const { data: faqData } = await supabase
      .from("faqs")
      .select("question, answer")
      .eq("user_id", botSettings.user_id);

    const business_name = user?.business_name || "this business";
    const plan = user?.plan || "starter";
    const faqs = faqData || [];
    const user_id = botSettings.user_id;

    // ─── 5. Check reply usage limits ───
    const monthlyLimit = PLAN_LIMITS[plan] ?? 50;
    const currentReplyCount = botSettings.reply_count_this_month || 0;
    const resetDate = botSettings.reply_reset_date;
    const today = new Date().toISOString().split("T")[0];

    // Reset counter if it's a new month
    if (resetDate && resetDate < today.substring(0, 7) + "-01") {
      await supabase
        .from("bot_settings")
        .update({ reply_count_this_month: 0, reply_reset_date: today })
        .eq("user_id", user_id);
      botSettings.reply_count_this_month = 0;
    }

    if (monthlyLimit !== Infinity && currentReplyCount >= monthlyLimit) {
      console.log(`[LIMIT] User ${user_id} hit ${plan} plan limit of ${monthlyLimit} replies`);
      const limitMsg = `Hi! ${business_name}'s free reply quota for this month has been reached. Please contact us directly for assistance.`;
      await sendMetaMessage(fromNumber, phoneNumberId, botSettings.meta_access_token, limitMsg);
      return new Response("OK", { status: 200 });
    }

    // ─── 6. Check business hours (IST) ───
    const { open_time, close_time, languages } = botSettings;
    let isClosed = false;
    let currentTimeStr = "N/A";

    function parseTimeTo24h(timeStr: string): string {
      if (!timeStr) return "00:00";
      const [time, modifier] = timeStr.split(" ");
      if (!time || !modifier) return "00:00";
      let [hoursStr, minutesStr] = time.split(":");
      let hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr || "0", 10);
      if (modifier === "PM" && hours !== 12) hours += 12;
      if (modifier === "AM" && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    }

    if (open_time && close_time) {
      const istTime = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      currentTimeStr = `${istTime.getUTCHours().toString().padStart(2, "0")}:${istTime.getUTCMinutes().toString().padStart(2, "0")}`;
      const open24 = parseTimeTo24h(open_time);
      const close24 = parseTimeTo24h(close_time);
      isClosed = currentTimeStr < open24 || currentTimeStr > close24;
    }

    // ─── 7. Generate AI reply ───
    let replyMessage = "";

    if (isClosed) {
      replyMessage = `We're currently closed. We open at ${open_time}. Please message us then!`;
    } else {
      const knowledgeBase = botSettings.business_knowledge
        || (faqData && faqData.length > 0
          ? faqData.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
          : 'No business information set up yet. Please complete AI Setup.');

      const systemPrompt = `You are a highly intelligent, professional, and friendly WhatsApp sales assistant for ${business_name}.
EVERYTHING YOU KNOW ABOUT THIS BUSINESS:
${knowledgeBase}

YOUR ADVANCED RULES:
1. FOCUS: ONLY answer questions about ${business_name}. If the user asks about politics, religion, completely unrelated topics, or uses abusive language, politely state that you are only here to help with ${business_name} and stop engaging in the unrelated topic.
2. LANGUAGE: Reply in ${languages?.join(', ') || 'English'} — perfectly match the customer's language and tone.
3. FORMATTING: Format your messages exactly like a human texts on WhatsApp. Use short paragraphs, use *bold* text for emphasis, and use emojis naturally. Keep it conversational and do not sound like a robot reading an essay.
4. HONESTY: NEVER make up prices, timings, or services not explicitly mentioned in your knowledge base. If you don't know something, say 'Please contact us directly for this'.
5. SALES DRIVEN: If the customer is asking about prices or availability for a service, do not just give them the price and end the conversation. Always end with an engaging question to keep them talking, like 'Would you like me to check our availability for that?'
6. MISSING INFO: If a customer says 'I want to book' but does not tell you the time or date, do NOT use the <BOOKING> tag yet. Reply politely and ask them what day and time works best for them.
7. IMPORTANT BOOKING RULE: ONLY when the user has provided a clear date, time, and service for an appointment that aligns with the business hours and knowledge, you MUST secretly include a booking tag at the very end of your response exactly like this: <BOOKING date="YYYY-MM-DD" time="HH:MM" service="Service Name">`;

      const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt + "\n\nCustomer: " + customerMessage }] }],
          }),
        }
      );

      const geminiData = await geminiResponse.json();
      replyMessage =
        geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry, I couldn't understand that. Please contact us directly.";
    }

    // ─── 7b. Parse Booking Tags ───
    let bookingMatch = replyMessage.match(/<BOOKING\s+date="([^"]+)"\s+time="([^"]+)"\s+service="([^"]+)">/);
    if (bookingMatch) {
      const bDate = bookingMatch[1];
      const bTime = bookingMatch[2];
      const bService = bookingMatch[3];
      replyMessage = replyMessage.replace(bookingMatch[0], '').trim();
      
      await supabase.from('appointments').insert({
        user_id: user_id,
        customer_phone: fromNumber,
        service: bService,
        appointment_date: `${bDate} ${bTime}`
      });
    }

    // ─── 8. Send reply via Meta Graph API ───
    const metaOk = await sendMetaMessage(fromNumber, phoneNumberId, botSettings.meta_access_token, replyMessage);

    // ─── 9. Increment reply counter ───
    if (metaOk) {
      await supabase
        .from("bot_settings")
        .update({ reply_count_this_month: currentReplyCount + 1 })
        .eq("user_id", user_id);
    }

    // ─── 10. Save to whatsapp_logs table ───
    await supabase.from("whatsapp_logs").insert({
      user_id: user_id,
      direction: "inbound",
      from_number: fromNumber,
      to_number: toNumber,
      message_body: customerMessage,
      ai_reply: replyMessage,
      status: metaOk ? "replied" : "failed",
    });

    // ─── 11. Save customer as lead ───
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", user_id)
      .eq("phone", fromNumber)
      .maybeSingle();

    if (!existingLead) {
      await supabase.from("leads").insert({
        user_id: user_id,
        name: "Unknown (WhatsApp)",
        phone: fromNumber,
        channel: "whatsapp",
        message: customerMessage,
      });
    }

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("[ERROR] Webhook crashed:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

// ─── HELPER: Send Meta message ───
async function sendMetaMessage(to: string, phoneNumberId: string, accessToken: string, body: string): Promise<boolean> {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "text",
    text: { body: body }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error("[META] Error sending:", await response.text());
  }
  return response.ok;
}
