# Supabase — File SQL e Migrations

## ⚠️ Ordine di applicazione

I file SQL devono essere eseguiti **nell'ordine** indicato. Ogni file è idempotente (sicuro da rieseguire).

### Schema base
1. `schema_v2_complete.sql` — Schema completo v2 (tabelle, funzioni, trigger, RLS, realtime)

### Migrations (in ordine cronologico)
2. `migration_cleanup_v2.sql` — Drop tabelle legacy v1 + RLS su tutte le tabelle base
3. `migration_rbac_moderation.sql` — RBAC, ban, kick, mute + funzioni moderazione
4. `migration_furniture.sql` — Tabella furniture
5. `migration_rooms_policies.sql` — RLS rooms aggiuntive
6. `migration_storage_buckets.sql` — Storage buckets Supabase
7. `migration_invite_links.sql` — Inviti via link (multiuso, `invite_type`, `max_uses`, ecc.)
8. `migration_remove_viewer_role.sql` — Rimozione ruolo `viewer` → tutto convertito a `guest`
9. `migration_cleanup_unused_features.sql` — Drop tabelle legacy (chat v1, badges, analytics v1)

### Patch / Fix
10. `FIX_INVITI.sql` — Fix consolidato inviti (colonne mancanti + policy + funzioni). **Superset** di `RUN_THIS_invite_links.sql`
11. `RUN_THIS_invite_links.sql` — Setup invite links (versione semplificata di FIX_INVITI)

### Verifica
- `verify_schema.sql` — Script diagnostico per verificare che il DB sia allineato al codice

## ❌ File obsoleti (non eseguire)
- `schema.sql` — Schema v1 originale, **superseded** da `schema_v2_complete.sql`
- `migration_from_old_schema.sql` — Migrazione da v1 a v2, necessaria solo una volta
- `storage_buckets.sql` — Versione ridotta, **superseded** da `migration_storage_buckets.sql`

## 📁 Sottocartelle
- `functions/` — Edge Functions (Deno runtime)
  - `_shared/` — Utilities condivise (cors, supabase client, errors)
  - `cleanup-presence/` — Heartbeat + cleanup utenti inattivi
  - `join-workspace/` — Accettazione invito / richiesta accesso
  - `manage-member/` — Moderazione (ban, kick, mute, change_role, remove)
- `migrations/` — Cartella vuota (migrations gestite manualmente via SQL files sopra)

## 📋 Source of Truth
- **TypeScript types**: `lib/supabase/database.types.ts`
- **Documentazione schema**: `docs/DATABASE_SCHEMA.md`
