# Leona Partners - Sistema de Afiliados

Sistema completo de afiliados para a Leona, similar ao Rewardful, construído com Next.js 14, Supabase e Stripe.

## Stack Tecnológica

- **Frontend**: Next.js 14 (App Router)
- **Backend**: Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- **Pagamentos**: Stripe (API + Webhooks)
- **Hospedagem**: Vercel
- **Domínio**: https://parceiros.leonaflow.com

## Funcionalidades

### Para Afiliados
- Dashboard com saldos (Pendente, Disponível, Pago)
- Gerenciamento de links de afiliado (até 3 aliases)
- Visualização de vendas e comissões
- Acompanhamento de assinaturas
- Configuração de dados de pagamento (PIX/Wise)
- Progresso de tier de comissão

### Para Admin
- Dashboard com métricas gerais
- Gerenciamento de afiliados
- Relatórios mensais
- Gestão de pagamentos (marcar pago individual/lote)
- Export CSV
- Resync com Stripe
- Migração do Rewardful

### Regras de Negócio
- **Comissão base**: 30%
- **Tier 2**: 35% (≥20 assinaturas pagas)
- **Tier 3**: 40% (≥50 assinaturas pagas)
- **Disponibilização**: 15 dias após pagamento
- **First Touch Attribution**: Cliente sempre vinculado ao primeiro afiliado

## Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Rewardful (para migração)
REWARDFUL_API_SECRET=sua-api-secret

# App
NEXT_PUBLIC_APP_URL=https://parceiros.leonaflow.com
NEXT_PUBLIC_REGISTER_URL=https://app.leonasolutions.io/register
```

### 2. Banco de Dados Supabase

Execute as migrations na ordem:

```bash
# Via Supabase CLI
supabase db push

# Ou manualmente no SQL Editor:
# 1. 001_profiles_affiliates.sql
# 2. 002_affiliate_links.sql
# 3. 003_customer_affiliates.sql
# 4. 004_subscriptions.sql
# 5. 005_transactions.sql
# 6. 006_monthly_payouts.sql
# 7. 007_stripe_events_logs.sql
# 8. 008_rls_policies.sql
# 9. 009_cron_jobs.sql
```

### 3. Webhooks Stripe

Configure os seguintes webhooks no Stripe Dashboard:

**URL**: `https://parceiros.leonaflow.com/api/webhooks/stripe`

**Eventos a ouvir**:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.updated`

### 4. Integração com App Principal

No seu app principal (app.leonasolutions.io), capture o parâmetro `via` da URL e salve no metadata do customer Stripe:

```javascript
// Ao criar checkout
const session = await stripe.checkout.sessions.create({
  // ...outras opções
  metadata: {
    affiliate_code: req.query.via || null,
  },
  subscription_data: {
    metadata: {
      affiliate_code: req.query.via || null,
    },
  },
});

// Ou ao criar customer
const customer = await stripe.customers.create({
  email: user.email,
  metadata: {
    affiliate_code: affiliateCode,
  },
});
```

### 5. Deploy Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Configurar domínio
# No Vercel Dashboard: Settings > Domains > parceiros.leonaflow.com
```

### 6. CRON Jobs

Configure os CRONs externos (Vercel Cron, GitHub Actions, etc.):

**Diário (reconciliação)**:
```
POST https://parceiros.leonaflow.com/api/admin/stripe-resync
Body: { "days": 1 }
```

**Mensal (payouts)**: 1º dia do mês às 00:05
```
POST https://seu-projeto.supabase.co/functions/v1/cron-monthly-payouts
```

## Estrutura do Projeto

```
afiliados-leona/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login, Register
│   │   ├── (dashboard)/     # Área do afiliado
│   │   ├── (admin)/         # Área admin
│   │   └── api/             # API Routes
│   ├── components/
│   │   ├── ui/              # Componentes base
│   │   ├── dashboard/       # Cards, gráficos
│   │   ├── tables/          # Tabelas
│   │   └── layout/          # Sidebar, Header
│   ├── lib/
│   │   ├── supabase/        # Client Supabase
│   │   ├── stripe/          # Utils Stripe
│   │   └── utils.ts         # Utilitários
│   ├── hooks/               # React hooks
│   └── types/               # TypeScript types
├── supabase/
│   ├── migrations/          # SQL migrations
│   └── functions/           # Edge Functions
└── public/
    └── assets/brand/        # Logo Leona
```

## Migração do Rewardful

Para migrar dados existentes do Rewardful:

1. Configure `REWARDFUL_API_SECRET` no `.env.local`
2. Acesse Admin > Configurações
3. Clique em "Iniciar Migração"

A migração irá:
- Importar afiliados mantendo códigos originais
- Criar vínculos customer→affiliate
- Importar histórico de transações do Stripe
- Recalcular tiers
- Gerar payouts passados como "paid"

## API Reference

### Webhook Stripe
`POST /api/webhooks/stripe`

### Admin - Resync
`POST /api/admin/stripe-resync`
```json
{ "days": 30 }
```

### Admin - Migrate
`POST /api/admin/migrate-rewardful`

## Design System

### Cores Primárias
- Primary: `#3A1D7A`
- Primary Light: `#5B3FA6`
- Primary Lighter: `#8E7EEA`
- Primary Lightest: `#C6BEF5`

### Neutros
- Background: `#F8F9FC`
- Surface: `#FFFFFF`
- Border: `#E5E7F2`
- Text Primary: `#1F1F2E`
- Text Secondary: `#6B6F8D`

### Gradiente
```css
background: linear-gradient(135deg, #3A1D7A, #5B3FA6, #8E7EEA);
```

## Segurança

- Stripe Secret Key nunca exposta no frontend
- Webhooks validados com assinatura
- RLS ativo em todas as tabelas
- Service Role Key apenas no servidor
- Idempotência em todos os webhooks

## Suporte

Para dúvidas ou problemas, entre em contato com a equipe de desenvolvimento.

---

Desenvolvido para Leona Solutions
