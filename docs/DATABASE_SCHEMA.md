# CosmoOffice — Database Schema v2

> **Ultimo aggiornamento**: 2026-02-28  
> **Source of truth TypeScript**: `lib/supabase/database.types.ts`  
> **Source of truth SQL**: `supabase/schema_v2_complete.sql` + migrations applicate

---

## Architettura

Il database è progettato su **Supabase (PostgreSQL)** con:
- **Multi-tenancy**: ogni azienda ha il proprio `workspace`
- **RBAC**: 4 ruoli gerarchici `owner > admin > member > guest`
- **Soft delete**: le entità non vengono mai cancellate fisicamente (campo `deleted_at`)
- **Audit trail**: tutte le azioni importanti loggate su `workspace_audit_logs`
- **Realtime**: Supabase Realtime su tabelle chiave per presence e chat

---

## Tipi Enumerati

| Tipo | Valori |
|---|---|
| `WorkspaceRole` | `owner`, `admin`, `member`, `guest` |
| `UserStatus` | `online`, `away`, `busy`, `offline`, `invisible` |
| `RoomType` | `open`, `meeting`, `focus`, `break`, `reception`, `private` |
| `MessageType` | `text`, `image`, `file`, `system`, `join`, `leave`, `call_start`, `call_end` |
| `ConversationType` | `room`, `channel`, `direct` |
| `NotificationType` | `mention`, `invite`, `room_enter`, `message`, `system`, `kick`, `ban`, `mute` |
| `InviteType` | `email`, `link` |

> ⚠️ **Nota**: nel DB PostgreSQL l'ENUM `workspace_role` include ancora `viewer`. Nell'applicazione TypeScript è stato rimosso. La migration `migration_remove_viewer_role.sql` converte i `viewer` esistenti in `guest`.

---

## Tabelle

### 🔒 Livello 1 — Auth & Profiles

#### `profiles`
Profilo utente, collegato 1:1 a `auth.users` via trigger.

| Colonna | Tipo | Default | Note |
|---|---|---|---|
| `id` | UUID PK | — | FK → `auth.users(id)` ON DELETE CASCADE |
| `email` | TEXT UNIQUE | — | |
| `full_name` | TEXT | null | |
| `display_name` | TEXT | null | Nome visualizzato |
| `avatar_url` | TEXT | null | |
| `timezone` | TEXT | `Europe/Rome` | |
| `locale` | TEXT | `it` | |
| `status` | TEXT | `offline` | online/away/busy/offline/invisible |
| `last_seen_at` | TIMESTAMPTZ | NOW() | |
| `preferences` | JSONB | `{}` | UI preferences |
| `deleted_at` | TIMESTAMPTZ | null | Soft delete |
| `deleted_by` | UUID | null | FK → profiles |
| `created_at` | TIMESTAMPTZ | NOW() | |
| `updated_at` | TIMESTAMPTZ | NOW() | Auto via trigger |

---

### 🏢 Livello 2 — Workspaces

#### `workspaces`
L'unità organizzativa principale (tenant).

| Colonna | Tipo | Default | Note |
|---|---|---|---|
| `id` | UUID PK | uuid_generate_v4() | |
| `name` | TEXT | — | |
| `slug` | TEXT UNIQUE | — | |
| `description` | TEXT | null | |
| `logo_url` | TEXT | null | |
| `plan` | TEXT | `free` | free/starter/pro/enterprise |
| `plan_expires_at` | TIMESTAMPTZ | null | |
| `max_members` | INT | 10 | |
| `max_spaces` | INT | 3 | |
| `max_rooms_per_space` | INT | 10 | |
| `storage_quota_bytes` | BIGINT | 1073741824 (1GB) | |
| `settings` | JSONB | `{...}` | allow_guest_invites, theme, ecc. |
| `branding` | JSONB | `{}` | White-label enterprise |
| `deleted_at/by` | — | — | Soft delete |
| `created_at/updated_at` | — | — | |
| `created_by` | UUID | null | FK → profiles |

