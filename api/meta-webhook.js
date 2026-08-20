const SUPABASE_URL = "https://fmqgxctgowrpepbnccwq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcWd4Y3Rnb3dycGVwYm5jY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDg5ODQsImV4cCI6MjA5ODEyNDk4NH0.jUepygo2S74_1csPoqsgfEPvr1osG5_KCk7uC-PzkR8";

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");

  if (req.method === "OPTIONS") {
    return res.status(200).send("ok");
  }

  // 1. Handle Meta GET Webhook Verification
  if (req.method === "GET") {
    const challenge = req.query["hub.challenge"] || req.query["challenge"] || "SUCCESS123";
    console.log("[META GET VERIFY] Challenge:", challenge);
    return res.status(200).send(challenge);
  }

  // 2. Handle Meta POST Incoming WhatsApp Message
  if (req.method === "POST") {
    try {
      console.log("[META POST WEBHOOK] Forwarding to Supabase edge function...");
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(req.body || {}),
      });

      const responseText = await response.text();
      console.log("[SUPABASE RESPONSE]", response.status, responseText);

      return res.status(200).send("OK");
    } catch (err) {
      console.error("[FORWARDING ERROR]", err);
      return res.status(200).send("OK");
    }
  }

  return res.status(200).send("OK");
}
