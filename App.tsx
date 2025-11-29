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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.MINE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<UserState>(DEFAULT_GUEST);

  // Telegram Web App init
  useEffect(() => {
    const initApp = async () => {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#0f172a');

        const tgUser = tg.initDataUnsafe?.user;

        if (tgUser) {
          const userId = String(tgUser.id);
          const remoteUser = await api.getUser(userId);

          let currentUser: UserState;
          if (remoteUser) {
            currentUser = {
              ...remoteUser,
              id: userId,
              username: tgUser.username || tgUser.first_name || 'CEO',
              languageCode: tgUser.language_code || 'en'
            };
          } else {
            currentUser = {
              ...DEFAULT_GUEST,
              id: userId,
              username: tgUser.username || tgUser.first_name || 'CEO',
              languageCode: tgUser.language_code || 'en',
              referredBy: tg.initDataUnsafe?.start_param || null,
            };
            await api.saveUser(currentUser);
          }

          setUser(currentUser);
        } else {
          console.warn("No Telegram user data found.");
        }
      } else {
        console.log("Running in browser mode");
      }
      setIsLoaded(true);
    };

    initApp();
  }, []);

  const isFirstRender = useRef(true);

  // Persist user changes with debounce
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

    const earned = Math.floor(Math.random() * 1) + 1; // 2–3 coins
    const passive = calculatePassiveIncome(user.businesses);
    setUser(prev => ({
      ...prev,
      coins: prev.coins + earned + passive,
      lastMine: now
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
          [businessId]: currentQty + 1
        }
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