#### `workspace_members`
Relazione N:N utenti↔workspace.

| Colonna | Tipo | Default | Note |
|---|---|---|---|
| `id` | UUID PK | | |
| `workspace_id` | UUID | — | FK → workspaces |
| `user_id` | UUID | — | FK → profiles |
| `role` | TEXT | `member` | owner/admin/member/guest |
| `permissions` | JSONB | `{}` | Override specifici |
| `invited_by` | UUID | null | FK → profiles |
| `invited_at` | TIMESTAMPTZ | null | |
| `joined_at` | TIMESTAMPTZ | NOW() | |
| `last_active_at` | TIMESTAMPTZ | null | |
| `removed_at/by` | — | null | Soft remove |
| `remove_reason` | TEXT | null | |
| `is_suspended` | BOOLEAN | false | |
| `suspended_at/by` | — | null | |
| `suspend_reason` | TEXT | null | |
| `suspend_expires_at` | TIMESTAMPTZ | null | |

**UNIQUE**: `(workspace_id, user_id)`

#### `workspace_role_permissions`
Permessi granulari per ogni ruolo in ogni workspace.

25 flag booleani tra cui: `can_manage_workspace_settings`, `can_invite_members`, `can_remove_members`, `can_kick_from_rooms`, `can_mute_in_rooms`, `can_delete_any_message`, `can_moderate_chat`, ecc.

**UNIQUE**: `(workspace_id, role)`

#### `workspace_bans`
Ban utenti con scope workspace/space/room.

| Colonna | Tipo | Note |
|---|---|---|
| `ban_type` | TEXT | workspace/space/room |
| `space_id`, `room_id` | UUID | Se ban limitato |
| `expires_at` | TIMESTAMPTZ | null = permanente |
| `revoked_at/by`, `revoke_reason` | — | Se revocato |

#### `workspace_audit_logs`
Trail di tutte le azioni (`member.invited`, `user.banned`, `user.role_changed`, ecc.)

---

### 🏠 Livello 3 — Spaces

#### `spaces`
Ufficio virtuale dentro un workspace.

Campi chiave: `visibility` (public/private/invitation_only), `layout_data` (JSONB con grid_size, background, zoom), `settings` (JSONB con max_participants, enable_chat/video/screen_share, chat_history_days).

#### `space_members`
Accesso granulare per space. Permessi: `can_create_rooms`, `can_delete_rooms`, `can_moderate_chat`, `can_manage_furniture`.

---

### 🚪 Livello 4 — Rooms

#### `rooms`
Stanze dentro uno Space.

Campi chiave: `type` (open/meeting/focus/break/reception/private), posizione (`x/y/width/height/z_index`), `capacity`, `is_secret`, `is_locked`, `who_can_enter`, `who_can_moderate`.

#### `room_connections`
Connessioni tra stanze: `type` (door/portal/stairs/elevator), coordinate `x_a/y_a` → `x_b/y_b`.

#### `furniture`
Mobili/oggetti. `is_interactable`, `interaction_type` (link/embed/app/whiteboard), `interaction_data` (JSONB).

---

### 👁️ Livello 5 — Presence

#### `room_participants`
Chi è in quale stanza **adesso**. Posizione avatar, stato media (audio/video/screen_sharing), stato moderazione (is_kicked/is_muted).

**UNIQUE**: `(room_id, user_id)`

#### `user_presence`
Presence globale per workspace: `status`, `status_message`, `platform` (web/desktop/mobile).

**PK**: `user_id` (una sola presenza per utente)

---

### 💬 Livello 6 — Chat

#### `conversations`
Container unificato: `type` = **room** (chat stanza), **channel** (canale workspace), **direct** (DM).

Vincoli SQL:
- DM richiede `user_a_id` + `user_b_id`
- Room richiede `room_id`
- Channel richiede `name`

