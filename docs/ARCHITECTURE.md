# 🏗️ Cosmoffice — Architettura

> **Ultimo aggiornamento**: 2026-03-14

---

## Stack Tecnologico

| Layer | Tecnologia | Scopo |
|-------|-----------|-------|
| **Frontend** | Next.js 14 (App Router) + React 18 + TypeScript | SSR, routing, UI |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **State** | Zustand (8 stores) | State management client-side |
| **Animazioni** | Framer Motion | Transizioni e micro-animazioni |
| **Icone** | Lucide React | Set icone SVG |
| **2D Rendering** | PixiJS | Canvas ufficio virtuale (avatar, stanze, connessioni) |
| **Database** | Supabase (PostgreSQL 17) | 30 tabelle, RLS, triggers, funzioni SQL |
| **Auth** | Supabase Auth | Email/password, magic link, OAuth |
| **Storage** | Supabase Storage | Upload file e immagini |
| **Realtime Sync** | PartyKit | Sincronizzazione posizioni avatar in tempo reale |
| **Video/Audio** | LiveKit | WebRTC per videochiamate e audio spaziale |
| **Email** | Resend | Email transazionali |
| **Pagamenti** | Stripe | Checkout, sottoscrizioni, webhook |
| **Deploy** | Vercel | Hosting frontend + API routes |
| **i18n** | Custom (TypeScript) | 3 lingue: IT, EN, ES |

---

## Diagramma Architetturale

```
┌─────────────────────────────────────────────────────────────┐
│                       BROWSER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Next.js UI  │  │  PixiJS      │  │  LiveKit SDK      │  │
│  │  (React)     │  │  (2D Canvas) │  │  (WebRTC)         │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────────┘  │
│         │                 │                   │              │
│  ┌──────┴─────────────────┴───────────────────┴──────────┐  │
│  │              Zustand Stores (8)                        │  │
│  │  avatar · media · workspace · comms · chat ·           │  │
│  │  whiteboard · call · notification                      │  │
│  └──────┬─────────────────┬───────────────────┬──────────┘  │
└─────────┼─────────────────┼───────────────────┼─────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌─────────────────┐ ┌──────────────┐ ┌─────────────────────┐
│  Supabase       │ │  PartyKit    │ │  LiveKit Cloud      │
│  ├ PostgreSQL   │ │  (WebSocket) │ │  (SFU Server)       │
│  ├ Auth         │ │              │ │                     │
│  ├ Realtime     │ │  Sync avatar │ │  Audio/Video/Screen │
│  ├ Storage      │ │  positions   │ │  sharing            │
│  └ Edge Funcs   │ │  + presence  │ │                     │
└─────────────────┘ └──────────────┘ └─────────────────────┘
          │
          ▼
┌─────────────────┐ ┌──────────────┐
│  Stripe         │ │  Resend      │
│  Pagamenti      │ │  Email       │
└─────────────────┘ └──────────────┘
```

---

## Struttura Directory

