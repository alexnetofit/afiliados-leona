import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SENHA_MESTRA = process.env.SENHA_MESTRA;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Brute force: a senha mestra dá sessão em qualquer conta, então vale travar
// cedo. O front só chama esta rota depois do login normal falhar, então usuário
// legítimo praticamente não consome essa cota.
const MAX_FAILURES_PER_IP = 5;
const WINDOW_MINUTES = 15;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// Compara via hash de tamanho fixo: timingSafeEqual exige buffers do mesmo
// tamanho, e comparar o tamanho antes vazaria o comprimento da senha mestra.
function matchesMasterPassword(candidate: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(candidate), digest(SENHA_MESTRA!));
}

async function recordAttempt(args: {
  targetEmail: string | null;
  ip: string;
  userAgent: string | null;
  success: boolean;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("master_login_attempts").insert({
    target_email: args.targetEmail,
    ip: args.ip,
    user_agent: args.userAgent,
    success: args.success,
  });
  if (error) {
    console.error("[master-login] falha ao registrar tentativa:", error.message);
  }
}

async function isRateLimited(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("master_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("success", false)
    .gte("created_at", since);

  if (error) {
    console.error("[master-login] falha ao checar rate limit:", error.message);
    return false;
  }

  return (count ?? 0) >= MAX_FAILURES_PER_IP;
}

export async function POST(request: NextRequest) {
  if (!SENHA_MESTRA) {
    console.error("[master-login] SENHA_MESTRA não configurada");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  if (await isRateLimited(ip)) {
    console.warn(`[master-login] rate limit atingido para IP ${ip}`);
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  if (!matchesMasterPassword(password)) {
    // Sem logar a senha nem o tamanho dela: esta rota recebe a senha real de
    // quem erra o login normal, e o log vazava o comprimento da senha mestra.
    await recordAttempt({ targetEmail: email, ip, userAgent, success: false });
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  // Senha mestra aceita: registra antes de emitir a sessão pra trilha existir
  // mesmo que a geração do link falhe depois.
  await recordAttempt({ targetEmail: email, ip, userAgent, success: true });
  console.warn(`[master-login] senha mestra aceita para ${email} (IP ${ip})`);

  let user = null;
  let page = 1;
  const perPage = 100;

  while (!user) {
    const { data: listData, error: listErr } =
      await supabaseAdmin.auth.admin.listUsers({ page, perPage });

    if (listErr) {
      console.error("[master-login] listUsers falhou:", listErr.message);
      return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
    }

    user = listData.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    ) ?? null;

    if (listData.users.length < perPage) break;
    page++;
  }

  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const { data: linkData, error: linkErr } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email!,
    });

  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error("[master-login] generateLink falhou:", linkErr?.message);
    return NextResponse.json({ error: "link_failed" }, { status: 500 });
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const verifyClient = createClient(supabaseUrl, anonKey);
  const { data: otpData, error: otpErr } = await verifyClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });

  if (otpErr || !otpData.session) {
    console.error("[master-login] verifyOtp falhou:", otpErr?.message);
    return NextResponse.json({ error: "verify_failed" }, { status: 500 });
  }

  return NextResponse.json({
    access_token: otpData.session.access_token,
    refresh_token: otpData.session.refresh_token,
  });
}
