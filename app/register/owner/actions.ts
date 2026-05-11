'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'

export async function registerOwner(formData: FormData) {
    const supabase = createClient()

    const token = formData.get('token') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const full_name = formData.get('full_name') as string
    const phone = formData.get('phone') as string || ''
    const company_name = formData.get('company_name') as string || ''
    const vat_number = formData.get('vat_number') as string || ''

    if (!token) {
        return { error: 'Token di registrazione mancante.' }
    }

    // 1. Verify token
    const { data: tokenData, error: tokenError } = await supabase
        .from('owner_registration_tokens')
        .select('*')
        .eq('token', token)
        .is('used_at', null)
        .single()

    if (tokenError || !tokenData) {
        return { error: 'Token non valido o già utilizzato.' }
    }

    // Check expiry
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        return { error: 'Token scaduto. Richiedi un nuovo link al tuo referente.' }
    }

    // Check if email matches (if pre-filled)
    if (tokenData.email && tokenData.email.toLowerCase() !== email.toLowerCase()) {
        return { error: `Questo link è riservato all'email ${tokenData.email}. Usa l'email corretta.` }
    }

    // 2. Create or upgrade user account
    let userId: string

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
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

    if (signUpError) {
        // If the user already exists, try to sign them in and upgrade to owner
        if (signUpError.message.toLowerCase().includes('already registered') ||
            signUpError.message.toLowerCase().includes('already been registered')) {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (signInError) {
                return { error: 'Account già esistente. Inserisci la password corretta per il tuo account.' }
            }

            if (!signInData?.user?.id) {
                return { error: 'Errore nell\'accesso all\'account esistente.' }
            }

            userId = signInData.user.id
        } else {
            return { error: signUpError.message }
        }
    } else {
        if (!signUpData?.user?.id) {
            return { error: 'Errore nella creazione dell\'account.' }
        }
        userId = signUpData.user.id
    }

    // 3. Update profile with owner data (works for both new and existing users)
    const adminClient = createAdminClient()
    await adminClient
        .from('profiles')
        .update({
            full_name,
            phone,
            company_name,
            vat_number,
            max_workspaces: (tokenData.max_workspaces || 1),
            is_workspace_creator: true,
        })
        .eq('id', userId)

    // 4. Mark token as used
    await supabase
        .from('owner_registration_tokens')
        .update({
            used_at: new Date().toISOString(),
            used_by: userId,
        })
        .eq('id', tokenData.id)

    // 5. Create the first workspace for the owner
    const workspaceName = company_name || full_name + '\'s Workspace'
    const slug = workspaceName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'workspace'

    const { data: workspace, error: wsError } = await supabase
        .from('workspaces')
        .insert({
            name: workspaceName,
            slug,
            created_by: userId,
        })
        .select()
        .single()

    if (wsError) {
        console.error('Failed to create workspace for owner:', wsError)
        // Don't fail registration — owner can create workspace manually
    }

    if (workspace) {
        // Create default space
        const { data: space } = await supabase
            .from('spaces')
            .insert({
                workspace_id: workspace.id,
                name: 'General Office',
                slug: 'general-office',
                created_by: userId,
                max_capacity: tokenData.max_capacity || 50,
                layout_data: {
                    officeWidth: 4000,
                    officeHeight: 3000,
                    bgOpacity: 0.8,
                    preset: 'team',
                },
            })
            .select()
            .single()

        if (space) {
            // Create default rooms
            await supabase.from('rooms').insert([
                { space_id: space.id, name: 'Lobby', type: 'reception', x: 400, y: 400, width: 250, height: 200, created_by: userId },
                { space_id: space.id, name: 'Coffee Break', type: 'break', x: 700, y: 400, width: 200, height: 200, created_by: userId },
                { space_id: space.id, name: 'Deep Work', type: 'focus', x: 400, y: 700, width: 300, height: 250, created_by: userId },
                { space_id: space.id, name: 'Meeting Room', type: 'meeting', x: 750, y: 700, width: 250, height: 250, created_by: userId },
            ])
        }
    }

    revalidatePath('/', 'layout')
    redirect('/office')
}