```
cosmoffice/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing page
│   ├── login/                    # Autenticazione
│   ├── office/                   # Ufficio virtuale
│   │   ├── page.tsx              # Selezione workspace
│   │   └── [id]/page.tsx         # Canvas ufficio (pagina principale)
│   ├── superadmin/               # 16 pagine admin piattaforma
│   ├── api/                      # 29 API routes
│   │   ├── admin/                # API superadmin
│   │   ├── stripe/               # Checkout, portal, webhook
│   │   ├── workspaces/           # Analytics, inviti, online count
│   │   └── livekit/              # Token WebRTC
│   └── auth/callback/            # OAuth callback
│
├── components/
│   ├── office/                   # Componenti ufficio virtuale
│   │   ├── PixiOffice.tsx        # Canvas 2D principale (PixiJS)
│   │   ├── OfficeBuilder.tsx     # Builder stanze/connessioni
│   │   ├── builder/              # Sub-componenti builder estratti
│   │   │   ├── BuilderRoomProperties.tsx
│   │   │   ├── BuilderConnectionsPanel.tsx
│   │   │   └── BuilderTemplatesPicker.tsx
│   │   ├── Whiteboard.tsx        # Lavagna collaborativa
│   │   ├── RoomChat.tsx          # Chat in stanza
│   │   ├── UserAvatar.tsx        # Avatar utente + bubble video
│   │   ├── ProximityAura.tsx     # Aura di prossimità
│   │   ├── MiniMap.tsx           # Minimappa navigazione
│   │   ├── MobileOfficeView.tsx  # Vista mobile
│   │   ├── OnboardingTour.tsx    # Tour guidato
│   │   └── OfficeAnalytics.tsx   # Dashboard analytics
│   ├── billing/                  # TrialBanner, piani
│   ├── chat/                     # Componenti chat
│   ├── media/                    # Controlli audio/video
│   ├── settings/                 # Impostazioni workspace
│   ├── superadmin/               # Componenti admin
│   ├── ui/                       # Componenti UI riusabili
│   └── workspace/                # Componenti workspace
│
├── stores/                       # Zustand stores (8)
│   ├── avatarStore.ts            # Posizioni e stato avatar
│   ├── mediaStore.ts             # Stato audio/video/screen
│   ├── workspaceStore.ts         # Workspace corrente, membri, stanze
│   ├── commsStore.ts             # Comunicazioni PartyKit
│   ├── chatStore.ts              # Messaggi chat
│   ├── whiteboardStore.ts        # Stato whiteboard
│   ├── callStore.ts              # Stato chiamate LiveKit
│   └── notificationStore.ts      # Notifiche browser
│
├── hooks/                        # Custom hooks (20)
│   ├── useOffice.ts              # Dati ufficio (workspace, space, stanze)
│   ├── usePresence.ts            # Presenza utente
│   ├── useProximityAndRooms.ts   # Logica prossimità avatar + cambio stanza
│   ├── useAvatarSync.ts          # Sync posizioni via PartyKit
│   ├── useWhiteboard.ts          # Logica whiteboard
│   ├── useRoom.ts                # Entrata/uscita stanza
│   ├── useRoomChat.ts            # Chat di stanza
│   ├── useOfficeChat.ts          # Chat globale ufficio
│   ├── useModeration.ts          # Kick, ban, mute
│   ├── usePermissions.ts         # Check permessi RBAC
│   ├── useWorkspaceRole.ts       # Ruolo utente nel workspace
│   ├── useWorkspace.ts           # CRUD workspace
│   ├── useWorkspaceMembers.ts    # Lista e gestione membri
│   ├── useEdgeFunctions.ts       # Wrapper Supabase Edge Functions
│   ├── useKnockToEnter.ts        # Bussata alla porta stanza chiusa
│   ├── useAutoAway.ts            # Auto away dopo inattività
│   ├── useSpatialAudio.ts        # Audio spaziale basato su prossimità
│   ├── useCurrentUser.ts         # Profilo utente corrente
│   └── useCurrency.ts            # Format valuta
│
├── lib/
│   ├── i18n/                     # Traduzioni (it.ts, en.ts, es.ts)
│   ├── supabase/                 # Client Supabase (server + browser)
│   ├── officeTemplates.ts        # Template uffici preconfigurati
│   ├── officeThemes.ts           # Temi visivi ufficio
│   ├── errorHandler.ts           # Error handler centralizzato
│   ├── stripe.ts                 # Client Stripe
│   ├── resend.ts                 # Template email
│   └── currency.ts               # Utility valuta
│
├── types/                        # Tipi TypeScript centralizzati
│   └── index.ts                  # UserProfile, Workspace, LayoutData, ecc.
│
├── partykit/                     # Server PartyKit (WebSocket)
│   └── server.ts                 # Sync avatar positions + presence
│
├── supabase/
│   └── functions/                # Edge Functions deployate
│
├── middleware.ts                  # Auth + membership check per ogni route
└── docs/                         # Documentazione
    ├── ARCHITECTURE.md           # ← Questo file
    ├── DATABASE_SCHEMA.md        # Schema database
    └── PAGES.md                  # Mappa pagine e API
```

