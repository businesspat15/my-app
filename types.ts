export enum Tab {
  MINE = 'Mine',
  LEADERBOARD = 'Leaderboard',
  UPGRADE = 'Upgrade',
  TEAM = 'Team',
  ME = 'Me'
}

export interface BusinessDef {
  id: string;
  name: string;
  cost: number;
  income: number;
}

export interface UserState {
  id: string;
  username: string;
  coins: number;
  businesses: Record<string, number>; // Business ID -> Quantity
  level: number;
  lastMine: number; // Timestamp
  referredBy: string | null;
  referralsCount: number;
  subscribed: boolean;
  languageCode?: string;
}

// Telegram Web App Types
export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    start_param?: string;
    auth_date: string;
    hash: string;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  platform: string;
  viewportHeight: number;
  viewportStableHeight: number;
}

declare global {
  interface Window {
    Telegram: {
      WebApp: TelegramWebApp;
    };
  }
}