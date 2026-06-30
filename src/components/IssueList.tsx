import React, { useState, useRef, useEffect } from "react";
import { CivicIssue } from "../types";
import { verifyIssue, updateIssueStatus } from "../lib/firebase";
import { auth } from "../lib/firebase";
import { useApp } from "../lib/AppContext";
import { 
  CheckCircle, 
  MapPin, 
  User, 
  Calendar, 
  AlertTriangle, 
  ChevronRight, 
  Activity, 
  Sparkles, 
  MessageSquare, 
  CornerDownRight, 
  ShieldCheck, 
  CheckCheck, 
  Eye, 
  AudioLines,
  Image as ImageIcon,
  Languages,
  Volume2,
  VolumeX,
  Loader2,
  Search,
  X
} from "lucide-react";
import BeforeAfterSlider from "./BeforeAfterSlider";

const BEFORE_AFTER_PHOTOS: Record<string, { before: string; after: string }> = {
  "Pothole": {
    before: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
    after: "https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&w=600&q=80"
  },
  "Water Leak": {
    before: "https://images.unsplash.com/photo-1542013936693-8848e5740a7a?auto=format&fit=crop&w=600&q=80",
    after: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80"
  },
  "Broken Streetlight": {
    before: "https://images.unsplash.com/photo-1509023464722-18d996393ca8?auto=format&fit=crop&w=600&q=80",
    after: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=600&q=80"
  },
  "Trash & Dumping": {
    before: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80",
    after: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80"
  },
  "Graffiti": {
    before: "https://images.unsplash.com/photo-1525909002-1b057f39dd81?auto=format&fit=crop&w=600&q=80",
    after: "https://images.unsplash.com/photo-1560185127-6a2806647f81?auto=format&fit=crop&w=600&q=80"
  },
  "Other": {
    before: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=600&q=80",
    after: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=600&q=80"
  }
};

interface IssueListProps {
  issues: CivicIssue[];
  onSelectIssue: (issue: CivicIssue) => void;
  selectedIssueId?: string;
  onOpenAuth: () => void;
  isLoading?: boolean;
  isJoined?: boolean;
}

