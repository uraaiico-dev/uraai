const SUPABASE_URL = "https://fmqgxctgowrpepbnccwq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcWd4Y3Rnb3dycGVwYm5jY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDg5ODQsImV4cCI6MjA5ODEyNDk4NH0.jUepygo2S74_1csPoqsgfEPvr1osG5_KCk7uC-PzkR8";

async function getRawBody(req) {
  if (req.body) {
    if (typeof req.body === "string") return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString("utf-8");
    return JSON.stringify(req.body);
  }
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => { resolve(data); });
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");

  if (req.method === "OPTIONS") {
    return res.status(200).send("ok");
  }

  if (req.method === "GET") {
    const challenge = req.query["hub.challenge"] || req.query["challenge"] || "SUCCESS123";
    console.log("[META GET VERIFY] Challenge:", challenge);
    return res.status(200).send(challenge);
  }

  if (req.method === "POST") {
    try {
      const payloadString = await getRawBody(req);
      console.log("[META POST WEBHOOK] Forwarding payload to Supabase Edge Function:", payloadString);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: payloadString,
      });

      const responseText = await response.text();
      console.log("[SUPABASE EDGE RESPONSE]", response.status, responseText);

      return res.status(200).send("OK");
    } catch (err) {
      console.error("[FORWARDING ERROR]", err);
      return res.status(200).send("OK");
    }
  }

  return res.status(200).send("OK");
}
