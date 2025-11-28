import { BusinessDef } from './types';

// Derived from index.js provided by user
export const BUSINESSES: BusinessDef[] = [
  { id: 'Hire_Miner', name: 'Hire Miner', cost: 1000, income: 1 },
  { id: 'TOTO_VAULT', name: 'TOTO VAULT', cost: 2000, income: 2 },
  { id: 'CIFCI_STABLE', name: 'CIFCI STABLE COIN', cost: 5000, income: 4 },
  { id: 'TYPOGRAM', name: 'TYPOGRAM', cost: 100000, income: 5 },
  { id: 'APPLE', name: 'APPLE', cost: 200000, income: 5 },
  { id: 'BITCOIN', name: 'BITCOIN', cost: 1000000, income: 10 },
];

export const MINE_COOLDOWN_MS = 60000; // 1 minute

export const getLevelLabel = (coins: number): string => {
  if (coins < 1000) return "Intern";
  if (coins < 10000) return "Manager";
  if (coins < 100000) return "CEO";
  if (coins < 700000) return "Tycoon";
  return "You become CEO TOTO 💎";
};

export const formatNumber = (n: number): string => {
  return n.toLocaleString("en-IN");
};
