// Supabase Edge Function for Monthly Payout Generation
// Should be triggered by external scheduler on 1st of each month
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Calculate last month
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const monthKey = lastMonth.toISOString().split("T")[0];

    console.log(`Generating payouts for month: ${monthKey}`);

    // Get all active affiliates
    const { data: affiliates, error: affError } = await supabase
      .from("affiliates")
      .select("id")
      .eq("is_active", true);

    if (affError) throw affError;

    let generated = 0;
    const errors: string[] = [];

    for (const affiliate of affiliates || []) {
      try {
        // Get transactions for the month
        const { data: transactions } = await supabase
          .from("transactions")
          .select("type, commission_amount_cents")
          .eq("affiliate_id", affiliate.id)
          .gte("available_at", lastMonth.toISOString())
          .lte("available_at", lastMonthEnd.toISOString());

        const txs = transactions || [];
        
        const totalCommission = txs
          .filter((t) => t.type === "commission")
          .reduce((sum, t) => sum + t.commission_amount_cents, 0);

        const totalNegative = txs
          .filter((t) => t.type === "refund" || t.type === "dispute")
          .reduce((sum, t) => sum + Math.abs(t.commission_amount_cents), 0);

        const totalPayable = Math.max(totalCommission - totalNegative, 0);

        // Skip if nothing to pay
        if (totalPayable === 0) continue;

        // Check if payout already exists
        const { data: existingPayout } = await supabase
          .from("monthly_payouts")
          .select("id, status")
          .eq("month", monthKey)
          .eq("affiliate_id", affiliate.id)
          .single();

        // Skip if already paid
        if (existingPayout?.status === "paid") continue;

        // Upsert payout
        await supabase.from("monthly_payouts").upsert({
          month: monthKey,
          affiliate_id: affiliate.id,
          total_commission_cents: totalCommission,
          total_negative_cents: totalNegative,
          total_payable_cents: totalPayable,
          status: "pending",
        }, { onConflict: "month,affiliate_id" });

        generated++;
      } catch (err) {
        errors.push(`Affiliate ${affiliate.id}: ${err}`);
      }
    }

    console.log(`Generated ${generated} payout records`);

    return new Response(
      JSON.stringify({
        success: true,
        month: monthKey,
        generated,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Payout generation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
