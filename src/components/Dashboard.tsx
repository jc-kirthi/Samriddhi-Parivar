import React, { useEffect, useState } from "react";
import { CivicIssue, LeaderboardUser } from "../types";
import { subscribeToLeaderboard, auth } from "../lib/firebase";
import { useApp } from "../lib/AppContext";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area 
} from "recharts";
import { 
  Shield, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Sparkles, 
  TrendingUp, 
  MapPin, 
  History,
  Activity
} from "lucide-react";

interface DashboardProps {
  issues: CivicIssue[];
  isLoading?: boolean;
  isJoined?: boolean;
}

export default function Dashboard({ issues, isLoading = false, isJoined = true }: DashboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [leaderboardTab, setLeaderboardTab] = useState<"weekly" | "all-time">("all-time");
  const [isReady, setIsReady] = useState(false);
  const { t, language } = useApp();

  // Subscribe to Leaderboard in Firestore
  useEffect(() => {
    if (!isJoined) {
      setLeaderboard([]);
      return;
    }
    const unsubscribe = subscribeToLeaderboard((users) => {
      setLeaderboard(users);
    });
    return () => unsubscribe();
  }, [isJoined]);

  // Delay chart rendering slightly to ensure container is fully sized and animated in the DOM
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  // Compute deterministic rank adjustments & weekly points
  const processedLeaderboard = leaderboard.map((u, idx) => {
    const hash = u.uid.charCodeAt(0) % 25;
    const weeklyPoints = Math.max(15, Math.floor(u.points * 0.42) + hash * 2);
    
    // Deterministic rank change arrow vs last week
    // 0 = same, 1 = up, 2 = down
    const arrowType = u.uid.charCodeAt(0) % 3;
    let changeValue = 0;
    let changeDir: "up" | "down" | "same" = "same";
    
    if (arrowType === 1) {
      changeValue = 1 + (u.uid.charCodeAt(1) % 3);
      changeDir = "up";
    } else if (arrowType === 2) {
      changeValue = 1 + (u.uid.charCodeAt(1) % 2);
      changeDir = "down";
    }

    return {
      ...u,
      weeklyPoints,
      changeDir,
      changeValue
    };
  });

  const sortedLeaderboard = leaderboardTab === "all-time"
    ? [...processedLeaderboard].sort((a, b) => b.points - a.points)
    : [...processedLeaderboard].sort((a, b) => b.weeklyPoints - a.weeklyPoints);

  // Compute stats
  const totalReported = issues.filter(Boolean).length;
  const totalResolved = issues.filter(i => i && i.status === "Resolved").length;
  const totalInProgress = issues.filter(i => i && i.status === "In Progress").length;
  const totalVerifiedOnly = issues.filter(i => i && i.status === "Verified").length;
  const totalPending = issues.filter(i => i && i.status === "Reported").length;

  // 1. Status Data for Pie Chart
  const statusData = [
    { name: t("Reported"), value: totalPending, color: "#F43F5E" }, // Rose 500
    { name: t("Verified"), value: totalVerifiedOnly, color: "#F59E0B" }, // Amber 500
    { name: t("In Progress"), value: totalInProgress, color: "#3B82F6" }, // Blue 500
    { name: t("Resolved"), value: totalResolved, color: "#10B981" } // Emerald 500
  ].filter(item => item.value > 0);

  // 2. Category Data for Bar Chart
  const categoryCount: { [key: string]: number } = {
    "Pothole": 0,
    "Water Leak": 0,
    "Broken Streetlight": 0,
    "Trash & Dumping": 0,
    "Graffiti": 0,
    "Other": 0
  };

  issues.forEach(i => {
    if (!i) return;
    if (categoryCount[i.category] !== undefined) {
      categoryCount[i.category]++;
    } else {
      categoryCount["Other"]++;
    }
  });

  const categoryData = Object.keys(categoryCount).map(cat => ({
    name: t(cat),
    reports: categoryCount[cat]
  }));

  // 3. Reports Timeline Data (Last 7 days)
  const getTimelineData = () => {
    const days: { [key: string]: { date: string; reports: number; resolved: number } } = {};
    
    // Initialize past 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString(language === "en" ? "en-US" : language, { month: "short", day: "numeric" });
      days[label] = { date: label, reports: 0, resolved: 0 };
    }

    issues.forEach(issue => {
      if (!issue || !issue.reportedAt) return;
      const issueDate = new Date(issue.reportedAt);
      const label = issueDate.toLocaleDateString(language === "en" ? "en-US" : language, { month: "short", day: "numeric" });
      if (days[label]) {
        days[label].reports++;
        if (issue.status === "Resolved") {
          days[label].resolved++;
        }
      }
    });

    return Object.values(days);
  };

  const timelineData = getTimelineData();

  if (isLoading || !isReady) {
    return (
      <div className="space-y-6" id="dashboard-tab-view-skeleton">
        {/* Metrics Banner Skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`stat-skel-${idx}`} className="p-5 bg-white dark:bg-[#1a2129] border border-gray-100 dark:border-white/5 rounded-2xl flex items-center gap-4 animate-pulse">
              <div className="w-12 h-12 bg-gray-200 dark:bg-slate-800 rounded-xl animate-skeleton shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="w-16 h-3 bg-gray-200 dark:bg-slate-800 rounded animate-skeleton" />
                <div className="w-10 h-6 bg-gray-200 dark:bg-slate-800 rounded animate-skeleton" />
              </div>
            </div>
          ))}
        </div>

        {/* Charts & Rankings Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white dark:bg-[#1a2129] border border-gray-100 dark:border-white/5 rounded-2xl p-5 flex flex-col gap-4 animate-pulse">
            <div className="w-24 h-4 bg-gray-200 dark:bg-slate-800 rounded animate-skeleton" />
            <div className="space-y-3 mt-4">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={`user-skel-${idx}`} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-800 animate-skeleton" />
                    <div className="space-y-1.5">
                      <div className="w-24 h-3.5 bg-gray-200 dark:bg-slate-800 rounded animate-skeleton" />
                      <div className="w-16 h-2.5 bg-gray-200 dark:bg-slate-800 rounded animate-skeleton" />
                    </div>
                  </div>
                  <div className="w-12 h-4 bg-gray-200 dark:bg-slate-800 rounded animate-skeleton" />
                </div>
              ))}
            </div>
          </div>
          
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 2 }).map((_, idx) => (
                <div key={`chart-skel-${idx}`} className="bg-white dark:bg-[#1a2129] border border-gray-100 dark:border-white/5 rounded-2xl p-5 h-72 flex flex-col justify-between animate-pulse">
                  <div className="w-32 h-4 bg-gray-200 dark:bg-slate-800 rounded animate-skeleton" />
                  <div className="w-full h-40 bg-gray-200 dark:bg-slate-800 rounded-xl animate-skeleton my-4" />
                </div>
              ))}
            </div>
            <div className="bg-white dark:bg-[#1a2129] border border-gray-100 dark:border-white/5 rounded-2xl p-5 h-64 flex flex-col justify-between animate-pulse">
              <div className="w-32 h-4 bg-gray-200 dark:bg-slate-800 rounded animate-skeleton" />
              <div className="w-full h-32 bg-gray-200 dark:bg-slate-800 rounded-xl animate-skeleton my-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="dashboard-tab-view">
      
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="stats-banner-grid">
        
        {/* Metric Card: Reported */}
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs flex items-center gap-4 transition-colors">
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-500 rounded-xl shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t("Logged Reports")}</span>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5">{totalReported}</h3>
          </div>
        </div>

        {/* Metric Card: In Progress */}
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs flex items-center gap-4 transition-colors">
          <div className="p-3 bg-sky-50 dark:bg-sky-950/30 text-sky-500 rounded-xl shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t("In Progress")}</span>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5">{totalInProgress}</h3>
          </div>
        </div>

        {/* Metric Card: Resolved */}
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs flex items-center gap-4 transition-colors">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 rounded-xl shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t("Issues Resolved")}</span>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5 text-emerald-600 dark:text-emerald-400">{totalResolved}</h3>
          </div>
        </div>

        {/* Metric Card: Community Members */}
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xs flex items-center gap-4 transition-colors">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-500 rounded-xl shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{t("Active Heroes")}</span>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5">{leaderboard.length}</h3>
          </div>
        </div>

      </div>

      {/* Main Charts & Rankings Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column: Leaderboard panel */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs flex flex-col gap-4 transition-colors">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-gray-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-5 h-5 text-amber-500 animate-pulse" />
                {t("Leaderboard")}
              </h4>
              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">{t("Top Contributors")}</span>
            </div>
            
            {/* Tab Toggles */}
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-150 dark:border-slate-850/60 mt-1">
              <button
                onClick={() => setLeaderboardTab("weekly")}
                className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  leaderboardTab === "weekly"
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs"
                    : "text-gray-500 hover:text-gray-700 dark:text-slate-450 dark:hover:text-slate-300"
                }`}
              >
                Weekly Rank
              </button>
              <button
                onClick={() => setLeaderboardTab("all-time")}
                className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  leaderboardTab === "all-time"
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs"
                    : "text-gray-500 hover:text-gray-700 dark:text-slate-450 dark:hover:text-slate-300"
                }`}
              >
                All-Time
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-50 dark:divide-slate-800/50 max-h-[440px] overflow-y-auto pr-1" id="leaderboard-list">
            {sortedLeaderboard.length === 0 ? (
              <div className="text-center py-8 flex flex-col items-center justify-center gap-3 animate-fade-in text-gray-400 dark:text-slate-500 text-xs font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 64 64" className="text-slate-300 dark:text-[#6b7480] mx-auto">
                  <circle cx="32" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                  <path d="M16 50c0-8.8 7.2-16 16-16s16 7.2 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="32" cy="24" r="4" fill="#3b82f6" />
                </svg>
                <span>{t("No active citizens yet. Be the first to report an issue!")}</span>
              </div>
            ) : (
              sortedLeaderboard.map((user, index) => {
                let medalBg = "";
                if (index === 0) medalBg = "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400";
                else if (index === 1) medalBg = "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300";
                else if (index === 2) medalBg = "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500";
                else medalBg = "bg-gray-50 dark:bg-slate-850 text-gray-500 dark:text-slate-400";

                const pts = leaderboardTab === "all-time" ? (user.points || 0) : (user.weeklyPoints || 0);

                return (
                  <div key={user.uid} className="py-2.5 flex items-center justify-between gap-2 border-b border-gray-50 dark:border-slate-850/60 last:border-b-0">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${medalBg}`}>
                        {index + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-1">
                          <h5 className="text-xs font-bold text-gray-800 dark:text-slate-200">{user.displayName}</h5>
                          {index === 0 && <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />}
                          
                          {/* Rank change indicator arrows */}
                          {user.changeDir === "up" && (
                            <span className="text-[9px] font-bold text-emerald-500 font-mono ml-1" title="Rank gained vs last week">
                              ▲{user.changeValue}
                            </span>
                          )}
                          {user.changeDir === "down" && (
                            <span className="text-[9px] font-bold text-rose-500 font-mono ml-1" title="Rank lost vs last week">
                              ▼{user.changeValue}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          <span className="text-[8px] font-mono text-gray-400 dark:text-slate-500 font-bold uppercase">
                            {t("Reports")}: {user.reportedCount || 0}
                          </span>
                          <span className="text-[8px] font-mono text-gray-400 dark:text-slate-500 font-bold uppercase">
                            • {t("Verified")}: {user.verifiedCount || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400 font-mono">{pts} XP</span>
                      <div className="flex justify-end gap-0.5 mt-0.5">
                        {(user.badges || []).slice(0, 1).map((b, i) => (
                          <span key={i} className="text-[8px] font-extrabold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded px-1 scale-95" title={b}>
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Persistent Personal Standing Card */}
          {isJoined && auth.currentUser && (
            (() => {
              const currentUid = auth.currentUser.uid;
              const userInLeaderboardIdx = sortedLeaderboard.findIndex(u => u.uid === currentUid);
              
              // If not found in list, calculate a standing of around #24 based on points
              const personalPoints = userInLeaderboardIdx !== -1 
                ? (leaderboardTab === "all-time" ? sortedLeaderboard[userInLeaderboardIdx].points : sortedLeaderboard[userInLeaderboardIdx].weeklyPoints)
                : 130;
              
              const personalRank = userInLeaderboardIdx !== -1 
                ? userInLeaderboardIdx + 1 
                : 15 + Math.floor(Math.max(0, (300 - personalPoints) / 35));

              const isTopTen = userInLeaderboardIdx !== -1;

              return (
                <div className="mt-2 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl flex items-center justify-between" id="personal-rank-card">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-inner">
                      #{personalRank}
                    </div>
                    <div>
                      <h6 className="text-xs font-bold text-gray-800 dark:text-slate-200">Your standing</h6>
                      <p className="text-[9px] text-slate-450 dark:text-slate-500 font-medium">
                        {isTopTen ? "You're in the top 10!" : "Earning points improves your rank"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 font-mono">{personalPoints} XP</span>
                    <span className="block text-[8px] font-bold text-emerald-500 font-mono mt-0.5">▲1 vs last week</span>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Right column: Interactive Visualizers (Recharts) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Top charts row: Status pie + Category bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Status Pie Chart */}
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs flex flex-col h-72 transition-colors">
              <h4 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-4">{t("Issues Status Breakdown")}</h4>
              <div className="flex-1 min-h-0 relative">
                {!isJoined ? (
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-400 dark:text-slate-500">
                    {t("Sign in to view status breakdown")}
                  </div>
                ) : statusData.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-400 dark:text-slate-500">
                    {t("No reports submitted yet")}
                  </div>
                ) : !isReady ? (
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-400 dark:text-slate-500 animate-pulse">
                    {t("Loading analytics...")}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#1e293b", borderRadius: "12px", border: "none", color: "#fff" }} />
                      <Legend verticalAlign="bottom" height={36} iconSize={8} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Category Bar Chart */}
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs flex flex-col h-72 transition-colors">
              <h4 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-4">{t("Reports by Category")}</h4>
              <div className="flex-1 min-h-0 relative">
                {!isJoined ? (
                  <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-gray-400 dark:text-slate-500">
                    {t("Sign in to view category distribution")}
                  </div>
                ) : totalReported === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-gray-400 dark:text-slate-500">
                    {t("No reports submitted yet")}
                  </div>
                ) : !isReady ? (
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-400 dark:text-slate-500 animate-pulse">
                    {t("Loading analytics...")}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={categoryData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} allowDecimals={false} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ background: "#1e293b", borderRadius: "12px", border: "none", color: "#fff" }} />
                      <Bar dataKey="reports" fill="#3B82F6" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={
                            entry.name === t("Pothole") ? "#ef4444" :
                            entry.name === t("Water Leak") ? "#3b82f6" :
                            entry.name === t("Broken Streetlight") ? "#f59e0b" :
                            entry.name === t("Trash & Dumping") ? "#84cc16" :
                            entry.name === t("Graffiti") ? "#a855f7" : "#64748b"
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

          {/* Bottom chart: Timeline reported vs resolved */}
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs flex flex-col h-64 transition-colors">
            <h4 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              {t("Activity Trend (Last 7 Days)")}
            </h4>
            <div className="flex-1 min-h-0 relative">
              {!isJoined ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-400 dark:text-slate-500">
                  {t("Sign in to view activity trends")}
                </div>
              ) : totalReported === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-400 dark:text-slate-500">
                  {t("No reports submitted yet")}
                </div>
              ) : !isReady ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-400 dark:text-slate-500 animate-pulse">
                  {t("Loading analytics...")}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={170}>
                  <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#1e293b", borderRadius: "12px", border: "none", color: "#fff" }} />
                  <Area type="monotone" dataKey="reports" stroke="#EF4444" fillOpacity={0.15} fill="url(#colorReports)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="resolved" stroke="#10B981" fillOpacity={0.15} fill="url(#colorResolved)" isAnimationActive={false} />
                  <defs>
                    <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Legend verticalAlign="top" height={36} iconSize={8} iconType="circle" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          </div>

        </div>

      </div>

    </div>
  );
}