#### `conversation_members`
Partecipanti con `notification_settings` (mute, mentions_only).

#### `messages`
Contenuto: `type` (text/image/file/system/...), `reactions` (JSON denormalizzato), `reply_to_id`, threading (`thread_parent_id`, `reply_count`), `agent_id/agent_name` per AI.

#### `message_attachments`
File allegati con `storage_path`, `thumbnail_url`, dimensioni.

---

### ✉️ Livello 7 — Invitations & Requests

#### `workspace_invitations`
**Due modalità**: email (specifico per utente) e link (multiuso).

| Colonna | Tipo | Note |
|---|---|---|
| `email` | TEXT | **nullable** — null per link invites |
| `invite_type` | TEXT | `email` o `link` |
| `token` | TEXT UNIQUE | UUID segreto |
| `max_uses` | INT | null = illimitato (solo per link) |
| `use_count` | INT | 0 | contatore |
| `label` | TEXT | Etichetta descrittiva |
| `expires_at` | TIMESTAMPTZ | null = mai |
| `accepted_at/by` | — | Per email invites |
| `revoked_at/by` | — | |

**UNIQUE INDEX**: `(workspace_id, email)` WHERE email IS NOT NULL AND revoked_at IS NULL AND accepted_at IS NULL

#### `workspace_join_requests`
Richieste di accesso con `status` (pending/approved/rejected).

---

### ⚖️ Livello 8 — Moderazione

#### `room_kicks`
Storico kick: `reason`, `can_reenter`, `banned_until`.

#### `room_mutes`
Storico mute: `mute_type` (chat/audio/video/all), `expires_at`, `unmuted_at/by`.

---

### 🤖 Livello 9 — AI & Notifiche

#### `ai_agents`
Agenti AI per workspace con `system_prompt`, `capabilities`, `allowed_spaces/rooms`.

#### `notifications`
`type` (mention/invite/system/kick/ban/mute), `action_url`, `is_read`.

---

## Triggers

| Trigger | Tabella | Funzione | Azione |
|---|---|---|---|
| `on_auth_user_created` | `auth.users` | `handle_new_user()` | Crea profilo automaticamente |
| `on_workspace_created` | `workspaces` | `handle_new_workspace()` | Aggiunge owner come membro + crea permessi default |
| `on_workspace_create_permissions` | `workspaces` | `handle_workspace_permissions()` | Crea `workspace_role_permissions` per 4 ruoli |
| `*_updated_at` | profiles, workspaces, spaces, rooms, furniture, ai_agents | `update_updated_at()` | Auto-aggiorna `updated_at` |

---

## Funzioni SQL (RPC)

### Helper di autorizzazione
| Funzione | Scopo |
|---|---|
| `is_workspace_member(workspace_id)` | Verificha appartenenza |
| `is_workspace_admin(workspace_id)` | Admin o owner |
| `is_workspace_owner(workspace_id)` | Solo owner |
| `can_access_space(space_id)` | Accesso allo space |
| `is_space_admin(space_id)` | Admin dello space |
| `can_enter_room(room_id)` | Check ruolo base |
| `can_enter_room_v2(room_id)` | Check completo: ban + suspension + ruolo |
| `has_workspace_permission(workspace_id, permission)` | Check permesso granulare |
| `can_moderate_user(workspace_id, target_user_id)` | Gerarchia ruoli |
| `is_user_banned(workspace_id, user_id?)` | Ban attivo |
| `is_user_muted(room_id, mute_type?)` | Mute attivo |

### Moderazione
| Funzione | Azione |
|---|---|
| `kick_user_from_room(room_id, user_id, reason?, duration?)` | Kick + log + notifica |
| `ban_user_from_workspace(workspace_id, user_id, reason?, expires?)` | Ban + remove + notifica |
| `unban_user_from_workspace(workspace_id, user_id, reason?)` | Revoca ban |
| `mute_user_in_room(room_id, user_id, type?, duration?)` | Mute |
| `unmute_user_in_room(room_id, user_id, type?)` | Unmute |
| `change_user_role(workspace_id, user_id, new_role)` | Cambio ruolo + audit |

