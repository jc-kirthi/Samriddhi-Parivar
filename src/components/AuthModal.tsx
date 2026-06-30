import React, { useState, useEffect } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from "firebase/auth";
import { 
  auth, 
  getOrCreateUserProfile, 
  diagnoseFirebaseConfig, 
  FirebaseDiagResult,
  signInAnonymously,
  setDemoMode,
  isDemoMode,
  seedFirestoreDatabase
} from "../lib/firebase";
import { verifyFirebaseConfig, VerificationResult } from "../lib/auth-debug";
import { useApp } from "../lib/AppContext";
import { 
  Shield, 
  Sparkles, 
  User, 
  Mail, 
  Lock, 
  X, 
  AlertTriangle, 
  Settings, 
  RefreshCw, 
  Key, 
  ArrowRight, 
  HelpCircle, 
  CheckCircle, 
  Activity 
} from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { t } = useApp();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Troubleshooting states
  const [showTroubleshooter, setShowTroubleshooter] = useState(false);
  const [troubleTab, setTroubleTab] = useState<"auth" | "firestore">("auth");
  const [dbOverride, setDbOverride] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("firebase_firestore_db_id") || "";
    }
    return "";
  });
  const [diagnostics, setDiagnostics] = useState<FirebaseDiagResult | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleCheckAuth = async () => {
    setVerifying(true);
    try {
      const res = await verifyFirebaseConfig();
      setVerification(res);
      if (res && !res.firestoreConnectionOk) {
        setTroubleTab("firestore");
        setShowTroubleshooter(true);
      }
    } catch (err: any) {
      console.error("Diagnostic error:", err);
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveDbOverride = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("firebase_firestore_db_id", dbOverride.trim());
      // Reload to re-initialize Firestore
      window.location.reload();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setDiagnostics(diagnoseFirebaseConfig());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: name || email.split("@")[0]
        });
        // Create user profile in Firestore
        await getOrCreateUserProfile(userCredential.user);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await getOrCreateUserProfile(userCredential.user);
      }
      localStorage.setItem("civic_user_joined", "true");
      await seedFirestoreDatabase();
      window.dispatchEvent(new Event("civic_user_joined_event"));
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An authentication error occurred.");
      // Automatically prompt the troubleshooter if Firestore config or propagation issues occur
      const isConfigIssue = 
        err.message?.includes("NOT_FOUND") ||
        err.message?.includes("not-found") ||
        err.message?.includes("permission") ||
        err.message?.includes("PERMISSION_DENIED") ||
        err.message?.includes("database") ||
        err.code?.includes("firestore");
        
      if (isConfigIssue) {
        if (
          err.message?.includes("NOT_FOUND") || 
          err.message?.includes("not-found") || 
          err.message?.includes("database") || 
          err.code?.includes("firestore") || 
          err.message?.includes("permission") || 
          err.message?.includes("PERMISSION_DENIED")
        ) {
          setTroubleTab("firestore");
        } else {
          setTroubleTab("auth");
        }
        setShowTroubleshooter(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const userCredential = await signInAnonymously(auth);
      // Generate a randomized fun hero name for Guest
      const guestNames = ["Echo Guardian", "Metro Shield", "Asphalt Ranger", "Beacon Citizen", "Street Sentinel"];
      const chosenName = guestNames[Math.floor(Math.random() * guestNames.length)] + " #" + Math.floor(100 + Math.random() * 900);
      
      await updateProfile(userCredential.user as any, {
        displayName: chosenName
      });
      await getOrCreateUserProfile(userCredential.user as any);
      localStorage.setItem("civic_user_joined", "true");
      await seedFirestoreDatabase();
      window.dispatchEvent(new Event("civic_user_joined_event"));
      onClose();
    } catch (err: any) {
      console.error("Guest login error details:", err);
      setError(err.message || "Failed to sign in as Guest.");
      // Automatically prompt the troubleshooter if Anonymous Auth is disabled, user creation is blocked, or Firestore is propagation-delayed
      const isConfigIssue = 
        err.code === "auth/operation-not-allowed" || 
        err.code === "auth/admin-restricted-operation" ||
        err.message?.includes("operation-not-allowed") ||
        err.message?.includes("admin-restricted-operation") ||
        err.message?.includes("NOT_FOUND") ||
        err.message?.includes("not-found") ||
        err.message?.includes("permission") ||
        err.message?.includes("PERMISSION_DENIED") ||
        err.message?.includes("database") ||
        err.code?.includes("firestore");
        
      if (isConfigIssue) {
        if (
          err.message?.includes("NOT_FOUND") || 
          err.message?.includes("not-found") || 
          err.message?.includes("database") || 
          err.code?.includes("firestore") || 
          err.message?.includes("permission") || 
          err.message?.includes("PERMISSION_DENIED")
        ) {
          setTroubleTab("firestore");
        } else {
          setTroubleTab("auth");
        }
        setShowTroubleshooter(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in" id="auth-modal-overlay">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800" id="auth-modal-container">
        
        {/* Banner header */}
        <div className="p-6 text-center text-white bg-linear-to-r from-blue-600 to-indigo-700">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-1 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            id="auth-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center justify-center p-3 mb-2 bg-white/10 rounded-full">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{t("Samprati Pariwar")}</h2>
          <p className="mt-1 text-sm text-blue-100">{t("Bengaluru's citizen civic action platform")}</p>
        </div>

        {/* Form content */}
        <div className="p-6">
          {showTroubleshooter && diagnostics && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 rounded-xl animate-scale-up" id="auth-troubleshooter">
              {/* Tab Selector */}
              <div className="flex border-b border-amber-200 dark:border-slate-700 mb-3 text-xs">
                <button
                  type="button"
                  onClick={() => setTroubleTab("auth")}
                  className={`pb-2 px-3 font-bold transition-all cursor-pointer ${troubleTab === "auth" ? "border-b-2 border-amber-500 text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}
                >
                  {t("1. Authentication Setup")}
                </button>
                <button
                  type="button"
                  onClick={() => setTroubleTab("firestore")}
                  className={`pb-2 px-3 font-bold transition-all cursor-pointer ${troubleTab === "firestore" ? "border-b-2 border-amber-500 text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}
                >
                  {t("2. Firestore Database")}
                </button>
              </div>

              {troubleTab === "auth" ? (
                <>
                  <div className="flex items-start gap-2.5 mb-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                        {t("Firebase Guest Auth Fix")}
                      </h4>
                      <p className="text-[11px] text-slate-650 dark:text-slate-400 leading-relaxed mt-0.5">
                        {t("Anonymous sign-in is disabled in your Firebase console by default. Please follow these simple steps to enable it:")}
                      </p>
                    </div>
                  </div>

                  {/* Step-by-step instructions */}
                  <div className="space-y-2 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                    <div className="flex items-start gap-1.5 p-2 bg-white dark:bg-slate-850 rounded-lg border border-slate-100 dark:border-slate-800">
                      <span className="w-4 h-4 bg-amber-100 dark:bg-amber-950/40 text-amber-700 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0">1</span>
                      <span>
                        Go to your <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 font-bold underline hover:text-blue-700">Firebase Console</a> and select project <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold text-slate-800 dark:text-slate-200">{diagnostics.projectId || "your-project"}</code>.
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5 p-2 bg-white dark:bg-slate-850 rounded-lg border border-slate-100 dark:border-slate-800">
                      <span className="w-4 h-4 bg-amber-100 dark:bg-amber-950/40 text-amber-700 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0">2</span>
                      <span>
                        Go to <span className="font-bold">Build &gt; Authentication</span> in the left sidebar.
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5 p-2 bg-white dark:bg-slate-850 rounded-lg border border-slate-100 dark:border-slate-800">
                      <span className="w-4 h-4 bg-amber-100 dark:bg-amber-950/40 text-amber-700 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0">3</span>
                      <span>
                        <strong>Enable Guest Auth:</strong> Under the <span className="font-bold">Sign-in method</span> tab, click <span className="font-bold">Add new provider</span>, choose <span className="font-bold text-amber-600 dark:text-amber-400">Anonymous</span>, toggle <span className="font-bold">Enable</span>, and click <span className="font-bold">Save</span>.
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5 p-2 bg-white dark:bg-slate-850 rounded-lg border border-slate-100 dark:border-slate-800">
                      <span className="w-4 h-4 bg-amber-100 dark:bg-amber-950/40 text-amber-700 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0">4</span>
                      <span>
                        <strong>Fix "Admin Restricted" Error:</strong> Click on the <span className="font-bold">Settings</span> tab (next to Sign-in method), select <span className="font-bold">User actions</span>, and ensure <span className="font-bold text-blue-600 dark:text-blue-400">"Enable create (sign-up)"</span> is checked. Save any changes.
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold mb-1">
                    {t("Firestore database returned NOT_FOUND (Code 5) or BLOCKED (Code 7). Let's verify:")}
                  </p>
                  <div className="flex items-start gap-1.5 p-2 bg-white dark:bg-slate-850 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="w-4 h-4 bg-amber-100 dark:bg-amber-950/40 text-amber-700 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0">1</span>
                    <span>
                      {t("Go to ")}<strong>Build &gt; Firestore Database</strong>{t(" in your Firebase console. Verify a database exists for project ")}<code>{diagnostics.projectId}</code>.
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 p-2 bg-white dark:bg-slate-850 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="w-4 h-4 bg-amber-100 dark:bg-amber-950/40 text-amber-700 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0">2</span>
                    <span>
                      <strong>{t("Native Mode Required: ")}</strong>{t("Verify the database was initialized in 'Native Mode' (not Datastore Mode), which is required for browser/client SDK operations.")}
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 p-2 bg-white dark:bg-slate-850 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="w-4 h-4 bg-amber-100 dark:bg-amber-950/40 text-amber-700 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0">3</span>
                    <span>
                      {t("If you created a Custom Database ID instead of using the default, enter it below to override:")}
                    </span>
                  </div>

                  {/* Override input */}
                  <div className="p-2 bg-white dark:bg-slate-850 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1.5">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      {t("Firestore Database ID:")}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="e.g. (default)"
                        value={dbOverride}
                        onChange={(e) => setDbOverride(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveDbOverride}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {t("Save & Reload")}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => { setDbOverride("(default)"); }}
                        className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[9px] text-slate-600 dark:text-slate-400 rounded-md font-bold transition-all cursor-pointer"
                      >
                        {t("Preset: (default)")}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDbOverride("default"); }}
                        className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[9px] text-slate-600 dark:text-slate-400 rounded-md font-bold transition-all cursor-pointer"
                      >
                        {t("Preset: default")}
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 font-normal leading-normal">
                      {t("Leave blank or choose a preset. Override is saved locally in your browser.")}
                    </p>
                  </div>
                </div>
              )}

              {/* Hardware diagnostics health list */}
              <div className="mt-4 border-t border-slate-200 dark:border-slate-750 pt-3">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase font-bold mb-1.5">
                  <span>Firebase Config Check</span>
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="flex items-center gap-1">
                    {diagnostics.configValid ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    <span className="text-slate-600 dark:text-slate-400">Configuration: {diagnostics.configValid ? "VALID" : "INVALID"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {diagnostics.usingPlaceholders ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    )}
                    <span className="text-slate-600 dark:text-slate-400">Placeholders: {diagnostics.usingPlaceholders ? "YES" : "NO"}</span>
                  </div>
                </div>
              </div>

              {/* Firestore Propagation Notice */}
              {(((verification && !verification.firestoreConnectionOk) || error.includes("NOT_FOUND") || error.includes("not-found") || error.includes("permission") || error.toLowerCase().includes("database") || error.includes("PERMISSION_DENIED")) && !error.includes("operation-not-allowed") && !error.includes("admin-restricted-operation")) && (
                <div className="mt-4 p-3 bg-blue-50/50 dark:bg-slate-800/80 border border-blue-200 dark:border-slate-750 rounded-lg text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-400 mb-1">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                    <span>Firestore Database Propagation Alert</span>
                  </div>
                  <p className="text-slate-655 dark:text-slate-355 leading-relaxed text-[11px]">
                    Google Cloud Firestore databases take about <strong>1 to 5 minutes</strong> to fully propagate and register globally after initial creation. 
                    If you just successfully created your database, this <code>NOT_FOUND</code> or <code>PERMISSION_DENIED</code> error is fully normal and transient. Please wait 1-2 minutes and click <strong>Try Guest Sign In Again</strong> or try refreshing.
                  </p>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleGuestLogin}
                  disabled={loading}
                  className="flex-1 py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  {t("Try Guest Sign In Again")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTroubleshooter(false)}
                  className="py-1.5 px-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-bold text-xs transition-all cursor-pointer"
                >
                  {t("Dismiss")}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t("Your Name")}</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-850 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t("Email Address")}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-850 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t("Password")}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-850 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 text-xs font-medium text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 rounded-lg flex flex-col gap-2">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setShowTroubleshooter(true)}
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline text-left font-bold flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{t("Click here for step-by-step guest login troubleshooting guide")}</span>
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-lg shadow-sm transition-all flex items-center justify-center cursor-pointer"
              id="auth-submit-btn"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : isSignUp ? (
                t("Create Hero Account")
              ) : (
                t("Sign In")
              )}
            </button>
          </form>

          <div className="relative my-6 text-center">
            <hr className="border-gray-100 dark:border-slate-800" />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 text-xs text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-900">{t("— explore without signing in —")}</span>
          </div>

          <button
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full py-3 px-4 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 active:bg-gray-200 disabled:opacity-50 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xs transition-all flex flex-col items-center justify-center gap-1 cursor-pointer"
            id="auth-guest-btn"
          >
            <div className="flex items-center gap-2 font-bold">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{t("Explore as Guest →")}</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400 font-normal">
              {t("No sign-up needed. Full access to all features.")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              localStorage.setItem("civic_user_joined", "true");
              setDemoMode(true);
              onClose();
              setTimeout(() => {
                window.location.reload();
              }, 100);
            }}
            className="w-full mt-3 py-3 px-4 text-sm font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/30 active:bg-amber-200 border border-amber-200 dark:border-amber-900/40 rounded-lg shadow-xs transition-all flex flex-col items-center justify-center gap-1 cursor-pointer animate-pulse"
            id="auth-demo-sandbox-btn"
          >
            <div className="flex items-center gap-2 font-bold">
              <Activity className="w-4 h-4 text-amber-500 animate-spin" />
              <span>{t("🏆 Launch Judge Demo — Bengaluru Sample Data")}</span>
            </div>
            <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 font-normal">
              {t("Best for evaluation — pre-loads realistic civic reports, charts & leaderboard.")}
            </span>
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 underline focus:outline-none cursor-pointer"
              id="auth-toggle-mode"
            >
              {isSignUp ? t("Already have an account? Sign In") : t("Don't have an account? Sign Up")}
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 text-center">
            <button
              type="button"
              onClick={handleCheckAuth}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors cursor-pointer"
              id="auth-debug-btn"
            >
              <Activity className={`w-3.5 h-3.5 ${verifying ? "animate-spin text-blue-500" : ""}`} />
              <span>{verifying ? t("Diagnosing Auth...") : t("Check Firebase Connection Status")}</span>
            </button>

            {verification && (
              <div className="mt-3 p-3 text-left bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-xl text-[11px] font-mono text-slate-650 dark:text-slate-350 animate-scale-up" id="auth-debug-results">
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200 mb-2">
                  <span>SYSTEM DIAGNOSTIC REPORT</span>
                  <button 
                    type="button"
                    onClick={() => setVerification(null)} 
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span>Initialized:</span>
                    <span className={verification.initialized ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold"}>
                      {verification.initialized ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>API Key Detected:</span>
                    <span className={verification.apiKeyPresent ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold"}>
                      {verification.apiKeyPresent ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Auth Domain Set:</span>
                    <span className={verification.authDomainPresent ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold"}>
                      {verification.authDomainPresent ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Project ID Set:</span>
                    <span className={verification.projectIdPresent ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold"}>
                      {verification.projectIdPresent ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Auth Class Valid:</span>
                    <span className={verification.authInstanceValid ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold"}>
                      {verification.authInstanceValid ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>DB Connection Valid:</span>
                    <span className={verification.dbInstanceValid ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold"}>
                      {verification.dbInstanceValid ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Firestore DB Access:</span>
                    <span className={verification.firestoreConnectionOk ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-600 dark:text-rose-400 font-bold"}>
                      {verification.firestoreConnectionOk ? "REACHABLE" : "BLOCKED/ERROR"}
                    </span>
                  </div>
                  {verification.firestoreError && (
                    <div className="mt-2 pt-1 border-t border-slate-200 dark:border-slate-750 text-rose-500 font-semibold break-words">
                      Firestore Error: {verification.firestoreError}
                    </div>
                  )}
                  {verification.errorMessage && (
                    <div className="mt-2 pt-1 border-t border-slate-200 dark:border-slate-750 text-rose-500 font-semibold break-all">
                      Error: {verification.errorMessage}
                    </div>
                  )}
                  {!verification.apiKeyPresent && (
                    <div className="mt-2 text-rose-500 font-semibold text-[10px]">
                      ⚠️ Please check that firebase-applet-config.json has valid keys.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
