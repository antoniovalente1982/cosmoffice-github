'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'

export async function signup(formData: FormData) {
    const supabase = createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const full_name = formData.get('full_name') as string
    const phone = formData.get('phone') as string
    const company_name = formData.get('company_name') as string
    const vat_number = formData.get('vat_number') as string

    const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name,
                phone,
                company_name,
                vat_number,
            }
        }
    })

    if (error) {
        return { error: error.message }
    }

    // Update profile with company data (the trigger creates the profile, we update it)
    if (signUpData?.user?.id) {
        await supabase
            .from('profiles')
            .update({
                phone,
                company_name,
                vat_number,
            })
            .eq('id', signUpData.user.id)
    }

    revalidatePath('/', 'layout')

    // Redirect to the invite page or office
    const redirectTo = formData.get('redirect') as string
    if (redirectTo && redirectTo.startsWith('/invite/')) {
        redirect(redirectTo)
    }
    redirect('/office')
}
