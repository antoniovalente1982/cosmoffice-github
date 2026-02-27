// Client admin per edge functions (service_role)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export function getServiceRoleClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

export function getUserClient(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );
}
