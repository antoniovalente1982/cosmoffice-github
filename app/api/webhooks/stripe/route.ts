import { NextRequest, NextResponse } from 'next/server';
import { stripe, getPlanByPriceId, PLAN_CONFIG, normalizePlanKey } from '../../../../lib/stripe';
import { createClient } from '@supabase/supabase-js';

// Use service role key for webhook (no user session)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
        console.error('[Stripe Webhook] Signature verification failed:', err.message);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Prevent duplicate processing
    const { data: existingEvent } = await supabaseAdmin
        .from('billing_events')
        .select('id')
        .eq('stripe_event_id', event.id)
        .single();

    if (existingEvent) {
        return NextResponse.json({ received: true, duplicate: true });
    }

    try {
        switch (event.type) {
            // ─── Checkout completed → activate subscription ───
            case 'checkout.session.completed': {
                const session = event.data.object;
                const workspaceId = session.metadata?.workspace_id;

                if (workspaceId && session.subscription) {
                    // Per-user model: activate workspace, keep max_capacity as set by SuperAdmin
                    await supabaseAdmin.from('workspaces').update({
                        stripe_subscription_id: session.subscription as string,
                        stripe_subscription_status: 'active',
                        plan: 'premium',
                    }).eq('id', workspaceId);

                    await logBillingEvent(workspaceId, 'plan_upgrade', 'demo', 'premium', session.amount_total || 0, event.id);
                }
                break;
            }

            // ─── Subscription updated (quantity change, renewal) ───
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const workspaceId = subscription.metadata?.workspace_id;

                if (workspaceId) {
                    const updateData: Record<string, any> = {
                        stripe_subscription_status: subscription.status,
                    };

                    // Keep plan premium if subscription is active
                    if (subscription.status === 'active') {
                        updateData.plan = 'premium';
                        updateData.suspended_at = null;
                    }

                    await supabaseAdmin.from('workspaces').update(updateData).eq('id', workspaceId);
                }
                break;
            }

            // ─── Subscription deleted (canceled or expired) ───
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const workspaceId = subscription.metadata?.workspace_id;

                if (workspaceId) {
                    // Downgrade to demo (no billing)
                    await supabaseAdmin.from('workspaces').update({
                        plan: 'demo',
                        stripe_subscription_status: 'canceled',
                        stripe_subscription_id: null,
                    }).eq('id', workspaceId);

                    await logBillingEvent(workspaceId, 'cancellation', 'premium', 'demo', 0, event.id);
                }
                break;
            }

            // ─── Payment succeeded ───
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                const customerId = invoice.customer as string;

                const { data: workspace } = await supabaseAdmin
                    .from('workspaces')
                    .select('id, plan')
                    .eq('stripe_customer_id', customerId)
                    .single();

                if (workspace) {
                    await logBillingEvent(workspace.id, 'payment', workspace.plan, workspace.plan, invoice.amount_paid || 0, event.id);
                }
                break;
            }

            // ─── Payment failed → mark as past_due ───
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const customerId = invoice.customer as string;

                await supabaseAdmin.from('workspaces').update({
                    stripe_subscription_status: 'past_due',
                }).eq('stripe_customer_id', customerId);
                break;
            }

            default:
                console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
        }
    } catch (error: any) {
        console.error(`[Stripe Webhook] Error processing ${event.type}:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}

// ── Helper: Log billing event ──
async function logBillingEvent(
    workspaceId: string,
    eventType: string,
    planFrom: string,
    planTo: string,
    amountCents: number,
    stripeEventId: string,
) {
    await supabaseAdmin.from('billing_events').insert({
        workspace_id: workspaceId,
        event_type: eventType,
        plan_from: planFrom,
        plan_to: planTo,
        amount_cents: amountCents,
        currency: 'EUR',
        stripe_event_id: stripeEventId,
        metadata: { stripe_event_id: stripeEventId },
    });
}
