-- ============================================
-- COSMOFFICE DATABASE SCHEMA - CORRETTO
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 1: CREAZIONE TUTTE LE TABELLE (senza policy)
-- ============================================

-- PROFILES (Users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ORGANIZATIONS
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- ORGANIZATION MEMBERS
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- SPACES (Virtual Offices)
CREATE TABLE spaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  max_capacity INTEGER DEFAULT 50,
  layout_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ROOMS
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'open' CHECK (type IN ('open', 'meeting', 'focus', 'break', 'reception')),
  x INTEGER DEFAULT 0,
  y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 200,
  height INTEGER DEFAULT 150,
  capacity INTEGER DEFAULT 10,
  is_secret BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ROOM CONNECTIONS (Portals/Doors)
CREATE TABLE room_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  room_a_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  room_b_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'portal' CHECK (type IN ('portal', 'door')),
  x_a INTEGER DEFAULT 0,
  y_a INTEGER DEFAULT 0,
  x_b INTEGER DEFAULT 0,
  y_b INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_a_id, room_b_id)
);

-- INVITATIONS
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  token TEXT UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- PARTICIPANTS (Active users in rooms)
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  x INTEGER DEFAULT 100,
  y INTEGER DEFAULT 100,
  direction INTEGER DEFAULT 0,
  audio_enabled BOOLEAN DEFAULT true,
  video_enabled BOOLEAN DEFAULT false,
  screen_sharing BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- CONVERSATIONS
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT DEFAULT 'room' CHECK (type IN ('room', 'direct', 'channel')),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MESSAGES
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'system')),
  reply_to UUID REFERENCES messages(id),
  edited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI AGENTS
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  personality TEXT,
  capabilities JSONB DEFAULT '[]',
  system_prompt TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 2: ABILITA RLS SU TUTTE LE TABELLE
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: CREA TUTTE LE POLICY (dopo che tutte le tabelle esistono)
-- ============================================

-- PROFILES POLICIES
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- ORGANIZATIONS POLICIES
CREATE POLICY "Organizations viewable by members"
  ON organizations FOR SELECT USING (
    auth.uid() = created_by OR
    public.is_org_member(id)
  );

CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT WITH CHECK (auth.uid() = created_by);

-- ORGANIZATION MEMBERS POLICIES
CREATE POLICY "Members viewable by organization members"
  ON organization_members FOR SELECT USING (
    user_id = auth.uid() OR
    public.is_org_member(org_id)
  );

CREATE POLICY "Users can join organizations"
  ON organization_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- SPACES POLICIES
CREATE POLICY "Spaces viewable by organization members"
  ON spaces FOR SELECT USING (
    public.is_org_member(org_id)
  );

CREATE POLICY "Admins can create spaces"
  ON spaces FOR INSERT WITH CHECK (
    public.is_org_admin(org_id)
  );

-- ROOMS POLICIES
CREATE POLICY "Rooms viewable by space members"
  ON rooms FOR SELECT USING (
    public.is_org_member(space_id := space_id) OR
    public.is_space_admin(space_id)
  );

CREATE POLICY "Admins can create rooms"
  ON rooms FOR INSERT WITH CHECK (
    public.is_space_admin(space_id)
  );

-- PARTICIPANTS POLICIES
CREATE POLICY "Participants viewable by room members"
  ON participants FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rooms
      JOIN spaces ON spaces.id = rooms.space_id
      JOIN organization_members ON organization_members.org_id = spaces.org_id
      WHERE rooms.id = participants.room_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own participation"
  ON participants FOR ALL USING (auth.uid() = user_id);

-- MESSAGES POLICIES
CREATE POLICY "Messages viewable by conversation participants"
  ON messages FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN rooms r ON r.id = c.room_id
      JOIN spaces s ON s.id = r.space_id
      JOIN organization_members om ON om.org_id = s.org_id
      WHERE c.id = messages.conversation_id
      AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- AI AGENTS POLICIES
CREATE POLICY "AI agents viewable by organization members"
  ON ai_agents FOR SELECT USING (
    public.is_org_member(org_id)
  );

CREATE POLICY "Admins can manage AI agents"
  ON ai_agents FOR ALL USING (
    public.is_org_admin(org_id)
  );

-- ROOM CONNECTIONS POLICIES
CREATE POLICY "Room connections viewable by space members"
  ON room_connections FOR SELECT USING (
    public.is_space_admin(space_id) OR
    EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE (r.id = room_a_id OR r.id = room_b_id)
      AND NOT r.is_secret
    )
  );

CREATE POLICY "Admins can manage room connections"
  ON room_connections FOR ALL USING (
    public.is_space_admin(space_id)
  );

-- INVITATIONS POLICIES
CREATE POLICY "Invitations viewable by organizers"
  ON invitations FOR SELECT USING (
    public.is_org_admin(org_id) OR
    email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can create invitations"
  ON invitations FOR INSERT WITH CHECK (
    public.is_org_admin(org_id)
  );

-- ============================================
-- STEP 4: REALTIME SETUP
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_connections;

-- ============================================
-- STEP 5: FUNCTIONS & TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function to check membership without recursion (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = check_org_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to handle organization ownership on creation
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for organization owner
CREATE OR REPLACE TRIGGER on_organization_created
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

CREATE TRIGGER spaces_updated_at
  BEFORE UPDATE ON spaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER ai_agents_updated_at
  BEFORE UPDATE ON ai_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Helper function to check admin status without recursion
CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = check_org_id 
    AND user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check space admin status
CREATE OR REPLACE FUNCTION public.is_space_admin(check_space_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.spaces s
    WHERE s.id = check_space_id 
    AND public.is_org_admin(s.org_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 6: INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_status ON profiles(status);
CREATE INDEX idx_org_members_org ON organization_members(org_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_spaces_org ON spaces(org_id);
CREATE INDEX idx_rooms_space ON rooms(space_id);
CREATE INDEX idx_participants_room ON participants(room_id);
CREATE INDEX idx_participants_user ON participants(user_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_room_connections_space ON room_connections(space_id);
CREATE INDEX idx_invitations_org ON invitations(org_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);

-- ============================================
-- STEP 7: SEED DATA (optional)
-- ============================================

-- Crea organizzazione demo (opzionale)
-- INSERT INTO organizations (name, slug) VALUES ('Demo Org', 'demo-org');