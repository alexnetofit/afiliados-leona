import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { fetchPagarmeCharges, type PagarmeCharge } from "@/lib/pagarme";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAGARME_API_KEY = process.env.PAGARME_API_KEY || "";
const EXPECTED_PRODUCT_ID = "a1869b83-b28d-4257-a986-1df94558a152";

async function verifyAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabaseAdmin
    .from("profiles").select("role").eq("id", user.id).single();
  return p?.role === "admin";
}

function getPeriodRangeBRT(label: string): { start: Date; end: Date } {
  const [year, month] = label.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 6, 3, 0, 0)),
    end: new Date(Date.UTC(year, month, 6, 2, 59, 59)),
  };
}

function getProductId(ch: PagarmeCharge): string {
  const meta = ch.metadata ?? {};
  if (meta.product_id != null) return String(meta.product_id);
  const orderMeta = ch.order?.metadata ?? {};
  if (orderMeta.product_id != null) return String(orderMeta.product_id);
  return "(sem product_id)";
}

function getProductIdLocation(ch: PagarmeCharge): string {
  const meta = ch.metadata ?? {};
  if (meta.product_id != null) return "metadata";
  const orderMeta = ch.order?.metadata ?? {};
  if (orderMeta.product_id != null) return "order.metadata";
  return "nenhum";
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!PAGARME_API_KEY) {
    return NextResponse.json({ error: "PAGARME_API_KEY não configurada" }, { status: 500 });
  }

  const period = request.nextUrl.searchParams.get("period") || "2026-04";
  const bufferDays = Number(request.nextUrl.searchParams.get("buffer") || "60");

  const saqueRange = getPeriodRangeBRT(period);
  const delayMs = 8 * 24 * 60 * 60 * 1000;
  const paidSince = new Date(saqueRange.start.getTime() - delayMs);
  const paidUntil = new Date(saqueRange.end.getTime() - delayMs);

  const createdSince = new Date(paidSince.getTime() - bufferDays * 24 * 60 * 60 * 1000);
  const createdUntil = new Date(paidUntil.getTime() + 24 * 60 * 60 * 1000);

  // Busca SEM filtrar por status pra ver tudo
  const allCharges = await fetchPagarmeCharges({
    apiKey: PAGARME_API_KEY,
    createdSince,
    createdUntil,
    pageSize: 100,
    maxPages: 200,
  });

  const paidSinceMs = paidSince.getTime();
  const paidUntilMs = paidUntil.getTime();

  // Stats globais
  const byStatus: Record<string, { count: number; sumPaidAmount: number }> = {};
  const byProductId: Record<string, { count: number; sumPaidAmount: number; location: Set<string> }> = {};
  let inPaidWindowAnyStatus = 0;
  let inPaidWindowPaid = 0;
  let inPaidWindowPaidMatchProduct = 0;
  let inPaidWindowPaidNoProduct = 0;
  let totalCentsAllInWindowPaid = 0;
  let totalCentsMatchProduct = 0;
  let totalCentsNoProduct = 0;

  const samplesNoProduct: Array<{ id: string; amount: number; paid_at: string | null; metadataKeys: string[] }> = [];
  const samplesOtherProduct: Array<{ id: string; product_id: string; amount: number; paid_at: string | null }> = [];

  for (const ch of allCharges) {
    const status = ch.status || "(sem status)";
    if (!byStatus[status]) byStatus[status] = { count: 0, sumPaidAmount: 0 };
    byStatus[status].count++;
    byStatus[status].sumPaidAmount += ch.paid_amount || 0;

    if (!ch.paid_at) continue;
    const paidAtMs = new Date(ch.paid_at).getTime();
    if (Number.isNaN(paidAtMs)) continue;
    if (paidAtMs < paidSinceMs || paidAtMs > paidUntilMs) continue;
    inPaidWindowAnyStatus++;

    if (ch.status !== "paid") continue;
    inPaidWindowPaid++;

    const value = ch.paid_amount && ch.paid_amount > 0 ? ch.paid_amount : (ch.amount || 0);
    totalCentsAllInWindowPaid += value;

    const productId = getProductId(ch);
    const location = getProductIdLocation(ch);

    if (!byProductId[productId]) {
      byProductId[productId] = { count: 0, sumPaidAmount: 0, location: new Set() };
    }
    byProductId[productId].count++;
    byProductId[productId].sumPaidAmount += value;
    byProductId[productId].location.add(location);

    if (productId === EXPECTED_PRODUCT_ID) {
      inPaidWindowPaidMatchProduct++;
      totalCentsMatchProduct += value;
    } else if (productId === "(sem product_id)") {
      inPaidWindowPaidNoProduct++;
      totalCentsNoProduct += value;
      if (samplesNoProduct.length < 5) {
        samplesNoProduct.push({
          id: ch.id,
          amount: value,
          paid_at: ch.paid_at || null,
          metadataKeys: Object.keys(ch.metadata || {}),
        });
      }
    } else {
      if (samplesOtherProduct.length < 5) {
        samplesOtherProduct.push({
          id: ch.id,
          product_id: productId,
          amount: value,
          paid_at: ch.paid_at || null,
        });
      }
    }
  }

  return NextResponse.json({
    period,
    janela_paid_at: { since: paidSince.toISOString(), until: paidUntil.toISOString() },
    janela_created_at: { since: createdSince.toISOString(), until: createdUntil.toISOString() },
    expected_product_id: EXPECTED_PRODUCT_ID,
    totais: {
      charges_retornadas_pela_api: allCharges.length,
      em_janela_paid_qualquer_status: inPaidWindowAnyStatus,
      em_janela_paid_status_paid: inPaidWindowPaid,
      em_janela_paid_status_paid_com_product_match: inPaidWindowPaidMatchProduct,
      em_janela_paid_status_paid_sem_product_id: inPaidWindowPaidNoProduct,
      valor_brl_todas_paid_em_janela: (totalCentsAllInWindowPaid / 100).toFixed(2),
      valor_brl_match_product: (totalCentsMatchProduct / 100).toFixed(2),
      valor_brl_sem_product_id: (totalCentsNoProduct / 100).toFixed(2),
    },
    breakdown_por_status: Object.fromEntries(
      Object.entries(byStatus).map(([k, v]) => [
        k,
        { count: v.count, sumPaidAmount_brl: (v.sumPaidAmount / 100).toFixed(2) },
      ])
    ),
    breakdown_por_product_id: Object.fromEntries(
      Object.entries(byProductId)
        .sort((a, b) => b[1].sumPaidAmount - a[1].sumPaidAmount)
        .slice(0, 20)
        .map(([k, v]) => [
          k,
          {
            count: v.count,
            sumPaidAmount_brl: (v.sumPaidAmount / 100).toFixed(2),
            location: Array.from(v.location),
          },
        ])
    ),
    samples_sem_product_id: samplesNoProduct,
    samples_outro_product_id: samplesOtherProduct,
  });
}
