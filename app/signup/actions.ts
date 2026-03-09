'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'

export async function signup(formData: FormData) {
    const supabase = createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const full_name = formData.get('full_name') as string
    // Optional fields (only present for non-invite registration)
    const phone = (formData.get('phone') as string) || ''
    const company_name = (formData.get('company_name') as string) || ''
    const vat_number = (formData.get('vat_number') as string) || ''

    const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name,
                ...(phone && { phone }),
                ...(company_name && { company_name }),
                ...(vat_number && { vat_number }),
            }
        }
    })

    if (error) {
        return { error: error.message }
    }

    // Update profile with company data if provided
    if (signUpData?.user?.id) {
        const updateData: Record<string, string> = {}
        if (phone) updateData.phone = phone
        if (company_name) updateData.company_name = company_name
        if (vat_number) updateData.vat_number = vat_number

        if (Object.keys(updateData).length > 0) {
            await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', signUpData.user.id)
        }
    }

    revalidatePath('/', 'layout')

    // Redirect to the invite page or office
    const redirectTo = formData.get('redirect') as string
    if (redirectTo && redirectTo.startsWith('/invite/')) {
        redirect(redirectTo)
    }
    redirect('/office')
}
