'use client';

import { useEffect } from 'react';
import { LanguageProvider, useT } from '../lib/i18n';

/**
 * Inner component that syncs locale from user profile after auth.
 * Runs once on mount — if user is authenticated, loads their language preference from DB.
 */
function LanguageSyncOnMount({ children }: { children: React.ReactNode }) {
  const { syncFromProfile } = useT();

  useEffect(() => {
    // On mount, sync locale from the user's DB profile (if authenticated)
    syncFromProfile();
  }, [syncFromProfile]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <LanguageSyncOnMount>
        {children}
      </LanguageSyncOnMount>
    </LanguageProvider>
  );
}
