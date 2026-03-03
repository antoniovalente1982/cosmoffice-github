// Pulisce spaces eliminati e le loro stanze
const { createClient } = await import('@supabase/supabase-js');
const { readFileSync } = await import('fs');
const { resolve } = await import('path');

const envFile = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Get active workspace IDs
const { data: workspaces } = await supabase.from('workspaces').select('id, name, deleted_at');
const activeWsIds = new Set(workspaces.filter(w => !w.deleted_at).map(w => w.id));

// Get all spaces
const { data: spaces } = await supabase.from('spaces').select('id, name, workspace_id, deleted_at');

// Find spaces to delete: deleted_at set OR workspace doesn't exist
const spacesToDelete = spaces.filter(s => s.deleted_at || !activeWsIds.has(s.workspace_id));
const spaceIdsToDelete = spacesToDelete.map(s => s.id);

console.log(`\n🧹 Pulizia in corso...`);
console.log(`   Spaces da eliminare: ${spacesToDelete.length}`);

// Get rooms in those spaces
const { data: rooms } = await supabase.from('rooms').select('id, name, space_id');
const roomsToDelete = rooms.filter(r => spaceIdsToDelete.includes(r.space_id));
const roomIdsToDelete = roomsToDelete.map(r => r.id);

console.log(`   Stanze da eliminare: ${roomsToDelete.length}`);

// Delete related data for each room
for (const roomId of roomIdsToDelete) {
    await supabase.from('furniture').delete().eq('room_id', roomId);
    await supabase.from('room_participants').delete().eq('room_id', roomId);
    await supabase.from('room_connections').delete().or(`room_a_id.eq.${roomId},room_b_id.eq.${roomId}`);
}

// Delete the rooms
if (roomIdsToDelete.length > 0) {
    const { error: roomErr } = await supabase.from('rooms').delete().in('id', roomIdsToDelete);
    if (roomErr) console.error('   ❌ Errore rooms:', roomErr.message);
    else console.log(`   ✅ ${roomIdsToDelete.length} stanze eliminate!`);
}

// Delete the spaces
if (spaceIdsToDelete.length > 0) {
    const { error: spaceErr } = await supabase.from('spaces').delete().in('id', spaceIdsToDelete);
    if (spaceErr) console.error('   ❌ Errore spaces:', spaceErr.message);
    else console.log(`   ✅ ${spaceIdsToDelete.length} spaces eliminati!`);
}

// Verify
const { data: remainingRooms } = await supabase.from('rooms').select('id');
const { data: remainingSpaces } = await supabase.from('spaces').select('id');
console.log(`\n📊 Dopo pulizia:`);
console.log(`   Spaces rimasti: ${remainingSpaces.length}`);
console.log(`   Stanze rimaste: ${remainingRooms.length}\n`);
