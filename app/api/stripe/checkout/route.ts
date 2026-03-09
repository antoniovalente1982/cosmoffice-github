import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { stripe, PLAN_CONFIG } from '../../../../lib/stripe';

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

        const { workspaceId } = await req.json();

        if (!workspaceId) {
            return NextResponse.json({ error: 'workspaceId è obbligatorio' }, { status: 400 });
        }

        const plan = PLAN_CONFIG.active;
        if (!plan || !plan.stripePriceId) {
            return NextResponse.json({ error: 'Piano per-utente non configurato. Contatta il supporto.' }, { status: 400 });
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

        // Get workspace with current member count
        const { data: workspace } = await supabase
            .from('workspaces')
            .select('id, name, stripe_customer_id, max_members')
            .eq('id', workspaceId)
            .single();

        if (!workspace) {
            return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 });
        }

        // Count current members for initial quantity
        const { count: memberCount } = await supabase
            .from('workspace_members')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .is('removed_at', null);

        const quantity = memberCount || 1;

        // Get or create Stripe customer
        let stripeCustomerId = workspace.stripe_customer_id;

        if (!stripeCustomerId) {
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

            await supabase
                .from('workspaces')
                .update({ stripe_customer_id: customer.id })
                .eq('id', workspaceId);
        }

        const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // Create Checkout Session with per-user quantity
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: 'subscription',
            line_items: [{ price: plan.stripePriceId, quantity }],
            success_url: `${origin}/office?checkout=success`,
            cancel_url: `${origin}/office?checkout=canceled`,
            subscription_data: {
                metadata: {
                    workspace_id: workspaceId,
                    plan_key: 'active',
                },
            },
            metadata: {
                workspace_id: workspaceId,
                plan_key: 'active',
            },
            allow_promotion_codes: true,
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('[Stripe Checkout Error]', error);
        return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 });
    }
}
