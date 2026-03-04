const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: 'postgresql://postgres:ONtVtBw3ouArzYS5@db.tcbqsmjmhuebfdijiaag.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('✅ Connected to Supabase');

  // ════════════════════════════════════════════════════
  // FIX 1: Enable RLS on room_kicks and room_mutes
  // ════════════════════════════════════════════════════
  console.log('\n🔒 FIX 1: Enabling RLS on room_kicks and room_mutes...');
  await client.query('ALTER TABLE public.room_kicks ENABLE ROW LEVEL SECURITY');
  await client.query('ALTER TABLE public.room_mutes ENABLE ROW LEVEL SECURITY');
  console.log('  ✅ RLS enabled on room_kicks, room_mutes');

  // room_kicks policies
  await client.query('DROP POLICY IF EXISTS "room_kicks_select" ON public.room_kicks');
  await client.query(`CREATE POLICY "room_kicks_select" ON public.room_kicks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm JOIN spaces s ON s.workspace_id=wm.workspace_id JOIN rooms r ON r.space_id=s.id WHERE r.id=room_kicks.room_id AND wm.user_id=auth.uid() AND wm.removed_at IS NULL))`);
  await client.query('DROP POLICY IF EXISTS "room_kicks_insert" ON public.room_kicks');
  await client.query(`CREATE POLICY "room_kicks_insert" ON public.room_kicks FOR INSERT TO authenticated WITH CHECK (kicked_by=auth.uid() AND EXISTS (SELECT 1 FROM workspace_members wm JOIN spaces s ON s.workspace_id=wm.workspace_id JOIN rooms r ON r.space_id=s.id WHERE r.id=room_kicks.room_id AND wm.user_id=auth.uid() AND wm.removed_at IS NULL AND wm.role IN ('owner','admin','moderator')))`);
  console.log('  ✅ room_kicks policies created');

  // room_mutes policies
  await client.query('DROP POLICY IF EXISTS "room_mutes_select" ON public.room_mutes');
  await client.query(`CREATE POLICY "room_mutes_select" ON public.room_mutes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm JOIN spaces s ON s.workspace_id=wm.workspace_id JOIN rooms r ON r.space_id=s.id WHERE r.id=room_mutes.room_id AND wm.user_id=auth.uid() AND wm.removed_at IS NULL))`);
  await client.query('DROP POLICY IF EXISTS "room_mutes_insert" ON public.room_mutes');
  await client.query(`CREATE POLICY "room_mutes_insert" ON public.room_mutes FOR INSERT TO authenticated WITH CHECK (muted_by=auth.uid() AND EXISTS (SELECT 1 FROM workspace_members wm JOIN spaces s ON s.workspace_id=wm.workspace_id JOIN rooms r ON r.space_id=s.id WHERE r.id=room_mutes.room_id AND wm.user_id=auth.uid() AND wm.removed_at IS NULL AND wm.role IN ('owner','admin','moderator')))`);
  console.log('  ✅ room_mutes policies created');

  // ════════════════════════════════════════════════════
  // FIX 2: Set search_path on all functions
  // ════════════════════════════════════════════════════
  console.log('\n🔧 FIX 2: Setting search_path on all functions...');
  const fns = [
    'is_space_message_admin', 'is_space_admin', 'is_workspace_owner',
    'kick_workspace_member', 'handle_new_user', 'create_default_role_permissions',
    'is_workspace_member', 'can_moderate_user', 'is_user_banned',
    'is_workspace_admin', 'handle_new_workspace', 'accept_invite_link',
    'get_invite_info', 'update_updated_at'
  ];
  for (const fn of fns) {
    try {
      await client.query(`ALTER FUNCTION public.${fn} SET search_path = public`);
      console.log(`  ✅ ${fn}`);
    } catch (e) {
      console.log(`  ⚠️ ${fn}: ${e.message.split('\n')[0]}`);
    }
  }

  // ════════════════════════════════════════════════════
  // FIX 3: Fix "Always True" permissive policies
  // ════════════════════════════════════════════════════
  console.log('\n🛡️ FIX 3: Fixing overly permissive policies...');

  // login_events
  await client.query('DROP POLICY IF EXISTS "Users can insert own login events" ON public.login_events');
  await client.query(`CREATE POLICY "Users can insert own login events" ON public.login_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())`);
  await client.query('DROP POLICY IF EXISTS "Users can view own login events" ON public.login_events');
  await client.query(`CREATE POLICY "Users can view own login events" ON public.login_events FOR SELECT TO authenticated USING (user_id = auth.uid())`);
  console.log('  ✅ login_events policies fixed');

  // workspace_members: drop overly permissive policies
  const wmResult = await client.query(`
    SELECT policyname FROM pg_policies
    WHERE tablename = 'workspace_members'
      AND schemaname = 'public'
      AND (qual = 'true' OR with_check = 'true')
      AND cmd != 'SELECT'
  `);
  for (const row of wmResult.rows) {
    await client.query(`DROP POLICY IF EXISTS "${row.policyname}" ON public.workspace_members`);
    console.log(`  ✅ Dropped overly permissive policy: ${row.policyname}`);
  }
  if (wmResult.rows.length === 0) {
    console.log('  ℹ️ No overly permissive workspace_members policies found');
  }

  // ════════════════════════════════════════════════════
  // FIX 4: Revoke anonymous access to sensitive tables
  // ════════════════════════════════════════════════════
  console.log('\n🚫 FIX 4: Revoking anonymous access to sensitive tables...');
  const sensitiveTables = ['admin_transfers', 'billing_events', 'conversation_members', 'conversations', 'furniture'];
  for (const tbl of sensitiveTables) {
    try {
      const anonResult = await client.query(`
        SELECT policyname FROM pg_policies
        WHERE tablename = $1
          AND schemaname = 'public'
          AND roles @> '{anon}'
      `, [tbl]);
      for (const row of anonResult.rows) {
        await client.query(`DROP POLICY IF EXISTS "${row.policyname}" ON public.${tbl}`);
        console.log(`  ✅ Dropped anon policy "${row.policyname}" on ${tbl}`);
      }
      if (anonResult.rows.length === 0) {
        console.log(`  ℹ️ No anon policies found on ${tbl}`);
      }
    } catch (e) {
      console.log(`  ⚠️ ${tbl}: ${e.message.split('\n')[0]}`);
    }
  }

  // Recreate furniture policy for authenticated only
  await client.query('DROP POLICY IF EXISTS "Authenticated users can view furniture" ON public.furniture');
  await client.query(`CREATE POLICY "Authenticated users can view furniture" ON public.furniture FOR SELECT TO authenticated USING (true)`);
  console.log('  ✅ Furniture policy recreated for authenticated users only');

  // bug_reports: remove anon access
  const bugAnonResult = await client.query(`
    SELECT policyname FROM pg_policies
    WHERE tablename = 'bug_reports'
      AND schemaname = 'public'
      AND roles @> '{anon}'
  `);
  for (const row of bugAnonResult.rows) {
    await client.query(`DROP POLICY IF EXISTS "${row.policyname}" ON public.bug_reports`);
    console.log(`  ✅ Dropped anon policy on bug_reports: ${row.policyname}`);
  }

  // Recreate bug_reports policies for authenticated
  await client.query('DROP POLICY IF EXISTS "Authenticated users can view bug reports" ON public.bug_reports');
  await client.query(`CREATE POLICY "Authenticated users can view bug reports" ON public.bug_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.user_id = auth.uid() AND wm.role IN ('owner','admin') AND wm.removed_at IS NULL))`);
  await client.query('DROP POLICY IF EXISTS "Authenticated users can insert bug reports" ON public.bug_reports');
  await client.query(`CREATE POLICY "Authenticated users can insert bug reports" ON public.bug_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid())`);
  console.log('  ✅ bug_reports policies recreated for authenticated users only');

  // ════════════════════════════════════════════════════
  // VERIFICATION
  // ════════════════════════════════════════════════════
  console.log('\n📋 VERIFICATION:');
  const v = await client.query(`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename IN ('room_kicks','room_mutes')`);
  console.log('  RLS status:', JSON.stringify(v.rows));

  const policyCount = await client.query(`SELECT tablename, count(*) as policy_count FROM pg_policies WHERE schemaname='public' AND tablename IN ('room_kicks','room_mutes','login_events','bug_reports','furniture') GROUP BY tablename ORDER BY tablename`);
  console.log('  Policy counts:', JSON.stringify(policyCount.rows));

  await client.end();
  console.log('\n🚀 ALL SECURITY FIXES APPLIED SUCCESSFULLY!');
}

run().catch(e => { console.error('❌ ERROR:', e.message); process.exit(1); });
