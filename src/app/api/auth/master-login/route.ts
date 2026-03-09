import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SENHA_MESTRA = process.env.SENHA_MESTRA;

export async function POST(request: NextRequest) {
  if (!SENHA_MESTRA) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const { email, password } = await request.json();

  if (password !== SENHA_MESTRA) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }

  const { data: users, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const user = users.users.find(
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

  if (linkErr || !linkData) {
    return NextResponse.json({ error: linkErr?.message || "link_failed" }, { status: 500 });
  }

  const hashed = linkData.properties?.hashed_token;
  if (!hashed) {
    return NextResponse.json({ error: "no_token" }, { status: 500 });
  }

  return NextResponse.json({
    token_hash: hashed,
    email: user.email,
  });
}
