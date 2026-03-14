# 🗺️ Cosmoffice — Mappa Pagine & API

> **Ultimo aggiornamento**: 2026-03-14
> Questo documento elenca **tutte** le pagine e API routes dell'applicazione.

---

## Pagine Frontend (26)

### 🌐 Pubbliche (no login richiesto)

| Route | File | Descrizione |
|-------|------|-------------|
| `/` | `app/page.tsx` | Landing page marketing |
| `/login` | `app/login/page.tsx` | Login con email/password o magic link |
| `/signup` | `app/signup/page.tsx` | Registrazione nuovo utente |
| `/set-password` | `app/set-password/page.tsx` | Impostazione password dopo magic link |
| `/pricing` | `app/pricing/page.tsx` | Pagina prezzi piani |
| `/logo-showcase` | `app/logo-showcase/page.tsx` | Showcase del logo Cosmoffice |
| `/invite/[token]` | `app/invite/[token]/page.tsx` | Accettazione invito workspace via token |
| `/register/owner` | `app/register/owner/page.tsx` | Registrazione owner con token di invito speciale |

### 🏢 Office (login + membership richiesto)

| Route | File | Descrizione |
|-------|------|-------------|
| `/office` | `app/office/page.tsx` | Dashboard selezione workspace/space |
| `/office/[id]` | `app/office/[id]/page.tsx` | Ufficio virtuale 2D (PixiJS canvas, avatar, stanze, chat, whiteboard) |

### 🔑 SuperAdmin (login + `is_super_admin = true`)

| Route | File | Descrizione |
|-------|------|-------------|
| `/superadmin` | `app/superadmin/page.tsx` | Dashboard principale con metriche piattaforma |
| `/superadmin/login` | `app/superadmin/login/page.tsx` | Login dedicato superadmin |
| `/superadmin/analytics` | `app/superadmin/analytics/page.tsx` | Analytics avanzate utenti e workspace |
| `/superadmin/audit` | `app/superadmin/audit/page.tsx` | Log audit trail di tutte le azioni |
| `/superadmin/bugs` | `app/superadmin/bugs/page.tsx` | Gestione bug report |
| `/superadmin/customers` | `app/superadmin/customers/page.tsx` | Lista clienti/workspace con dettagli |
| `/superadmin/livekit` | `app/superadmin/livekit/page.tsx` | Monitor WebRTC LiveKit in tempo reale |
| `/superadmin/email` | `app/superadmin/email/page.tsx` | Invio email ai clienti (Resend) |
| `/superadmin/fix-roles` | `app/superadmin/fix-roles/page.tsx` | Tool per fix ruoli corrotti |
| `/superadmin/infrastructure` | `app/superadmin/infrastructure/page.tsx` | Stato infrastruttura (Supabase, Vercel, PartyKit) |
| `/superadmin/payments` | `app/superadmin/payments/page.tsx` | Gestione pagamenti e ricevute |
| `/superadmin/revenue` | `app/superadmin/revenue/page.tsx` | Dashboard ricavi e MRR |
| `/superadmin/security` | `app/superadmin/security/page.tsx` | Audit sicurezza e RLS |
| `/superadmin/support` | `app/superadmin/support/page.tsx` | Gestione ticket supporto |
| `/superadmin/transfer` | `app/superadmin/transfer/page.tsx` | Trasferimento ownership workspace |
| `/superadmin/upgrade-requests` | `app/superadmin/upgrade-requests/page.tsx` | Richieste upgrade piano |

---

## API Routes (29)

### 🔐 Auth

| Route | Metodo | Descrizione | Tabelle |
|-------|--------|-------------|---------|
| `/api/auth/email-hook` | POST | Webhook per eventi auth Supabase | `profiles` |
| `/auth/callback` | GET | Callback OAuth / magic link | — |

### 🏢 Workspace

| Route | Metodo | Descrizione | Tabelle |
|-------|--------|-------------|---------|
| `/api/workspaces/analytics` | GET | Metriche workspace (membri, ruoli, stanze) | `workspace_members`, `spaces`, `rooms`, `workspace_invitations` |
| `/api/workspaces/online-count` | GET | Conteggio utenti online | `spaces`, `room_participants` |
| `/api/workspaces/invites/revoke` | POST | Revoca invito | `workspace_invitations` |