---

## Flussi Dati Principali

### 1. Autenticazione
```
Browser → /login → Supabase Auth → JWT → middleware.ts
  → Verifica sessione
  → Verifica membership workspace
  → Se OK → Render pagina
  → Se no → Redirect /login o /join
```

### 2. Ufficio Virtuale (pagina principale)
```
/office/[id] carica:
  1. useOffice()      → Fetch workspace + space + rooms da Supabase
  2. PixiOffice       → Render canvas 2D (stanze, connessioni, lobby)
  3. useAvatarSync()  → Connetti PartyKit WebSocket → Sync posizioni
  4. usePresence()    → Traccia presenza utente
  5. LiveKit          → Se in stanza con altri → Avvia audio/video
```

### 3. Movimento Avatar (real-time)
```
Mouse click → avatarStore.setTarget(x, y)
  → PixiJS lerp animation (30fps)
  → useAvatarSync → PartyKit broadcast (throttled 30s/60s backoff)
  → Altri client ricevono → Aggiornano sprite PixiJS
```

### 4. Prossimità e Stanze
```
useProximityAndRooms() loop continuo:
  → Calcola distanza avatar ↔ bordo stanza
  → Se <50px → "near room" → mostra UI entrata
  → Se dentro bounds → auto-join room
  → Se dentro bounds di altro utente → attiva aura prossimità
  → Se <200px da altro utente → LiveKit connette audio
```

### 5. Whiteboard Collaborativo
```
Canvas mousedown → whiteboardStore aggiunge stroke
  → useWhiteboard() → PartyKit broadcast stroke data
  → Periodicamente → Supabase save (whiteboard_strokes)
  → Altri client → Ricevono via PartyKit → Renderizzano
```

---

## Sicurezza (4 livelli)

| Livello | Dove | Cosa fa |
|---------|------|---------|
| **1. RLS** | PostgreSQL | Row Level Security su tutte le 30 tabelle |
| **2. Edge Functions** | Supabase | Verifica gerarchia ruoli server-side |
| **3. Middleware** | Next.js | Check sessione + membership per ogni route |
| **4. UI** | React | Nasconde azioni in base ai permessi |

### Gerarchia Ruoli RBAC
```
Owner (4) → Tutto + billing + eliminare workspace
Admin (3) → Moderazione + impostazioni
Member (2) → Uso base (stanze, chat)
Guest (1) → Accesso limitato su invito
```

---

## Servizi Esterni

| Servizio | Piano | Scopo | Limiti |
|----------|-------|-------|--------|
| **Supabase** | Free/Pro | DB + Auth + Realtime + Storage | 500MB DB, 50K auth users |
| **PartyKit** | Free | WebSocket sync avatar | 100 connessioni simultanee |
| **LiveKit** | Free | WebRTC audio/video | 100 min/mese |
| **Vercel** | Free/Pro | Hosting + API routes | 100GB bandwidth |
| **Stripe** | Pay-as-you-go | Pagamenti | 2.9% + €0.30/transazione |
| **Resend** | Free | Email transazionali | 100 email/giorno |

---

## Deploy

```bash
# Frontend (Vercel)
git push origin main  # Auto-deploy via Vercel GitHub integration

# PartyKit
npx partykit deploy   # Deploy WebSocket server

# Edge Functions
# Gestite via Supabase Dashboard o supabase CLI
```

### Environment Variables Richieste
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_PARTYKIT_HOST=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
NEXT_PUBLIC_LIVEKIT_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
RESEND_API_KEY=
```
