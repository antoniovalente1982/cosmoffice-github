'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'

export async function login(formData: FormData) {
    const supabase = createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    // Log login event (success or failure)
    try {
        await supabase.rpc('log_login_event', {
            p_user_id: data?.user?.id || null,
            p_email: email,
            p_event_type: error ? 'failed_login' : 'login',
            p_success: !error,
            p_failure_reason: error?.message || null,
        });
    } catch (e) {
        // Don't block login if logging fails
        console.error('[login] Failed to log login event:', e);
    }

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')

    // Redirect to the invite page or office
    const redirectTo = formData.get('redirect') as string
    if (redirectTo && redirectTo.startsWith('/invite/')) {
        redirect(redirectTo)
    }
    redirect('/office')
}
