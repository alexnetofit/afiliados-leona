import postgres from "postgres";

const dbUrl = process.env.DATABASE_URL || `postgresql://postgres.teklbteabwcgceemvdhd:${process.env.SUPABASE_DB_PASSWORD}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;

const sql = postgres(dbUrl);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS withdraw_requests (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      affiliate_id UUID NOT NULL REFERENCES affiliates(id),
      affiliate_name TEXT,
      affiliate_email TEXT,
      amount_text TEXT NOT NULL,
      date_label TEXT,
      pix_key TEXT,
      wise_email TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("Table created!");

  await sql`CREATE INDEX IF NOT EXISTS idx_withdraw_requests_affiliate ON withdraw_requests(affiliate_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_withdraw_requests_status ON withdraw_requests(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_withdraw_requests_created ON withdraw_requests(created_at DESC)`;
  console.log("Indexes created!");

  const result = await sql`SELECT count(*) FROM withdraw_requests`;
  console.log("Verify:", result);

  await sql.end();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
