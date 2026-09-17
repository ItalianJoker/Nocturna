/**
 * @fileoverview Press-and-hold role reveal — i18n.
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
import { useTranslation } from 'react-i18next';
import type { SanitizedGameState } from '@nocturna/shared';
import { getSocket } from '../lib/socket';
import { selectIsMasterView, useAppStore } from '../store/appStore';
import { MasterDashboard } from './MasterDashboard';
import { LanguageSwitcher } from './LanguageSwitcher';

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
  const { t } = useTranslation();
  const storeView = useAppStore((s) => s.view);
  const isHost = view.players.some(
    (p) => p.id === view.you.playerId && p.isHost,
  );

  if (storeView && selectIsMasterView(storeView)) {
    return <MasterDashboard view={storeView} />;
  }

  const roleId = view.you.roleId;
  const roleName = roleId
    ? t(`roles.${roleId}.name`, { defaultValue: view.you.roleName ?? '' })
    : view.you.roleName;
  const roleDesc = roleId
    ? t(`roles.${roleId}.description`, {
        defaultValue: view.you.roleDescription ?? '',
      })
    : view.you.roleDescription;
  const factionLabel = view.you.faction
    ? t(`factions.${view.you.faction}`)
    : '';

  return (
    <div className="page-shell">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <p className="fluid-label text-stone-500">{t('phases.ROLE_REVEAL')}</p>
      <h1 className="font-display fluid-title mt-2">{t('reveal.title')}</h1>
      <p className="mt-2 fluid-body text-stone-400">{t('reveal.hint')}</p>
      <HoldToReveal
        colorHex={view.you.colorHex}
        iconName={view.you.iconName}
        roleName={roleName}
        roleDesc={roleDesc}
        factionLabel={factionLabel}
        holdLabel={t('reveal.hold')}
      />
      {isHost && (
        <button
          type="button"
          className="btn-primary mt-auto"
          onClick={() => getSocket().emit('game:beginNight', {})}
        >
          {t('reveal.beginNight')}
        </button>
      )}
      {!isHost && (
        <p className="mt-auto text-center fluid-body text-stone-500">
          {t('reveal.waitingHost')}
        </p>
      )}
    </div>
  );
}

function HoldToReveal({
  colorHex,
  iconName,
  roleName,
  roleDesc,
  factionLabel,
  holdLabel,
}: {
  colorHex: string | null;
  iconName: string | null;
  roleName: string | null;
  roleDesc: string | null;
  factionLabel: string;
  holdLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const Icon = ICONS[iconName ?? 'Users'] ?? Users;

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
      aria-label={holdLabel}
    >
      {!open ? (
        <>
          <div className="animate-breathe rounded-full border border-white/10 p-5 sm:p-6">
            <Moon className="h-9 w-9 text-stone-600 sm:h-10 sm:w-10" />
          </div>
          <p className="mt-5 fluid-body text-stone-500">{holdLabel}</p>
        </>
      ) : (
        <div className="animate-rise max-w-full px-1 text-center">
          <Icon
            className="mx-auto h-10 w-10 sm:h-12 sm:w-12"
            style={{ color: colorHex ?? '#aaa' }}
          />
          <p
            className="font-display fluid-title mt-3 break-words"
            style={{ color: colorHex ?? undefined }}
          >
            {roleName}
          </p>
          <p className="mt-1 fluid-label text-stone-500">{factionLabel}</p>
          <p className="mt-3 fluid-body leading-relaxed text-stone-400">
            {roleDesc}
          </p>
        </div>
      )}
    </button>
  );
}
