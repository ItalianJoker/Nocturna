import { useTranslation } from 'react-i18next';
import { setAppLanguage, type AppLanguage } from '../i18n';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('it') ? 'it' : 'en') as AppLanguage;

  return (
    <label
      className={`flex items-center gap-2 text-xs text-stone-500 ${className}`}
    >
      <span className="uppercase tracking-wider">{t('app.language')}</span>
      <select
        className="min-h-[44px] rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-sm text-stone-200"
        value={lang}
        onChange={(e) => setAppLanguage(e.target.value as AppLanguage)}
        aria-label={t('app.language')}
      >
        <option value="it">Italiano</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
