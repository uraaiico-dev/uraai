import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

export const config = {
  auth: false,
};

const PLAN_LIMITS: Record<string, number> = {
  starter: 50,
  pro: 5000,
  max: 25000,
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
    // ─── 1.5. Security: HMAC-SHA256 Payload Verification ───
    const rawBody = await req.text();
    const metaSignature = req.headers.get("x-hub-signature-256");
    
    // In production, require META_APP_SECRET. Fallback for testing only.
    const appSecret = Deno.env.get("META_APP_SECRET") || "dummy_secret";
    
    if (metaSignature) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(appSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      const signatureHex = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const expectedSignature = `sha256=${signatureHex}`;
      
      if (metaSignature !== expectedSignature) {
        console.error("[SECURITY] Invalid Meta Signature");
        return new Response("Unauthorized", { status: 401 });
      }
    }

    // ─── 2. Parse incoming Meta Webhook ───
    const body = JSON.parse(rawBody);

    // Check if it's a WhatsApp status update (message read, delivered, etc)
    if (!body.entry?.[0]?.changes?.[0]?.value?.messages) {
      return new Response("OK", { status: 200 }); // Acknowledge status updates but ignore them
    }

    const value = body.entry[0].changes[0].value;
    const messageObj = value.messages[0];
    
    // Only handle text and interactive messages
    if (messageObj.type !== 'text' && messageObj.type !== 'interactive') {
      return new Response("OK", { status: 200 });
    }

    const isInteractive = messageObj.type === 'interactive';
    const customerMessage = isInteractive ? messageObj.interactive?.button_reply?.title : messageObj.text?.body;
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
      .select("id, business_name, plan, subscription_end_date, broadcast_count_this_month, wa_phone_number")
      .eq("id", botSettings.user_id)
      .single();

    const { data: faqData } = await supabase
      .from("faqs")
      .select("question, answer")
      .eq("user_id", botSettings.user_id);

    const business_name = user?.business_name || "this business";
    let plan = user?.plan || "starter";
    const faqs = faqData || [];
    const user_id = botSettings.user_id;

    // Check subscription expiration
    if (user?.subscription_end_date) {
      const subEnd = new Date(user.subscription_end_date);
      if (new Date() > subEnd) {
        console.log(`[EXPIRED] User ${user_id} subscription expired on ${subEnd.toISOString()}. Downgrading to starter limits.`);
        plan = "starter";
      }
    }

    // ─── 4b. Handle Interactive Approvals ───
    if (isInteractive) {
      const btnReply = messageObj.interactive.button_reply;
      if (btnReply && (btnReply.id.startsWith('approve_') || btnReply.id.startsWith('decline_'))) {
        const action = btnReply.id.split('_')[0]; // 'approve' or 'decline'
        const appointmentId = btnReply.id.split('_')[1];

        const status = action === 'approve' ? 'accepted' : 'declined';
        await supabase.from('appointments').update({ status }).eq('id', appointmentId);
        
        // Fetch appointment to notify customer
        const { data: appt } = await supabase.from('appointments').select('*').eq('id', appointmentId).single();
        if (appt) {
            const customerMsg = action === 'approve' 
                ? `Great news! Your appointment for ${appt.service} on ${appt.appointment_date} has been confirmed.`
                : `Sorry, we are unable to confirm your appointment for ${appt.service} on ${appt.appointment_date}. Please let us know if you'd like to reschedule.`;
            await sendMetaMessage(appt.customer_phone, phoneNumberId, botSettings.meta_access_token, customerMsg);
        }
        
        // Notify owner
        await sendMetaMessage(fromNumber, phoneNumberId, botSettings.meta_access_token, `You have ${status} the appointment.`);
        return new Response("OK", { status: 200 });
      }
    }
    // ─── 4c. Check if AI is Paused for this Customer (Human Handoff) ───
    const { data: customerLead } = await supabase
      .from("leads")
      .select("is_ai_paused")
      .eq("user_id", user_id)
      .eq("phone", fromNumber)
      .maybeSingle();

    if (customerLead?.is_ai_paused) {
      console.log(`[PAUSE BOT] AI is paused for customer ${fromNumber}. Skipping AI reply.`);
      
      // Still log the incoming message so it shows up in the Uraai Live Inbox for the human to read
      await supabase.from("whatsapp_logs").insert({
        user_id: user_id,
        direction: "inbound",
        from_number: fromNumber,
        to_number: toNumber,
        message_body: customerMessage,
        ai_reply: "[AI Paused - Human took over]",
        status: "read",
      });
      
      return new Response("OK", { status: 200 });
    }

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
      const category = botSettings.business_category || 'general';
      
      let categoryContext = "";
      if (category === 'gym') {
        categoryContext = `BUSINESS TYPE: Gym & Fitness Center.
ROLE: You are the front-desk manager. Help customers with membership plans, gym timings, trainer options, and facility visits.
GOALS & RULES:
- Never assume a free trial exists unless explicitly stated in the knowledge base. If not stated, offer a facility tour/visit or membership package details.
- If the customer agrees to a visit/tour with a clear date and time, append: <ACTION_TAG type="gym_visit" date="YYYY-MM-DD" time="HH:MM" details="Gym Tour Visit">`;
      } else if (category === 'hotel') {
        categoryContext = `BUSINESS TYPE: Hotel, Resort, or Homestay.
ROLE: You are the reservations desk. Help guests check room rates, amenities (WiFi, Pool, Parking, Breakfast), and check-in/out times.
GOALS & RULES:
- Ask for check-in/check-out dates and guest count.
- When check-in date is provided, append: <ACTION_TAG type="room_inquiry" date="YYYY-MM-DD" time="12:00" details="Room Reservation Inquiry">`;
      } else if (category === 'clinic') {
        categoryContext = `BUSINESS TYPE: Medical Clinic / Hospital / Dental Care.
ROLE: You are patient reception. Assist with doctor OPD timings, consultation fees, and appointment slots.
GOALS & RULES:
- When date/time and service/doctor are clear, append: <ACTION_TAG type="appointment" date="YYYY-MM-DD" time="HH:MM" details="Doctor Consultation">`;
      } else if (category === 'salon') {
        categoryContext = `BUSINESS TYPE: Salon & Spa.
ROLE: You are a beauty consultant. Help with haircuts, spa packages, service prices, and stylist selection.
GOALS & RULES:
- When service, date, and time are clear, append: <ACTION_TAG type="booking" date="YYYY-MM-DD" time="HH:MM" details="Service Booking">`;
      } else if (category === 'restaurant') {
        categoryContext = `BUSINESS TYPE: Restaurant / Cafe.
ROLE: You are hostess. Assist with food menu items, today's specials, and table reservations.
GOALS & RULES:
- When party size, date, and time are clear, append: <ACTION_TAG type="table_reservation" date="YYYY-MM-DD" time="HH:MM" details="Table Reservation">`;
      } else if (category === 'realestate') {
        categoryContext = `BUSINESS TYPE: Real Estate / PG / Hostel.
ROLE: You are a leasing consultant. Assist with room sharing options, monthly rent, deposit, meals, and property tour visits.
GOALS & RULES:
- When date and time for a visit are clear, append: <ACTION_TAG type="property_tour" date="YYYY-MM-DD" time="HH:MM" details="Property Visit">`;
      } else {
        categoryContext = `BUSINESS TYPE: General Business.
ROLE: Professional customer support sales assistant.
GOALS & RULES:
- When date, time, and service are clear, append: <ACTION_TAG type="booking" date="YYYY-MM-DD" time="HH:MM" details="Service Booking">`;
      }

      const systemPrompt = `You are a highly intelligent, professional, and friendly WhatsApp sales assistant for ${business_name}.

${categoryContext}

EVERYTHING YOU KNOW ABOUT THIS BUSINESS:
${knowledgeBase}

YOUR ADVANCED RULES:
1. FOCUS: ONLY answer questions about ${business_name}. If the user asks about politics, religion, completely unrelated topics, or uses abusive language, politely state that you are only here to help with ${business_name} and stop engaging in the unrelated topic.
2. LANGUAGE: Reply in ${languages?.join(', ') || 'English'} — perfectly match the customer's language and tone.
3. FORMATTING: Format your messages exactly like a human texts on WhatsApp. Use short paragraphs, use *bold* text for emphasis, and use emojis naturally. Keep it conversational.
4. HONESTY: NEVER make up prices, timings, or services not explicitly mentioned in your knowledge base. If you don't know something, say 'Please contact us directly for this'.
5. SALES DRIVEN: If the customer asks about prices or availability, give the details and end with an engaging question to keep them talking.
6. INTENT SCORING: At the very end of your response, ALWAYS append a secret intent tag like this:
<INTENT score="90" label="High Intent"> (or "Pricing Inquiry", "Booking Request", "General FAQ")`;

      const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000); // 7-second timeout

      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt + "\n\nCustomer: " + customerMessage }] }],
            }),
            signal: controller.signal
          }
        );
        clearTimeout(timeoutId);
        const geminiData = await geminiResponse.json();
        replyMessage =
          geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
          "Sorry, I couldn't understand that. Please contact us directly.";
      } catch (error) {
        clearTimeout(timeoutId);
        console.error("[ERROR] Gemini API Timeout or Failure:", error);
        replyMessage = "We are experiencing high volume right now. Please hold on, or contact us directly if urgent.";
      }
    }

    // ─── 7a. Marketing: Viral Watermark for Starter Plan ───
    if (plan === 'starter' && replyMessage) {
      replyMessage += "\n\n_Powered by Uraai - Build your AI bot today at uraai.com_";
    }

    // ─── 7b. Parse Secret Intent & Action Tags ───
    let intentMatch = replyMessage.match(/<INTENT\s+score="([^"]+)"\s+label="([^"]+)">/);
    let leadScore = 50;
    let intentLabel = "General FAQ";
    if (intentMatch) {
      leadScore = parseInt(intentMatch[1], 10) || 50;
      intentLabel = intentMatch[2];
      replyMessage = replyMessage.replace(intentMatch[0], '').trim();
      
      // Update customer_leads table with lead_score and intent_label
      await supabase.from('customer_leads').upsert({
        user_id: user_id,
        phone_number: fromNumber,
        lead_score: leadScore,
        intent_label: intentLabel,
        last_contact: new Date().toISOString()
      }, { onConflict: 'user_id,phone_number' });
    }

    // ─── 7c. Parse Action / Booking Tags ───
    let actionMatch = replyMessage.match(/<ACTION_TAG\s+type="([^"]+)"\s+date="([^"]+)"\s+time="([^"]+)"\s+details="([^"]+)">/)
                   || replyMessage.match(/<BOOKING\s+date="([^"]+)"\s+time="([^"]+)"\s+service="([^"]+)">/);
    if (actionMatch) {
      let aType, aDate, aTime, aDetails;
      if (actionMatch[0].startsWith('<ACTION_TAG')) {
        aType = actionMatch[1];
        aDate = actionMatch[2];
        aTime = actionMatch[3];
        aDetails = actionMatch[4];
      } else {
        aType = 'booking';
        aDate = actionMatch[1];
        aTime = actionMatch[2];
        aDetails = actionMatch[3];
      }
      replyMessage = replyMessage.replace(actionMatch[0], '').trim();
      
      const { data: newAppt } = await supabase.from('appointments').insert({
        user_id: user_id,
        customer_phone: fromNumber,
        service: `${aType.toUpperCase()}: ${aDetails}`,
        appointment_date: `${aDate} ${aTime}`,
        status: 'pending'
      }).select().single();

      replyMessage += `\n\nI have submitted this request for you. Our team will confirm shortly!`;

      // Send Interactive Message to Owner
      const ownerPhone = user?.wa_phone_number;
      if (ownerPhone && newAppt) {
        await sendInteractiveBookingMessage(ownerPhone, phoneNumberId, botSettings.meta_access_token, newAppt.id, aDetails, `${aDate} ${aTime}`, fromNumber);
      }
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

// ─── HELPER: Send Interactive Booking Message ───
async function sendInteractiveBookingMessage(to: string, phoneNumberId: string, accessToken: string, appointmentId: string, service: string, dateTime: string, customerPhone: string): Promise<boolean> {
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: `📅 *New Booking Request*\n\nCustomer: ${customerPhone}\nService: ${service}\nTime: ${dateTime}\n\nDo you want to accept this appointment?`
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: `approve_${appointmentId}`,
              title: "✅ Accept"
            }
          },
          {
            type: "reply",
            reply: {
              id: `decline_${appointmentId}`,
              title: "❌ Decline"
            }
          }
        ]
      }
    }
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
    console.error("[META] Error sending interactive:", await response.text());
  }
  return response.ok;
}
