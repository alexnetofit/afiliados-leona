import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ABACATEPAY_API_KEY = process.env.ABACATEPAY_API_KEY;

async function verifyAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabaseAdmin
    .from("profiles").select("role").eq("id", user.id).single();
  return p?.role === "admin";
}

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!ABACATEPAY_API_KEY) {
    return NextResponse.json({ error: "ABACATEPAY_API_KEY not configured" }, { status: 500 });
  }

  try {
    const res = await fetch("https://api.abacatepay.com/v2/store/get", {
      headers: { Authorization: `Bearer ${ABACATEPAY_API_KEY}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `AbacatePay ${res.status}: ${text}` }, { status: 502 });
    }

    const json = await res.json();
    const balance = json.data?.balance || { available: 0, pending: 0, blocked: 0 };

    return NextResponse.json({ balance });
  } catch (e) {
    console.error("AbacatePay balance error:", e);
    return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!ABACATEPAY_API_KEY) {
    return NextResponse.json({ error: "ABACATEPAY_API_KEY not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { amount, pixKey, notes } = body;

  if (!amount || !pixKey) {
    return NextResponse.json({ error: "amount and pixKey are required" }, { status: 400 });
  }

  if (amount < 350) {
    return NextResponse.json({ error: "Minimum withdrawal is R$ 3.50 (350 cents)" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.abacatepay.com/v1/withdraw/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ABACATEPAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount, pixKey, notes: notes || "Saque via painel admin" }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `AbacatePay ${res.status}: ${text}` }, { status: 502 });
    }

    const json = await res.json();
    return NextResponse.json({ withdraw: json.data });
  } catch (e) {
    console.error("AbacatePay withdraw error:", e);
    return NextResponse.json({ error: "Failed to create withdraw" }, { status: 500 });
  }
}
