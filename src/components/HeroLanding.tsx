import React, { useEffect, useState } from "react";
import { Shield, Sparkles, MapPin, Play, CheckCircle, Clock, Users, ArrowRight } from "lucide-react";
import { useApp } from "../lib/AppContext";

interface HeroLandingProps {
  onDismiss: () => void;
  onReportIssue: () => void;
  totalIssuesCount: number;
  onStartJudgeDemo?: () => void;
}

interface PinItem {
  id: number;
  label: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
  status: "Reported" | "Resolved";
  type: string;
}

export default function HeroLanding({ onDismiss, onReportIssue, totalIssuesCount, onStartJudgeDemo }: HeroLandingProps) {
  const [resolvedCounter, setResolvedCounter] = useState<number>(1420);
  const [visiblePins, setVisiblePins] = useState<PinItem[]>([]);
  const [activeStep, setActiveStep] = useState<number>(0);

  // Fallback map projection coordinates for Bengaluru
  const demoPins: PinItem[] = [
    { id: 1, label: "Pothole Repaved at Indiranagar", lat: 12.9716, lng: 77.6406, x: 550, y: 220, status: "Resolved", type: "Pothole" },
    { id: 2, label: "Streetlight Repaired at Koramangala", lat: 12.9340, lng: 77.6200, x: 340, y: 190, status: "Resolved", type: "Broken Streetlight" },
    { id: 3, label: "Water Leak Fixed in Malleshwaram", lat: 13.0031, lng: 77.5694, x: 230, y: 110, status: "Resolved", type: "Water Leak" },
    { id: 4, label: "Trash Cleared in Whitefield", lat: 12.9698, lng: 77.7500, x: 290, y: 390, status: "Resolved", type: "Trash & Dumping" },
    { id: 5, label: "Active Garbage Dumping at JP Nagar", lat: 12.9100, lng: 77.5850, x: 420, y: 480, status: "Reported", type: "Trash & Dumping" },
    { id: 6, label: "Defective Bulb Replaced at Indiranagar", lat: 12.9784, lng: 77.6408, x: 620, y: 160, status: "Resolved", type: "Broken Streetlight" },
    { id: 7, label: "Water Leakage Repaired at Koramangala", lat: 12.9340, lng: 77.6200, x: 470, y: 440, status: "Resolved", type: "Water Leak" }
  ];

  // Auto-play pins dropping one-by-one with beautiful bounce effects in a single clean interval
  useEffect(() => {
    let pinIndex = 0;
    const interval = setInterval(() => {
      if (pinIndex < demoPins.length) {
        const nextPin = demoPins[pinIndex];
        if (nextPin) {
          setVisiblePins((prev) => [...prev.filter(Boolean), nextPin]);
          setActiveStep(pinIndex);
        }
        pinIndex++;
      } else if (pinIndex < demoPins.length + 3) {
        // Paused state with all pins fully rendered before recycle
        pinIndex++;
      } else {
        // Recycle cleanly
        setVisiblePins([]);
        pinIndex = 0;
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  // Tick up resolved counter over time to show momentum
  useEffect(() => {
    const counterInterval = setInterval(() => {
      setResolvedCounter((prev) => prev + (Math.random() > 0.4 ? 1 : 0));
    }, 2500);

    return () => clearInterval(counterInterval);
  }, []);

  const { theme } = useApp();

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col md:grid md:grid-cols-12 overflow-y-auto md:overflow-hidden font-sans transition-colors duration-300 citizen-theme ${
        theme === "light" 
          ? "bg-bg-base text-text-primary" 
          : "bg-slate-950 text-white"
      }`}
      id="hero-landing-viewport"
    >
      {/* Background ambient radial gradients (city night sky feel or warm sunny daylight feel) */}
      <div className={`absolute inset-0 pointer-events-none transition-all duration-300 ${
        theme === "light"
          ? "bg-[radial-gradient(ellipse_at_center,rgba(253,250,245,1)_0%,rgba(245,239,228,1)_100%)]"
          : "bg-[radial-gradient(ellipse_at_center,rgba(15,23,41,1)_0%,rgba(8,13,26,1)_100%)]"
      }`}></div>

      {/* Grid Pattern overlay */}
      <div 
        className={`absolute inset-0 opacity-[0.03] pointer-events-none transition-all duration-300 ${
          theme === "light"
            ? "bg-[linear-gradient(to_right,#d96c3f_1px,transparent_1px),linear-gradient(to_bottom,#d96c3f_1px,transparent_1px)] bg-[size:32px_32px]"
            : "bg-[linear-gradient(to_right,#3b82f6_1px,transparent_1px),linear-gradient(to_bottom,#3b82f6_1px,transparent_1px)] bg-[size:32px_32px]"
        }`}
      ></div>

      {/* Left Panel: High impact marketing and quick details (5 columns) */}
      <div className="col-span-5 flex flex-col justify-start p-5 sm:p-7 lg:p-8 z-10 relative shrink-0 min-h-fit md:h-full md:overflow-y-auto gap-5 sm:gap-6 md:gap-7 scrollbar-none">
        {/* Top Branding Header */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-accent-primary text-white rounded-xl shadow-lg shadow-accent-primary/20 shrink-0">
            <Shield className="w-5 h-5 fill-white" />
          </div>
          <div>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest font-mono block leading-none" style={{ color: "var(--accent-primary)" }}>CIVIC PLATFORM</span>
            <h2 className="text-xs sm:text-sm font-extrabold tracking-tight text-text-primary mt-1 leading-none">SAMRIDDHI PARIVAR</h2>
          </div>
        </div>

        {/* Center Headline */}
        <div className="space-y-3.5 sm:space-y-4 max-w-md w-full flex-1 flex flex-col justify-center">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent-primary/10 border border-accent-primary/20 rounded-full text-[9px] sm:text-[10px] text-accent-primary font-black tracking-wider uppercase self-start">
            <Sparkles className="w-3 h-3 text-accent-tertiary animate-pulse" />
            Bengaluru's Civic Action Platform
          </div>

          <div className="space-y-1">
            <p className="text-[11px] sm:text-[12px] text-text-secondary font-bold uppercase tracking-widest leading-none">SAMRIDDHI PARIVAR presents</p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-[1.1] text-text-primary">
              See a Problem.<br />
              <span className="bg-gradient-to-r from-accent-primary via-accent-tertiary to-accent-secondary bg-clip-text text-transparent">
                Tap & Resolve.
              </span>
            </h1>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed font-medium">
            Join thousands of active Bengaluru citizens using advanced Multimodal Gemini AI to identify, verify, and resolve potholes, broken lights, and water leaks. Watch your neighborhood transform in real-time.
          </p>

          {/* Thin horizontal divider line below hero tagline */}
          <div className="h-[1px] w-full bg-accent-secondary/15" />

          {/* Realistic Community Multi-Stats Card */}
          <div className="p-2.5 sm:p-3 bg-bg-surface border border-border-warm rounded-2xl grid grid-cols-3 gap-1 sm:gap-2.5 shadow-md mt-1 transition-colors duration-300">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="p-1 sm:p-1.5 bg-accent-secondary/10 border border-accent-secondary/20 rounded-xl text-accent-secondary shrink-0">
                <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[8px] text-text-muted font-bold font-mono uppercase tracking-wide truncate">Fixed</div>
                <div className="text-xs sm:text-sm font-black font-mono text-text-primary mt-0.5 leading-none">{resolvedCounter}</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 border-l border-border-warm pl-1.5 sm:pl-2.5">
              <div className="p-1 sm:p-1.5 bg-accent-primary/10 border border-accent-primary/20 rounded-xl text-accent-primary shrink-0">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[8px] text-text-muted font-bold font-mono uppercase tracking-wide truncate">Speed</div>
                <div className="text-xs sm:text-sm font-black font-mono text-text-primary mt-0.5 leading-none">2.4 Days</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 border-l border-border-warm pl-1.5 sm:pl-2.5">
              <div className="p-1 sm:p-1.5 bg-accent-tertiary/10 border border-accent-tertiary/20 rounded-xl text-accent-tertiary shrink-0">
                <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[8px] text-text-muted font-bold font-mono uppercase tracking-wide truncate">Heroes</div>
                <div className="text-xs sm:text-sm font-black font-mono text-text-primary mt-0.5 leading-none">12,490</div>
              </div>
            </div>
          </div>
        </div>

        {/* Call To Action Buttons Footer */}
        <div className="space-y-2.5 w-full pt-3 border-t border-border-warm mt-1">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={onReportIssue}
              className="flex-1 py-3 px-5 bg-accent-primary hover:opacity-90 text-white font-extrabold text-xs rounded-full shadow-md shadow-accent-primary/20 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
              id="hero-cta-report"
            >
              <MapPin className="w-3.5 h-3.5 text-white animate-bounce shrink-0" />
              Report an Issue
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 py-3 px-5 bg-transparent hover:bg-accent-secondary/5 text-accent-secondary border border-accent-secondary font-extrabold text-xs rounded-full cursor-pointer transition-all flex items-center justify-center gap-2"
              id="hero-cta-explore"
            >
              Explore Map Grid
              <ArrowRight className="w-3.5 h-3.5 text-accent-secondary shrink-0" />
            </button>
          </div>
          <p className="text-[9px] text-text-muted font-bold font-mono text-center sm:text-left uppercase">
            PRESS "EXPLORE MAP GRID" TO INTERACT WITH BENGALURU LIVE REPORTS
          </p>
          {onStartJudgeDemo && (
            <div className="flex justify-center mt-4">
              <button
                onClick={onStartJudgeDemo}
                className="text-sm font-medium text-accent-secondary hover:underline cursor-pointer transition-all animate-pulse"
                id="hero-judge-demo-link"
              >
                🏆 Evaluating this project? Start the guided demo →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Auto-playing Live Interactive Map Vector (7 columns) */}
      <div className="col-span-7 relative bg-bg-surface border-t md:border-t-0 md:border-l border-border-warm h-[380px] sm:h-[450px] md:h-full shrink-0 transition-colors duration-300">
        {/* Simulated Map Outline Area */}
        <div className="absolute inset-0 flex items-center justify-center p-6 bg-bg-base transition-colors duration-300">
          <div className="relative w-full max-w-[640px] aspect-[4/3] rounded-3xl border border-border-warm bg-bg-surface overflow-hidden shadow-2xl flex items-center justify-center transition-colors duration-300">
            {/* Soft grid background */}
            <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#3b82f6_1.5px,transparent_1.5px)] bg-[size:20px_20px] pointer-events-none"></div>

            {/* Abstract Bengaluru Roads SVG */}
            <svg 
              viewBox="0 0 800 600" 
              className={`w-full h-full opacity-20 pointer-events-none transition-all duration-300 ${
                theme === "light" ? "text-accent-secondary/40" : "text-slate-900"
              }`}
              stroke="currentColor" 
              strokeWidth="2.5" 
              fill="none"
            >
              {/* Main Outer ring */}
              <circle cx="400" cy="300" r="280" strokeDasharray="8 8" strokeWidth="1.5" />
              <circle cx="400" cy="300" r="180" strokeWidth="1.5" />
              {/* Grid Lines */}
              <line x1="120" y1="300" x2="680" y2="300" />
              <line x1="400" y1="20" x2="400" y2="580" strokeDasharray="5 5" />
              {/* Radial Roads */}
              <line x1="200" y1="100" x2="600" y2="500" />
              <line x1="200" y1="500" x2="600" y2="100" />
              {/* Secondary roads */}
              <path d="M 150 150 C 250 220, 300 150, 400 200 C 500 250, 600 220, 700 200" strokeWidth="1.2" />
              <path d="M 100 450 C 250 400, 450 450, 500 350 C 550 250, 650 380, 750 450" strokeWidth="1" />
            </svg>

            {/* Autoplay falling/dropping pins */}
            {visiblePins.map((pin) => {
              if (!pin) return null;
              const isResolved = pin.status === "Resolved";
              const isLatest = demoPins[activeStep]?.id === pin.id;

              return (
                <div 
                  key={pin.id}
                  className="absolute transition-all duration-700 animate-scale-up"
                  style={{ left: `${(pin.x / 800) * 100}%`, top: `${(pin.y / 600) * 100}%` }}
                >
                  {/* Subtle pulsing rings around resolved pins */}
                  {isResolved && (
                    <div className="absolute inset-[-14px] w-12 h-12 bg-accent-secondary/20 border border-accent-secondary/40 rounded-full animate-ping pointer-events-none"></div>
                  )}

                  {!isResolved && (
                    <div className="absolute inset-[-14px] w-12 h-12 bg-accent-primary/20 border border-accent-primary/40 rounded-full animate-ping pointer-events-none"></div>
                  )}

                  {/* Marker Pin Icon wrapper */}
                  <div 
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform ${
                      isResolved 
                        ? "bg-accent-secondary border border-accent-secondary/40 text-white" 
                        : "bg-accent-primary border border-accent-primary/40 text-white"
                    } ${isLatest ? "scale-125 ring-4 ring-accent-primary/30" : "scale-100"}`}
                  >
                    <MapPin className="w-4 h-4 fill-white/10" />
                  </div>

                  {/* Tooltip Overlay Banner */}
                  <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-bg-surface border border-border-warm p-2 rounded-xl text-[9px] font-bold text-center whitespace-nowrap shadow-xl flex items-center gap-1.5 transition-colors duration-300">
                    <span className={`w-1.5 h-1.5 rounded-full ${isResolved ? "bg-accent-secondary" : "bg-accent-primary"}`}></span>
                    <span className="text-text-primary font-bold">{pin.label}</span>
                  </div>
                </div>
              );
            })}

            {/* Mini HUD Stats */}
            <div className="absolute bottom-4 left-4 p-3 bg-bg-surface border border-border-warm rounded-xl space-y-1 text-[10px] font-mono font-bold text-text-secondary transition-colors duration-300 shadow-sm">
              <div className="flex justify-between gap-6">
                <span>SECTOR:</span>
                <span className="text-accent-primary">BLR_CENTRAL</span>
              </div>
              <div className="flex justify-between gap-6">
                <span>GRID POWER:</span>
                <span className="text-accent-secondary">98.7% ONLINE</span>
              </div>
              <div className="flex justify-between gap-6">
                <span>ACTIVE HEROES:</span>
                <span className="text-text-primary">12,490 CITIZENS</span>
              </div>
            </div>

            {/* Pulse Indicator */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 bg-bg-surface border border-border-warm rounded-full text-[9px] font-mono font-extrabold text-accent-primary animate-pulse shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-primary"></div>
              LIVE SIMULATION
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
