import React, { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { motion, AnimatePresence } from "motion/react";
import { 
  auth, 
  subscribeToIssues, 
  subscribeToUserProfile,
  isUsingCustomDatabase,
  resetToDefaultDatabase,
  onAuthStateChanged,
  signOut,
  isDemoMode,
  setDemoMode,
  signInAnonymously
} from "./lib/firebase";
import { CivicIssue, UserProfile } from "./types";
import { syncOfflineQueue } from "./lib/offlineSync";
import { 
  Shield, 
  Map, 
  BarChart2, 
  User as UserIcon, 
  LogOut, 
  Plus, 
  ShieldAlert, 
  Compass, 
  Activity, 
  Sparkles,
  MapPin,
  Clock,
  Layers,
  Award,
  ChevronRight,
  UserCheck,
  Sun,
  Moon,
  Globe,
  Loader2,
  Play,
  Check,
  X,
  HelpCircle,
  Wand2
} from "lucide-react";

// Import Custom Hooks / Config
import { useApp, LANGUAGES } from "./lib/AppContext";
import { useOfflineSync } from "./hooks/useOfflineSync";

// Import Components
import AuthModal from "./components/AuthModal";
import ReportIssueModal from "./components/ReportIssueModal";
import IssueList from "./components/IssueList";
import GamificationPanel from "./components/GamificationPanel";
import HeroLanding from "./components/HeroLanding";
import BadgeCelebration from "./components/BadgeCelebration";
import ImpactCertificate from "./components/ImpactCertificate";
import OfficialDashboard from "./components/OfficialDashboard";
import Footer from "./components/Footer";

// Lazy-loaded heavy components for cold start performance
const MapContainer = React.lazy(() => import("./components/MapContainer"));
const Dashboard = React.lazy(() => import("./components/Dashboard"));

export default function App() {
  // Global Translation and Theme state
  const { theme, toggleTheme, language, setLanguage, t } = useApp();

  // Authentication State
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isUserJoined, setIsUserJoined] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("civic_user_joined") === "true";
    }
    return false;
  });

  const isJoined = isUserJoined || isDemoMode() || (!!user && !user.isAnonymous);

  // Core Data State
  const [issues, setIssues] = useState<CivicIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState<boolean>(true);
  const [selectedIssue, setSelectedIssue] = useState<CivicIssue | null>(null);
  const [activeTab, setActiveTab] = useState<"map" | "impact" | "official">("map");
  const [notifications, setNotifications] = useState<{ id: string; title: string; body: string; type: string }[]>([]);

  // Firestore Connection Error tracking
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState(false);

  // UX / UI enhancement states
  const [showHero, setShowHero] = useState<boolean>(true);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState<boolean>(false);
  const [showJudgeToast, setShowJudgeToast] = useState<boolean>(false);
  const [showTourPanel, setShowTourPanel] = useState<boolean>(false);
  const [showLangDropdown, setShowLangDropdown] = useState<boolean>(false);
  const [unlockedBadge, setUnlockedBadge] = useState<string | null>(null);
  const [showCertificate, setShowCertificate] = useState<boolean>(false);
  const [xpToasts, setXpToasts] = useState<{ id: string; amount: number }[]>([]);
  const [showLevelUpFlash, setShowLevelUpFlash] = useState<boolean>(false);
  const [dailyDigest, setDailyDigest] = useState<string>("");

  const prevProfileRef = React.useRef<UserProfile | null>(null);

  // Monitor Profile state for automatic rewards, level ups, and badge unlocks
  useEffect(() => {
    if (!profile) {
      prevProfileRef.current = null;
      return;
    }

    if (prevProfileRef.current) {
      const prev = prevProfileRef.current;
      
      // 1. XP floating toast animation triggers on points increase
      if (profile.points > prev.points) {
        const diff = profile.points - prev.points;
        const id = Math.random().toString(36).substring(2, 9);
        setXpToasts(prevToasts => [...prevToasts, { id, amount: diff }]);
        
        // auto-clear toast after 1.5s
        setTimeout(() => {
          setXpToasts(prevToasts => prevToasts.filter(t => t.id !== id));
        }, 1500);

        // 2. Full-screen celebration level-up trigger
        const prevLevel = Math.floor(prev.points / 200) + 1;
        const currentLevel = Math.floor(profile.points / 200) + 1;
        if (currentLevel > prevLevel) {
          setShowLevelUpFlash(true);
          setTimeout(() => setShowLevelUpFlash(false), 2000);
        }
      }

      // 3. New Badge unlock celebration triggers on badge additions
      const prevBadges = prev.badges || [];
      const currentBadges = profile.badges || [];
      const newlyUnlocked = currentBadges.filter(b => !prevBadges.includes(b));
      if (newlyUnlocked.length > 0) {
        setUnlockedBadge(newlyUnlocked[0]);
      }
    }

    prevProfileRef.current = profile;
  }, [profile]);

  // Fetch AI daily digest summary with client-side caching to avoid redundant API calls and rate-limiting
  useEffect(() => {
    if (issues.length === 0) return;

    // Check if we have a cached digest for this session
    const cachedDigest = sessionStorage.getItem("civic_daily_digest_text");
    const cachedTime = sessionStorage.getItem("civic_daily_digest_time");
    const now = Date.now();

    // Cache valid for 30 minutes to ensure fresh data while eliminating duplicate requests
    if (cachedDigest && cachedTime && (now - parseInt(cachedTime, 10) < 30 * 60 * 1000)) {
      setDailyDigest(cachedDigest);
      return;
    }
    
    const fetchDigest = async () => {
      try {
        // Send a lightweight representation of active issues to reduce network payload
        const minimizedIssues = issues.map(i => ({
          title: i.title || "Civic Issue",
          category: i.category || "General",
          status: i.status || "Reported"
        }));

        const res = await fetch("/api/daily-digest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issues: minimizedIssues })
        });
        const data = await res.json();
        if (data && data.text) {
          setDailyDigest(data.text);
          sessionStorage.setItem("civic_daily_digest_text", data.text);
          sessionStorage.setItem("civic_daily_digest_time", Date.now().toString());
        }
      } catch (err) {
        // Log cleanly to avoid noisy error output
        console.warn("Could not load AI daily digest, using fallback bulletin.");
      }
    };

    fetchDigest();
  }, [issues.length > 0]);

  // Track previous issues to trigger real-time notifications when government updates status of current user's issues
  const prevIssuesRef = React.useRef<CivicIssue[]>([]);

  useEffect(() => {
    if (!user || issues.length === 0 || prevIssuesRef.current.length === 0) {
      prevIssuesRef.current = issues;
      return;
    }

    const prevIssues = prevIssuesRef.current;
    
    issues.forEach(currentIssue => {
      const prevIssue = prevIssues.find(i => i.id === currentIssue.id);
      if (prevIssue && prevIssue.status !== currentIssue.status) {
        // If it was reported by the current user OR verified by the current user:
        const isMine = currentIssue.reportedBy === user.uid;
        const iVerified = currentIssue.verifiedBy?.includes(user.uid);
        
        if (isMine || iVerified) {
          const id = Math.random().toString(36).substring(2, 9);
          const titleText = isMine 
            ? t("Municipal Progress on Your Report!") 
            : t("Municipal Progress on Your Verified Issue!");
            
          const statusText = t(currentIssue.status);
          const body = `"${currentIssue.title}" status changed to [${statusText}]. ${
            currentIssue.officialResponse ? `Crew Note: "${currentIssue.officialResponse}"` : "The city has assigned work details."
          }`;

          setNotifications(prev => [...prev, { id, title: titleText, body, type: "success" }]);
          
          // Auto-remove notification after 10 seconds
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
          }, 10000);
        }
      }
    });

    prevIssuesRef.current = issues;
  }, [issues, user]);

  // Listen to custom integration events (such as duplicate merges or custom government notices)
  useEffect(() => {
    const handleDuplicateMerge = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { title, rationale } = customEvent.detail;
      const id = Math.random().toString(36).substring(2, 9);
      
      setNotifications(prev => [...prev, {
        id,
        title: t("Duplicate Report Auto-Merged"),
        body: `We merged your report for "${title}" with an existing nearby issue to keep the map clean. You received +25 XP verification credit! Rationale: ${rationale}`,
        type: "info"
      }]);

      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 10000);
    };

    const handleOfficialEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { title, body, type } = customEvent.detail;
      const id = Math.random().toString(36).substring(2, 9);
      
      setNotifications(prev => [...prev, { id, title, body, type }]);

      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 7000);
    };

    window.addEventListener("duplicate_merged_toast", handleDuplicateMerge);
    window.addEventListener("new_official_notification", handleOfficialEvent);
    
    return () => {
      window.removeEventListener("duplicate_merged_toast", handleDuplicateMerge);
      window.removeEventListener("new_official_notification", handleOfficialEvent);
    };
  }, []);

  // Reporting Modals State
  const [reportCoords, setReportCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isSampleTest, setIsSampleTest] = useState<boolean>(false);

  // Quick report triggers standard coordinate near center
  const triggerSampleTestWalkthrough = () => {
    setIsSampleTest(true);
    triggerReportModal(30.26715, -97.74306);
  };

  useEffect(() => {
    const handleJoinedEvent = () => {
      setIsUserJoined(true);
    };
    window.addEventListener("civic_user_joined_event", handleJoinedEvent);
    return () => window.removeEventListener("civic_user_joined_event", handleJoinedEvent);
  }, []);

  // Monitor Authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        if (!currentUser.isAnonymous) {
          localStorage.setItem("civic_user_joined", "true");
          setIsUserJoined(true);
        } else {
          setIsUserJoined(localStorage.getItem("civic_user_joined") === "true");
        }
        setAuthLoading(false);
      } else {
        setUser(null);
        setProfile(null);
        setIsUserJoined(false);
        if (!isDemoMode()) {
          try {
            await signInAnonymously(auth);
          } catch (err) {
            console.error("Auto anonymous sign-in failed on load:", err);
            setAuthLoading(false);
          }
        } else {
          setAuthLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Monitor corresponding Profile state
  const handleDatabaseConnectionError = (err: any) => {
    const msg = err?.message || String(err);
    if (msg.includes("NOT_FOUND") || msg.includes("not-found") || msg.includes("database") || msg.includes("5 NOT_FOUND")) {
      if (isUsingCustomDatabase()) {
        console.warn("Custom Firestore Database not found or inactive. Automatically falling back to '(default)' database and reloading...");
        resetToDefaultDatabase();
        setFirestoreError(t("Custom database not found. Switching to '(default)' database..."));
        setTimeout(() => {
          window.location.reload();
        }, 1200);
        return;
      }
    }
    if (msg.includes("NOT_FOUND") || msg.includes("not-found") || msg.includes("permission") || msg.includes("PERMISSION_DENIED")) {
      setFirestoreError(msg);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem("show_judge_demo_toast") === "true") {
        localStorage.removeItem("show_judge_demo_toast");
        setActiveTab("map");
        setShowHero(false);
        setShowJudgeToast(true);
        const timer = setTimeout(() => {
          setShowJudgeToast(false);
        }, 6000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user || !isJoined) {
      setProfile(null);
      return;
    }
    const unsubscribe = subscribeToUserProfile(user.uid, (p) => {
      setProfile(p);
      setFirestoreError(null);
    }, (err) => {
      handleDatabaseConnectionError(err);
    });
    return () => unsubscribe();
  }, [user, authLoading, isJoined]);

  // Synchronize document theme class for citizen vs authority portal
  useEffect(() => {
    const isDark = theme === "dark" || activeTab === "official";
    document.documentElement.classList.toggle("dark", isDark);
  }, [theme, activeTab]);

  // Subscribe to real-time Issues database
  useEffect(() => {
    if (authLoading || !user) return;
    const unsubscribe = subscribeToIssues((loadedIssues) => {
      setIssues(loadedIssues);
      setIssuesLoading(false);
      setFirestoreError(null);
      // Auto-update selected issue if it exists in list
      if (selectedIssue) {
        const updated = loadedIssues.find(i => i.id === selectedIssue.id);
        if (updated) setSelectedIssue(updated);
      }
    }, (err) => {
      setIssuesLoading(false);
      handleDatabaseConnectionError(err);
    });
    return () => unsubscribe();
  }, [selectedIssue, authLoading, user]);

  // Global Keyboard Shortcuts (Task 3g)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut if user is typing in form controls
      const activeEl = document.activeElement;
      if (
        activeEl && 
        (activeEl.tagName === "INPUT" || 
         activeEl.tagName === "TEXTAREA" || 
         activeEl.tagName === "SELECT" ||
         activeEl.getAttribute("contenteditable") === "true")
      ) {
        if (e.key === "Escape") {
          (activeEl as HTMLElement).blur();
        }
        return;
      }

      if (e.key === "?") {
        setShowKeyboardShortcuts(prev => !prev);
      } else if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        triggerQuickReport();
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        const resetBtn = document.querySelector('button[title*="Reset"]') as HTMLButtonElement;
        if (resetBtn) resetBtn.click();
      } else if (e.key === "Escape") {
        setShowKeyboardShortcuts(false);
        setSelectedIssue(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Monitor network status changes and auto-sync offline/IndexedDB queue via useOfflineSync hook
  useOfflineSync(
    (notification) => {
      setNotifications((prev) => [...prev, notification]);
      // Auto-remove notification after 8 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      }, 8000);
    },
    user,
    authLoading
  );

  const handleLogout = async () => {
    setIsUserJoined(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("civic_user_joined");
    }
    await signOut(auth);
  };

  // Helper to open reporting modal with a coordinate
  const triggerReportModal = (lat: number, lng: number) => {
    if (!user || !isJoined) {
      setIsAuthOpen(true);
      return;
    }
    setReportCoords({ lat, lng });
  };

  // Quick report triggers standard coordinate near center
  const triggerQuickReport = () => {
    // Bengaluru coordinates
    triggerReportModal(12.9716 + (Math.random() - 0.5) * 0.015, 77.5946 + (Math.random() - 0.5) * 0.015);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center" id="app-auth-loading-screen">
        <div className="max-w-md w-full flex flex-col items-center gap-6 p-8 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl shadow-md animate-fade-in">
          <div className="p-4 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-2xl shadow-inner animate-pulse shrink-0">
            <Shield className="w-10 h-10 fill-blue-600/10" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-2">{t("Loading SAMRIDDHI PARIVAR...")}</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold tracking-widest uppercase mb-4">{t("Verifying Secure Session")}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {t("Please wait while we establish a secure connection and verify your credentials with Firestore.")}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-blue-500 dark:text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t("AUTHENTICATING...")}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${activeTab !== "official" ? "citizen-theme" : ""} bg-slate-50 dark:bg-slate-950 font-sans text-gray-800 dark:text-slate-100 flex flex-col selection:bg-blue-500/20 selection:text-blue-900 transition-colors duration-300`} id="app-root-container">
      
      {isDemoMode() && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold py-2 px-4 shadow-sm flex items-center justify-between gap-4 animate-fade-in" id="demo-mode-sticky-banner">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-100 animate-pulse shrink-0" />
            <span>{t("🏆 Judge Demo Mode — sample Bengaluru civic data loaded. All features fully functional.")}</span>
          </div>
          <button
            onClick={() => {
              setDemoMode(false);
              window.location.reload();
            }}
            className="px-2.5 py-1 bg-white/15 hover:bg-white/25 active:bg-white/35 text-white text-[10px] uppercase tracking-widest font-extrabold rounded-md transition-all cursor-pointer shadow-xs whitespace-nowrap"
          >
            {t("Connect Live Database →")}
          </button>
        </div>
      )}

      {/* Universal Sticky Header */}
      <header 
        className={`sticky top-0 z-40 border-b backdrop-blur-md shadow-2xs transition-colors duration-350 ${
          activeTab !== "official"
            ? "bg-bg-surface/80 border-border-warm"
            : "bg-white/80 dark:bg-slate-950/80 border-gray-200/50 dark:border-slate-800/50"
        }`}
        style={{
          height: "56px",
          "--nav-text-color": activeTab !== "official" ? "var(--text-primary)" : (theme === "light" ? "#111827" : "#ffffff"),
          "--nav-text-muted": activeTab !== "official" ? "var(--text-secondary)" : (theme === "light" ? "#6b7280" : "#9ca3af"),
        } as React.CSSProperties}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-4">
          
          {/* Logo Brand (Shield + SAMRIDDHI PARIVAR) */}
          <div className="flex items-center gap-2">
            <div className={`p-1.5 ${activeTab !== "official" ? "bg-accent-primary" : "bg-blue-600"} text-white rounded-lg shadow-xs shrink-0 flex items-center justify-center`}>
              <Shield className="w-4 h-4 fill-white" />
            </div>
            <span 
              className="font-bold tracking-tight text-text-primary" 
              style={{ fontSize: "16px" }}
            >
              SAMRIDDHI PARIVAR
            </span>
          </div>

          {/* Navigation Tabs (Adapting beautifully to light/dark mode with CSS variables) */}
          <div className={`hidden md:flex items-center gap-1 ${
            activeTab !== "official" 
              ? "bg-bg-surface-alt/80 border-border-warm" 
              : "bg-slate-100/80 dark:bg-slate-900/60"
          } p-1 rounded-xl border transition-colors`}>
            <button
              onClick={() => setActiveTab("map")}
              className="px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
              style={{
                backgroundColor: activeTab === "map" ? (theme === "light" ? "var(--bg-surface)" : "var(--bg-surface-alt)") : "transparent",
                color: activeTab === "map" ? (activeTab !== "official" ? "var(--accent-primary)" : "var(--nav-text-color)") : "var(--nav-text-muted)",
                boxShadow: activeTab === "map" ? "0 1px 2px 0 rgba(0, 0, 0, 0.05)" : "none",
              }}
            >
              <Map className="w-3.5 h-3.5" />
              {t("Civic Map & Grid")}
            </button>
            <button
              onClick={() => setActiveTab("impact")}
              className="px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
              style={{
                backgroundColor: activeTab === "impact" ? (theme === "light" ? "var(--bg-surface)" : "var(--bg-surface-alt)") : "transparent",
                color: activeTab === "impact" ? (activeTab !== "official" ? "var(--accent-primary)" : "var(--nav-text-color)") : "var(--nav-text-muted)",
                boxShadow: activeTab === "impact" ? "0 1px 2px 0 rgba(0, 0, 0, 0.05)" : "none",
              }}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              {t("Impact Analytics")}
            </button>
            <button
              onClick={() => setActiveTab("official")}
              className="px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
              style={{
                backgroundColor: activeTab === "official" ? (theme === "light" ? "#111827" : "#1e293b") : "transparent",
                color: activeTab === "official" ? "#ffffff" : "var(--nav-text-muted)",
                boxShadow: activeTab === "official" ? "0 1px 2px 0 rgba(0, 0, 0, 0.05)" : "none",
              }}
            >
              <Shield className="w-3.5 h-3.5 text-rose-500 fill-rose-500/10" />
              {t("BBMP Portal")}
            </button>
          </div>

          {/* Quick controls: Language Popover, Dark/Light mode, Profile */}
          <div className="flex items-center gap-2.5">
            
            {/* Language Selector Popover (Globe 32px button) */}
            <div className="relative">
              <button
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300 border border-slate-200/40 dark:border-slate-800/40 rounded-lg transition-all cursor-pointer"
                title="Select Language"
              >
                <Globe className="w-4 h-4" />
              </button>
              {showLangDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowLangDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-lg py-1.5 z-50 animate-scale-up">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code as any);
                          setShowLangDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors ${
                          language === lang.code 
                            ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30" 
                            : "text-gray-700 dark:text-slate-200"
                        }`}
                      >
                        <span className="text-sm">{lang.flag}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Dark & Light Theme Toggle Button (32px) */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-300 border border-slate-200/40 dark:border-slate-800/40 rounded-lg transition-all cursor-pointer"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* User Profile / Authentication controls */}
            <div className="flex items-center gap-3">
              {(user && isJoined) ? (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/40 p-1 pr-2.5 rounded-xl transition-colors">
                  {/* User avatar display */}
                  <div className="w-7 h-7 rounded-lg bg-linear-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                    {user.displayName?.charAt(0).toUpperCase() || "H"}
                  </div>
                  
                  <div className="hidden lg:block text-left">
                    <div className="flex items-center gap-1 leading-none">
                      <span className="text-[11px] font-bold text-gray-800 dark:text-slate-200 leading-none">{user.displayName || "Citizen Hero"}</span>
                      {profile && (
                        <span className="text-[8px] font-mono font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1 rounded">
                          Lvl {Math.floor(profile.points / 200) + 1}
                        </span>
                      )}
                    </div>
                    {profile && (
                      <span className="text-[9px] font-extrabold text-gray-400 dark:text-slate-500 font-mono block mt-0.5 leading-none">{profile.points} XP</span>
                    )}
                  </div>

                  {profile && (
                    <button
                      onClick={() => setShowCertificate(true)}
                      className="p-1 text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/40 border border-amber-200/40 dark:border-amber-900/40 rounded-md transition-all cursor-pointer animate-pulse shrink-0"
                      title="Claim Impact Certificate"
                    >
                      <Award className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button 
                    onClick={handleLogout}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 dark:hover:border-slate-700 rounded-md transition-colors cursor-pointer"
                    title={t("Sign Out")}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className={`h-8 px-3 text-xs font-bold text-white ${
                    activeTab !== "official"
                      ? "bg-accent-primary hover:opacity-90 shadow-accent-primary/10"
                      : "bg-blue-600 hover:bg-blue-700 shadow-blue-100/10"
                  } rounded-lg shadow-md dark:shadow-none hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer shrink-0 flex items-center justify-center`}
                >
                  {t("Sign In / Join")}
                </button>
              )}
            </div>
          </div>

        </div>
      </header>

      {/* Mobile Tab Selector (only visible on small screens) */}
      <div className="sm:hidden grid grid-cols-3 p-1.5 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 transition-colors" id="mobile-navigation-tabs">
        <button
          onClick={() => setActiveTab("map")}
          className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeTab === "map" ? "bg-slate-100 dark:bg-slate-800 text-gray-800 dark:text-white" : "text-gray-500 dark:text-slate-400"
          }`}
        >
          <Map className="w-4 h-4 shrink-0" />
          <span>{t("Map")}</span>
        </button>
        <button
          onClick={() => setActiveTab("impact")}
          className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeTab === "impact" ? "bg-slate-100 dark:bg-slate-800 text-gray-800 dark:text-white" : "text-gray-500 dark:text-slate-400"
          }`}
        >
          <BarChart2 className="w-4 h-4 shrink-0" />
          <span>{t("Impact")}</span>
        </button>
        <button
          onClick={() => setActiveTab("official")}
          className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeTab === "official" ? "bg-slate-900 text-white dark:bg-slate-800 text-white" : "text-gray-500 dark:text-slate-400"
          }`}
        >
          <Shield className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{t("BBMP")}</span>
        </button>
      </div>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">

        {firestoreError && !dismissedError && (
          <div className="mb-6 p-5 bg-amber-50 dark:bg-slate-900 border border-amber-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col md:flex-row items-start gap-4 animate-scale-up" id="firestore-connection-alert">
            <div className="p-3 bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                {t("Firestore Connection Warning")}
                <span className="text-[10px] font-mono bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{t("NOT_FOUND / PERMISSION_DENIED")}</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                {t("The application is unable to reach or subscribe to your Cloud Firestore database. This usually means that either:")}
              </p>
              <ul className="text-xs text-slate-650 dark:text-slate-400 list-disc pl-5 space-y-1 font-medium">
                <li>
                  {t("The Firestore Database has not been fully created yet in your Firebase Console, or")}
                </li>
                <li>
                  {t("The database takes 1 to 5 minutes to fully propagate after initial creation, or")}
                </li>
                <li>
                  {t("You initialized a custom Database ID instead of using the '(default)' database.")}
                </li>
              </ul>
              <div className="pt-2 flex flex-wrap gap-2.5">
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Activity className="w-3.5 h-3.5" />
                  {t("Open Diagnostic Troubleshooter")}
                </button>
                <a
                  href="https://console.firebase.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-200 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all"
                >
                  {t("Go to Firebase Console")}
                </a>
                <button
                  onClick={() => setDismissedError(true)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold rounded-lg text-xs transition-all cursor-pointer"
                >
                  {t("Dismiss Notice")}
                </button>
              </div>
            </div>
          </div>
        )}
        
        <AnimatePresence mode="wait">
          {activeTab === "map" ? (
            <motion.div
              key="map-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              id="workspace-map-tab"
            >
              
              {/* Left Column: List Feed & Filters */}
              <div className="lg:col-span-1 flex flex-col gap-4 order-2 lg:order-1">
                
                {dailyDigest && (
                  <div className="p-4 bg-blue-50 dark:bg-slate-900/40 border border-blue-200 dark:border-blue-900/40 rounded-2xl relative overflow-hidden flex items-start gap-3 shadow-md animate-fade-in" id="daily-digest-banner">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none"></div>
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl shrink-0 border border-blue-200 dark:border-blue-800/40">
                      <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-pulse" />
                    </div>
                    <div className="space-y-0.5 relative z-10">
                      <span className="text-[9px] font-mono font-black text-blue-600 dark:text-amber-400 uppercase tracking-widest block">Gemini Daily Briefing</span>
                      <p className="text-xs text-blue-900 dark:text-slate-200 leading-relaxed font-semibold">
                        {dailyDigest}
                      </p>
                    </div>
                  </div>
                )}

                {/* Live Banner to report new issue */}
                <div className="p-5 bg-amber-50 dark:bg-slate-900 text-gray-900 dark:text-white rounded-2xl shadow-xl border border-amber-200 dark:border-slate-800/80 relative overflow-hidden flex flex-col gap-3">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none"></div>
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-1.5 text-amber-700 dark:text-blue-400">
                      <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      {t("Notice a civic issue?")}
                    </h3>
                    <p className="text-xs text-amber-900 dark:text-slate-300 mt-1.5 font-medium leading-relaxed">
                      {t("Click directly on the interactive grid map on the right to pinpoint a precise location, or file an instant report.")}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2" id="report-actions-grid">
                    <button
                      onClick={triggerQuickReport}
                      className="py-2.5 bg-accent-primary hover:opacity-95 text-white font-bold rounded-xl transition-all text-xs shadow-lg shadow-accent-primary/20 flex items-center justify-center gap-1.5 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t("File Report")}
                    </button>
                    <button
                      onClick={triggerSampleTestWalkthrough}
                      className="py-2.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 font-bold rounded-xl transition-all text-xs border border-slate-200 dark:border-slate-700 border-l-[2px] border-l-[#1baf7a] flex flex-col items-center justify-center text-center cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <span className="flex items-center gap-1">
                        <Play className="w-3 h-3 text-blue-600 dark:text-blue-400 animate-pulse" fill="currentColor" />
                        {t("▶ Watch AI in Action")}
                      </span>
                      <span className="text-[9px] font-normal text-slate-500 dark:text-slate-400 mt-0.5 leading-none">
                        {t("Gemini AI demos issue analysis automatically")}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Subscribed active issues feed */}
                <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs flex-1 flex flex-col min-h-[380px] transition-colors duration-300" id="active-reports-feed-container">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">{t("Active Civic Reports")}</h4>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black px-2 py-0.5 rounded-full">
                      {isJoined ? issues.length : 0} {t("Active Reports")}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-h-0">
                    <IssueList 
                      issues={isJoined ? issues : []}
                      isJoined={isJoined}
                      selectedIssueId={selectedIssue?.id}
                      onSelectIssue={setSelectedIssue}
                      onOpenAuth={() => setIsAuthOpen(true)}
                      isLoading={issuesLoading}
                    />
                  </div>
                </div>

              </div>

              {/* Middle/Right Columns: Map overlay and user dashboard info */}
              <div className="lg:col-span-2 flex flex-col gap-6 order-1 lg:order-2">
                
                {/* Beautiful Interactive Map component */}
                <div className="flex-1 min-h-[480px]">
                  <React.Suspense fallback={
                    <div className="w-full h-full min-h-[480px] bg-slate-100 dark:bg-slate-800 animate-pulse flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700/50">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
                        <p className="text-xs text-slate-500 font-medium tracking-wide">Loading interactive map...</p>
                      </div>
                    </div>
                  }>
                    <MapContainer 
                      issues={isJoined ? issues : []}
                      selectedIssueId={selectedIssue?.id}
                      onSelectIssue={setSelectedIssue}
                      onMapClickReport={triggerReportModal}
                    />
                  </React.Suspense>
                </div>

                {/* Profile Milestones and Gamification Drawer */}
                <div>
                  <GamificationPanel 
                    profile={profile}
                    onOpenAuth={() => setIsAuthOpen(true)}
                  />
                </div>

              </div>

            </motion.div>
          ) : activeTab === "impact" ? (
            <motion.div
              key="impact-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              id="workspace-impact-tab"
            >
              <React.Suspense fallback={
                <div className="w-full h-96 bg-slate-50 dark:bg-slate-900/50 animate-pulse flex items-center justify-center rounded-2xl border border-slate-200/50 dark:border-slate-800/40">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400 dark:text-slate-500" />
                    <p className="text-xs text-slate-500 font-medium tracking-wide">Loading impact dashboard analytics...</p>
                  </div>
                </div>
              }>
                <Dashboard 
                  issues={isJoined ? issues : []} 
                  isLoading={issuesLoading} 
                  isJoined={isJoined} 
                />
              </React.Suspense>
            </motion.div>
          ) : (
            <motion.div
              key="official-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              id="workspace-official-tab"
            >
              <OfficialDashboard 
                issues={isJoined ? issues : []}
                onSelectIssueOnMap={(issue) => {
                  setSelectedIssue(issue);
                }}
                language={language}
                isJoined={isJoined}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      <Footer 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onOpenAuth={() => setIsAuthOpen(true)} 
        onReportClick={triggerQuickReport} 
        user={user} 
      />

      {/* Modals & Dialogs overlays */}
      <AnimatePresence>
        {isAuthOpen && (
          <AuthModal 
            isOpen={isAuthOpen} 
            onClose={() => setIsAuthOpen(false)} 
          />
        )}
        
        {reportCoords && (
          <ReportIssueModal 
            isOpen={!!reportCoords}
            onClose={() => {
              setReportCoords(null);
              setIsSampleTest(false);
            }}
            lat={reportCoords.lat}
            lng={reportCoords.lng}
            isSampleTestMode={isSampleTest}
          />
        )}
      </AnimatePresence>

      {/* Cinematic First-Load Hero Overlay Screen */}
      {showHero && (
        <HeroLanding 
          onDismiss={() => setShowHero(false)} 
          onReportIssue={() => {
            setShowHero(false);
            if (!isJoined) {
              setIsAuthOpen(true);
            } else {
              triggerQuickReport();
            }
          }}
          totalIssuesCount={issues.length}
          onStartJudgeDemo={() => {
            if (typeof window !== "undefined") {
              localStorage.setItem("show_judge_demo_toast", "true");
              localStorage.setItem("civic_user_joined", "true");
              setDemoMode(true);
              window.location.reload();
            }
          }}
        />
      )}

      {/* Badge Unlock Celebration Modal */}
      {unlockedBadge && (
        <BadgeCelebration 
          badgeName={unlockedBadge} 
          onClose={() => setUnlockedBadge(null)} 
        />
      )}

      {/* Impact Certificate Canvas Overlay Modal */}
      {showCertificate && profile && (
        <ImpactCertificate 
          profile={profile} 
          onClose={() => setShowCertificate(false)} 
        />
      )}

      {/* Level Up Subtle Screen Flash & Splash Indicator */}
      {showLevelUpFlash && (
        <div className="fixed inset-0 bg-blue-500/10 backdrop-blur-[1px] pointer-events-none z-50 flex flex-col items-center justify-center animate-pulse">
          <div className="bg-blue-600/95 text-white text-lg font-black tracking-widest px-8 py-4 rounded-2xl shadow-2xl border border-blue-400/50 flex flex-col items-center gap-1 animate-scale-up">
            <span className="text-xl">⚡ LEVEL UP ⚡</span>
            <span className="text-[10px] text-blue-200 uppercase tracking-widest font-bold">New Milestones Await</span>
          </div>
        </div>
      )}

      {/* XP Floating Toast Animation Center */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {xpToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 25, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -25, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="bg-emerald-500 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-lg border border-emerald-400 flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
              <span>+{toast.amount} XP</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Real-time empathetic notification panel */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-3 pointer-events-auto max-w-sm w-full">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: -50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, scale: 0.9 }}
              className={`p-4 rounded-2xl shadow-xl border flex flex-col gap-1 backdrop-blur-md ${
                notif.type === "success" 
                  ? "bg-emerald-950/95 border-emerald-800 text-emerald-100" 
                  : notif.type === "error"
                  ? "bg-rose-950/95 border-rose-800 text-rose-100"
                  : "bg-slate-900/95 border-slate-800 text-slate-100"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                  {notif.title}
                </span>
                <button 
                  onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                  className="text-slate-400 hover:text-white text-[10px] uppercase font-black cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300 font-medium">{notif.body}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Top-center one-time Judge Demo Toast */}
      <AnimatePresence>
        {showJudgeToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -50, x: "-50%" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed top-6 left-1/2 z-[9999] px-5 py-3.5 bg-slate-950 dark:bg-slate-900 border border-teal-500/30 text-slate-100 rounded-2xl shadow-2xl flex items-center gap-3 max-w-md w-[90%] sm:w-auto"
            id="judge-demo-toast"
          >
            <div className="p-1 bg-teal-500/20 text-teal-400 rounded-full shrink-0">
              <Check className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold leading-normal text-slate-200">
                {t("Judge Demo loaded ✓ — Try the map, file a report, or watch the AI demo from the sidebar.")}
              </p>
            </div>
            <button 
              onClick={() => setShowJudgeToast(false)}
              className="p-1 text-slate-500 hover:text-slate-300 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Feature Tour Button & Panel */}
      {!showHero && (
        <div className="fixed bottom-6 right-6 z-[9999]">
          <AnimatePresence>
            {showTourPanel && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-14 right-0 w-[280px] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-[16px] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.2)] flex flex-col gap-3"
                id="feature-tour-panel"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                  <span className="font-bold text-sm text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                    ✨ {t("Feature Tour")}
                  </span>
                  <button 
                    onClick={() => setShowTourPanel(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 rounded-full hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Rows */}
                <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto">
                  {/* Row 1 */}
                  <div 
                    onClick={() => {
                      setActiveTab("map");
                      setShowTourPanel(false);
                    }}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <span className="text-[18px] shrink-0">🗺️</span>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-gray-850 dark:text-slate-200 leading-tight">{t("Bengaluru Civic Map")}</span>
                      <span className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 leading-tight">{t("Click any area to report an issue")}</span>
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div 
                    onClick={() => {
                      setActiveTab("map");
                      triggerSampleTestWalkthrough();
                      setShowTourPanel(false);
                    }}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <span className="text-[18px] shrink-0">🤖</span>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-gray-850 dark:text-slate-200 leading-tight">{t("Gemini AI Analysis")}</span>
                      <span className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 leading-tight">{t("Upload a photo — AI categorizes it live")}</span>
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div 
                    onClick={() => {
                      setActiveTab("map");
                      setShowTourPanel(false);
                      setTimeout(() => {
                        const el = document.getElementById("active-reports-feed-container");
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }, 150);
                    }}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <span className="text-[18px] shrink-0">✅</span>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-gray-850 dark:text-slate-200 leading-tight">{t("Community Verification")}</span>
                      <span className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 leading-tight">{t("Verify issues reported by neighbors")}</span>
                    </div>
                  </div>

                  {/* Row 4 */}
                  <div 
                    onClick={() => {
                      setActiveTab("impact");
                      setShowTourPanel(false);
                    }}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <span className="text-[18px] shrink-0">📊</span>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-gray-850 dark:text-slate-200 leading-tight">{t("Impact Analytics")}</span>
                      <span className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 leading-tight">{t("Real-time civic metrics & leaderboard")}</span>
                    </div>
                  </div>

                  {/* Row 5 */}
                  <div 
                    onClick={() => {
                      setActiveTab("impact");
                      setShowTourPanel(false);
                      setTimeout(() => {
                        const el = document.getElementById("leaderboard-list");
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }, 150);
                    }}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <span className="text-[18px] shrink-0">🏆</span>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-gray-850 dark:text-slate-200 leading-tight">{t("Earn XP & Badges")}</span>
                      <span className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 leading-tight">{t("Gamified civic participation system")}</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center pt-2 border-t border-gray-100 dark:border-slate-800 font-medium">
                  {t("Samprati Pariwar — Built for Bengaluru 🇮🇳")}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toggle Button */}
          <button
            onClick={() => setShowTourPanel(!showTourPanel)}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-[#1baf7a] hover:bg-[#159a6a] text-white shadow-[0_4px_16px_rgba(27,175,122,0.35)] transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
            id="feature-tour-floating-btn"
          >
            <HelpCircle className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      {/* Keyboard Shortcuts Overlay Modal (Task 3g) */}
      {showKeyboardShortcuts && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-md z-[10000] flex items-center justify-center p-4 animate-fade-in" id="keyboard-shortcuts-overlay">
          <div className="bg-white dark:bg-[#20272f] border border-gray-200 dark:border-white/5 rounded-3xl p-6 shadow-2xl max-w-sm w-full animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/5">
              <span className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                ⌨ {t("Keyboard Shortcuts")}
              </span>
              <button 
                onClick={() => setShowKeyboardShortcuts(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 rounded-full hover:bg-gray-50 dark:hover:bg-[#1a2129] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex flex-col gap-3.5 py-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-600 dark:text-slate-300">{t("Focus Search Input")}</span>
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-[#1a2129] border border-gray-250 dark:border-white/10 rounded-lg text-[10px] font-mono font-black text-gray-800 dark:text-[#e8eaed] shadow-xs">/</kbd>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-600 dark:text-slate-300">{t("New Civic Report")}</span>
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-[#1a2129] border border-gray-250 dark:border-white/10 rounded-lg text-[10px] font-mono font-black text-gray-800 dark:text-[#e8eaed] shadow-xs">N</kbd>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-600 dark:text-slate-300">{t("Recenter City Map")}</span>
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-[#1a2129] border border-gray-250 dark:border-white/10 rounded-lg text-[10px] font-mono font-black text-gray-800 dark:text-[#e8eaed] shadow-xs">R</kbd>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-600 dark:text-slate-300">{t("Toggle Shortcuts Legend")}</span>
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-[#1a2129] border border-gray-250 dark:border-white/10 rounded-lg text-[10px] font-mono font-black text-gray-800 dark:text-[#e8eaed] shadow-xs">?</kbd>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-600 dark:text-slate-300">{t("Dismiss / Close Modals")}</span>
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-[#1a2129] border border-gray-250 dark:border-white/10 rounded-lg text-[10px] font-mono font-black text-gray-800 dark:text-[#e8eaed] shadow-xs">Esc</kbd>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-white/5 text-center">
              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">{t("Press any key to test live!")}</span>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts trigger hint footer widget */}
      <div className="fixed bottom-6 left-6 z-40 hidden md:block">
        <button
          onClick={() => setShowKeyboardShortcuts(true)}
          className="px-3 py-1.5 bg-white/95 dark:bg-[#20272f]/95 backdrop-blur-md text-[10.5px] font-bold text-gray-500 dark:text-[#9aa3ad] hover:text-gray-800 dark:hover:text-white rounded-xl border border-gray-200 dark:border-white/5 shadow-md flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95"
          title="Show Keyboard Shortcuts Info Guide"
        >
          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-[#1a2129] border border-gray-250 dark:border-white/10 rounded-md text-[9px] font-mono font-black shadow-2xs">?</kbd>
          <span>Shortcuts Guide</span>
        </button>
      </div>

    </div>
  );
}
