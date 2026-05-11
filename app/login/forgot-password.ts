'use server'

import { createClient } from '../../utils/supabase/server'

export async function forgotPassword(formData: FormData) {
    const supabase = createClient()
    const email = formData.get('email') as string

    if (!email?.trim()) {
        return { error: 'Inserisci la tua email' }
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.cosmoffice.io'}/auth/callback?next=/set-password`,
    })

    if (error) {
        // Don't reveal if email exists or not for security
        console.error('[forgotPassword]', error.message)
    }

    // Always return success to prevent email enumeration
    return { success: true }
}
