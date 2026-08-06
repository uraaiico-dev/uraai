import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('x-razorpay-signature');
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || 'dummy_webhook_secret';
    
    // In a production environment, you MUST verify the signature using HMAC SHA256.
    // For this dummy implementation, we will bypass strict validation if using dummy secrets.
    if (!signature && webhookSecret !== 'dummy_webhook_secret') {
      throw new Error("Missing Razorpay Signature");
    }

    const payload = await req.json();

    // Only process successful payments
    if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
      
      const paymentEntity = payload.payload.payment.entity;
      
      // Extract user_id from notes
      const orderEntity = payload.payload.order?.entity || {};
      const user_id = paymentEntity.notes?.user_id || orderEntity.notes?.user_id;

      if (!user_id) {
        throw new Error("Could not extract user_id from notes");
      }

      // Determine plan based on amount paid (amount is in paise)
      let newPlan = 'starter';
      if (paymentEntity.amount === 199900) newPlan = 'pro';
      else if (paymentEntity.amount === 399900) newPlan = 'max';

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Upgrade the user's plan and give them 30 days of access
      const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ plan: newPlan, subscription_end_date: nextMonth })
        .eq('id', user_id);

      if (updateError) {
        console.error("Failed to upgrade plan in database", updateError);
        throw updateError;
      }

      console.log(`Successfully upgraded user ${user_id} to ${newPlan} plan until ${nextMonth}.`);
    }

    // Process subscription cancellations or failures (Revenue Leakage Protection)
    if (payload.event === 'subscription.halted' || payload.event === 'subscription.cancelled' || payload.event === 'payment.failed') {
      const entity = payload.payload.subscription?.entity || payload.payload.payment?.entity || {};
      const user_id = entity.notes?.user_id;

      if (user_id) {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Downgrade immediately by setting end date to yesterday
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin
          .from('users')
          .update({ plan: 'starter', subscription_end_date: yesterday })
          .eq('id', user_id);
          
        console.log(`[CFO ACTION] Downgraded user ${user_id} to starter due to payment failure/cancellation.`);
      }
    }

    return new Response(JSON.stringify({ status: 'success' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Webhook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
