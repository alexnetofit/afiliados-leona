import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailRequest {
  subject: string;
  htmlContent: string;
  filters: {
    tier: string;
    minCommission: number | null;
    maxCommission: number | null;
    status: string;
    onlyWithSales: boolean;
  };
  testEmail?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Check if admin
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const body: SendEmailRequest = await request.json();
    const { subject, htmlContent, filters, testEmail } = body;

    if (!subject || !htmlContent) {
      return NextResponse.json({ error: "Título e conteúdo são obrigatórios" }, { status: 400 });
    }

    // If test email, send only to that address
    if (testEmail) {
      const { error } = await resend.emails.send({
        from: "Leona Afiliados <noreply@leonasolutions.io>",
        to: testEmail,
        subject: `[TESTE] ${subject}`,
        html: htmlContent,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, sent: 1, testMode: true });
    }

    // Fetch affiliates based on filters
    let query = supabaseAdmin
      .from("affiliates")
      .select("id, user_id, commission_tier, paid_subscriptions_count, is_active");

    // Apply tier filter
    if (filters.tier !== "all") {
      query = query.eq("commission_tier", parseInt(filters.tier));
    }

    // Apply status filter
    if (filters.status !== "all") {
      query = query.eq("is_active", filters.status === "active");
    }

    // Apply only with sales filter
    if (filters.onlyWithSales) {
      query = query.gt("paid_subscriptions_count", 0);
    }

    const { data: affiliates, error: affError } = await query;

    if (affError) {
      return NextResponse.json({ error: affError.message }, { status: 500 });
    }

    if (!affiliates || affiliates.length === 0) {
      return NextResponse.json({ error: "Nenhum afiliado encontrado com os filtros selecionados" }, { status: 400 });
    }

    // If commission range filter is set, we need to fetch transactions and filter
    let filteredAffiliates = affiliates;
    
    if (filters.minCommission !== null || filters.maxCommission !== null) {
      const affiliateIds = affiliates.map(a => a.id);
      
      const { data: transactions } = await supabaseAdmin
        .from("transactions")
        .select("affiliate_id, commission_amount_cents")
        .in("affiliate_id", affiliateIds)
        .eq("type", "commission");

      // Calculate total commissions per affiliate
      const commissionMap = new Map<string, number>();
      (transactions || []).forEach(tx => {
        const current = commissionMap.get(tx.affiliate_id) || 0;
        commissionMap.set(tx.affiliate_id, current + tx.commission_amount_cents);
      });

      filteredAffiliates = affiliates.filter(a => {
        const totalCents = commissionMap.get(a.id) || 0;
        const totalReais = totalCents / 100;
        
        if (filters.minCommission !== null && totalReais < filters.minCommission) {
          return false;
        }
        if (filters.maxCommission !== null && totalReais > filters.maxCommission) {
          return false;
        }
        return true;
      });
    }

    if (filteredAffiliates.length === 0) {
      return NextResponse.json({ error: "Nenhum afiliado encontrado com os filtros de comissão" }, { status: 400 });
    }

    // Get user emails from auth
    const userIds = filteredAffiliates.map(a => a.user_id);
    const emails: string[] = [];

    for (const userId of userIds) {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (authUser?.user?.email) {
          emails.push(authUser.user.email);
        }
      } catch {
        // Skip users we can't get email for
      }
    }

    if (emails.length === 0) {
      return NextResponse.json({ error: "Nenhum email encontrado para os afiliados selecionados" }, { status: 400 });
    }

    // Send emails in batches
    let sent = 0;
    let failed = 0;
    const batchSize = 10;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(email =>
          resend.emails.send({
            from: "Leona Afiliados <noreply@leonasolutions.io>",
            to: email,
            subject,
            html: htmlContent,
          })
        )
      );

      results.forEach(result => {
        if (result.status === "fulfilled" && !result.value.error) {
          sent++;
        } else {
          failed++;
        }
      });

      // Small delay between batches
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return NextResponse.json({ 
      success: true, 
      sent, 
      failed,
      total: emails.length 
    });
  } catch (error) {
    console.error("Send email error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// Get affiliate count for preview
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tier = searchParams.get("tier") || "all";
    const status = searchParams.get("status") || "all";
    const onlyWithSales = searchParams.get("onlyWithSales") === "true";
    const minCommission = searchParams.get("minCommission");
    const maxCommission = searchParams.get("maxCommission");

    let query = supabaseAdmin
      .from("affiliates")
      .select("id, user_id, commission_tier, paid_subscriptions_count, is_active");

    if (tier !== "all") {
      query = query.eq("commission_tier", parseInt(tier));
    }

    if (status !== "all") {
      query = query.eq("is_active", status === "active");
    }

    if (onlyWithSales) {
      query = query.gt("paid_subscriptions_count", 0);
    }

    const { data: affiliates } = await query;

    if (!affiliates) {
      return NextResponse.json({ count: 0 });
    }

    let count = affiliates.length;

    // Apply commission filter if needed
    if (minCommission || maxCommission) {
      const affiliateIds = affiliates.map(a => a.id);
      
      const { data: transactions } = await supabaseAdmin
        .from("transactions")
        .select("affiliate_id, commission_amount_cents")
        .in("affiliate_id", affiliateIds)
        .eq("type", "commission");

      const commissionMap = new Map<string, number>();
      (transactions || []).forEach(tx => {
        const current = commissionMap.get(tx.affiliate_id) || 0;
        commissionMap.set(tx.affiliate_id, current + tx.commission_amount_cents);
      });

      const filtered = affiliates.filter(a => {
        const totalCents = commissionMap.get(a.id) || 0;
        const totalReais = totalCents / 100;
        
        if (minCommission && totalReais < parseFloat(minCommission)) {
          return false;
        }
        if (maxCommission && totalReais > parseFloat(maxCommission)) {
          return false;
        }
        return true;
      });

      count = filtered.length;
    }

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Get count error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
