'use client';

import { LanguageSelector } from '@/components/common/LanguageSelector';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { useWalletProfileCompletion } from '@/lib/profile-completion';
import { primaryNav } from '@/lib/site-data';
import { ArrowRight, Menu, X, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n';
import { useKeyboardShortcuts } from '@/components/keyboard/KeyboardShortcutsProvider';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { publicKey } = useWallet();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const completedProfile = useWalletProfileCompletion(publicKey);
  const profileCompleted = !!completedProfile;
  const { openShortcutHelp } = useKeyboardShortcuts();
  const { t } = useI18n();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const getNavLabel = (label: string) => {
    const key = `nav.${label.toLowerCase()}`;
    const translated = t(key);
    return translated === key ? label : translated;
  };

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-black/80 border-b border-red-500/20 backdrop-blur-xl shadow-[0_10px_30px_rgba(220,38,38,0.1)]' : 'bg-transparent border-b border-white/5'}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3" onClick={() => setOpen(false)}>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-600 to-orange-600 text-sm font-black tracking-[0.3em] text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] group-hover:scale-105 transition-transform group-hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] relative overflow-hidden">
            <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0" />
            <span className="relative z-10">W3</span>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-red-500 font-bold group-hover:text-red-400 transition-colors flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> {t('nav.open_source_lab')}
            </p>
            <p className="text-sm font-black tracking-widest text-white uppercase mt-0.5">
              {t('nav.web3_student_lab')}
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {primaryNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-xl ${
                  active
                    ? 'text-white bg-white/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[2px] bg-red-500 rounded-t-full shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
                )}
                {getNavLabel(item.label)}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <LanguageSelector />
          {user ? (
            <>
              <NotificationBell />
              <Link
                href="/certificates"
                className="rounded-xl border border-white/10 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:border-red-500/50 hover:bg-red-500/10 hover:shadow-[0_0_15px_rgba(220,38,38,0.2)]"
              >
                {t('nav.certificates')}
              </Link>
              <button
                onClick={logout}
                className="rounded-xl bg-white/10 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-white/20"
              >
                {t('nav.sign_out')}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 transition-all hover:text-white hover:bg-white/5"
              >
                {publicKey ? t('nav.wallet_connected') : t('nav.connect_wallet')}
              </Link>
              <Link
                href={profileCompleted ? '/auth/login' : '/auth/register'}
                className="group relative inline-flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full transition-transform group-hover:translate-y-0" />
                <span className="relative z-10 flex items-center gap-2">
                  {publicKey
                    ? profileCompleted
                      ? t('nav.open_wallet_access')
                      : t('nav.complete_profile')
                    : t('nav.start_with_wallet')}
                  <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 text-white lg:hidden bg-white/5 hover:bg-white/10 transition-colors"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-red-500/20 bg-black/95 backdrop-blur-2xl lg:hidden shadow-[0_20px_40px_rgba(220,38,38,0.1)] absolute w-full left-0">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 sm:px-6">
            {primaryNav.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-2xl px-5 py-4 transition-all border ${
                    active
                      ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(220,38,38,0.15)]'
                      : 'bg-white/5 border-transparent text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <span className={`block text-xs font-black uppercase tracking-[0.2em] ${active ? 'text-red-400' : 'text-white'}`}>{getNavLabel(item.label)}</span>
                  <span className="mt-1.5 block text-xs font-light text-gray-500 leading-relaxed">{item.description}</span>
                </Link>
              );
            })}

            <div className="mt-6 mb-2 border-t border-white/10 pt-6">
              <LanguageSelector />
            </div>
            
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {user ? (
                <>
                  <Link
                    href="/certificates"
                    onClick={() => setOpen(false)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-xs font-black uppercase tracking-[0.2em] text-white text-center hover:bg-white/10 transition-colors"
                  >
                    {t('nav.certificates')}
                  </Link>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-white">{t('nav.notifications')}</span>
                    <NotificationBell />
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setOpen(false);
                    }}
                    className="rounded-2xl bg-white/10 px-5 py-4 text-xs font-black uppercase tracking-[0.2em] text-white sm:col-span-2 hover:bg-white/20 transition-colors"
                  >
                    {t('nav.sign_out')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    onClick={() => setOpen(false)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-xs font-black uppercase tracking-[0.2em] text-white text-center hover:bg-white/10 transition-colors"
                  >
                    {publicKey ? t('nav.wallet_connected') : t('nav.connect_wallet')}
                  </Link>
                  <Link
                    href={profileCompleted ? '/auth/login' : '/auth/register'}
                    onClick={() => setOpen(false)}
                    className="rounded-2xl bg-red-600 px-5 py-4 text-xs font-black uppercase tracking-[0.2em] text-white text-center shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:bg-red-500 transition-colors"
                  >
                    {publicKey
                      ? profileCompleted
                        ? t('nav.open_wallet_access')
                        : t('nav.complete_profile')
                      : t('nav.start_with_wallet')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
