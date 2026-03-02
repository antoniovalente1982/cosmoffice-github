# Handoff — CosmoOffice Rooms + Proximity System

## Stato Attuale (2 Marzo 2026)

### Git
- **Branch `main`**: Commit `f694f480` — include Step 1/6 (store extensions)
- **Branch `backup-rooms-and-proximity`**: Contiene TUTTO il lavoro completo (16 file, +1908 righe)
- **Repo**: `antoniovalente1982/cosmoffice-github`

### Vercel
- **PROBLEMA ATTIVO**: Vercel ha un issue infrastrutturale — TUTTI i nuovi deploy falliscono con `Error: We encountered an internal error. Please try again.` nella fase "Deploying outputs" (dopo il build che completa correttamente)
- **Versione online**: cosmoffice.io funziona con `80db9efa` + Step 1 stores (anche se il deploy di Step 1 è fallito, il sito serve ancora il deploy precedente)
- Controlla https://www.vercel-status.com prima di fare nuovi push
- Se il problema persiste, **creare un nuovo progetto Vercel** collegato allo stesso repo

### PartyKit
- Il server PartyKit (`partykit/server.ts`) è stato modificato nella branch backup ma NON ancora deployato
- PartyKit si deploya separatamente con: `npx partykit deploy`

---

## Piano Incrementale (6 Step)

Ogni step deve essere: checkout dal backup → build locale → commit → push → verifica deploy Vercel OK → procedere.

### ✅ Step 1: Store Extensions (FATTO — pushato su main)
```bash
# GIÀ COMPLETATO — i file sono già su main
# stores/avatarStore.ts, stores/dailyStore.ts, stores/workspaceStore.ts
```

### ⬜ Step 2: Utility Files
```bash
cd /Users/antoniovalente/Desktop/cosmoffice-github-1
git checkout backup-rooms-and-proximity -- utils/wallDetection.ts utils/avatarStateMachine.ts
npm run build
git add -A && git commit -m "feat: add wall detection and avatar state machine utilities (Step 2/6)"
git push origin main
# ASPETTARE che il deploy Vercel passi prima di procedere
```

### ⬜ Step 3: Nuovi Hook + Componenti
```bash
git checkout backup-rooms-and-proximity -- hooks/useProximityAndRooms.ts hooks/useKnockToEnter.ts components/office/ProximityAura.ts components/office/AdminContextMenu.tsx components/office/KnockNotification.tsx
npm run build
git add -A && git commit -m "feat: add proximity hooks and UI components (Step 3/6)"
git push origin main
# ASPETTARE deploy
```

### ⬜ Step 4: PartyKit Server
```bash
git checkout backup-rooms-and-proximity -- partykit/server.ts
npm run build
git add -A && git commit -m "feat: extend PartyKit server with room/admin messages (Step 4/6)"
git push origin main
# ASPETTARE deploy Vercel
# POI deployare PartyKit separatamente:
npx partykit deploy
```

### ⬜ Step 5: useAvatarSync + DailyManager
```bash
git checkout backup-rooms-and-proximity -- hooks/useAvatarSync.ts components/DailyManager.tsx
npm run build
git add -A && git commit -m "feat: integrate avatar sync and multi-context DailyManager (Step 5/6)"
git push origin main
# ASPETTARE deploy
```

### ⬜ Step 6: PixiOffice Integration
```bash
git checkout backup-rooms-and-proximity -- components/office/PixiOffice.tsx
npm run build
git add -A && git commit -m "feat: integrate proximity aura and knock notification into PixiOffice (Step 6/6)"
git push origin main
# ASPETTARE deploy → FINITO!
```

---

## Se un Deploy Fallisce con Errore di CODICE (non internal error)

Se il build fallisce o c'è un errore specifico (non il generico "internal error"):
```bash
# Revertire l'ultimo step
git revert HEAD
git push origin main
# Poi debuggare e rifare lo step
```

---

## Architettura Implementata

### File Nuovi (7)
| File | Scopo |
|------|-------|
| `hooks/useProximityAndRooms.ts` | Engine: proximity detection 250px + room join/leave |
| `hooks/useKnockToEnter.ts` | Hook: knock-to-enter con timeout 30s |
| `components/office/ProximityAura.ts` | PixiJS Graphics: cerchio pulsante attorno avatar |
| `components/office/AdminContextMenu.tsx` | Menu right-click su avatar (mute, kick, etc.) |
| `components/office/KnockNotification.tsx` | UI glassmorphism per notifiche knock |
| `utils/wallDetection.ts` | Ray-casting per verificare pareti tra avatar |
| `utils/avatarStateMachine.ts` | Stato avatar: DND > Room > Proximity > Idle |

### File Modificati (5)
| File | Cosa cambia |
|------|-------------|
| `stores/avatarStore.ts` | +DND, away, adminMuted, proximityGroupId, knockingAtRoom |
| `stores/dailyStore.ts` | +activeContext (room/proximity/none), admin controls |
| `stores/workspaceStore.ts` | +lockedRoomIds, setRoomLocked |
| `hooks/useAvatarSync.ts` | +Handlers: knock, admin, leave_room, update_state |
| `components/DailyManager.tsx` | Riscritto: joinDailyContext/leaveDailyContext multi-context |
| `components/office/PixiOffice.tsx` | +useProximityAndRooms, KnockNotification, ProximityAura nel ticker |
| `partykit/server.ts` | +Message types: knock, admin_action, leave_room, update_state |

### Come Funziona
1. **Proximity**: `useProximityAndRooms` calcola distanza tra avatar ogni 200ms. Se < 250px e nessuna parete → crea proximity group → chiama `joinDailyContext('proximity', groupId)`
2. **Room Isolation**: Entrare in una stanza → `joinDailyContext('room', roomId)`. Audio isolato alla stanza
3. **Knock to Enter**: Se stanza è locked, mostra notifica all'admin. Timeout 30s
4. **Admin Controls**: Right-click su avatar → mute audio/video, kick. Broadcast via PartyKit
5. **Avatar States**: DND > Room > Proximity con broadcast real-time

---

## Comandi Utili

```bash
# Build locale
npm run build

# Vedere differenze tra main e backup
git diff main backup-rooms-and-proximity -- <file>

# Vedere tutti i file diversi
git diff --stat main backup-rooms-and-proximity

# Deploy PartyKit
npx partykit deploy

# Controllare lo stato Vercel
# https://www.vercel-status.com
```