export default function IssueList({ 
  issues, 
  onSelectIssue, 
  selectedIssueId,
  onOpenAuth,
  isLoading = false,
  isJoined = true
}: IssueListProps) {
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const selectedRef = useRef<HTMLDivElement | null>(null);

  const renderTimelineStepper = (issue: CivicIssue, isExpanded: boolean) => {
    const steps: { label: string; key: CivicIssue["status"] }[] = [
      { label: "Reported", key: "Reported" },
      { label: "Verified", key: "Verified" },
      { label: "In Progress", key: "In Progress" },
      { label: "Resolved", key: "Resolved" }
    ];

    const getStatusIndex = (status: CivicIssue["status"]) => {
      if (status === "Reported") return 0;
      if (status === "Verified") return 1;
      if (status === "In Progress" || status === "Assigned") return 2;
      if (status === "Resolved") return 3;
      return 0;
    };

    const currentIndex = getStatusIndex(issue.status);

    const getSimulatedTime = (key: string, idx: number) => {
      const baseTime = issue.reportedAt || (Date.now() - 36 * 3600 * 1000);
      if (idx > currentIndex) return "";
      let offset = 0;
      if (key === "Verified") offset = 1.2 * 3600 * 1000;
      else if (key === "In Progress") offset = 4.5 * 3600 * 1000;
      else if (key === "Resolved") offset = 14.8 * 3600 * 1000;
      return new Date(baseTime + offset).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    if (!isExpanded) {
      return (
        <div className="flex items-center gap-1.5 mt-1" id={`compact-stepper-${issue.id}`}>
          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase">Timeline:</span>
          <div className="flex items-center gap-1">
            {steps.map((step, idx) => (
              <div 
                key={step.key}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx <= currentIndex 
                    ? idx === 3 
                      ? "w-5 bg-emerald-500" 
                      : "w-5 bg-blue-500" 
                    : "w-1.5 bg-gray-200 dark:bg-slate-850"
                }`}
                title={step.label}
              />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="w-full py-3 bg-slate-50 dark:bg-slate-950/45 rounded-2xl px-3 border border-slate-100 dark:border-slate-800/85 mt-1 flex flex-col gap-2" id={`timeline-stepper-${issue.id}`}>
        <div className="flex items-center justify-between relative px-2">
          {/* Connector line */}
          <div className="absolute left-[8%] right-[8%] top-[11px] h-[2px] bg-slate-200 dark:bg-slate-805 pointer-events-none">
            <div 
              className="h-full bg-blue-500 transition-all duration-500" 
              style={{ width: `${(currentIndex / 3) * 100}%` }}
            />
          </div>

          {steps.map((step, idx) => {
            const isCompleted = idx <= currentIndex;
            const isActive = idx === currentIndex;
            const timeStr = getSimulatedTime(step.key, idx);

            return (
              <div key={step.key} className="flex flex-col items-center flex-1 relative z-10 text-center">
                <div 
                  className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                    isActive 
                      ? "bg-blue-600 text-white ring-4 ring-blue-500/20 shadow-sm" 
                      : isCompleted 
                        ? "bg-blue-100 dark:bg-blue-950/40 text-blue-600 border border-blue-200 dark:border-blue-900" 
                        : "bg-slate-100 dark:bg-slate-850 text-slate-400 border border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {isCompleted && !isActive ? "✓" : idx + 1}
                </div>

                <span className={`text-[9px] font-bold mt-1.5 leading-none ${isActive ? "text-blue-600 dark:text-blue-400" : isCompleted ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}`}>
                  {step.label}
                </span>

                {timeStr && (
                  <span className="text-[8px] font-mono font-bold text-slate-450 dark:text-slate-500 mt-1 whitespace-nowrap block">
                    {timeStr}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Auto-scroll selected card into view
  useEffect(() => {
    if (selectedIssueId && selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }
  }, [selectedIssueId]);

  // AI & Translation States
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [translatedContent, setTranslatedContent] = useState<Record<string, { title: string; description: string }>>({});
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);

  const { t, translateDynamicText, getSpeechAudio, language } = useApp();
  const currentUser = auth.currentUser;

  // Dynamic Translation handler
  const handleTranslate = async (issue: CivicIssue) => {
    if (translatedContent[issue.id]) {
      // Toggle back to original translation
      const updated = { ...translatedContent };
      delete updated[issue.id];
      setTranslatedContent(updated);
      return;
    }

    setTranslatingId(issue.id);
    try {
      const [translatedTitle, translatedDesc] = await Promise.all([
        translateDynamicText(issue.title, language),
        translateDynamicText(issue.description, language)
      ]);
      setTranslatedContent(prev => ({
        ...prev,
        [issue.id]: {
          title: translatedTitle || issue.title,
          description: translatedDesc || issue.description
        }
      }));
    } catch (err) {
      console.error("Translation error:", err);
    } finally {
      setTranslatingId(null);
    }
  };

  // Text-To-Speech with local fallback
  const handleSpeak = async (issue: CivicIssue, textTitle: string, textDesc: string) => {
    if (speakingId === issue.id) {
      if (activeAudio) {
        activeAudio.pause();
        setActiveAudio(null);
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setSpeakingId(null);
      return;
    }

    // Stop any current audio or speech
    if (activeAudio) {
      activeAudio.pause();
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setSpeakingId(issue.id);
    const speechText = `${textTitle}. Category: ${t(issue.category)}. Description: ${textDesc}`;

    try {
      const base64Audio = await getSpeechAudio(speechText, language);
      if (base64Audio) {
        const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          setSpeakingId(null);
          setActiveAudio(null);
        };
        audio.onerror = () => {
          fallbackSpeech(speechText);
        };
        setActiveAudio(audio);
        audio.play();
        return;
      }
    } catch (err) {
      console.warn("Gemini TTS endpoint failed, falling back to client native SpeechSynthesis", err);
    }

    fallbackSpeech(speechText);
  };

  const fallbackSpeech = (text: string) => {
    if (!window.speechSynthesis) {
      setSpeakingId(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const locales: Record<string, string> = {
      en: "en-US",
      es: "es-ES",
      vi: "vi-VN",
      hi: "hi-IN",
      zh: "zh-CN",
      fr: "fr-FR",
      kn: "kn-IN",
      ta: "ta-IN",
      te: "te-IN",
      mr: "mr-IN",
      ja: "ja-JP"
    };
    utterance.lang = locales[language] || "en-US";
    utterance.onend = () => {
      setSpeakingId(null);
    };
    utterance.onerror = () => {
      setSpeakingId(null);
    };
    window.speechSynthesis.speak(utterance);
  };

  // Filter logic
  const filteredIssues = issues.filter(issue => {
    if (!issue) return false;
    const matchesCategory = filterCategory === "All" || issue.category === filterCategory;
    const matchesStatus = filterStatus === "All" || issue.status === filterStatus;
    const matchesSearch = searchQuery.trim() === "" ||
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.locationName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.category || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesStatus && matchesSearch;
  });

  const handleVerify = async (e: React.MouseEvent, issue: CivicIssue) => {
    e.stopPropagation();
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    if (issue.reportedBy === currentUser.uid) {
      alert("You cannot verify your own reported issues!");
      return;
    }

    if (issue.verifiedBy.includes(currentUser.uid)) {
      alert("You have already verified this issue!");
      return;
    }

    setVerifyingId(issue.id);
    try {
      await verifyIssue(issue.id, currentUser.uid);
    } catch (err: any) {
      alert(err.message || "Failed to verify issue.");
    } finally {
      setVerifyingId(null);
    }
  };

  // Helper to trigger status progressions for testing the full lifecycle
  const handleToggleStatus = async (e: React.MouseEvent, issue: CivicIssue) => {
    e.stopPropagation();
    
    // In our prototype, we allow the reporter or anyone to progress status for demonstration
    let nextStatus: CivicIssue["status"] = "Reported";
    if (issue.status === "Reported") nextStatus = "Verified";
    else if (issue.status === "Verified") nextStatus = "In Progress";
    else if (issue.status === "In Progress") nextStatus = "Resolved";
    else return; // already resolved

    try {
      await updateIssueStatus(issue.id, nextStatus);
    } catch (err: any) {
      console.error(err);
    }
  };

  const getUrgencyBadgeStyle = (urgency: CivicIssue["urgency"]) => {
    switch (urgency) {
      case "Low": return "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700";
      case "Medium": return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/40";
      case "High": return "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border-orange-100 dark:border-orange-900/40";
      case "Critical": return "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-150 dark:border-rose-900 animate-pulse";
    }
  };

  const getStatusBadgeStyle = (status: CivicIssue["status"]) => {
    switch (status) {
      case "Reported": return "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40";
      case "Verified": return "bg-amber-50 dark:bg-amber-950/40 text-amber-750 dark:text-amber-400 border-amber-200 dark:border-amber-900/40";
      case "In Progress": return "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-900/40";
      case "Resolved": return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40";
    }
  };

  return (
    <div className="flex flex-col h-full gap-4" id="issue-list-component">
      
      {/* Filtering Header */}
      <div className="space-y-2" id="filter-controls-group">
        {/* Keyword Search Input */}
        <div className="relative" id="search-input-wrapper">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("Search by keyword, street, or category...")}
            className="w-full pl-10 pr-9 py-2.5 text-xs font-semibold text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-gray-150 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns row */}
        <div className="flex flex-col sm:flex-row gap-2" id="filter-controls-row">
          
          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="flex-1 p-2.5 text-xs font-bold text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-150 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all duration-200"
          >
            <option value="All">{t("Category")}: All Categories</option>
            <option value="Pothole">{t("Pothole")}</option>
            <option value="Water Leak">{t("Water Leak")}</option>
            <option value="Broken Streetlight">{t("Broken Streetlight")}</option>
            <option value="Trash & Dumping">{t("Trash & Dumping")}</option>
            <option value="Graffiti">{t("Graffiti")}</option>
            <option value="Other">{t("Other")}</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 p-2.5 text-xs font-bold text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-150 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer transition-all duration-200"
          >
            <option value="All">All Statuses</option>
            <option value="Reported">{t("Reported")}</option>
            <option value="Verified">{t("Verified")}</option>
            <option value="In Progress">{t("In Progress")}</option>
            <option value="Resolved">{t("Resolved")}</option>
          </select>

        </div>
      </div>

      {/* Scrollable List Content */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[550px]" id="scrollable-issues-feed">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div key={`skeleton-${idx}`} className="p-5 sm:p-6 bg-white dark:bg-[#1a2129] rounded-2xl border border-gray-200 dark:border-white/5 flex flex-col gap-3 animate-pulse">
              <div className="flex items-start justify-between gap-2">
                <div className="flex gap-2">
                  <div className="w-16 h-4 bg-gray-200 dark:bg-slate-800 rounded-md animate-skeleton" />
                  <div className="w-12 h-4 bg-gray-200 dark:bg-slate-800 rounded-full animate-skeleton" />
                </div>
                <div className="w-10 h-4 bg-gray-200 dark:bg-slate-800 rounded-full animate-skeleton" />
              </div>
              <div className="w-3/4 h-5 bg-gray-200 dark:bg-slate-800 rounded-md animate-skeleton mt-1" />
              <div className="space-y-2 mt-1">
                <div className="w-full h-3.5 bg-gray-200 dark:bg-slate-800 rounded-md animate-skeleton" />
                <div className="w-5/6 h-3.5 bg-gray-200 dark:bg-slate-800 rounded-md animate-skeleton" />
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 dark:border-white/5">
                <div className="w-24 h-4 bg-gray-200 dark:bg-slate-800 rounded-md animate-skeleton" />
                <div className="w-16 h-6 bg-gray-200 dark:bg-slate-800 rounded-lg animate-skeleton" />
              </div>
            </div>
          ))
        ) : !isJoined ? (
          <div className="p-8 text-center bg-white dark:bg-[#1a2129] border border-gray-200 dark:border-white/5 rounded-2xl flex flex-col items-center justify-center gap-4 animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" className="text-slate-300 dark:text-[#6b7480] mx-auto">
              <rect x="14" y="8" width="36" height="48" rx="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
              <path d="M22 20h20M22 28h12M22 36h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="44" cy="44" r="10" fill="none" stroke="#3b82f6" strokeWidth="2.5" />
              <line x1="51" y1="51" x2="58" y2="58" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div>
              <h5 className="text-xs font-extrabold text-gray-700 dark:text-slate-200">{t("Sign In Required")}</h5>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 max-w-[240px] mx-auto leading-relaxed">{t("Please sign in or join to view active civic reports on the map.")}</p>
            </div>
            <button
              onClick={onOpenAuth}
              className="mt-1 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>{t("Sign In / Join")}</span>
            </button>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-[#1a2129] border border-gray-200 dark:border-white/5 rounded-2xl flex flex-col items-center justify-center gap-4 animate-fade-in">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" className="text-slate-300 dark:text-[#6b7480] mx-auto">
              <rect x="14" y="8" width="36" height="48" rx="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
              <path d="M22 20h20M22 28h12M22 36h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="44" cy="44" r="10" fill="none" stroke="#3b82f6" strokeWidth="2.5" />
              <line x1="51" y1="51" x2="58" y2="58" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div>
              <h5 className="text-xs font-extrabold text-gray-700 dark:text-slate-200">{t("No issues matching filters")}</h5>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 max-w-[240px] mx-auto leading-relaxed">{t("Try changing your filters or report a new issue directly on the map.")}</p>
            </div>
            {(filterCategory !== "All" || filterStatus !== "All" || searchQuery !== "") && (
              <button
                onClick={() => {
                  setFilterCategory("All");
                  setFilterStatus("All");
                  setSearchQuery("");
                }}
                className="mt-1 px-3 py-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 rounded-lg border border-blue-100 dark:border-blue-900/60 cursor-pointer transition-colors"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const isSelected = selectedIssueId === issue.id;
            const hasVerified = currentUser && issue.verifiedBy.includes(currentUser.uid);
            const isOwnReport = currentUser && issue.reportedBy === currentUser.uid;

            // Resolve possibly translated titles/descriptions
            const displayTitle = translatedContent[issue.id]?.title || issue.title;
            const displayDescription = translatedContent[issue.id]?.description || issue.description;

            return (
              <div
                key={issue.id}
                ref={isSelected ? selectedRef : null}
                onClick={() => onSelectIssue(issue)}
                className={`p-5 sm:p-6 bg-white dark:bg-gray-900 rounded-2xl border transition-all duration-250 flex flex-col gap-3 cursor-pointer group ${
                  isSelected 
                    ? "border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/10 dark:ring-blue-500/20 shadow-md" 
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-xs"
                }`}
              >
                {/* Header row: category, status, urgency */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-widest font-mono">
                      {t(issue.category)}
                    </span>
                    <span className={`px-2 py-0.5 text-[9px] font-bold border rounded-full ${getStatusBadgeStyle(issue.status)}`}>
                      {t(issue.status)}
                    </span>
                    {(issue as any).isOfflinePending && (
                      <span className="px-1.5 py-0.5 text-[8.5px] font-black bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/25 dark:border-amber-400/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center gap-1 font-mono animate-pulse">
                        <span className="w-1 h-1 bg-amber-500 rounded-full animate-ping shrink-0" />
                        {t("OFFLINE PENDING")}
                      </span>
                    )}
                  </div>

                  <span className={`px-2 py-0.5 text-[9px] font-bold border rounded-md ${getUrgencyBadgeStyle(issue.urgency)}`}>
                    {t(issue.urgency)}
                  </span>
                </div>

                {/* Title and Description */}
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {displayTitle}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-[1.6]">
                    {displayDescription}
                  </p>
                </div>

                {/* Progress timeline stepper */}
                {renderTimelineStepper(issue, isSelected)}

                {/* Before / After Photo Comparison on Resolution */}
                {isSelected && issue.status === "Resolved" && (
                  <div className="mt-1 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-mono flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                      Before & After Resolution Comparison
                    </span>
                    <BeforeAfterSlider 
                      beforeUrl={issue.imageUrl || BEFORE_AFTER_PHOTOS[issue.category]?.before || BEFORE_AFTER_PHOTOS["Other"].before}
                      afterUrl={BEFORE_AFTER_PHOTOS[issue.category]?.after || BEFORE_AFTER_PHOTOS["Other"].after}
                    />
                  </div>
                )}

                {/* Dynamic Speech & Translation Micro-Utilities */}
                {isSelected && (
                  <div className="flex flex-wrap gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    {/* Read Aloud Button */}
                    <button
                      type="button"
                      onClick={() => handleSpeak(issue, displayTitle, displayDescription)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        speakingId === issue.id
                          ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900 animate-pulse"
                          : "bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {speakingId === issue.id ? (
                        <>
                          <VolumeX className="w-3 h-3 text-purple-600" />
                          <span>Stop Reading</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>{t("Speak")}</span>
                        </>
                      )}
                    </button>

                    {/* Translate Details Button */}
                    <button
                      type="button"
                      disabled={translatingId === issue.id}
                      onClick={() => handleTranslate(issue)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        translatedContent[issue.id]
                          ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900"
                          : "bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {translatingId === issue.id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                          <span>Translating...</span>
                        </>
                      ) : (
                        <>
                          <Languages className="w-3.5 h-3.5 text-slate-500" />
                          <span>{translatedContent[issue.id] ? "Show Original" : t("Translate Issue Details")}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Attached Multimodal Badges (Voice / Photo) */}
                {(issue.imageUrl || issue.voiceUrl) && (
                  <div className="flex items-center gap-2" id="multimodal-attachments-feed">
                    {issue.imageUrl && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900 rounded">
                        <ImageIcon className="w-2.5 h-2.5" />
                        {t("Photo Attachment")}
                      </span>
                    )}
                    {issue.voiceUrl && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900 rounded">
                        <AudioLines className="w-2.5 h-2.5" />
                        {t("Voice note attached")}
                      </span>
                    )}
                  </div>
                )}

                {/* Bottom metadata */}
                <div className="pt-3 border-t border-gray-50 dark:border-slate-800/60 flex items-center justify-between gap-2 text-[10px] text-gray-450 dark:text-slate-450 font-semibold">
                  <div className="flex items-center gap-1 truncate max-w-[140px]">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{issue.locationName}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate max-w-[80px]">{issue.reportedByName}</span>
                  </div>
                </div>

                {/* Expanded actions footer (visible only when selected) */}
                {isSelected && (
                  <div className="mt-2 pt-3 border-t border-gray-100 dark:border-slate-800 flex flex-wrap gap-2 items-center justify-between animate-fade-in" onClick={(e) => e.stopPropagation()}>
                    
                    {/* Verifications Counter */}
                    <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                      {t("Verifications")}: {issue.verificationsCount} / 3
                    </span>

                    <div className="flex gap-1.5">
                      
                      {/* Lifecycle Demo Toggle (Reported -> Verified -> In Progress -> Resolved) */}
                      {issue.status !== "Resolved" && (
                        <button
                          type="button"
                          onClick={(e) => handleToggleStatus(e, issue)}
                          className="py-1 px-2 text-[9px] font-bold text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-850 rounded-lg border border-gray-200 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Activity className="w-3 h-3 text-emerald-500" />
                          {t("Update Status")}
                        </button>
                      )}

                      {/* Verify Button */}
                      {issue.status === "Reported" && (
                        <button
                          disabled={verifyingId === issue.id || isOwnReport || hasVerified}
                          onClick={(e) => handleVerify(e, issue)}
                          className={`py-1 px-2.5 text-[9px] font-bold rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                            hasVerified 
                              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900" 
                              : isOwnReport 
                                ? "bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border-gray-200 dark:border-slate-700 cursor-not-allowed opacity-60"
                                : "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white border-amber-500 hover:-translate-y-0.5 active:translate-y-0"
                          }`}
                        >
                          {hasVerified ? (
                            <>
                              <CheckCheck className="w-3 h-3" />
                              {t("Verified")} By You
                            </>
                          ) : isOwnReport ? (
                            <>
                              <User className="w-3 h-3" />
                              {t("Other")}
                            </>
                          ) : verifyingId === issue.id ? (
                            "Verifying..."
                          ) : (
                            <>
                              <ShieldCheck className="w-3 h-3" />
                              {t("Verify Issue")} (+15 XP)
                            </>
                          )}
                        </button>
                      )}

                    </div>

                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
