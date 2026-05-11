import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../utils/supabase/server';
import { stripe } from '../../../../lib/stripe';

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

        const { workspaceId } = await req.json();

        if (!workspaceId) {
            return NextResponse.json({ error: 'workspaceId è obbligatorio' }, { status: 400 });
        }

        // Verify user is owner
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
            .select('stripe_customer_id')
            .eq('id', workspaceId)
            .single();

        if (!workspace?.stripe_customer_id) {
            return NextResponse.json({ error: 'Nessun abbonamento attivo' }, { status: 400 });
        }

        const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // Create Stripe Customer Portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: workspace.stripe_customer_id,
            return_url: `${origin}/office`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('[Stripe Portal Error]', error);
        return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 });
    }
}
