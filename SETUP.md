# COSMOFFICE - Setup Completo

## 1. Prerequisiti

- Node.js 18+
- Supabase CLI
- Account Supabase

## 2. Installazione

```bash
# Installa dipendenze
npm install

# Installa Supabase CLI se non lo hai
npm install -g supabase
```

## 3. Configura Supabase

### 3.1 Crea progetto
```bash
supabase login
supabase init
```

### 3.2 Applica Schema
```bash
# Nel SQL Editor di Supabase Dashboard, esegui:
# 1. supabase/schema_v2_complete.sql
# 2. supabase/migration_rbac_moderation.sql
```

### 3.3 Deploy Edge Functions
```bash
supabase functions deploy manage-member
supabase functions deploy cleanup-presence
supabase functions deploy join-workspace
```

### 3.4 Configura Secrets
```bash
supabase secrets set SUPABASE_URL=<your-project-url>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
supabase secrets set SUPABASE_ANON_KEY=<your-anon-key>
```

## 4. Configura Next.js

### 4.1 Environment Variables
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=<your-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 4.2 Configura Realtime
```sql
-- Assicurati che realtime sia abilitato
alter publication supabase_realtime add table room_participants;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table user_presence;
alter publication supabase_realtime add table workspace_members;
```

## 5. Avvia Development

```bash
npm run dev
```

## 6. Verifica Setup

### Test Auth
- Registra un utente
- Verifica che venga creato in `profiles`

### Test Workspace
- Crea un workspace
- Verifica che tu sia owner
- Verifica che i permessi default siano creati

### Test Room
- Crea uno space e una room
- Entra nella room
- Verifica presence in `room_participants`

### Test Moderazione
- Invita un altro utente (guest)
- Prova a kickarlo (dovrebbe funzionare)
- Prova a bannarlo (dovrebbe funzionare)

## 7. Production Checklist

### Database
- [ ] RLS abilitato su TUTTE le tabelle
- [ ] Indici creati
- [ ] Backup configurato

### Security
- [ ] Secrets configurati
- [ ] CORS limitato ai domini production
- [ ] Row limits su tabelle (se necessario)

### Performance
- [ ] Connection pooling abilitato
- [ ] CDN configurato per assets
- [ ] Realtime limits controllati

### Monitoring
- [ ] Log drain configurato
- [ ] Alert CPU/RAM attivi
- [ ] Error tracking (Sentry)

## 8. Comandi Utili

```bash
# Reset database locale
supabase db reset

# Genera tipi TypeScript
supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts

# Logs edge functions
supabase functions logs manage-member

# Stats database
supabase inspect db size
```

## 9. Troubleshooting

### "Non autorizzato" su edge function
- Verifica JWT token
- Verifica secrets configurati

### Utenti non vedono dati
- Controlla RLS policies
- Verifica `is_workspace_member()` function

### Presence non funziona
- Verifica subscription realtime
- Controlla heartbeat interval
- Verifica edge function cleanup-presence

### Messaggi non arrivano in real-time
- Verifica `alter publication supabase_realtime`
- Controlla filtri subscription

## 10. Next Steps

1. **UI Components** - Crea interfaccia con i hooks forniti
2. **Onboarding** - Flusso per nuovi utenti
3. **Integrations** - Slack, Google Calendar, etc.
4. **Billing** - Stripe per piani a pagamento
5. **Mobile App** - React Native con stesso backend

## Supporto

- Docs: `/docs/`
- API Reference: `/docs/USAGE_GUIDE.md`
- Architecture: `/docs/ARCHITECTURE.md`
- Edge Functions: `/docs/EDGE_FUNCTIONS.md`
