-- ============================================
-- RPC: KICK MEMBER (bypassa RLS, sicuro)
-- Eseguire nel SQL Editor di Supabase
-- ============================================

CREATE OR REPLACE FUNCTION public.kick_workspace_member(
    p_workspace_id UUID,
    p_target_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role TEXT;
    v_target_role TEXT;
    v_caller_level INT;
    v_target_level INT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Non autenticato');
    END IF;

    -- Cannot kick yourself
    IF v_caller_id = p_target_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Non puoi rimuovere te stesso');
    END IF;

    -- Get caller role
    SELECT role INTO v_caller_role
    FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = v_caller_id AND removed_at IS NULL;

    IF v_caller_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Non sei membro di questo workspace');
    END IF;

    -- Get target role
    SELECT role INTO v_target_role
    FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_target_user_id AND removed_at IS NULL;

    IF v_target_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Utente non trovato nel workspace');
    END IF;

    -- Role hierarchy check: can only kick lower roles
    v_caller_level := CASE v_caller_role WHEN 'owner' THEN 3 WHEN 'admin' THEN 2 WHEN 'member' THEN 1 ELSE 0 END;
    v_target_level := CASE v_target_role WHEN 'owner' THEN 3 WHEN 'admin' THEN 2 WHEN 'member' THEN 1 ELSE 0 END;

    IF v_caller_level <= v_target_level THEN
        RETURN jsonb_build_object('success', false, 'error', 'Non puoi rimuovere un utente con ruolo uguale o superiore');
    END IF;

    -- Perform the kick
    UPDATE workspace_members
    SET removed_at = NOW()
    WHERE workspace_id = p_workspace_id AND user_id = p_target_user_id AND removed_at IS NULL;

    RETURN jsonb_build_object('success', true, 'kicked_user_id', p_target_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
