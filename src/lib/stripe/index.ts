import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

export async function getCustomer(customerId: string): Promise<Stripe.Customer | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    return customer as Stripe.Customer;
  } catch {
    return null;
  }
}

export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['customer', 'items.data.price'],
    });
  } catch {
    return null;
  }
}

export async function getInvoice(invoiceId: string): Promise<Stripe.Invoice | null> {
  try {
    return await stripe.invoices.retrieve(invoiceId);
  } catch {
    return null;
  }
}

export async function listInvoices(params: {
  customer?: string;
  subscription?: string;
  created?: { gte?: number; lte?: number };
  limit?: number;
}): Promise<Stripe.Invoice[]> {
  const invoices: Stripe.Invoice[] = [];
  
  for await (const invoice of stripe.invoices.list({
    ...params,
    limit: params.limit || 100,
  })) {
    invoices.push(invoice);
  }
  
  return invoices;
}

export async function listSubscriptions(params: {
  customer?: string;
  created?: { gte?: number; lte?: number };
  status?: Stripe.SubscriptionListParams.Status;
  limit?: number;
}): Promise<Stripe.Subscription[]> {
  const subscriptions: Stripe.Subscription[] = [];
  
  for await (const subscription of stripe.subscriptions.list({
    ...params,
    expand: ['data.customer'],
    limit: params.limit || 100,
  })) {
    subscriptions.push(subscription);
  }
  
  return subscriptions;
}

export async function listRefunds(params: {
  charge?: string;
  created?: { gte?: number; lte?: number };
  limit?: number;
}): Promise<Stripe.Refund[]> {
  const refunds: Stripe.Refund[] = [];
  
  for await (const refund of stripe.refunds.list({
    ...params,
    limit: params.limit || 100,
  })) {
    refunds.push(refund);
  }
  
  return refunds;
}

export async function listDisputes(params: {
  created?: { gte?: number; lte?: number };
  limit?: number;
}): Promise<Stripe.Dispute[]> {
  const disputes: Stripe.Dispute[] = [];
  
  for await (const dispute of stripe.disputes.list({
    ...params,
    limit: params.limit || 100,
  })) {
    disputes.push(dispute);
  }
  
  return disputes;
}

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
