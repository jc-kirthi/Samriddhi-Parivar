import React from "react";
import { UserProfile } from "../types";
import { useApp } from "../lib/AppContext";
import { 
  Award, 
  Sparkles, 
  Flame, 
  BookOpen, 
  Compass, 
  Shield, 
  Star, 
  CheckCircle, 
  MapPin, 
  Hourglass,
  Zap
} from "lucide-react";

interface GamificationPanelProps {
  profile: UserProfile | null;
  onOpenAuth: () => void;
}

export default function GamificationPanel({ profile, onOpenAuth }: GamificationPanelProps) {
  const { t } = useApp();
  
  if (!profile) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 text-center shadow-xs flex flex-col items-center justify-center gap-4 h-full" id="gamification-auth-banner">
        <Award className="w-12 h-12 text-gray-300 dark:text-slate-700" />
        <div>
          <h4 className="text-sm font-extrabold text-gray-800 dark:text-slate-200">{t("Track Your Points & Badges")}</h4>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
            {t("Create an account or sign in as Guest to earn XP for filing reports, verifying issues, and repairing local city infrastructure!")}
          </p>
        </div>
        <button
          onClick={onOpenAuth}
          className="py-2.5 px-6 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-colors cursor-pointer"
        >
          {t("Sign In / Open Hero Panel")}
        </button>
      </div>
    );
  }

  // XP calculations
  const points = profile.points || 0;
  const xpPerLevel = 200;
  const currentLevel = Math.floor(points / xpPerLevel) + 1;
  const levelProgressPoints = points % xpPerLevel;
  const levelProgressPercent = Math.min(Math.round((levelProgressPoints / xpPerLevel) * 100), 100);
  const xpToNextLevel = xpPerLevel - levelProgressPoints;

  // Custom metadata for badges
  const badgeMeta: { [key: string]: { description: string; emoji: string; color: string } } = {
    "First Step": {
      description: "Welcome Bonus: Initial registration into the Austin Civic Network.",
      emoji: "🌱",
      color: "from-teal-400 to-emerald-500 text-teal-900"
    },
    "Rookie Reporter": {
      description: "Logged your first civic issue! The city appreciates your keen eyes.",
      emoji: "📸",
      color: "from-blue-400 to-sky-500 text-blue-900"
    },
    "Civic Champion": {
      description: "Reported 5 or more distinct active civic maintenance issues.",
      emoji: "🏆",
      color: "from-amber-400 to-orange-500 text-amber-900"
    },
    "Eagle Eye": {
      description: "Validated another user's report. Helping maintain grid integrity.",
      emoji: "🦅",
      color: "from-indigo-400 to-purple-500 text-indigo-900"
    },
    "Elite Validator": {
      description: "Verified 5 or more distinct reports to assist civic municipal crews.",
      emoji: "🔍",
      color: "from-fuchsia-400 to-pink-500 text-fuchsia-900"
    },
    "Problem Solver": {
      description: "Successfully had one of your reported issues marked as 'Resolved'.",
      emoji: "🔧",
      color: "from-emerald-400 to-teal-500 text-emerald-900"
    },
    "Neighborhood Guardian": {
      description: "Eclipsed 200 total civic contribution experience points.",
      emoji: "🛡️",
      color: "from-rose-400 to-rose-600 text-rose-900"
    },
    "Super Citizen": {
      description: "Exceeded 500 total points. Legendary status in our Austin metro grid.",
      emoji: "👑",
      color: "from-violet-500 to-purple-700 text-violet-50 font-black"
    }
  };

  const getBadgeDetails = (badgeName: string) => {
    return badgeMeta[badgeName] || {
      description: "Special achievement earned for helping the city.",
      emoji: "🌟",
      color: "from-gray-400 to-gray-500 text-gray-900"
    };
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col gap-5 h-full transition-colors" id="gamification-panel-main">
      
      {/* Level Summary */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
            <Zap className="w-5 h-5 fill-blue-600" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">{t("Active Level")}</h4>
            <h3 className="text-lg font-black text-gray-800 dark:text-slate-200">{t("Rank: Level")} {currentLevel}</h3>
          </div>
        </div>
        <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg">
          {points} XP
        </span>
      </div>

      {/* Level Progression Bar */}
      <div className="space-y-1.5" id="level-progression-wrapper">
        <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500 font-extrabold font-mono">
          <span>{t("PROGRESS TO LEVEL")} {currentLevel + 1}</span>
          <span>{levelProgressPoints} / 200 XP</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-3.5 rounded-full overflow-hidden border border-slate-50 dark:border-slate-750 relative">
          <div 
            className="bg-linear-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${levelProgressPercent}%` }}
          />
        </div>
        <p className="text-[9px] text-gray-400 dark:text-slate-400 font-medium">
          {t("Earn")} <span className="font-extrabold text-blue-600 dark:text-blue-400">{xpToNextLevel} {t("more XP")}</span> {t("to level up and unlock exclusive city profile styles!")}
        </p>
      </div>

      <hr className="border-gray-50 dark:border-slate-800" />

      {/* Stats Counter Grid */}
      <div className="grid grid-cols-3 gap-3" id="user-private-stats">
        
        <div className="p-3 bg-slate-50/70 dark:bg-slate-850/50 rounded-xl text-center border border-slate-100/50 dark:border-slate-800">
          <h5 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase">{t("Reports")}</h5>
          <span className="text-lg font-black text-gray-700 dark:text-slate-300 font-mono mt-0.5 block">{profile.reportedCount || 0}</span>
        </div>

        <div className="p-3 bg-slate-50/70 dark:bg-slate-850/50 rounded-xl text-center border border-slate-100/50 dark:border-slate-800">
          <h5 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase">{t("Verifications")}</h5>
          <span className="text-lg font-black text-gray-700 dark:text-slate-300 font-mono mt-0.5 block">{profile.verifiedCount || 0}</span>
        </div>

        <div className="p-3 bg-slate-50/70 dark:bg-slate-850/50 rounded-xl text-center border border-slate-100/50 dark:border-slate-800">
          <h5 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase">{t("Resolved")}</h5>
          <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">{profile.resolvedCount || 0}</span>
        </div>

      </div>

      <hr className="border-gray-50 dark:border-slate-800" />

      {/* Earned Badges Scroll Area */}
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        <h4 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5 shrink-0">
          <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          {t("My Civic Achievements")} ({profile.badges?.length || 0})
        </h4>

        <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[190px]" id="user-badges-list">
          {(profile.badges || []).map((badgeName) => {
            const { description, emoji, color } = getBadgeDetails(badgeName);

            return (
              <div 
                key={badgeName} 
                className="p-3 bg-white dark:bg-slate-850 border border-gray-100 dark:border-slate-800 rounded-xl flex items-start gap-3 shadow-2xs hover:border-gray-200 dark:hover:border-slate-750 transition-colors"
              >
                <div className={`w-9 h-9 rounded-xl bg-linear-to-br ${color} flex items-center justify-center text-lg shrink-0 shadow-sm`}>
                  {emoji}
                </div>
                <div>
                  <h5 className="text-xs font-black text-gray-800 dark:text-slate-200">{t(badgeName)}</h5>
                  <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5 leading-relaxed">{t(description)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick guide for XP contribution */}
      <div className="pt-3 border-t border-gray-100 dark:border-slate-800 text-[11px] text-gray-500 dark:text-slate-400" id="xp-contribution-guide">
        <h5 className="font-bold text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          {t("How to Earn Experience Points (XP)")}
        </h5>
        <div className="grid grid-cols-3 gap-2 text-[10px] text-center font-bold">
          <div className="p-2 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/30 dark:border-blue-900/10 rounded-xl">
            <span className="block text-blue-600 dark:text-blue-400 font-black">+50 XP</span>
            <span className="text-[9px] text-gray-400 dark:text-slate-500 font-medium">{t("File Report")}</span>
          </div>
          <div className="p-2 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/30 dark:border-amber-900/10 rounded-xl">
            <span className="block text-amber-600 dark:text-amber-400 font-black">+15 XP</span>
            <span className="text-[9px] text-gray-400 dark:text-slate-500 font-medium">{t("Verify")}</span>
          </div>
          <div className="p-2 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/30 dark:border-emerald-900/10 rounded-xl">
            <span className="block text-emerald-600 dark:text-emerald-400 font-black">+100 XP</span>
            <span className="text-[9px] text-gray-400 dark:text-slate-500 font-medium">{t("Resolved")}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
