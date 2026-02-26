-- Aggiunge room_id alla chat per supportare chat per stanza
ALTER TABLE space_chat_messages ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE CASCADE;

-- Aggiorna la policy per permettere visualizzazione se utente è nello space (che include tutte le stanze)
-- (La policy "Messages viewable by space members" già permette questo perché controlla lo space_id)

-- Crea un indice per ottimizzare le query per room_id
CREATE INDEX IF NOT EXISTS idx_space_chat_messages_room ON space_chat_messages(room_id);
