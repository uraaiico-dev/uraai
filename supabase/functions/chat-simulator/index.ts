import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, message, customerPhone } = await req.json();
    
    if (!userId || !message) {
      return new Response(JSON.stringify({ error: "Missing userId or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SERVICE_ROLE_KEY") || ""
    );

    // 1. Fetch user data and bot settings
    const { data: user } = await supabase.from("users").select("business_name").eq("id", userId).single();
    const { data: botSettings } = await supabase.from("bot_settings").select("*").eq("user_id", userId).single();
    const { data: faqData } = await supabase.from("faqs").select("question, answer").eq("user_id", userId);

    const business_name = user?.business_name || "this business";
    
    if (!botSettings) {
      return new Response(JSON.stringify({ reply: "Bot is not configured yet." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Check business hours
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

    let replyMessage = "";
    let bookingMade = false;

    if (isClosed) {
      replyMessage = `We're currently closed. We open at ${open_time}. Please message us then!`;
    } else {
      // 3. Call Gemini API
      let knowledgeBase = botSettings.business_knowledge
        || (faqData && faqData.length > 0
          ? faqData.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
          : 'No business information set up yet.');

      if (botSettings.menu_items && botSettings.menu_items.length > 0) {
        const menuText = botSettings.menu_items.map((m: any) => `- ${m.name}: ${m.price}`).join('\n');
        knowledgeBase += '\n\nOUR SERVICES & PRICES:\n' + menuText;
      }

      const systemPrompt = `You are a dedicated WhatsApp customer service assistant for ${business_name}.
EVERYTHING YOU KNOW ABOUT THIS BUSINESS:
${knowledgeBase}

YOUR RULES:
1. ONLY answer questions about ${business_name} — nothing else
2. Reply in ${languages?.join(', ') || 'English'} — match customer language
3. Be friendly, warm, concise — like a helpful shop assistant
4. If you don't know something specific, say 'Please contact us directly for this'
5. NEVER make up prices, timings, or services not mentioned above
6. End with a helpful follow-up when appropriate
7. IMPORTANT BOOKING RULE: If the user provides a clear date, time, and service for an appointment that aligns with the business hours and knowledge, you MUST secretly include a booking tag at the very end of your response exactly like this: <BOOKING date="YYYY-MM-DD" time="HH:MM" service="Service Name">`;

      const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt + "\n\nCustomer: " + message }] }],
          }),
        }
      );

      const geminiData = await geminiResponse.json();
      replyMessage = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't understand that.";
    }

    // 4. Parse Booking Tags
    let bookingMatch = replyMessage.match(/<BOOKING\s+date="([^"]+)"\s+time="([^"]+)"\s+service="([^"]+)">/);
    if (bookingMatch) {
      const bDate = bookingMatch[1];
      const bTime = bookingMatch[2];
      const bService = bookingMatch[3];

      // Strip the tag so customer doesn't see it
      replyMessage = replyMessage.replace(bookingMatch[0], '').trim();

      const phoneToSave = customerPhone || "Simulator Tester";
      
      const { error: apptError } = await supabase.from('appointments').insert({
        user_id: userId,
        customer_phone: phoneToSave,
        service: bService,
        appointment_date: `${bDate} ${bTime}`
      });

      if (!apptError) {
        bookingMade = true;
      } else {
        console.error('Failed to save appointment in simulator:', apptError);
      }
    }

    return new Response(JSON.stringify({ reply: replyMessage, bookingMade }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
