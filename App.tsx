import React, { useState, useEffect, useRef } from 'react';
import { UserState, Tab } from './types';
import { BUSINESSES, MINE_COOLDOWN_MS } from './constants';
import BottomNav from './components/BottomNav';
import MineView from './views/MineView';
import LeaderboardView from './views/LeaderboardView';
import UpgradeView from './views/UpgradeView';
import TeamView from './views/TeamView';
import MeView from './views/MeView';
import { calculatePassiveIncome } from './services/gameLogic';
import { api } from './services/api';

// Default guest user
const DEFAULT_GUEST: UserState = {
  id: 'guest_123',
  username: 'Guest CEO',
  coins: 100,
  businesses: {},
  level: 1,
  lastMine: 0,
  referredBy: null,
  referralsCount: 0,
  subscribed: false,
  languageCode: 'en',
};

/** Normalize referral param into "ref_<id>" or null */
const normalizeReferralParam = (raw?: string | null): string | null => {
  if (!raw) return null;
  const val = raw.toString().trim();
  if (!val) return null;
  if (val.startsWith('ref_')) return val;
  if (/^\d+$/.test(val)) return `ref_${val}`;
  return val;
};

const readReferralFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('start') ?? params.get('startapp');
    return normalizeReferralParam(raw);
  } catch {
    return null;
  }
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.MINE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<UserState>(DEFAULT_GUEST);

  useEffect(() => {
    const initApp = async () => {
      const tg = (window as any).Telegram?.WebApp;
      let referralFromTelegram: string | null = null;

      if (tg) {
        try {
          tg.ready?.();
          if (typeof tg.expand === 'function') tg.expand();
          if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor('#0f172a');

          // Telegram deep-link param (start_param / start_app)
          const tgStart = tg.initDataUnsafe?.start_param ?? tg.initDataUnsafe?.start_app ?? null;
          referralFromTelegram = normalizeReferralParam(tgStart ?? null);
        } catch (e) {
          console.warn('Telegram init error (non-fatal):', e);
        }
      }

      // Also support direct URL ?start= or ?startapp=
      const referralFromUrl = readReferralFromUrl();
      const finalReferral = referralFromTelegram ?? referralFromUrl ?? null;

      // Try to fetch Telegram user
      const tgUser = tg?.initDataUnsafe?.user ?? null;

      if (tgUser) {
        const userId = String(tgUser.id);

        // Try load existing user from Supabase/local cache
        const remoteUser = await api.getUser(userId);

        let currentUser: UserState;

        if (remoteUser) {
          // Existing user: merge updates from Telegram
          currentUser = {
            ...remoteUser,
            id: userId,
            username: tgUser.username || tgUser.first_name || remoteUser.username || 'CEO',
            languageCode: tgUser.language_code || remoteUser.languageCode || 'en',
          };
        } else {
          // NEW USER PATH (secure): call server endpoint to create user & process referral
          currentUser = {
            ...DEFAULT_GUEST,
            id: userId,
            username: tgUser.username || tgUser.first_name || 'CEO',
            languageCode: tgUser.language_code || 'en',
            referredBy: finalReferral,
          };

          try {
            // POST to /api/register (server must verify initData and call handle_referral)
            const resp = await fetch('/api/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: currentUser.id,
                username: currentUser.username,
                referredBy: currentUser.referredBy,
                initData: tg?.initData ?? null,
                languageCode: currentUser.languageCode,
              }),
            });

            if (!resp.ok) {
              // Log server error (server may still create user; we'll fetch authoritative record next)
              const txt = await resp.text().catch(() => '');
              console.warn('Server /api/register returned error:', resp.status, txt);
            }
          } catch (e) {
            console.warn('Failed to call /api/register (continuing local):', e);
          }

          // Fetch the authoritative user row (may include referral credits)
          try {
            const saved = await api.getUser(userId);
            if (saved) {
              currentUser = {
                ...saved,
                // ensure latest username/language from Telegram
                username: tgUser.username || tgUser.first_name || saved.username,
                languageCode: tgUser.language_code || saved.languageCode || 'en',
              };
            }
          } catch (e) {
            console.warn('Failed to fetch saved user after register:', e);
          }
        }

        setUser(currentUser);
      } else {
        // Not inside Telegram — treat as guest (optionally preserve referral from URL)
        const guestWithReferral = { ...DEFAULT_GUEST, referredBy: finalReferral ?? DEFAULT_GUEST.referredBy };
        setUser(guestWithReferral);
        console.info('Running in browser mode. Referral (if any):', finalReferral);
      }

      setIsLoaded(true);
    };

    initApp();
  }, []);

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!isLoaded) return;

    const handler = setTimeout(() => {
      api.saveUser(user);
    }, 1000);

    return () => clearTimeout(handler);
  }, [user, isLoaded]);

  const handleMine = () => {
    const now = Date.now();
    if (now - user.lastMine < MINE_COOLDOWN_MS) return;

    const earned = Math.floor(Math.random() * 2) + 2; // 2-3 coins
    const passive = calculatePassiveIncome(user.businesses);
    setUser(prev => ({
      ...prev,
      coins: prev.coins + earned + passive,
      lastMine: now,
    }));
  };

  const handleBuyBusiness = (businessId: string) => {
    const business = BUSINESSES.find(b => b.id === businessId);
    if (!business) return;

    if (user.coins >= business.cost) {
      const currentQty = user.businesses[businessId] || 0;
      setUser(prev => ({
        ...prev,
        coins: prev.coins - business.cost,
        businesses: {
          ...prev.businesses,
          [businessId]: currentQty + 1,
        },
      }));
    }
  };

  const handleSubscribeToggle = () => {
    setUser(prev => ({ ...prev, subscribed: !prev.subscribed }));
  };

  const renderContent = () => {
    switch (activeTab) {
      case Tab.MINE:
        return <MineView user={user} onMine={handleMine} />;
      case Tab.LEADERBOARD:
        return <LeaderboardView user={user} />;
      case Tab.UPGRADE:
        return <UpgradeView user={user} onBuy={handleBuyBusiness} />;
      case Tab.TEAM:
        return <TeamView user={user} />;
      case Tab.ME:
        return <MeView user={user} onSubscribeToggle={handleSubscribeToggle} />;
      default:
        return <MineView user={user} onMine={handleMine} />;
    }
  };

  if (!isLoaded) {
    return (
      <div className="h-screen w-full bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lime-500"></div>
        <div className="text-slate-400 text-sm animate-pulse">Connecting to server...</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-slate-900 text-white font-sans overflow-hidden">
      <div className="h-full w-full">{renderContent()}</div>
      <BottomNav currentTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default App;
