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

// Default guest user for browser testing
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
  
  // User state
  const [user, setUser] = useState<UserState>(DEFAULT_GUEST);

  // Initialize Telegram Web App and Fetch Data
  useEffect(() => {
    const initApp = async () => {
      // Check if running inside Telegram
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#0f172a'); // Match slate-900 background

        // Retrieve user data from Telegram Web App
        const tgUser = tg.initDataUnsafe?.user;
        
        if (tgUser) {
          const userId = String(tgUser.id);
          
          // Fetch user from Backend
          const remoteUser = await api.getUser(userId);
          
          let currentUser: UserState;

          if (remoteUser) {
            // Merge remote data with fresh Telegram data (e.g. username updates)
            currentUser = {
              ...remoteUser,
              id: userId, // Ensure ID matches
              username: tgUser.username || tgUser.first_name || 'CEO',
              languageCode: tgUser.language_code || 'en'
            };
          } else {
            // New User Initialization
            currentUser = {
              ...DEFAULT_GUEST,
              id: userId,
              username: tgUser.username || tgUser.first_name || 'CEO',
              languageCode: tgUser.language_code || 'en',
              referredBy: tg.initDataUnsafe.start_param || null, 
            };
            // Immediately save new user to backend
            await api.saveUser(currentUser);
          }
          
          setUser(currentUser);
        } else {
          // Fallback if no TG user data (e.g., opened via direct link without TG context)
          console.warn("No Telegram user data found.");
        }
      } else {
        // Fallback for browser testing
        console.log("Running in browser mode");
      }
      setIsLoaded(true);
    };

    initApp();
  }, []);

  // Persist User State to Backend with Debounce
  // We use a ref to track if it's the initial load to avoid saving immediately on mount
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    if (!isLoaded) return;

    // Debounce the save operation to avoid spamming the API
    const handler = setTimeout(() => {
      api.saveUser(user);
    }, 1000); // Wait 1 second after last change

    return () => {
      clearTimeout(handler);
    };
  }, [user, isLoaded]);

  // Handle Mining Action
  const handleMine = () => {
    const now = Date.now();
    // Simple client-side validation
    if (now - user.lastMine < MINE_COOLDOWN_MS) return;

    // Logic: earn random 2-3 coins + passive
    const earned = Math.floor(Math.random() * 1) + 1; 
    const passive = calculatePassiveIncome(user.businesses);
    const newCoins = user.coins + earned + passive;

    setUser(prev => ({
      ...prev,
      coins: newCoins,
      lastMine: now
    }));
  };

  // Handle Buying Businesses
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
        {/* Main Content Area */}
        <div className="h-full w-full">
            {renderContent()}
        </div>

        {/* Bottom Navigation */}
        <BottomNav currentTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default App;