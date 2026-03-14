# 🗄️ Cosmoffice — Database Schema

> **Ultimo aggiornamento**: 2026-03-14
> **Database**: Supabase PostgreSQL 17 (progetto `tcbqsmjmhuebfdijiaag`)
> **Region**: `eu-west-1`
> **Migrazioni applicate**: 45 (gestite direttamente su Supabase)

---

## Panoramica

- **30 tabelle** con RLS abilitato su tutte
- **Multi-tenancy** via `workspace_id` + RLS policies
- **RBAC**: `owner > admin > member > guest`
- **Soft delete**: campo `removed_at` / `deleted_at` dove applicabile
- **Audit trail**: `workspace_audit_logs` per ogni azione importante

---

## Modello Relazionale

```
profiles (12 rows)
  └─── workspace_members (12) ─── workspaces (2)
         │                           ├── spaces (2)
         │                           │     ├── rooms (18)
         │                           │     │     ├── room_participants (0)
         │                           │     │     ├── room_connections (3)
         │                           │     │     ├── furniture (0)
         │                           │     │     ├── whiteboard_strokes (0)
         │                           │     │     ├── messages (2)
         │                           │     │     ├── room_kicks (0)
         │                           │     │     └── room_mutes (0)
         │                           │     └── space_chat_messages (0)
         │                           ├── workspace_invitations (5)
         │                           ├── workspace_bans (0)
         │                           ├── workspace_audit_logs (36)
         │                           ├── conversations (0)
         │                           │     └── conversation_members (0)
         │                           └── billing_events (0)
         └── user_presence (0)

Tabelle standalone:
  login_events (51)
  admin_transfers (0)
  platform_metrics (0)
  platform_settings (1)
  owner_registration_tokens (1)
  support_tickets (2) ─── ticket_messages (0)
  bug_reports (4)
  payments (0)
  invoices (0)
  upgrade_requests (0)
  presence_events (6560)
  message_attachments (1)
```

---

## Tabelle per Area

### 🔒 Auth & Profili

#### `profiles` (12 rows)
Collegata 1:1 a `auth.users` via trigger `handle_new_user()`.

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | UUID PK | FK → `auth.users(id)` |
| `email` | TEXT | |
| `full_name` | TEXT | |
| `display_name` | TEXT | Nome visualizzato |
| `avatar_url` | TEXT | |
| `status` | TEXT | `online/away/busy/offline` |
| `language` | TEXT | Default `it`. Valori: `it`, `en`, `es` |
| `timezone` | TEXT | Default `Europe/Rome` |
| `is_super_admin` | BOOL | Default `false` |
| `is_support_staff` | BOOL | Default `false` |
| `max_workspaces` | INT | Default `1` |
| `company_name` | TEXT | Dati fatturazione |
| `vat_number`, `fiscal_code`, `sdi_code`, `pec` | TEXT | Fatturazione IT |
| `billing_address/city/zip/country` | TEXT | Indirizzo fatturazione |
| `suspended_at`, `suspended_by` | — | Sospensione account |
| `last_seen`, `created_at`, `updated_at` | TIMESTAMPTZ | |

---

### 🏢 Workspaces

#### `workspaces` (2 rows)
Tenant principale. Ogni azienda = 1 workspace.

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | UUID PK | |
| `name` | TEXT | |
| `slug` | TEXT UNIQUE | URL-friendly |
| `plan` | TEXT | Default `free` |
| `max_capacity` | INT | Default `3` (posti totali) |
| `max_spaces` | INT | Default `1` |
| `max_rooms_per_space` | INT | Default `5` |
| `max_guests` | INT | Default `0` |
| `storage_quota_bytes` | BIGINT | Default 1GB |
| `price_per_seat` | INT | Centesimi €/posto |
| `billing_cycle` | TEXT | `monthly` o `annual` |
| `trial_ends_at` | TIMESTAMPTZ | Fine trial |
| `stripe_customer_id` | TEXT | |
| `stripe_subscription_id` | TEXT | |
| `stripe_subscription_status` | TEXT | Default `none` |
| `payment_status` | TEXT | Default `none` |
| `monthly_amount_cents` | INT | |
| `branding`, `settings` | JSONB | Personalizzazione |
| `logo_url` | TEXT | |
| `suspended_at/by`, `deleted_at/by` | — | |
| `plan_activated_by/at` | — | Chi ha attivato il piano |

