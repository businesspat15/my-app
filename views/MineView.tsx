import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserState } from '../types';
import { calculatePassiveIncome } from '../services/gameLogic';
import { formatNumber, getLevelLabel, MINE_COOLDOWN_MS } from '../constants';

interface MineViewProps {
  user: UserState;
  onMine: () => void;
}

interface FlyingCoin {
  id: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  controlX: number;
  controlY: number;
  delay: number;
}

const CoinAnimation: React.FC<{ coin: FlyingCoin; onComplete: () => void }> = React.memo(({ coin, onComplete }) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  const DURATION = 800; // ms

  // Keep callback fresh without restarting effect
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let rafId: number;
    
    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      
      // Wait for delay
      if (elapsed < coin.delay) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      const animationTime = elapsed - coin.delay;
      const progress = Math.min(animationTime / DURATION, 1);

      // Quadratic Bezier: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
      const t = progress;
      const t2 = t * t;
      const oneMinusT = 1 - t;
      const oneMinusT2 = oneMinusT * oneMinusT;

      const x = oneMinusT2 * coin.startX + 2 * oneMinusT * t * coin.controlX + t2 * coin.targetX;
      const y = oneMinusT2 * coin.startY + 2 * oneMinusT * t * coin.controlY + t2 * coin.targetY;
      
      const scale = 1 - 0.3 * t; // Slight shrink
      const rotate = t * 720; // Spin twice

      if (elementRef.current) {
        // Fade in
        elementRef.current.style.opacity = '1';
        elementRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`;
        
        // Fade out slightly at the very end
        if (progress > 0.9) {
           elementRef.current.style.opacity = String(1 - (progress - 0.9) * 10);
        }
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        onCompleteRef.current();
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [coin.delay, coin.startX, coin.startY, coin.controlX, coin.controlY, coin.targetX, coin.targetY]);

  return (
    <div
      ref={elementRef}
      className="fixed z-50 text-2xl pointer-events-none"
      style={{
        left: 0,
        top: 0,
        opacity: 0,
        transform: `translate(${coin.startX}px, ${coin.startY}px)`
      }}
    >
      💰
    </div>
  );
});

const MineView: React.FC<MineViewProps> = ({ user, onMine }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [flyingCoins, setFlyingCoins] = useState<FlyingCoin[]>([]);
  const [balanceScale, setBalanceScale] = useState(1);
  
  const buttonRef = useRef<HTMLButtonElement>(null);
  const balanceRef = useRef<HTMLDivElement>(null);

  const passiveIncome = calculatePassiveIncome(user.businesses);
  const levelLabel = getLevelLabel(user.coins);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = now - user.lastMine;
      const remaining = Math.max(0, MINE_COOLDOWN_MS - diff);
      setTimeLeft(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [user.lastMine]);

  const progressPercent = Math.min(100, ((MINE_COOLDOWN_MS - timeLeft) / MINE_COOLDOWN_MS) * 100);
  const isReady = timeLeft === 0;

  const handleMineClick = () => {
    if (!isReady) return;
    
    // Trigger game logic
    onMine();

    // Trigger animation
    if (buttonRef.current && balanceRef.current) {
      const btnRect = buttonRef.current.getBoundingClientRect();
      const balRect = balanceRef.current.getBoundingClientRect();

      // Centers
      const startX = btnRect.left + btnRect.width / 2;
      const startY = btnRect.top + btnRect.height / 2;
      
      const targetX = balRect.left + balRect.width / 2;
      const targetY = balRect.top + balRect.height / 2;

      const newCoins: FlyingCoin[] = Array.from({ length: 15 }).map((_, i) => {
        // Calculate a random Bezier control point
        const midX = (startX + targetX) / 2;
        const midY = (startY + targetY) / 2;

        // Wide random spread for X to create a "fountain" effect
        const spreadX = (Math.random() - 0.5) * 400; 
        
        // Control Y: biased upwards (negative offset) relative to midpoint
        // to ensure coins arc UP before going to the target.
        const controlX = midX + spreadX;
        const controlY = midY - 150 - Math.random() * 100;

        return {
          id: Date.now() + i + Math.random(),
          startX: startX + (Math.random() * 40 - 20), // Slight scatter at source
          startY: startY + (Math.random() * 40 - 20),
          targetX,
          targetY,
          controlX,
          controlY,
          delay: i * 40 // Stagger start times
        };
      });

      setFlyingCoins(prev => [...prev, ...newCoins]);
    }
  };

  const removeCoin = useCallback((id: number) => {
    setFlyingCoins(prev => prev.filter(c => c.id !== id));
    
    // Bounce effect on balance
    setBalanceScale(1.15);
    // Clear any previous timeout to avoid premature reset if possible?
    // Actually, just setting it back after a delay is fine for the "vibrating" effect of multiple coins hitting.
    setTimeout(() => setBalanceScale(1), 100);
  }, []);

  return (
    <div className="flex flex-col items-center h-full px-4 pt-8 pb-24 overflow-y-auto bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Flying Coins Layer */}
      {flyingCoins.map(coin => (
        <CoinAnimation 
          key={coin.id} 
          coin={coin} 
          onComplete={() => removeCoin(coin.id)} 
        />
      ))}

      {/* Header Info */}
      <div className="w-full flex justify-between items-center mb-8">
        <div className="flex flex-col">
          <span className="text-slate-400 text-sm">Passive Income</span>
          <span className="text-lime-400 font-bold">+{formatNumber(passiveIncome)}/mine</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-slate-400 text-sm">Level</span>
          <span className="text-white font-bold">{levelLabel}</span>
        </div>
      </div>

      {/* Main Balance */}
      <div className="flex flex-col items-center mb-10">
        <div 
          ref={balanceRef}
          className="w-20 h-20 bg-lime-500/20 rounded-full flex items-center justify-center mb-4 ring-2 ring-lime-500/50 shadow-[0_0_20px_rgba(132,204,22,0.3)] transition-transform duration-100 ease-in-out"
          style={{ transform: `scale(${balanceScale})` }}
        >
          <span className="text-4xl">💰</span>
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">{formatNumber(user.coins)}</h1>
        <span className="text-slate-400 uppercase tracking-widest text-xs mt-1">Total Balance</span>
      </div>

      {/* Mining Interaction */}
      <div className="flex-1 flex flex-col justify-center items-center w-full max-w-sm">
        <div className="relative w-64 h-64">
           {/* Ripple Effect Background */}
           {isReady && (
            <div className="absolute inset-0 rounded-full bg-lime-500/20 animate-ping"></div>
           )}
           
          <button
            ref={buttonRef}
            onClick={handleMineClick}
            disabled={!isReady}
            className={`relative w-full h-full rounded-full flex items-center justify-center shadow-2xl border-4 transition-all duration-300 active:scale-95 ${
              isReady
                ? 'bg-gradient-to-br from-lime-500 to-green-700 border-lime-300 cursor-pointer hover:shadow-[0_0_40px_rgba(132,204,22,0.5)]'
                : 'bg-slate-700 border-slate-600 cursor-not-allowed opacity-80'
            }`}
          >
            <div className="flex flex-col items-center">
              <span className="text-6xl filter drop-shadow-md">
                {isReady ? '⛏️' : '⏳'}
              </span>
              <span className={`mt-2 font-bold text-lg ${isReady ? 'text-white' : 'text-slate-400'}`}>
                {isReady ? 'MINE NOW' : 'COOLING DOWN'}
              </span>
            </div>
          </button>
        </div>

        {/* Cooldown Timer */}
        <div className="w-full mt-8">
          <div className="flex justify-between text-xs text-slate-400 mb-2 font-mono">
            <span>Status</span>
            <span>{isReady ? 'Ready' : `${Math.ceil(timeLeft / 1000)}s remaining`}</span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${
                isReady ? 'bg-lime-500' : 'bg-orange-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MineView;