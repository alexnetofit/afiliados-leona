import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REWARDFUL_API_URL = "https://api.getrewardful.com/v1";
const REWARDFUL_API_SECRET = process.env.REWARDFUL_API_SECRET;

interface RewardfulLink {
  id: string;
  url: string;
  token: string; // O código legível (ex: "alex", "joao")
}

interface RewardfulCampaign {
  id: string;
  name: string; // Ex: "Afiliados 30%", "Afiliados 35%", "Afiliados 40%"
}

interface RewardfulAffiliate {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  token: string; // ID interno do Rewardful (não usar como código)
  state: string;
  links?: RewardfulLink[]; // Array de links expandidos
  campaign?: RewardfulCampaign; // Campanha com nome contendo a comissão
}

// Helper to extract commission tier from campaign name
function getCommissionTierFromCampaign(campaignName?: string): number {
  if (!campaignName) return 1; // Default to tier 1 (30%)
  
  if (campaignName.includes("40")) return 3; // 40%
  if (campaignName.includes("35")) return 2; // 35%
  return 1; // Default 30%
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
async function fetchAllRewardful<T>(endpoint: string, sendProgress?: (msg: string) => void): Promise<T[]> {
  const allData: T[] = [];
  let page = 1;
  const maxPages = 50;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    const url = `${REWARDFUL_API_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&per_page=50`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${REWARDFUL_API_SECRET}`,
        "Content-Type": "application/json",
      },
    });

    // Handle rate limit
    if (response.status === 429) {
      sendProgress?.(`Rate limit, aguardando...`);
      await delay(3000);
      continue;
    }

    if (!response.ok) {
      console.error(`Rewardful error: ${response.status}`);
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
    
    if (items.length === 0) {
      hasMore = false;
      break;
    }
    
    allData.push(...items);
    sendProgress?.(`Página ${page}: ${items.length} itens (total: ${allData.length})`);
    
    // Check if there are more pages
    if (json.pagination?.total_pages) {
      hasMore = page < json.pagination.total_pages;
    } else if (json.meta?.total_pages) {
      hasMore = page < json.meta.total_pages;
    } else {
      // If no pagination info, assume there's more if we got a full page
      hasMore = items.length >= 50;
    }
    
    // Wait between requests to avoid rate limit
    await delay(800);
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

        // Progress callback
        const progressCallback = (msg: string) => {
          sendEvent({ type: "progress", step: "fetch", message: msg });
        };

        // 1. Fetch affiliates with expanded links and campaign
        sendEvent({ type: "progress", step: "affiliates", message: "Buscando afiliados do Rewardful..." });
        const affiliates = await fetchAllRewardful<RewardfulAffiliate>("/affiliates?expand[]=links&expand[]=campaign", progressCallback);
        sendEvent({ type: "progress", step: "affiliates", message: `${affiliates.length} afiliados encontrados`, completed: true });

        // 2. Fetch referrals
        sendEvent({ type: "progress", step: "referrals", message: "Buscando referrals do Rewardful..." });
        const referrals = await fetchAllRewardful<RewardfulReferral>("/referrals", progressCallback);
        sendEvent({ type: "progress", step: "referrals", message: `${referrals.length} referrals encontrados`, completed: true });

        // 3. Get existing users by email (with pagination to get ALL users)
        sendEvent({ type: "progress", step: "processing", message: "Carregando usuários existentes..." });
        
        const emailToUserId = new Map<string, string>();
        let userPage = 1;
        const usersPerPage = 1000;
        let hasMoreUsers = true;

        while (hasMoreUsers) {
          const { data: { users } } = await supabase.auth.admin.listUsers({
            page: userPage,
            perPage: usersPerPage,
          });
          
          users.forEach(u => {
            if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
          });
          
          sendEvent({ type: "progress", step: "processing", message: `${emailToUserId.size} usuários carregados...` });
          
          hasMoreUsers = users.length === usersPerPage;
          userPage++;
        }

        // Get existing affiliates by code
        const { data: existingAffiliates } = await supabase
          .from("affiliates")
          .select("id, user_id, affiliate_code");
        
        const codeToAffiliateId = new Map<string, string>();
        const userIdToAffiliateId = new Map<string, string>();
        const affiliateIdToCode = new Map<string, string>(); // To check if update needed
        existingAffiliates?.forEach(a => {
          codeToAffiliateId.set(a.affiliate_code, a.id);
          userIdToAffiliateId.set(a.user_id, a.id);
          affiliateIdToCode.set(a.id, a.affiliate_code);
        });

        // Map rewardful_id -> our affiliate_id
        const affiliateMap = new Map<string, string>();
        let created = 0;
        let updated = 0;
        let skipped = 0;

        sendEvent({ 
          type: "progress", 
          step: "processing", 
          message: `${emailToUserId.size} usuários no Auth, ${existingAffiliates?.length || 0} affiliates no banco` 
        });

        sendEvent({ type: "progress", step: "processing", message: `Processando ${affiliates.length} afiliados...` });

        for (let i = 0; i < affiliates.length; i++) {
          const aff = affiliates[i];
          
          // Progress update every 20 affiliates
          if (i > 0 && i % 20 === 0) {
            sendEvent({ 
              type: "progress", 
              step: "processing", 
              message: `${i}/${affiliates.length} processados (${created} criados, ${updated} atualizados, ${skipped} skipped)` 
            });
          }
          
          // Get the readable code from the first link, fallback to token
          const affiliateCode = aff.links?.[0]?.token || aff.token;
          
          // Get commission tier from campaign name (30%, 35%, or 40%)
          const commissionTier = getCommissionTierFromCampaign(aff.campaign?.name);
          
          // Already exists with same code?
          if (codeToAffiliateId.has(affiliateCode)) {
            const existingId = codeToAffiliateId.get(affiliateCode)!;
            affiliateMap.set(aff.id, existingId);
            
            // Still update the tier even if code already exists
            await supabase.from("affiliates")
              .update({ commission_tier: commissionTier })
              .eq("id", existingId);
            
            skipped++;
            continue;
          }
          
          // Check if user exists by email
          const userId = emailToUserId.get(aff.email.toLowerCase());
          
          if (userId) {
            // User exists, check if has affiliate
            const existingAffId = userIdToAffiliateId.get(userId);
            
            if (existingAffId) {
              // Always update code and tier to Rewardful values
              const { error: updateError } = await supabase.from("affiliates")
                .update({ affiliate_code: affiliateCode, commission_tier: commissionTier })
                .eq("id", existingAffId);
                
                if (updateError) {
                  // Code might already exist (unique constraint)
                  console.error(`Failed to update affiliate ${existingAffId} with code ${affiliateCode}: ${updateError.message}`);
                  skipped++;
                } else {
                  affiliateMap.set(aff.id, existingAffId);
                  codeToAffiliateId.set(affiliateCode, existingAffId);
                  affiliateIdToCode.set(existingAffId, affiliateCode); // Update local cache
                  updated++;
                }
              }
            } else {
              // Create affiliate for existing user
              const { data: newAff } = await supabase.from("affiliates")
                .insert({
                  user_id: userId,
                  affiliate_code: affiliateCode,
                  commission_tier: commissionTier,
                  is_active: aff.state === "active",
                })
                .select("id")
                .single();
              
              if (newAff) {
                affiliateMap.set(aff.id, newAff.id);
                codeToAffiliateId.set(affiliateCode, newAff.id);
                userIdToAffiliateId.set(userId, newAff.id);
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

            // Note: Creating profile triggers on_profile_created which auto-creates affiliate
            // with random code. We need to update it to use Rewardful token.
            await supabase.from("profiles").upsert({
              id: authUser.user.id,
              full_name: `${aff.first_name} ${aff.last_name}`.trim(),
              role: "affiliate",
            }, { onConflict: "id" });

            // Small delay to ensure trigger has executed
            await delay(100);

            // Fetch the affiliate created by trigger and update with Rewardful token
            const { data: autoCreatedAffiliate } = await supabase
              .from("affiliates")
              .select("id")
              .eq("user_id", authUser.user.id)
              .single();

            if (autoCreatedAffiliate) {
              // Update code, tier and status to Rewardful values
              await supabase.from("affiliates")
                .update({ 
                  affiliate_code: affiliateCode, 
                  commission_tier: commissionTier,
                  is_active: aff.state === "active" 
                })
                .eq("id", autoCreatedAffiliate.id);
              
              affiliateMap.set(aff.id, autoCreatedAffiliate.id);
              emailToUserId.set(aff.email.toLowerCase(), authUser.user.id);
              codeToAffiliateId.set(affiliateCode, autoCreatedAffiliate.id);
              userIdToAffiliateId.set(authUser.user.id, autoCreatedAffiliate.id);
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

        // 4. Import additional links (beyond the first one)
        sendEvent({ type: "progress", step: "links", message: "Importando links adicionais..." });
        
        let linksImported = 0;
        let affiliatesWithMultipleLinks = 0;
        
        for (const aff of affiliates) {
          // Skip if no additional links
          if (!aff.links || aff.links.length <= 1) continue;
          
          affiliatesWithMultipleLinks++;
          
          const affiliateId = affiliateMap.get(aff.id);
          if (!affiliateId) {
            console.log(`No affiliate ID found for ${aff.email} (rewardful id: ${aff.id})`);
            continue;
          }
          
          // Import links starting from index 1 (skip the first one, it's the main code)
          for (let j = 1; j < aff.links.length && j < 3; j++) { // Limit to 3 total (1 main + 2 aliases)
            const link = aff.links[j];
            if (!link.token) continue;
            
            // Check if alias already exists
            const { data: existingLink } = await supabase
              .from("affiliate_links")
              .select("id")
              .eq("alias", link.token)
              .single();
            
            if (!existingLink) {
              const { error } = await supabase.from("affiliate_links").insert({
                affiliate_id: affiliateId,
                alias: link.token,
              });
              
              if (!error) {
                linksImported++;
              } else {
                console.error(`Failed to insert link ${link.token}: ${error.message}`);
              }
            }
          }
        }
        
        sendEvent({ 
          type: "progress", 
          step: "links", 
          message: `${affiliatesWithMultipleLinks} afiliados com múltiplos links, ${linksImported} novos aliases importados`, 
          completed: true 
        });

        // 5. Link customers
        sendEvent({ type: "progress", step: "customers", message: "Vinculando clientes..." });
        
        let customersLinked = 0;
        let skippedReferrals = 0;
        let noStripeId = 0;
        let noAffiliateMatch = 0;
        const customerBatch: { stripe_customer_id: string; affiliate_id: string }[] = [];

        for (const ref of referrals) {
          if (!ref.stripe_customer_id) {
            noStripeId++;
            continue;
          }
          
          if (!ref.affiliate?.id && !ref.affiliate?.token) {
            skippedReferrals++;
            continue;
          }
          
          // Try to find affiliate by rewardful id or by token
          let affiliateId = ref.affiliate?.id ? affiliateMap.get(ref.affiliate.id) : undefined;
          
          if (!affiliateId && ref.affiliate?.token) {
            affiliateId = codeToAffiliateId.get(ref.affiliate.token);
          }
          
          if (affiliateId) {
            customerBatch.push({
              stripe_customer_id: ref.stripe_customer_id,
              affiliate_id: affiliateId,
            });
          } else {
            noAffiliateMatch++;
          }
        }
        
        sendEvent({ 
          type: "progress", 
          step: "customers", 
          message: `${customerBatch.length} para vincular (${noStripeId} sem stripe_id, ${noAffiliateMatch} sem match)` 
        });

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