### Inviti
| Funzione | Azione |
|---|---|
| `get_invite_info(token)` | Info invito da token (SECURITY DEFINER) |
| `accept_invite_link(token)` | Accetta invito email o link (SECURITY DEFINER) |

### Utility
| Funzione | Azione |
|---|---|
| `log_workspace_action(...)` | Audit trail |
| `soft_delete(table, id, deleted_by)` | Soft delete generico |
| `create_default_role_permissions(workspace_id)` | Permessi default per 4 ruoli |

---

## Realtime

Tabelle con **Supabase Realtime** attivo:

| Tabella | REPLICA IDENTITY | Uso |
|---|---|---|
| `room_participants` | FULL | Presence in stanza |
| `messages` | FULL | Chat real-time |
| `user_presence` | FULL | Stato online |
| `rooms` | DEFAULT | Aggiornamenti stanze |
| `room_connections` | DEFAULT | Connessioni |
| `furniture` | DEFAULT | Mobili |
| `conversations` | DEFAULT | Conversazioni |
| `notifications` | DEFAULT | Notifiche |

---

## Edge Functions

| Funzione | Endpoint | Azione |
|---|---|---|
| `manage-member` | POST | ban, unban, kick, mute, unmute, change_role, remove |
| `join-workspace` | POST | Accetta invito o richiesta accesso |
| `cleanup-presence` | POST | Heartbeat + cleanup utenti inattivi (>5 min) |

---

## Flussi Principali

### 1. Registrazione → Profilo
```
auth.users INSERT → trigger → INSERT profiles
```

### 2. Creazione Workspace
```
INSERT workspaces → trigger → INSERT workspace_members (owner)
                             → INSERT workspace_role_permissions (4 ruoli)
```

### 3. Invito via Link
```
INSERT workspace_invitations (invite_type='link')
→ Utente apre /invite/{token}
→ get_invite_info(token) → mostra info
→ accept_invite_link(token) → INSERT/UPDATE workspace_members
                              → UPDATE workspace_invitations (use_count++)
```

### 4. Presence
```
Frontend usePresence → Supabase Realtime Presence Channel
→ .track() ogni 200ms (dead-zone 2px)
+ cleanup-presence edge fn → UPSERT user_presence + cleanup inattivi
```

### 5. Moderazione
```
Frontend useEdgeFunctions → manage-member edge fn
→ Verifica gerarchia ruoli → Azione atomica + audit + notifica
```

---

## Gerarchia Ruoli RBAC

```
Owner (4) > Admin (3) > Member (2) > Guest (1)
```

- **Owner**: tutti i permessi, unico che può eliminare il workspace
- **Admin**: tutto tranne eliminare workspace e gestire billing
- **Member**: uso base, nessun permesso di gestione
- **Guest**: accesso limitato, solo osservazione

---

## Migration Applicate (in ordine)

1. `schema_v2_complete.sql` — Schema base completo
2. `migration_cleanup_v2.sql` — Drop legacy v1, RLS su tutte le tabelle
3. `migration_rbac_moderation.sql` — RBAC, ban, kick, mute
4. `migration_furniture.sql` — Tabella furniture
5. `migration_rooms_policies.sql` — RLS rooms  
6. `migration_storage_buckets.sql` — Storage Supabase
7. `migration_invite_links.sql` — Inviti via link (multiuso)
8. `migration_remove_viewer_role.sql` — Rimozione ruolo viewer
9. `migration_cleanup_unused_features.sql` — Drop tabelle legacy (chat v1, badges, analytics v1)
10. `FIX_INVITI.sql` — Fix colonne mancanti + policy inviti
11. `RUN_THIS_invite_links.sql` — Setup completo invite links (consolidato)
