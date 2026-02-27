# COSMOFFICE - Guida all'Uso

## Struttura Database

```
profiles (utenti)
    ↓
workspaces (tenant isolation)
    ├── workspace_members (RBAC: owner > admin > member > guest > viewer)
    ├── workspace_role_permissions (permessi granulari)
    ├── workspace_bans (ban utenti)
    ├── spaces (uffici virtuali)
    │   ├── rooms (stanze)
    │   │   ├── room_participants (chi c'è dentro)
    │   │   ├── room_kicks (storico kick)
    │   │   ├── room_mutes (mute audio/video/chat)
    │   │   └── furniture (mobili)
    │   ├── room_connections (porte)
    │   └── conversations → messages (chat)
    └── ai_agents
```

## Hooks

### 1. Autenticazione

```tsx
import { useCurrentUser } from '@/hooks';

function ProfilePage() {
  const { user, profile, isLoading, isAuthenticated } = useCurrentUser();
  
  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Login />;
  
  return <div>Ciao {profile?.full_name}</div>;
}
```

### 2. Workspace

```tsx
import { useWorkspace, useUserWorkspaces } from '@/hooks';

// Lista workspaces utente
function WorkspaceList() {
  const { workspaces, isLoading } = useUserWorkspaces();
  return <div>{workspaces.map(w => w.workspace.name)}</div>;
}

// Singolo workspace
function WorkspacePage({ workspaceId }: { workspaceId: string }) {
  const { workspace, members, spaces, isLoading, refresh } = useWorkspace(workspaceId);
  
  return (
    <div>
      <h1>{workspace?.name}</h1>
      <p>{members.length} membri</p>
      <p>{spaces.length} spaces</p>
    </div>
  );
}
```

### 3. Permessi RBAC

```tsx
import { usePermissions, useWorkspaceRole, useIsMember } from '@/hooks';

function AdminPanel({ workspaceId }: { workspaceId: string }) {
  const {
    canKick,
    canBan,
    canManageRoles,
    canInvite,
    canModerate,
    isLoading,
  } = usePermissions({ workspaceId });
  
  const { isOwner, isAdmin, role } = useWorkspaceRole(workspaceId);
  const { isMember, isBanned } = useIsMember(workspaceId);
  
  if (!canManageRoles) return <AccessDenied />;
  
  return (
    <div>
      {canInvite && <InviteButton />}
      {canBan && <BanList />}
    </div>
  );
}
```

### 4. Moderazione

```tsx
import { useModeration, useRoomModeration, useBannedUsers } from '@/hooks';

function RoomControls({ workspaceId, roomId }: { workspaceId: string; roomId: string }) {
  const { kick, ban, mute, unmute, isLoading, error } = useModeration({ 
    workspaceId, 
    roomId 
  });
  
  const { mutedUsers, isUserMuted } = useRoomModeration(roomId);
  const { bannedUsers } = useBannedUsers(workspaceId);
  
  const handleKick = async (userId: string) => {
    const success = await kick(userId, { 
      reason: 'Comportamento inappropriato',
      durationMinutes: 30 // kick temporaneo di 30 min
    });
    
    if (success) {
      toast.success('Utente kickato');
    }
  };
  
  const handleBan = async (userId: string) => {
    await ban(userId, { 
      reason: 'Violazione regole gravi',
      permanent: true 
    });
  };
  
  const handleMute = async (userId: string) => {
    await mute(userId, { 
      type: 'chat', // 'chat' | 'audio' | 'video' | 'all'
      durationMinutes: 10 
    });
  };
  
  return (
    <div>
      <UserList 
        onKick={handleKick}
        onBan={handleBan}
        onMute={handleMute}
      />
    </div>
  );
}
```

### 5. Stanze