#### `workspace_members` (12 rows)
N:N utenti ↔ workspace.

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | UUID PK | |
| `workspace_id` | UUID FK → workspaces | |
| `user_id` | UUID FK → profiles | |
| `role` | TEXT | `owner/admin/member/guest` |
| `joined_at` | TIMESTAMPTZ | Default `now()` |
| `last_active_at` | TIMESTAMPTZ | |
| `invited_by/at` | — | Chi ha invitato |
| `removed_at/by`, `remove_reason` | — | Soft remove |
| `is_suspended`, `suspended_at/by` | — | |
| `suspend_reason`, `suspend_expires_at` | — | |
| `permissions` | JSONB | Override specifici |
| `invitation_id` | UUID FK → workspace_invitations | |

#### `workspace_invitations` (5 rows)
Due modalità: **email** (1 uso) e **link** (multiuso).

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | UUID PK | |
| `workspace_id` | UUID FK → workspaces | |
| `email` | TEXT | NULL per inviti link |
| `token` | TEXT UNIQUE | Segreto nell'URL |
| `invite_type` | TEXT | `email` o `link` |
| `role` | TEXT | Ruolo assegnato |
| `max_uses` | INT | NULL = illimitato |
| `use_count` | INT | Default `0` |
| `label` | TEXT | Etichetta descrittiva |
| `destination_room_id` | UUID FK → rooms | Stanza di destinazione |
| `expires_at` | TIMESTAMPTZ | NULL = mai |
| `accepted_at/by`, `revoked_at/by` | — | |

#### `workspace_bans` (0 rows)
Ban utenti da workspace con possibile scadenza.

#### `workspace_audit_logs` (36 rows)
Audit trail: `action`, `entity_type`, `entity_id`, `metadata` JSONB.

---

### 🏠 Spaces & Rooms

#### `spaces` (2 rows)
Ufficio virtuale dentro un workspace.

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | UUID PK | |
| `workspace_id` | UUID FK | |
| `name`, `description` | TEXT | |
| `max_capacity` | INT | Default `50` |
| `layout_data` | JSONB | Dimensioni, background, zoom |
| `settings` | JSONB | Configurazione |
| `visibility` | TEXT | Default `private` |
| `slug` | TEXT | |
| `archived_at/by`, `deleted_at/by`, `created_by` | — | |

#### `rooms` (18 rows)
Stanze dentro uno Space.

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | UUID PK | |
| `space_id` | UUID FK → spaces | |
| `name` | TEXT | |
| `type` | TEXT | `open/meeting/focus/break/reception` |
| `shape` | TEXT | `rect` o `circle` |
| `x`, `y`, `width`, `height` | INT | Posizione/dimensione su canvas |
| `z_index` | INT | Ordine rendering |
| `capacity` | INT | Default `10` |
| `color` | TEXT | Default `#1e293b` |
| `department` | TEXT | Es. "Marketing" |
| `icon` | TEXT | |
| `background_image_url` | TEXT | |
| `is_locked` | BOOL | |
| `who_can_enter` | TEXT | `owner/admin/member/guest` |
| `who_can_moderate` | TEXT | `owner/admin/member/guest` |

#### `room_connections` (3 rows)
Connessioni visive tra stanze.

| Colonna | Tipo | Note |
|---------|------|------|
| `room_a_id`, `room_b_id` | UUID FK → rooms | |
| `space_id` | UUID FK → spaces | |
| `type` | TEXT | `door/portal/stairs/elevator/link` |
| `label`, `color` | TEXT | Styling |
| `cp_offset_x/y` | FLOAT | Control point per curva Bézier |

#### `furniture` (0 rows)
Mobili/oggetti in stanza: `type`, `label`, posizione, `rotation`, `settings` JSONB.

---

### 👁️ Presenza

#### `room_participants` (0 rows)
Chi è in quale stanza **adesso**. Posizione avatar, stato media.

| Colonne principali | Note |
|---|---|
| `room_id`, `user_id` | FK |
| `x`, `y`, `direction` | Posizione avatar |
| `audio_enabled`, `video_enabled`, `screen_sharing` | Stato media |
| `hand_raised` | Bool |
| `is_kicked/is_muted` | Moderazione |

