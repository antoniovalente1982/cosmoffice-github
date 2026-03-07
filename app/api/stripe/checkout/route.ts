import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { stripe, PLAN_CONFIG } from '../../../../lib/stripe';

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

        const { workspaceId, planKey } = await req.json();

        if (!workspaceId || !planKey) {
            return NextResponse.json({ error: 'workspaceId e planKey sono obbligatori' }, { status: 400 });
        }

        const plan = PLAN_CONFIG[planKey];
        if (!plan || !plan.stripePriceId) {
            return NextResponse.json({ error: 'Piano non valido o non disponibile' }, { status: 400 });
        }

        // Verify user is owner of this workspace
        const { data: member } = await supabase
            .from('workspace_members')
            .select('role')
            .eq('workspace_id', workspaceId)
            .eq('user_id', user.id)
            .single();

        if (!member || member.role !== 'owner') {
            return NextResponse.json({ error: 'Solo il proprietario può gestire il piano' }, { status: 403 });
        }

        // Get workspace
        const { data: workspace } = await supabase
            .from('workspaces')
            .select('id, name, stripe_customer_id')
            .eq('id', workspaceId)
            .single();

        if (!workspace) {
            return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 });
        }

        // Get or create Stripe customer
        let stripeCustomerId = workspace.stripe_customer_id;

        if (!stripeCustomerId) {
            // Get user email
            const { data: profile } = await supabase
                .from('profiles')
                .select('email, full_name')
                .eq('id', user.id)
                .single();

            const customer = await stripe.customers.create({
                email: profile?.email || user.email,
                name: profile?.full_name || undefined,
                metadata: {
                    workspace_id: workspaceId,
                    user_id: user.id,
                },
            });

            stripeCustomerId = customer.id;

            // Save customer ID
            await supabase
                .from('workspaces')
                .update({ stripe_customer_id: customer.id })
                .eq('id', workspaceId);
        }

        // Determine base URL
        const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: 'subscription',
            line_items: [{ price: plan.stripePriceId, quantity: 1 }],
            success_url: `${origin}/office?checkout=success&plan=${planKey}`,
            cancel_url: `${origin}/office?checkout=canceled`,
            subscription_data: {
                metadata: {
                    workspace_id: workspaceId,
                    plan_key: planKey,
                },
            },
            metadata: {
                workspace_id: workspaceId,
                plan_key: planKey,
            },
            allow_promotion_codes: true,
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('[Stripe Checkout Error]', error);
        return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 });
    }
}
