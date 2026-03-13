import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "code param required" }, { status: 400 });

  const metadataFields = ["Link", "referral", "link", "via", "affiliate_code", "ref"];

  const results: {
    customerId: string;
    customerName: string | null;
    customerEmail: string | null;
    matchedField: string;
    subscriptions: {
      id: string;
      status: string;
      amount: number | null;
      created: string;
      invoices: { id: string; amount: number; status: string | null; paid_at: string | null; refunded: boolean }[];
    }[];
  }[] = [];

  for (const field of metadataFields) {
    try {
      const customers = await stripe.customers.search({
        query: `metadata["${field}"]:"${code}"`,
        limit: 100,
      });

      for (const customer of customers.data) {
        if (customer.deleted) continue;
        if (results.find(r => r.customerId === customer.id)) continue;

        const subs: typeof results[0]["subscriptions"] = [];

        for await (const sub of stripe.subscriptions.list({
          customer: customer.id,
          limit: 100,
          expand: ["data.items.data.price"],
        })) {
          const invoices: typeof subs[0]["invoices"] = [];

          for await (const inv of stripe.invoices.list({
            subscription: sub.id,
            limit: 50,
          })) {
            const invAny = inv as any;
            invoices.push({
              id: inv.id,
              amount: invAny.amount_paid || 0,
              status: inv.status,
              paid_at: invAny.status_transitions?.paid_at
                ? new Date(invAny.status_transitions.paid_at * 1000).toISOString()
                : null,
              refunded: !!(invAny.charge && typeof invAny.charge === "object" && invAny.charge.refunded),
            });
          }

          const item = sub.items.data[0];
          subs.push({
            id: sub.id,
            status: sub.status,
            amount: item?.price?.unit_amount || null,
            created: new Date(sub.created * 1000).toISOString(),
            invoices,
          });
        }

        results.push({
          customerId: customer.id,
          customerName: customer.name,
          customerEmail: customer.email,
          matchedField: field,
          subscriptions: subs,
        });
      }
    } catch {
      // field not found, continue
    }
  }

  return NextResponse.json({ code, results });
}
