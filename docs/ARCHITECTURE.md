# Architettura COSMOFFICE

## Stack Tecnologico

- **Frontend:** Next.js 14 + React + TypeScript
- **Backend:** Supabase (Postgres + Realtime + Edge Functions)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Realtime:** Supabase Realtime (WebSockets)

## Isolamento Multi-Tenant

```
┌─────────────────────────────────────────┐
│           COFFICE SAAS                 │
│  ┌─────────────────────────────────┐    │
│  │   Workspace: "ACME Corp"        │    │
│  │   ├── Space: "Ufficio Milano"   │    │
│  │   │   ├── Room: "Sala Riunioni" │    │
│  │   │   └── Room: "Open Space"    │    │
│  │   └── Space: "Ufficio Roma"     │    │
│  └─────────────────────────────────┘    │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │   Workspace: "StartupXYZ"       │    │
│  │   └── Space: "HQ Virtuale"      │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

Ogni workspace è completamente isolato:
- RLS policies garantiscono accesso solo ai propri dati
- Edge functions verificano permessi server-side
- Audit trail per ogni workspace separato

## Flusso Dati

### 1. Autenticazione
```
Login → Supabase Auth → JWT Token → Middleware Next.js → Accesso
```

### 2. Accesso Workspace
```
/w/:slug → Middleware → Verifica membership → Carica workspace
                    ↓
              Se non membro → Redirect /join
              Se bannato → Redirect /banned
              Se OK → Render page
```

### 3. Entrata Stanza
```
Click "Entra" → joinRoom() → Insert room_participants
                        → Subscribe realtime presence
                        → Start heartbeat
                        → Update user_presence
```

### 4. Moderazione
```
Click "Kick" → Edge Function → Verifica permessi
                           → Delete room_participants
                           → Insert room_kicks
                           → Send notification
                           → Audit log
```

## Sicurezza a Livelli

### Livello 1: RLS (Row Level Security)
```sql
-- Esempio: user vede solo i suoi workspace
CREATE POLICY "Workspaces viewable by members"
  ON workspaces FOR SELECT
  USING (is_workspace_member(id));
```

### Livello 2: Edge Functions
```typescript
// Verifica server-side prima di eseguire
if (!canModerateUser(adminId, targetId)) {
  throw new Error('Non autorizzato');
}
```

### Livello 3: Middleware Next.js
```typescript
// Blocca accesso a route protette
if (!session) redirect('/login');
if (!isMember) redirect('/join');
```

### Livello 4: UI (Optional)
```tsx
// Nascondi bottoni se non hai permessi
{canKick && <KickButton />}
```

## Realtime Architecture

### Canali WebSocket
```
room_participants:{roomId}    → Chi entra/esce dalla stanza
messages:{conversationId}     → Nuovi messaggi
user_presence:{workspaceId}   → Chi è online
workspace_members:{workspaceId} → Cambi ruoli
room_mutes:{roomId}           → Mute/unmute
```

### Presence Management
```
utente attivo → heartbeat ogni 30s → Edge Function
      ↓
  tab inattiva → status = 'away'
      ↓
  chiude tab → beforeunload → status = 'offline'
      ↓
  5 min senza heartbeat → Auto-cleanup
```

## Database Performance

### Indici Critici
```sql
-- Ricerca rapida membri workspace
CREATE INDEX idx_workspace_members_lookup 
  ON workspace_members(workspace_id, user_id) 
  WHERE removed_at IS NULL;

-- Messaggi recenti
CREATE INDEX idx_messages_conversation_time 
  ON messages(conversation_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Utenti online
CREATE INDEX idx_presence_workspace_status 
  ON user_presence(workspace_id, status) 
  WHERE status != 'offline';
```

### Partizionamento (Futuro)
Per scale > 1M messaggi:
```sql
-- Partiziona messaggi per mese
CREATE TABLE messages_2024_01 PARTITION OF messages
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Gerarchia Ruoli

```
OWNER (4)
  └── Può: Tutto + cancellare workspace + gestire billing

ADMIN (3)  
  └── Può: Moderare tutti tranne owner + gestire settings

MEMBER (2)
  └── Può: Usare spaces/rooms + chattare

GUEST (1)
  └── Può: Accedere su invito + navigazione limitata

VIEWER (0)
  └── Può: Solo guardare (read-only)
```

## Audit Trail

Ogni azione importante è loggata:
```typescript
{
  id: "uuid",
  workspace_id: "uuid",
  user_id: "uuid",          // Chi ha fatto l'azione
  action: "user.banned",    // Cosa è successo
  entity_type: "member",    // Tipo oggetto
  entity_id: "uuid",        // ID oggetto
  metadata: { ... },        // Dettagli extra
  old_values: { role: "member" },
  new_values: { role: "admin" },
  created_at: "timestamp"
}
```

## Scaling Considerazioni

### Current: < 1000 utenti/workspace
- Tutto su Supabase managed
- Edge functions per operazioni pesanti
- Realtime per presence/chat

### Future: > 10K utenti/workspace
1. **Read Replicas** - Query analytics su replica
2. **Connection Pooling** - PgBouncer per connessioni
3. **CDN** - Assets statici su CDN
4. **Edge Caching** - Cache permessi/workspace

## Monitoring

### Metriche Importanti
- Utenti attivi simultanei (per room)
- Latenza heartbeat (>5s = warning)
- Errori edge functions
- Dimensione database (cleanup vecchi messaggi)

### Alert
```
- CPU Supabase > 80%
- Utenti in stanza > capacity
- Errori 5xx > 1%
- Presence stale > 100 utenti
```

## Deployment Checklist

- [ ] Schema SQL applicato
- [ ] Edge Functions deployate
- [ ] RLS abilitato su tutte le tabelle
- [ ] Realtime configurato
- [ ] Storage buckets creati
- [ ] Secrets configurati
- [ ] Cron job presence (opzionale)
- [ ] Domini CORS configurati
- [ ] Backup automatizzato
