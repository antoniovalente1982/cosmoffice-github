'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'

export async function superadminLogin(formData: FormData) {
    const supabase = createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
        return { error: error.message }
    }

    if (!data.user) {
        return { error: 'Autenticazione fallita' }
    }

    // Verify superadmin flag
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', data.user.id)
        .single()

    if (!profile?.is_super_admin) {
        // Sign out immediately — not authorized
        await supabase.auth.signOut()
        return { error: 'Accesso non autorizzato. Solo i Super Admin possono accedere.' }
    }

    revalidatePath('/', 'layout')
    redirect('/superadmin')
}
