import React from 'react';
import { UserState } from '../types';
import { formatNumber, getLevelLabel } from '../constants';
import { calculatePassiveIncome } from '../services/gameLogic';

interface MeViewProps {
  user: UserState;
  onSubscribeToggle: () => void;
}

const MeView: React.FC<MeViewProps> = ({ user, onSubscribeToggle }) => {
  const passive = calculatePassiveIncome(user.businesses);
  const level = getLevelLabel(user.coins);

  return (
    <div className="h-full px-4 pt-8 pb-24 overflow-y-auto bg-slate-900">
      <div className="flex flex-col items-center mb-6">
        <div className="w-24 h-24 bg-gradient-to-tr from-slate-700 to-slate-600 rounded-full flex items-center justify-center text-4xl shadow-xl mb-4 border-4 border-slate-800">
          😎
        </div>
        <h2 className="text-2xl font-bold text-white">{user.username}</h2>
        <span className="px-3 py-1 bg-lime-500/10 text-lime-400 rounded-full text-xs font-bold mt-2 uppercase border border-lime-500/20">
          {level}
        </span>
      </div>

      <div className="space-y-4">
        {/* User ID Section - Dedicated & Prominent */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center justify-between shadow-sm">
           <span className="text-slate-400 font-medium">User ID</span>
           <div className="flex items-center gap-2">
             <span className="text-lime-400 font-mono font-bold tracking-wider bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-600/50 select-all shadow-inner">
                {user.id}
             </span>
           </div>
        </div>

        {/* Profile Details Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-white font-bold mb-4">Profile Details</h3>
            <div className="space-y-3">
               <div className="flex justify-between border-b border-slate-700 pb-2">
                 <span className="text-slate-400">Username</span>
                 <span className="text-white">@{user.username}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-slate-400">Language</span>
                 <span className="text-white uppercase">{user.languageCode || 'en'}</span>
               </div>
            </div>
        </div>

        {/* Stats Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-white font-bold mb-4">Account Statistics</h3>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700/50 p-3 rounded-lg">
                    <div className="text-slate-400 text-xs mb-1">Total Balance</div>
                    <div className="text-white font-bold">{formatNumber(user.coins)}</div>
                </div>
                <div className="bg-slate-700/50 p-3 rounded-lg">
                    <div className="text-slate-400 text-xs mb-1">Passive Income</div>
                    <div className="text-lime-400 font-bold">+{formatNumber(passive)}</div>
                </div>
                <div className="bg-slate-700/50 p-3 rounded-lg">
                    <div className="text-slate-400 text-xs mb-1">Businesses</div>
                    <div className="text-white font-bold">{Object.values(user.businesses).reduce((a: number, b: number) => a + b, 0)}</div>
                </div>
                <div className="bg-slate-700/50 p-3 rounded-lg">
                    <div className="text-slate-400 text-xs mb-1">Referrals</div>
                    <div className="text-white font-bold">{user.referralsCount}</div>
                </div>
            </div>
        </div>

        {/* Settings Card */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-white font-bold mb-4">Settings</h3>
            
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-white font-medium">Notifications</div>
                    <div className="text-slate-400 text-xs">Receive leaderboard & ad updates</div>
                </div>
                <button 
                    onClick={onSubscribeToggle}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${user.subscribed ? 'bg-lime-500' : 'bg-slate-600'}`}
                >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${user.subscribed ? 'translate-x-6' : ''}`}></div>
                </button>
            </div>
        </div>

        <div className="mt-8 text-center">
            <a href="#" className="text-indigo-400 text-sm hover:text-indigo-300">Terms of Service</a>
            <span className="mx-2 text-slate-600">•</span>
            <a href="#" className="text-indigo-400 text-sm hover:text-indigo-300">Privacy Policy</a>
            <div className="mt-4 text-xs text-slate-600">
                v1.0.0 • CEO TOTO Tycoon
            </div>
        </div>
      </div>
    </div>
  );
};

export default MeView;