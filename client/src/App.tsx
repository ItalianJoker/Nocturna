/**
 * @fileoverview Root SPA router for Nocturna phases.
 */

import { useEffect, type ReactNode } from 'react';
import { getSocket } from './lib/socket';
import {
  selectIsMasterView,
  useAppStore,
} from './store/appStore';
import { HomeGate } from './components/Lobby';
import { NightScreen } from './components/NightScreen';
import { RoleReveal } from './components/RoleReveal';
import { DayFlow } from './components/DayFlow';
import { MasterDashboard } from './components/MasterDashboard';

export function App() {
  const view = useAppStore((s) => s.view);
  const session = useAppStore((s) => s.session);
  const toast = useAppStore((s) => s.toast);
  const setToast = useAppStore((s) => s.setToast);
  const hydrateSession = useAppStore((s) => s.hydrateSession);

  useEffect(() => {
    getSocket();
    hydrateSession();
    const pin = new URLSearchParams(window.location.search).get('pin');
    if (pin) {
      sessionStorage.setItem('nocturna.pendingPin', pin);
    }
  }, [hydrateSession]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast, setToast]);

  let body: ReactNode = <HomeGate />;

  if (session && view) {
    if (view.phase === 'LOBBY') {
      body = <HomeGate />;
    } else if (
      selectIsMasterView(view) &&
      view.settings.moderatorMode === 'ASSISTED'
    ) {
      body = <MasterDashboard view={view} />;
    } else if (!selectIsMasterView(view) && view.phase === 'ROLE_REVEAL') {
      body = <RoleReveal view={view} />;
    } else if (!selectIsMasterView(view) && view.phase === 'NIGHT') {
      body = <NightScreen view={view} />;
    } else if (!selectIsMasterView(view)) {
      body = <DayFlow view={view} />;
    }
  }

  return (
    <>
      {body}
      {toast && (
        <div
          role="status"
          className={`toast-dock border ${
            toast.level === 'error'
              ? 'border-rose-800 bg-rose-950 text-rose-100'
              : toast.level === 'warn'
                ? 'border-amber-800 bg-amber-950 text-amber-100'
                : 'border-white/10 bg-stone-900 text-stone-100'
          }`}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
