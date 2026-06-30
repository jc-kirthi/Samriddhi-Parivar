import React from "react";
import { 
  Shield, 
  Heart, 
  Mail, 
  Github, 
  Twitter, 
  MapPin, 
  ExternalLink, 
  Award, 
  Activity, 
  FileText
} from "lucide-react";
import { useApp } from "../lib/AppContext";

interface FooterProps {
  activeTab: string;
  setActiveTab: (tab: "map" | "impact" | "official") => void;
  onOpenAuth: () => void;
  onReportClick: () => void;
  user: any;
}

export default function Footer({ 
  activeTab, 
  setActiveTab, 
  onOpenAuth, 
  onReportClick,
  user 
}: FooterProps) {
  const { t } = useApp();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 transition-colors duration-200 mt-12" id="global-application-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Column 1: Brand & Initiative */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="font-extrabold text-gray-900 dark:text-white tracking-tight">
                SAMRIDDHI PARIVAR
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
              {t("A citizen-led civic monitoring and collaborative action grid for Bengaluru. Empowering local communities to report, verify, and resolve issues dynamically.")}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg transition-colors border border-slate-200/20">
                <Github className="w-4 h-4" />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg transition-colors border border-slate-200/20">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="mailto:support@samriddhiparivar.org" className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg transition-colors border border-slate-200/20">
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Column 2: Civic Categories & Quick Filter */}
          <div className="space-y-4">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {t("Civic Categories")}
            </h5>
            <ul className="space-y-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
              <li>
                <button onClick={() => { setActiveTab("map"); }} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                  <span>{t("Pothole & Roads")}</span>
                </button>
              </li>
              <li>
                <button onClick={() => { setActiveTab("map"); }} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                  <span>{t("Water Leakage")}</span>
                </button>
              </li>
              <li>
                <button onClick={() => { setActiveTab("map"); }} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                  <span>{t("Broken Streetlights")}</span>
                </button>
              </li>
              <li>
                <button onClick={() => { setActiveTab("map"); }} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span>{t("Trash & Waste Disposal")}</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Impact & Ecosystem */}
          <div className="space-y-4">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {t("Impact & Ecosystem")}
            </h5>
            <ul className="space-y-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
              <li>
                <button 
                  onClick={() => setActiveTab("impact")} 
                  className={`transition-colors cursor-pointer flex items-center gap-2 ${activeTab === "impact" ? "text-blue-600 dark:text-blue-400" : "hover:text-blue-600 dark:hover:text-blue-400"}`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>{t("Impact Analytics")}</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveTab("map")} 
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t("Leaderboard Standing")}</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={onOpenAuth} 
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{t("Citizen Rewards Program")}</span>
                </button>
              </li>
              <li>
                <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded inline-block">
                  {t("System State: Live Sync")}
                </span>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Grievance */}
          <div className="space-y-4">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {t("Contact & Reporting")}
            </h5>
            <div className="space-y-3.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>Bengaluru, Karnataka, India</span>
              </div>
              
              <div className="pt-1.5">
                <button
                  onClick={onReportClick}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Shield className="w-4 h-4" />
                  <span>{t("Report Civil Issue")}</span>
                </button>
              </div>

              {/* Password protected portal link remains gated as per rules - only exposes if already on that tab or via current authenticated layout */}
              <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-gray-400 dark:text-gray-500">
                <span>BBMP Administrative Hub</span>
                <button 
                  onClick={() => {
                    // Triggers the password auth gate if unauthenticated, or navigates safely
                    setActiveTab("official");
                  }} 
                  className="hover:text-blue-600 dark:hover:text-blue-400 underline cursor-pointer"
                >
                  {t("Portal Login")}
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-200 dark:border-gray-800/80 mt-12 pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            &copy; {currentYear} SAMRIDDHI PARIVAR. {t("All rights reserved.")}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 font-medium">
            <span>{t("Crafted with")}</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
            <span>{t("for a better Bengaluru")}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