### 💳 Stripe / Billing

| Route | Metodo | Descrizione | Tabelle |
|-------|--------|-------------|---------|
| `/api/stripe/checkout` | POST | Crea sessione checkout Stripe | `workspace_members`, `workspaces`, `profiles` |
| `/api/stripe/portal` | POST | Apri portale billing Stripe | `workspace_members`, `workspaces` |
| `/api/stripe/plan-status` | GET | Stato piano corrente | `workspace_members`, `workspaces`, `spaces` |
| `/api/webhooks/stripe` | POST | Webhook Stripe (pagamenti, sottoscrizioni) | `workspaces`, `billing_events` |

### 🎫 Supporto

| Route | Metodo | Descrizione | Tabelle |
|-------|--------|-------------|---------|
| `/api/support-ticket` | POST | Crea ticket supporto | `profiles`, `workspace_members`, `support_tickets` |
| `/api/support/messages` | GET/POST | Messaggi ticket | `ticket_messages` |
| `/api/bug-report` | POST | Segnala bug | `profiles`, `support_tickets` |
| `/api/upgrade-request` | POST | Richiesta upgrade piano | `support_tickets`, `profiles` |

### 🛡️ Admin (richiede `is_super_admin`)

| Route | Metodo | Descrizione | Tabelle |
|-------|--------|-------------|---------|
| `/api/admin/stats` | GET | Statistiche piattaforma globali | `profiles`, `workspaces`, `workspace_members` |
| `/api/admin/stats/growth` | GET | Metriche crescita nel tempo | `workspace_members`, `login_events` |
| `/api/admin/workspaces` | GET/PATCH | Lista e gestione workspace | `workspaces`, `workspace_members` |
| `/api/admin/bugs` | GET/PATCH | Gestione bug report | `bug_reports` |
| `/api/admin/audit` | GET | Log audit trail | `workspace_audit_logs` |

| `/api/admin/security` | GET | Check sicurezza RLS | meta-query |
| `/api/admin/support-tickets` | GET/POST/PATCH/DELETE | CRUD ticket supporto | `support_tickets`, `ticket_messages` |
| `/api/admin/transfer` | POST | Trasferisci ownership | `workspace_members`, `admin_transfers` |
| `/api/admin/upgrade-requests` | GET/PATCH | Gestione richieste upgrade | `upgrade_requests` |
| `/api/admin/owner-tokens` | GET/POST | Token registrazione owner | `owner_registration_tokens` |
| `/api/admin/receipt` | POST | Genera ricevuta pagamento | `payments` |
| `/api/admin/cleanup` | POST | Pulizia dati orfani | multi-tabella |
| `/api/admin/presence-analytics` | GET | Analytics presenza utenti | `presence_events` |
| `/api/admin/livekit` | GET | Stato LiveKit rooms | API esterna |

### 🎤 Media

| Route | Metodo | Descrizione | Tabelle |
|-------|--------|-------------|---------|
| `/api/livekit/token` | POST | Token accesso LiveKit room | — (API esterna) |

---

## Componenti Chiave per Pagina

### `/office/[id]` — Ufficio Virtuale (pagina principale)

```
PixiOffice          → Canvas 2D con avatar, stanze, connessioni (PixiJS)
├── UserAvatar      → Avatar utente con bubble video
├── ProximityAura   → Aura di prossimità tra utenti
├── MiniMap         → Minimappa navigazione
├── RoomEditor      → Editor stanza inline
└── KnockNotification → Notifica bussata alla porta

OfficeBuilder       → Pannello costruzione ufficio (right sidebar)
├── BuilderRoomProperties    → Editing proprietà stanza
├── BuilderConnectionsPanel  → Gestione connessioni tra stanze
└── BuilderTemplatesPicker   → Selezione template ufficio

Whiteboard          → Lavagna collaborativa (canvas 2D)
RoomChat            → Chat in stanza
MobileOfficeView    → Vista mobile semplificata
OfficeAnalytics     → Dashboard analytics workspace
OnboardingTour      → Tour guidato nuovi utenti
```
