'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Dashboard from './Dashboard';
import Logo from './Logo';
import PasswordChange from './PasswordChange';
import { apiUrl, responseJson, TOKEN_KEY } from '../lib/api';
import { clearConsoleCache } from '../lib/consoleCache';
import {
  clearSessionCache,
  readSessionCache,
  writeSessionCache,
  type ConsoleSession,
} from '../lib/sessionCache';
import { isAdminSection, isClientOnlySection, type ConsoleSection } from '../lib/sections';

type AuthUser = { email?: string; role?: string; forcePasswordChange?: boolean };

function SessionLoading() {
  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow--blue" aria-hidden="true" />
      <div className="auth-glow auth-glow--violet" aria-hidden="true" />
      <div className="auth-loading">
        <Logo size="lg" tagline />
        <span className="auth-spinner" aria-hidden="true" />
        <p className="auth-sub">Checking your session…</p>
      </div>
    </main>
  );
}

export default function ConsolePage({ section }: { section: ConsoleSection }) {
  const router = useRouter();
  const [session, setSession] = useState<ConsoleSession | null>(() => readSessionCache());
  const [checking, setChecking] = useState(() => !readSessionCache());

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      clearSessionCache();
      clearConsoleCache();
      router.replace('/');
      return;
    }

    const cached = readSessionCache();
    if (cached && cached.token !== storedToken) {
      clearSessionCache();
      clearConsoleCache();
      setSession(null);
      setChecking(true);
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        const data = await responseJson<{ user?: AuthUser; message?: string }>(response);
        if (!response.ok || !data.user) throw new Error(data.message || 'Session expired');
        if (cancelled) return;
        const next: ConsoleSession = {
          token: storedToken,
          role: data.user.role || '',
          email: data.user.email || '',
          forcePasswordChange: Boolean(data.user.forcePasswordChange),
        };
        writeSessionCache(next);
        setSession(next);
      } catch {
        clearSessionCache();
        clearConsoleCache();
        window.localStorage.removeItem(TOKEN_KEY);
        router.replace('/');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!session) return;
    if (isClientOnlySection(section) && session.role !== 'CLIENT') {
      router.replace('/overview');
    } else if (isAdminSection(section) && session.role !== 'SUPER_ADMIN') {
      router.replace('/overview');
    }
  }, [router, section, session]);

  if (checking) return <SessionLoading />;
  if (!session) return null;
  if (isAdminSection(section) && session.role !== 'SUPER_ADMIN') return null;
  if (isClientOnlySection(section) && session.role !== 'CLIENT') return null;

  if (session.forcePasswordChange) {
    return (
      <PasswordChange
        token={session.token}
        email={session.email}
        onComplete={() => {
          const next = { ...session, forcePasswordChange: false };
          writeSessionCache(next);
          setSession(next);
        }}
        onSignOut={() => {
          clearSessionCache();
          clearConsoleCache();
          window.localStorage.removeItem(TOKEN_KEY);
          router.replace('/');
        }}
      />
    );
  }

  return <Dashboard token={session.token} role={session.role} email={session.email} section={section} />;
}
