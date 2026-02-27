-- ============================================
-- VERIFICA SCHEMA ATTIVO
-- Esegui questo nel SQL Editor di Supabase
-- ============================================

-- 1. Controlla quali tabelle esistono
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Controlla se esistono tabelle VECCHIE
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') 
        THEN '⚠️  SCHEMA VECCHIO: Tabella organizations esiste'
        ELSE '✅ OK: Tabella organizations non esiste' 
    END as check_organizations;

-- 3. Controlla se esistono tabelle NUOVE (V2)
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') 
        THEN '✅ SCHEMA V2: Tabella workspaces esiste'
        ELSE '❌ SCHEMA V2 NON TROVATO: Tabella workspaces manca' 
    END as check_workspaces;

-- 4. Controlla colonne nella tabella spaces
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'spaces' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Controlla se esistono le functions V2
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_workspace_member') 
        THEN '✅ Function V2 is_workspace_member esiste'
        ELSE '❌ Function V2 mancante' 
    END as check_function;
