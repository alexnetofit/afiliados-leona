import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REWARDFUL_API_URL = "https://api.getrewardful.com/v1";
const REWARDFUL_API_SECRET = process.env.REWARDFUL_API_SECRET;

interface RewardfulAffiliate {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  token: string;
  state: string;
}

interface RewardfulReferral {
  id: string;
  stripe_customer_id: string;
  affiliate: {
    id: string;
    token: string;
  };
}

// Helper to wait
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch all pages from Rewardful API with rate limit handling
async function fetchAllRewardful<T>(endpoint: string): Promise<T[]> {
  const allData: T[] = [];
  let page = 1;
  const maxPages = 20;

  while (page <= maxPages) {
    const url = `${REWARDFUL_API_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&per_page=100`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${REWARDFUL_API_SECRET}`,
        "Content-Type": "application/json",
      },
    });

    // Handle rate limit
    if (response.status === 429) {
      await delay(2000); // Wait 2 seconds and retry
      continue;
    }

    if (!response.ok) {
      break;
    }

    const json = await response.json();
    
    // Handle different response structures
    let items: T[] = [];
    if (Array.isArray(json)) {
      items = json;
    } else if (json.data && Array.isArray(json.data)) {
      items = json.data;
    }
    
    if (items.length === 0) break;
    
    allData.push(...items);
    
    if (items.length < 100) break;
    
    // Wait between requests to avoid rate limit
    await delay(500);
    page++;
  }

  return allData;
}

export async function POST() {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Auth check
        const supabaseAuth = await createServerClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();

        if (!user) {
          sendEvent({ type: "error", message: "Não autenticado" });
          controller.close();
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile?.role !== "admin") {
          sendEvent({ type: "error", message: "Acesso negado" });
          controller.close();
          return;
        }

        if (!REWARDFUL_API_SECRET) {
          sendEvent({ type: "error", message: "REWARDFUL_API_SECRET não configurado" });
          controller.close();
          return;
        }

        sendEvent({ type: "start", message: "Iniciando migração do Rewardful..." });

        // 1. Fetch affiliates
        sendEvent({ type: "progress", step: "affiliates", message: "Buscando afiliados..." });
        const affiliates = await fetchAllRewardful<RewardfulAffiliate>("/affiliates");
        sendEvent({ type: "progress", step: "affiliates", message: `${affiliates.length} afiliados encontrados` });

        // 2. Fetch referrals
        sendEvent({ type: "progress", step: "referrals", message: "Buscando referrals..." });
        const referrals = await fetchAllRewardful<RewardfulReferral>("/referrals");
        sendEvent({ type: "progress", step: "referrals", message: `${referrals.length} referrals encontrados` });

        // 3. Get existing users by email
        sendEvent({ type: "progress", step: "processing", message: "Processando afiliados..." });
        
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const emailToUserId = new Map<string, string>();
        existingUsers?.users.forEach(u => {
          if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
        });

        // Get existing affiliates by code
        const { data: existingAffiliates } = await supabase
          .from("affiliates")
          .select("id, user_id, affiliate_code");
        
        const codeToAffiliateId = new Map<string, string>();
        const userIdToAffiliateId = new Map<string, string>();
        existingAffiliates?.forEach(a => {
          codeToAffiliateId.set(a.affiliate_code, a.id);
          userIdToAffiliateId.set(a.user_id, a.id);
        });

        // Map rewardful_id -> our affiliate_id
        const affiliateMap = new Map<string, string>();
        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const aff of affiliates) {
          // Already exists with same code?
          if (codeToAffiliateId.has(aff.token)) {
            affiliateMap.set(aff.id, codeToAffiliateId.get(aff.token)!);
            skipped++;
            continue;
          }

          // User exists?
          const userId = emailToUserId.get(aff.email.toLowerCase());
          
          if (userId) {
            // User exists, check if has affiliate
            const existingAffId = userIdToAffiliateId.get(userId);
            
            if (existingAffId) {
              // Update code to Rewardful code
              await supabase.from("affiliates")
                .update({ affiliate_code: aff.token })
                .eq("id", existingAffId);
              affiliateMap.set(aff.id, existingAffId);
              codeToAffiliateId.set(aff.token, existingAffId);
              updated++;
            } else {
              // Create affiliate for existing user
              const { data: newAff } = await supabase.from("affiliates")
                .insert({
                  user_id: userId,
                  affiliate_code: aff.token,
                  is_active: aff.state === "active",
                })
                .select("id")
                .single();
              
              if (newAff) {
                affiliateMap.set(aff.id, newAff.id);
                codeToAffiliateId.set(aff.token, newAff.id);
                created++;
              }
            }
          } else {
            // Create new user
            const { data: authUser, error } = await supabase.auth.admin.createUser({
              email: aff.email,
              email_confirm: true,
              password: crypto.randomUUID(),
              user_metadata: {
                full_name: `${aff.first_name} ${aff.last_name}`.trim(),
              },
            });

            if (error || !authUser.user) {
              continue;
            }

            // Create profile
            await supabase.from("profiles").upsert({
              id: authUser.user.id,
              full_name: `${aff.first_name} ${aff.last_name}`.trim(),
              role: "affiliate",
            }, { onConflict: "id" });

            // Create affiliate
            const { data: newAff } = await supabase.from("affiliates")
              .insert({
                user_id: authUser.user.id,
                affiliate_code: aff.token,
                is_active: aff.state === "active",
              })
              .select("id")
              .single();

            if (newAff) {
              affiliateMap.set(aff.id, newAff.id);
              emailToUserId.set(aff.email.toLowerCase(), authUser.user.id);
              codeToAffiliateId.set(aff.token, newAff.id);
              created++;
            }
          }
        }

        sendEvent({ 
          type: "progress", 
          step: "processing", 
          message: `${created} criados, ${updated} atualizados, ${skipped} já existiam`,
          completed: true
        });

        // 4. Link customers
        sendEvent({ type: "progress", step: "customers", message: "Vinculando clientes..." });
        
        let customersLinked = 0;
        const customerBatch: { stripe_customer_id: string; affiliate_id: string }[] = [];

        for (const ref of referrals) {
          if (!ref.stripe_customer_id || !ref.affiliate?.id) continue;
          
          // Try to find affiliate by rewardful id or by token
          let affiliateId = affiliateMap.get(ref.affiliate.id);
          
          if (!affiliateId && ref.affiliate.token) {
            affiliateId = codeToAffiliateId.get(ref.affiliate.token);
          }
          
          if (affiliateId) {
            customerBatch.push({
              stripe_customer_id: ref.stripe_customer_id,
              affiliate_id: affiliateId,
            });
          }
        }

        // Bulk upsert customers
        if (customerBatch.length > 0) {
          const { error } = await supabase
            .from("customer_affiliates")
            .upsert(customerBatch, { onConflict: "stripe_customer_id" });
          
          if (!error) {
            customersLinked = customerBatch.length;
          }
        }

        sendEvent({ 
          type: "progress", 
          step: "customers", 
          message: `${customersLinked} clientes vinculados`,
          completed: true
        });

        // Complete
        sendEvent({ 
          type: "complete", 
          message: "Migração concluída!",
          summary: {
            affiliates: created,
            affiliatesUpdated: updated,
            affiliatesSkipped: skipped,
            customers: customersLinked,
          }
        });

      } catch (error) {
        console.error("Migration error:", error);
        sendEvent({ 
          type: "error", 
          message: error instanceof Error ? error.message : "Erro na migração" 
        });
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
