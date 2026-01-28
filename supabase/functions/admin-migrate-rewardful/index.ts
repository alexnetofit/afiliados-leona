// Supabase Edge Function for Rewardful Migration
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const REWARDFUL_API_URL = "https://api.getrewardful.com/v1";
const REWARDFUL_API_SECRET = Deno.env.get("REWARDFUL_API_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RewardfulAffiliate {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  token: string;
  state: string;
}

async function fetchRewardful(endpoint: string) {
  const response = await fetch(`${REWARDFUL_API_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${REWARDFUL_API_SECRET}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Rewardful API error: ${response.status}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!REWARDFUL_API_SECRET) {
    return new Response(
      JSON.stringify({ error: "REWARDFUL_API_SECRET not configured" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const stats = { affiliates: 0, customers: 0, errors: [] as string[] };

    // Fetch affiliates from Rewardful
    const { data: rewardfulAffiliates } = await fetchRewardful("/affiliates?per_page=100");

    for (const rwAffiliate of rewardfulAffiliates as RewardfulAffiliate[]) {
      try {
        // Check if already exists
        const { data: existing } = await supabase
          .from("affiliates")
          .select("id")
          .eq("affiliate_code", rwAffiliate.token)
          .single();

        if (existing) continue;

        // Create auth user
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: rwAffiliate.email,
          email_confirm: true,
          password: crypto.randomUUID(),
          user_metadata: {
            full_name: `${rwAffiliate.first_name} ${rwAffiliate.last_name}`.trim(),
          },
        });

        if (authError) {
          stats.errors.push(`Failed: ${rwAffiliate.email}`);
          continue;
        }

        // Create profile
        await supabase.from("profiles").upsert({
          id: authUser.user.id,
          full_name: `${rwAffiliate.first_name} ${rwAffiliate.last_name}`.trim(),
          role: "affiliate",
        }, { onConflict: "id" });

        // Create affiliate
        await supabase.from("affiliates").upsert({
          user_id: authUser.user.id,
          affiliate_code: rwAffiliate.token,
          is_active: rwAffiliate.state === "active",
        }, { onConflict: "user_id" });

        stats.affiliates++;
      } catch (err) {
        stats.errors.push(`Error: ${rwAffiliate.email}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
