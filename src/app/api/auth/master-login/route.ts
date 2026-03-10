import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SENHA_MESTRA = process.env.SENHA_MESTRA;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  if (!SENHA_MESTRA) {
    console.error("[master-login] SENHA_MESTRA não configurada");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const { email, password } = await request.json();

  if (password !== SENHA_MESTRA) {
    console.error("[master-login] senha não bate, recebida:", password?.length, "chars, esperada:", SENHA_MESTRA.length, "chars");
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  console.log("[master-login] senha OK, buscando user:", email);

  const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const user = listData.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const { data: linkData, error: linkErr } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email!,
    });

  if (linkErr || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: linkErr?.message || "link_failed" }, { status: 500 });
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const verifyClient = createClient(supabaseUrl, anonKey);
  const { data: otpData, error: otpErr } = await verifyClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });

  if (otpErr || !otpData.session) {
    console.error("[master-login] verifyOtp falhou:", otpErr?.message);
    return NextResponse.json({ error: otpErr?.message || "verify_failed" }, { status: 500 });
  }

  console.log("[master-login] sessão criada com sucesso para:", email);

  return NextResponse.json({
    access_token: otpData.session.access_token,
    refresh_token: otpData.session.refresh_token,
  });
}
