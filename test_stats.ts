import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
    const { data: allMembers, error } = await supabase
        .from('workspace_members')
        .select('user_id, last_active_at, role')
        .is('removed_at', null);
        
    const roleCounts = { owner: 0, admin: 0, member: 0, guest: 0 };
    const roleSets: Record<string, Set<string>> = {
        owner: new Set(), admin: new Set(), member: new Set(), guest: new Set()
    };
    for (const m of allMembers || []) {
        const role = (m.role || '').toLowerCase();
        if (roleSets[role]) roleSets[role].add(m.user_id);
    }
    roleCounts.owner = roleSets.owner.size;
    roleCounts.admin = roleSets.admin.size;
    roleCounts.member = roleSets.member.size;
    roleCounts.guest = roleSets.guest.size;

    console.log(roleCounts);
}
run();
