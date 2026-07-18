import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const config = {
  auth: false,
};

// ─── PLAN REPLY LIMITS ───
const PLAN_LIMITS: Record<string, number> = {
  starter: 50,
  pro: Infinity,
  max: Infinity,
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // ─── 1. Parse incoming Twilio message ───
    const formData = await req.formData();
    const customerMessage = formData.get("Body")?.toString() || "";
    const fromNumber = formData.get("From")?.toString() || "";
    const toNumber = formData.get("To")?.toString() || "";

    console.log(`[INCOMING] From: ${fromNumber} | To: ${toNumber} | Msg: ${customerMessage}`);

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SERVICE_ROLE_KEY") || ""
    );

    // ─── 2. MULTI-TENANT ROUTING ───
    // Find which business owns the number that received this message
    // toNumber from Twilio looks like "whatsapp:+14155238886"
    // Strip the "whatsapp:" prefix for matching
    const cleanToNumber = toNumber.replace("whatsapp:", "").trim();

    let botSettings: any = null;
    let userData: any = null;

    // First try: match by wa_phone_number in bot_settings
    const { data: botByNumber } = await supabase
      .from("bot_settings")
      .select("*")
      .eq("wa_phone_number", cleanToNumber)
      .eq("is_active", true)
      .single();

    if (botByNumber) {
      // Found exact match by phone number — production flow
      botSettings = botByNumber;
      console.log(`[ROUTING] Matched business by phone number: ${cleanToNumber}`);
    } else {
      // Fallback: also try matching with "whatsapp:" prefix
      const { data: botByFullNumber } = await supabase
        .from("bot_settings")
        .select("*")
        .eq("wa_phone_number", toNumber)
        .eq("is_active", true)
        .single();

      if (botByFullNumber) {
        botSettings = botByFullNumber;
        console.log(`[ROUTING] Matched business by full number: ${toNumber}`);
      } else {
        // SANDBOX FALLBACK: during development, route to most recently
        // updated active bot. Remove this block in production.
        console.log(`[ROUTING] No exact match for ${toNumber} — using sandbox fallback`);
        const { data: sandboxBot } = await supabase
          .from("bot_settings")
          .select("*")
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        botSettings = sandboxBot;
        console.log(`[ROUTING] Sandbox fallback bot: ${botSettings?.user_id}`);
      }
    }

    if (!botSettings) {
      console.error("[ROUTING] No bot found for this number — dropping message");
      return new Response("OK", { status: 200 });
    }

    // ─── 3. Load user profile and FAQs ───
    const { data: user } = await supabase
      .from("users")
      .select("id, business_name, plan, broadcast_count_this_month")
      .eq("id", botSettings.user_id)
      .single();

    const { data: faqData } = await supabase
      .from("faqs")
      .select("question, answer")
      .eq("user_id", botSettings.user_id);

    userData = user;
    const business_name = userData?.business_name || "this business";
    const plan = userData?.plan || "starter";
    const faqs = faqData || [];
    const user_id = botSettings.user_id;

    // ─── 4. Check reply usage limits ───
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
      // Send a polite limit message
      const limitMsg = `Hi! ${business_name}'s free reply quota for this month has been reached. Please contact us directly for assistance.`;
      await sendTwilioMessage(fromNumber, toNumber, limitMsg);
      return new Response("OK", { status: 200 });
    }

    // ─── 5. Check business hours (IST) ───
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

    console.log(`[HOURS] IST: ${currentTimeStr} | Open: ${open_time} | Closed: ${isClosed}`);

    // ─── 6. Generate AI reply ───
    let replyMessage = "";

    if (isClosed) {
      replyMessage = `We're currently closed. We open at ${open_time}. Please message us then!`;
    } else {
      const faqText = faqs.length > 0
        ? faqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
        : "No FAQs configured yet.";

      const systemPrompt = `You are a customer service assistant for ${business_name}.
You can ONLY answer questions about this specific business.
Business hours: ${open_time} to ${close_time}.
FAQs:
${faqText}
Language: Reply in ${languages?.join(", ") || "English"} only.
Keep replies concise and helpful.
If asked anything unrelated to ${business_name}, politely decline and suggest contacting the business directly.`;

      const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiApiKey || "",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt + "\n\nCustomer: " + customerMessage }] }],
          }),
        }
      );

      const geminiData = await geminiResponse.json();
      console.log(`[GEMINI] Status: ${geminiResponse.status}`);
      replyMessage =
        geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry, I couldn't understand that. Please contact us directly.";
      console.log(`[GEMINI] Reply: ${replyMessage}`);
    }

    // ─── 7. Send reply via Twilio ───
    const twilioOk = await sendTwilioMessage(fromNumber, toNumber, replyMessage);

    // ─── 8. Increment reply counter ───
    if (twilioOk) {
      await supabase
        .from("bot_settings")
        .update({ reply_count_this_month: currentReplyCount + 1 })
        .eq("user_id", user_id);
    }

    // ─── 9. Save to whatsapp_logs ───
    await supabase.from("whatsapp_logs").insert({
      user_id,
      direction: "inbound",
      from_number: fromNumber,
      to_number: toNumber,
      message_body: customerMessage,
      ai_reply: replyMessage,
      status: twilioOk ? "replied" : "failed",
    });

    // ─── 10. Save lead if new ───
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", user_id)
      .eq("phone", fromNumber)
      .maybeSingle();

    if (!existingLead) {
      await supabase.from("leads").insert({
        user_id,
        name: "Unknown (WhatsApp)",
        phone: fromNumber,
        channel: "whatsapp",
        message: customerMessage,
      });
      console.log(`[LEAD] New lead saved: ${fromNumber}`);
    }

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("[ERROR] Webhook crashed:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

// ─── HELPER: Send Twilio message ───
async function sendTwilioMessage(to: string, from: string, body: string): Promise<boolean> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");

  const data = new URLSearchParams();
  data.append("To", to);
  data.append("From", from);
  data.append("Body", body);

  const response = await fetch(
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

  console.log(`[TWILIO] Send status: ${response.status}`);
  if (!response.ok) {
    console.error("[TWILIO] Error:", await response.text());
  }
  return response.ok;
}
