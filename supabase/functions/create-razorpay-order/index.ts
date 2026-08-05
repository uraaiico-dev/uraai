import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLAN_PRICES: Record<string, number> = {
  pro: 1999, // INR
  max: 3999, // INR
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tier, user_id } = await req.json();

    if (!tier || !user_id) {
      throw new Error("Missing tier or user_id");
    }

    const price = PLAN_PRICES[tier];
    if (!price) {
      throw new Error("Invalid tier");
    }

    // Razorpay requires amount in paise (1 INR = 100 paise)
    const amountInPaise = price * 100;

    // Razorpay API Credentials
    const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "rzp_test_TM2yt4p5jRcL6A";
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "OdTUyHP000oR7PwSjxqe163T";

    // Call Razorpay API to create order
    const basicAuth = btoa(`${keyId}:${keySecret}`);
    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: `rcpt_${Date.now().toString().slice(-8)}`,
        notes: {
          user_id: user_id
        }
      })
    });

    const orderData = await rzpResponse.json();

    if (!rzpResponse.ok) {
      throw new Error(orderData.error?.description || "Razorpay API error");
    }

    return new Response(
      JSON.stringify({ 
        order_id: orderData.id,
        amount: amountInPaise
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
