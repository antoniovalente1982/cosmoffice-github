# Edge Functions - Guida

## Deploy

```bash
# Deploy tutte le funzioni
supabase functions deploy

# Deploy singola funzione
supabase functions deploy manage-member
supabase functions deploy cleanup-presence
supabase functions deploy join-workspace
```

## Configurazione Secrets

```bash
# Necessario per le edge functions
supabase secrets set SUPABASE_URL=<your-url>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-key>
supabase secrets set SUPABASE_ANON_KEY=<your-key>
```

## Funzioni Disponibili

### 1. `manage-member`
Gestisce tutte le operazioni di moderazione.

**Endpoint:** `POST /functions/v1/manage-member`

**Actions:**
- `ban` - Banna utente dal workspace
- `unban` - Revoca ban
- `kick` - Kicka da stanza
- `mute` - Muta in stanza
- `unmute` - Smuta
- `change_role` - Cambia ruolo
- `remove` - Rimuovi dal workspace

**Esempio:**
```ts
const { banUser, kickUser } = useEdgeFunctions();

await banUser(workspaceId, userId, { 
  reason: 'Spam', 
  durationMinutes: 60 // temporaneo, omesso = permanente
});

await kickUser(workspaceId, roomId, userId, {
  reason: 'Comportamento inappropriato',
  durationMinutes: 30 // non può rientrare per 30 min
});
```

### 2. `cleanup-presence`
Heartbeat e cleanup utenti inattivi.

**Endpoint:** `POST /functions/v1/cleanup-presence`

**Chiamato automaticamente da:** `usePresenceManager`

**Features:**
- Mantiene utente come "online"
- Rimuove utenti inattivi (>5 min)
- Aggiorna `last_active_at`

### 3. `join-workspace`
Gestisce inviti e richieste di accesso.

**Endpoint:** `POST /functions/v1/join-workspace`

**Types:**
- `invitation` - Accetta invito via token
- `request` - Richiedi accesso

**Esempio:**
```ts
const { acceptInvitation, requestAccess } = useEdgeFunctions();

// Accetta invito
await acceptInvitation('token-dall-email');

// Richiedi accesso
await requestAccess(workspaceId, 'Messaggio opzionale');
```

## Vantaggi Edge Functions

1. **Sicurezza** - Codice gira server-side con service_role
2. **Atomicità** - Operazioni complesse sono transazioni
3. **Audit** - Ogni azione è loggata automaticamente
4. **Notifiche** - Utenti ricevono notifiche real-time
5. **Cleanup** - Rimuove da tutte le stanze automaticamente

## Cron Job (Opzionale)

Per cleanup automatico ogni minuto:

```sql
-- In Supabase SQL Editor
select cron.schedule('cleanup-presence', '* * * * *', $$
  select net.http_post(
    url:='https://<project>.supabase.co/functions/v1/cleanup-presence',
    headers:='{"Authorization": "Bearer <anon-key>"}'::jsonb
  );
$$);
```

O usa una edge function schedulata con pg_cron.
