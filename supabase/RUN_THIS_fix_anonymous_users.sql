-- ============================================
-- FIX: Allow anonymous sign-ins for guest users
-- Eseguire nel SQL Editor di Supabase
-- Idempotente — sicuro da rieseguire
-- ============================================
--
-- Problema: Il trigger handle_new_user() prova a inserire l'email
-- nella tabella profiles, ma gli utenti anonimi non hanno email.
-- La colonna email ha un constraint NOT NULL, che causa l'errore:
-- "Database error creating anonymous user"
--
-- Fix: 
-- 1. Rendi email NULLABLE nella tabella profiles
-- 2. Aggiorna il trigger per gestire utenti anonimi
-- 3. Aggiorna il constraint UNIQUE su email (solo per non-null)
-- ============================================

-- STEP 1: Rendi email nullable (gli utenti anonimi non hanno email)
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

-- STEP 2: Cambia UNIQUE constraint per permettere multipli NULL
-- (multiple anonymous users senza email)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
DROP INDEX IF EXISTS profiles_email_key;
DROP INDEX IF EXISTS idx_profiles_email_unique;
CREATE UNIQUE INDEX idx_profiles_email_unique ON profiles(email) WHERE email IS NOT NULL;

-- STEP 3: Aggiorna il trigger handle_new_user per gestire utenti anonimi
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,  -- NULL per utenti anonimi, e ora è permesso
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Ospite'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', 'Ospite'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 4: Verifica — dovrebbe restituire 1 riga
SELECT 'handle_new_user trigger OK' AS status
WHERE EXISTS (
  SELECT 1 FROM pg_trigger 
  WHERE tgname = 'on_auth_user_created'
);
