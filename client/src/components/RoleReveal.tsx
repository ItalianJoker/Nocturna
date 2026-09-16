/**
 * @fileoverview Press-and-hold role reveal — large touch target, no shoulder-surf flash.
 */

import { useRef, useState } from 'react';
import {
  Eye,
  Moon,
  Shield,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { SanitizedGameState } from '@nocturna/shared';
import { getSocket } from '../lib/socket';
import { selectIsMasterView, useAppStore } from '../store/appStore';
import { MasterDashboard } from './MasterDashboard';

const ICONS: Record<string, LucideIcon> = {
  Users,
  Shield,
  Eye,
  Moon,
  Sparkles,
};

interface RoleRevealProps {
  view: SanitizedGameState;
}

export function RoleReveal({ view }: RoleRevealProps) {
  const storeView = useAppStore((s) => s.view);
  const isHost = view.players.some(
    (p) => p.id === view.you.playerId && p.isHost,
  );

  if (storeView && selectIsMasterView(storeView)) {
    return <MasterDashboard view={storeView} />;
  }

  return (
    <div className="page-shell">
      <p className="fluid-label text-stone-500">Distribuzione ruoli</p>
      <h1 className="font-display fluid-title mt-2">La tua identità</h1>
      <p className="mt-2 fluid-body text-stone-400">
        Tieni premuto per scoprire. Rilascia per nascondere — nessuno spia lo
        schermo.
      </p>
      <HoldToReveal view={view} />
      {isHost && (
        <button
          type="button"
          className="btn-primary mt-auto"
          onClick={() => getSocket().emit('game:beginNight', {})}
        >
          Tutti pronti — inizia la notte
        </button>
      )}
      {!isHost && (
        <p className="mt-auto text-center fluid-body text-stone-500">
          In attesa che l&apos;Host avvii la notte…
        </p>
      )}
    </div>
  );
}

function HoldToReveal({ view }: { view: SanitizedGameState }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const Icon = ICONS[view.you.iconName ?? 'Users'] ?? Users;

  const start = () => {
    timer.current = window.setTimeout(() => setOpen(true), 280);
  };
  const end = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <button
      type="button"
      className="animate-rise relative mt-8 flex min-h-[min(58vw,16rem)] w-full select-none flex-col items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-b from-[#1a1014] to-black p-5 touch-none sm:min-h-64"
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Tieni premuto per rivelare il ruolo"
    >
      {!open ? (
        <>
          <div className="animate-breathe rounded-full border border-white/10 p-5 sm:p-6">
            <Moon className="h-9 w-9 text-stone-600 sm:h-10 sm:w-10" />
          </div>
          <p className="mt-5 fluid-body text-stone-500">Tieni premuto</p>
        </>
      ) : (
        <div className="animate-rise max-w-full px-1 text-center">
          <Icon
            className="mx-auto h-10 w-10 sm:h-12 sm:w-12"
            style={{ color: view.you.colorHex ?? '#aaa' }}
          />
          <p
            className="font-display fluid-title mt-3 break-words"
            style={{ color: view.you.colorHex ?? undefined }}
          >
            {view.you.roleName}
          </p>
          <p className="mt-1 fluid-label text-stone-500">
            {view.you.faction}
          </p>
          <p className="mt-3 fluid-body leading-relaxed text-stone-400">
            {view.you.roleDescription}
          </p>
        </div>
      )}
    </button>
  );
}
