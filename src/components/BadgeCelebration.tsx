import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { Award, Share2, Sparkles, X, ChevronRight } from "lucide-react";

interface BadgeCelebrationProps {
  badgeName: string;
  onClose: () => void;
}

export default function BadgeCelebration({ badgeName, onClose }: BadgeCelebrationProps) {
  
  // Custom metadata for badges to display correct styling and descriptors
  const badgeMeta: { [key: string]: { description: string; emoji: string; color: string } } = {
    "First Step": {
      description: "Welcome Bonus: Initial registration into the Bengaluru Civic Network.",
      emoji: "🌱",
      color: "from-teal-400 to-emerald-500 text-teal-900 shadow-teal-500/20"
    },
    "Rookie Reporter": {
      description: "Logged your first civic issue! The city appreciates your keen eyes.",
      emoji: "📸",
      color: "from-blue-400 to-sky-500 text-blue-900 shadow-blue-500/20"
    },
    "Civic Champion": {
      description: "Reported 5 or more distinct active civic maintenance issues.",
      emoji: "🏆",
      color: "from-amber-400 to-orange-500 text-amber-900 shadow-amber-500/20"
    },
    "Eagle Eye": {
      description: "Validated another user's report. Helping maintain grid integrity.",
      emoji: "🦅",
      color: "from-indigo-400 to-purple-500 text-indigo-900 shadow-indigo-500/20"
    },
    "Elite Validator": {
      description: "Verified 5 or more distinct reports to assist civic municipal crews.",
      emoji: "🔍",
      color: "from-fuchsia-400 to-pink-500 text-fuchsia-900 shadow-fuchsia-500/20"
    },
    "Problem Solver": {
      description: "Successfully had one of your reported issues marked as 'Resolved'.",
      emoji: "🔧",
      color: "from-emerald-400 to-teal-500 text-emerald-900 shadow-emerald-500/20"
    },
    "Neighborhood Guardian": {
      description: "Eclipsed 200 total civic contribution experience points.",
      emoji: "🛡️",
      color: "from-rose-400 to-rose-600 text-rose-900 shadow-rose-500/20"
    },
    "Super Citizen": {
      description: "Exceeded 500 total points. Legendary status in our Bengaluru metro grid.",
      emoji: "👑",
      color: "from-violet-500 to-purple-700 text-violet-50 font-black shadow-purple-500/20"
    }
  };

  const badge = badgeMeta[badgeName] || {
    description: "Special achievement earned for helping the city.",
    emoji: "🌟",
    color: "from-gray-400 to-gray-500 text-gray-900 shadow-gray-500/20"
  };

  // Trigger high fidelity confetti bursts on component load
  useEffect(() => {
    // Left burst
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { x: 0.1, y: 0.6 }
    });

    // Right burst
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { x: 0.9, y: 0.6 }
    });

    // Center grand burst
    const duration = 2.5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  // Handle Web Share API sharing
  const handleShare = async () => {
    const shareData = {
      title: "SAMRIDDHI PARIVAR Badge Unlocked!",
      text: `I just unlocked the "${badgeName}" badge on SAMRIDDHI PARIVAR by contributing to Bengaluru city municipal maintenance! Join me!`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.warn("User cancelled share or API failed:", err);
      }
    } else {
      // Fallback copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        alert("Achievement link copied to clipboard!");
      } catch (err) {
        console.error("Clipboard copy failed:", err);
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-55 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto select-none font-sans"
      id="badge-celebration-overlay"
    >
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl flex flex-col items-center gap-6 animate-scale-up overflow-hidden"
        id="badge-celebration-card"
      >
        {/* Background pulsing glows */}
        <div className="absolute top-0 w-32 h-32 bg-blue-500/15 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute bottom-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon */}
        <div className="flex items-center gap-1 text-[10px] font-mono font-black text-amber-400 tracking-widest uppercase bg-amber-950/40 px-3 py-1 rounded-full border border-amber-900/30">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          Achievement Unlocked!
        </div>

        {/* Large Badge Display (120px) */}
        <div className="relative mt-2">
          {/* Pulsing rings background */}
          <div className="absolute inset-[-12px] rounded-full bg-linear-to-br from-blue-500/10 to-indigo-500/10 animate-pulse pointer-events-none"></div>
          <div className="absolute inset-[-24px] rounded-full bg-linear-to-br from-blue-500/5 to-indigo-500/5 animate-ping pointer-events-none"></div>

          {/* Actual Badge Circular icon */}
          <div 
            className={`w-32 h-32 rounded-full bg-linear-to-br ${badge.color} flex items-center justify-center text-5xl shadow-2xl shadow-blue-500/10 border-4 border-slate-900 relative`}
          >
            {badge.emoji}
          </div>
        </div>

        {/* Badge Name & Description */}
        <div className="space-y-2 mt-2">
          <h1 className="text-2xl font-black text-white tracking-tight">{badgeName}</h1>
          <p className="text-xs text-slate-400 font-medium px-4 leading-relaxed">
            {badge.description}
          </p>
        </div>

        {/* Rewards Summary */}
        <div className="w-full bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl flex items-center justify-around font-mono text-[10px] text-slate-400 font-bold">
          <div className="text-center">
            <span className="block text-emerald-400 font-black text-sm">+200 XP</span>
            <span>LEVEL PROGRESS</span>
          </div>
          <div className="h-6 w-px bg-slate-800"></div>
          <div className="text-center">
            <span className="block text-blue-400 font-black text-sm">GOLD</span>
            <span>MUNICIPAL RANK</span>
          </div>
        </div>

        {/* Share Achievement CTA and Continue */}
        <div className="w-full space-y-2.5 pt-2">
          <button
            onClick={handleShare}
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-500/20 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4 text-blue-200" />
            Share Achievement
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 px-6 bg-slate-800 hover:bg-slate-750 text-slate-300 font-extrabold text-xs rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
          >
            Continue
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