#### `user_presence` (0 rows)
Stato online per workspace. **PK**: `user_id`.

#### `presence_events` (6560 rows)
Log storico posizioni avatar per analytics.

---

### 💬 Chat

#### `conversations` (0 rows)
Container: `type` = `room` | `channel` | `direct`.

#### `conversation_members` (0 rows)
Partecipanti con `notification_settings` JSONB.

#### `messages` (2 rows)
Messaggi: `content`, `type` (text/image/file/system).

#### `space_chat_messages` (0 rows)
Chat globale space/stanza: `sender_id`, `sender_name`, `content`, `room_id`.

#### `message_attachments` (1 row)
File allegati: `file_name`, `mime_type`, `storage_path`, `public_url`.

#### `whiteboard_strokes` (0 rows)
Dati lavagna: `stroke_data` JSONB, `user_id`, `room_id`.

---

### ⚖️ Moderazione

#### `room_kicks` (0 rows) — `reason`, `can_reenter`, `banned_until`
#### `room_mutes` (0 rows) — `mute_type`, `expires_at`, `unmuted_at/by`

---

### 💳 Billing

#### `billing_events` (0 rows)
Log eventi billing: `plan_upgrade/downgrade`, `payment`, `refund`, `trial_start/end`.

#### `payments` (0 rows)
Pagamenti registrati con `receipt_number`, `receipt_data` JSONB.

#### `invoices` (0 rows)
Fatture: `seats`, `price_per_seat_cents`, `total_cents`, `seller/buyer_snapshot` JSONB.

---

### 🛡️ Piattaforma

#### `platform_settings` (1 row) — Configurazione globale `key/value` JSONB
#### `platform_metrics` (0 rows) — Metriche giornaliere piattaforma
#### `owner_registration_tokens` (1 row) — Token speciali per registrazione owner
#### `login_events` (51 rows) — Log login/logout/signup/failed
#### `admin_transfers` (0 rows) — Storico trasferimenti superadmin

---

### 🎫 Supporto

#### `support_tickets` (2 rows) — Ticket con `category`, `priority`, `status`
#### `ticket_messages` (0 rows) — Messaggi dentro un ticket
#### `bug_reports` (4 rows) — Segnalazioni bug con `severity`, `screenshot_url`
#### `upgrade_requests` (0 rows) — Richieste upgrade da utenti

---

## Funzioni SQL (RPC)

### Autorizzazione
| Funzione | Scopo |
|----------|-------|
| `is_workspace_member(workspace_id)` | Verifica appartenenza |
| `is_workspace_admin(workspace_id)` | Admin o owner |
| `is_workspace_owner(workspace_id)` | Solo owner |
| `can_enter_room(room_id)` | Check ruolo per stanza |
| `can_moderate_user(workspace_id, target_user_id)` | Gerarchia ruoli |

### Moderazione
| Funzione | Azione |
|----------|--------|
| `kick_user_from_room(...)` | Kick + audit + notifica |
| `ban_user_from_workspace(...)` | Ban + remove |
| `mute_user_in_room(...)` | Mute temporaneo |

### Inviti
| Funzione | Azione |
|----------|--------|
| `get_invite_info(token)` | Info invito (SECURITY DEFINER) |
| `accept_invite_link(token)` | Accetta invito |

---

## Trigger Attivi

| Trigger | Tabella | Azione |
|---------|---------|--------|
| `on_auth_user_created` | `auth.users` | Crea profilo in `profiles` |
| `on_workspace_created` | `workspaces` | Aggiunge owner come membro |
| `track_login_event` | `auth.users` | Log in `login_events` |
| `*_updated_at` | Multiple | Auto-update `updated_at` |

---

## Realtime

Tabelle con **Supabase Realtime** attivo:

| Tabella | Uso |
|---------|-----|
| `room_participants` | Presenza in stanza |
| `messages` | Chat real-time |
| `user_presence` | Stato online |
| `rooms` | Aggiornamenti stanze |
| `room_connections` | Connessioni |
| `space_chat_messages` | Chat space |
| `whiteboard_strokes` | Lavagna |