```tsx
import { useRoom, useRoomChat, usePresence } from '@/hooks';

function RoomPage({ roomId }: { roomId: string }) {
  const {
    room,
    participants,
    isJoined,
    myPosition,
    join,
    leave,
    move,
    setMediaState,
  } = useRoom(roomId);
  
  const { messages, send, loadMore } = useRoomChat(roomId);
  
  // Update presence in workspace
  const workspaceId = room?.space?.workspace_id;
  const { onlineUsers, updateMyPresence } = usePresence(workspaceId);
  
  useEffect(() => {
    if (isJoined) {
      updateMyPresence('in_call');
    }
    return () => {
      leave();
    };
  }, [isJoined]);
  
  const handleJoin = async () => {
    await join(100, 100); // posizione iniziale
  };
  
  const handleMove = (x: number, y: number) => {
    move(x, y);
  };
  
  const handleSendMessage = async (content: string) => {
    await send(content);
  };
  
  return (
    <div>
      <h1>{room?.name}</h1>
      <p>{participants.length} partecipanti</p>
      
      {!isJoined ? (
        <button onClick={handleJoin}>Entra</button>
      ) : (
        <>
          <RoomMap 
            participants={participants}
            myPosition={myPosition}
            onMove={handleMove}
          />
          <Chat messages={messages} onSend={handleSendMessage} />
          <MediaControls onToggle={setMediaState} />
        </>
      )}
    </div>
  );
}
```

### 6. Gestione Ruoli

```tsx
import { useModeration } from '@/hooks';

function MemberList({ workspaceId }: { workspaceId: string }) {
  const { changeRole } = useModeration({ workspaceId });
  
  const promoteToAdmin = async (userId: string) => {
    await changeRole(userId, 'admin');
  };
  
  const demoteToMember = async (userId: string) => {
    await changeRole(userId, 'member');
  };
  
  return (
    <div>
      {members.map(member => (
        <div key={member.id}>
          <span>{member.profile.full_name} - {member.role}</span>
          {member.role !== 'admin' && (
            <button onClick={() => promoteToAdmin(member.user_id)}>
              Promuovi ad Admin
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Gerarchia Ruoli

```
OWNER (4)
  ├── Può fare TUTTO
  ├── Può cancellare workspace
  └── Può designare nuovo owner

ADMIN (3)
  ├── Può moderare tutti tranne owner
  ├── Può gestire membri/spaces/rooms
  └── NON può cancellare workspace

MEMBER (2)
  ├── Può usare spaces e rooms
  ├── Può chattare
  └── NO permessi di gestione

GUEST (1)
  ├── Solo su invito
  ├── Accesso limitato
  └── NO permessi di moderazione

VIEWER (0)
  └── Solo guardare, nessuna interazione
```

## API Dirette (se serve fuori React)

```ts
import { 
  getCurrentUser,
  getWorkspaceBySlug,
  getRoomParticipants,
  joinRoom,
  leaveRoom,
  sendMessage,
  kickUser,
  banUser,
  muteUser,
} from '@/lib/supabase/client';

// Esempi
const user = await getCurrentUser();
const workspace = await getWorkspaceBySlug('mia-azienda');
await joinRoom('room-uuid', 100, 100);
await kickUser('room-uuid', 'user-uuid', 'Motivo', 30);
```

## Realtime Subscriptions

```ts
import { subscribeToRoomParticipants, subscribeToMessages } from '@/lib/supabase/client';

// Partecipanti stanza
const sub1 = subscribeToRoomParticipants(roomId, (payload) => {
  console.log('Cambio partecipanti:', payload);
});

// Nuovi messaggi
const sub2 = subscribeToMessages(conversationId, (payload) => {
  console.log('Nuovo messaggio:', payload.new);
});

// Cleanup
sub1.unsubscribe();
sub2.unsubscribe();
```

## Errori Comuni

1. **"Room ID required"** → Passa sempre roomId a useModeration per kick/mute
2. **"Non hai i permessi"** → L'utente non ha il ruolo necessario
3. **"Non puoi moderare questo utente"** → Target ha ruolo >= tuo
4. **"Not authenticated"** → Utente non loggato

## Pattern Consigliati

```tsx
// 1. Always check permissions before showing actions
const { canKick } = usePermissions({ workspaceId });
{canKick && <KickButton />}

// 2. Handle loading states
const { isLoading } = useWorkspace(workspaceId);
if (isLoading) return <Skeleton />;

// 3. Handle errors
const { error } = useModeration({ workspaceId, roomId });
useEffect(() => {
  if (error) toast.error(error.message);
}, [error]);

// 4. Cleanup on unmount
useEffect(() => {
  return () => {
    leave(); // esce dalla stanza
  };
}, []);
```
