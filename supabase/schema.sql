-- ============================================
-- COSMOFFICE DATABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES (Users)
-- ============================================
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

-- RLS Policies for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- ORGANIZATIONS
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizations viewable by members"
  ON organizations FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.org_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );

-- ============================================
-- ORGANIZATION MEMBERS
-- ============================================
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members viewable by organization members"
  ON organization_members FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.org_id = organization_members.org_id
      AND om.user_id = auth.uid()
    )
  );

-- ============================================
-- SPACES (Virtual Offices)
-- ============================================
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

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Spaces viewable by organization members"
  ON spaces FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.org_id = spaces.org_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- ============================================
-- ROOMS
-- ============================================
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
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rooms viewable by space members"
  ON rooms FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM spaces
      JOIN organization_members ON organization_members.org_id = spaces.org_id
      WHERE spaces.id = rooms.space_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- ============================================
-- PARTICIPANTS (Active users in rooms)
-- ============================================
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

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

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

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT DEFAULT 'room' CHECK (type IN ('room', 'direct', 'channel')),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

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

-- ============================================
-- REALTIME SETUP
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ============================================
-- FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER spaces_updated_at
  BEFORE UPDATE ON spaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
