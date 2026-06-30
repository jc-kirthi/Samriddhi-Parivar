import React, { useRef, useState } from "react";
import { Award, Download, Share2, Shield, Sparkles, X } from "lucide-react";
import { UserProfile } from "../types";

interface ImpactCertificateProps {
  profile: UserProfile;
  onClose: () => void;
}

export default function ImpactCertificate({ profile, onClose }: ImpactCertificateProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);

  const points = profile.points || 0;
  const isLegendary = points >= 1000;
  const certType = isLegendary ? "LEGENDARY COMMUNITY HERO" : "CIVIC GUARDIAN CADET";

  // Canvas drawing function
  const generateCertificate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set dimensions
    canvas.width = 800;
    canvas.height = 600;

    // 1. Solid base background (Dark Slate theme)
    ctx.fillStyle = "#020617"; // slate-950
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Beautiful abstract background circles / flares
    const gradient = ctx.createRadialGradient(400, 300, 50, 400, 300, 450);
    gradient.addColorStop(0, "#1e1b4b"); // indigo-950
    gradient.addColorStop(1, "#020617"); // slate-950
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Double golden/blue border frame
    ctx.strokeStyle = isLegendary ? "#f59e0b" : "#3b82f6"; // gold vs blue
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    ctx.strokeStyle = isLegendary ? "#d97706" : "#1d4ed8"; // dark gold vs dark blue
    ctx.lineWidth = 1.5;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    // 4. Grid overlay for technical high-tech look
    ctx.strokeStyle = "rgba(59, 130, 246, 0.04)";
    ctx.lineWidth = 1;
    for (let x = 40; x < canvas.width - 40; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x, canvas.height - 40);
      ctx.stroke();
    }
    for (let y = 40; y < canvas.height - 40; y += 40) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(canvas.width - 40, y);
      ctx.stroke();
    }

    // 5. Header details
    ctx.fillStyle = isLegendary ? "#fbbf24" : "#60a5fa"; // amber-400 vs blue-400
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText("BENGALURU MUNICIPAL COORDINATION GRID", 400, 80);

    // 6. Shield Emblem icon (Drawing a beautiful high-tech shield)
    ctx.beginPath();
    ctx.moveTo(400, 110);
    ctx.lineTo(425, 120);
    ctx.lineTo(425, 145);
    ctx.quadraticCurveTo(425, 170, 400, 185);
    ctx.quadraticCurveTo(375, 170, 375, 145);
    ctx.lineTo(375, 120);
    ctx.closePath();
    ctx.fillStyle = isLegendary ? "#f59e0b" : "#2563eb";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Shield inner star
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("★", 400, 150);

    // 7. Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 36px system-ui, sans-serif";
    ctx.fillText("CERTIFICATE OF IMPACT", 400, 235);

    ctx.fillStyle = isLegendary ? "#fbbf24" : "#60a5fa";
    ctx.font = "bold 13px monospace";
    ctx.fillText(`TIER: ${certType}`, 400, 270);

    // 8. Citation
    ctx.fillStyle = "#94a3b8"; // slate-400
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText("This official citation is awarded to citizen hero", 400, 320);

    // 9. Citizen Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 28px system-ui, sans-serif";
    ctx.fillText(profile.displayName?.toUpperCase() || "CITIZEN HERO", 400, 365);

    // Underline name
    ctx.strokeStyle = isLegendary ? "#fbbf24" : "#3b82f6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(250, 380);
    ctx.lineTo(550, 380);
    ctx.stroke();

    // 10. Summary description
    ctx.fillStyle = "#94a3b8";
    ctx.font = "italic 13px system-ui, sans-serif";
    ctx.fillText(
      `For distinguished service in improving local city infrastructure and community welfare.`,
      400,
      415
    );

    // 11. Core Stats Row
    ctx.fillStyle = "#1e293b"; // slate-800 background for stats
    ctx.fillRect(100, 445, 600, 65);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.strokeRect(100, 445, 600, 65);

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 18px monospace";
    ctx.fillText(`${profile.reportedCount || 0}`, 200, 475);
    ctx.fillText(`${profile.verifiedCount || 0}`, 350, 475);
    ctx.fillText(`${profile.resolvedCount || 0}`, 500, 475);
    ctx.fillText(`${profile.points || 0} XP`, 620, 475);

    ctx.fillStyle = "#64748b"; // slate-500
    ctx.font = "bold 9px monospace";
    ctx.fillText("ISSUES FILED", 200, 495);
    ctx.fillText("ISSUES VERIFIED", 350, 495);
    ctx.fillText("ISSUES RESOLVED", 500, 495);
    ctx.fillText("CONTRIBUTION SCORE", 620, 495);

    // 12. Signature Stamp
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`VERIFICATION SEC_ID: #${profile.uid?.substring(0, 8).toUpperCase()}`, 60, 550);

    ctx.textAlign = "right";
    ctx.fillText(`DATE: ${new Date().toLocaleDateString()}`, 740, 550);

    // Set generated data URL
    setGeneratedImg(canvas.toDataURL("image/png"));
  };

  // Run on mount
  React.useEffect(() => {
    setTimeout(generateCertificate, 150);
  }, [profile]);

  const handleShare = async () => {
    if (!generatedImg) return;

    // Convert Base64 Data URL to actual file object for Web Share API
    try {
      const response = await fetch(generatedImg);
      const blob = await response.blob();
      const file = new File([blob], "impact_certificate.png", { type: "image/png" });

      const shareData = {
        title: "SAMRIDDHI PARIVAR Impact Certificate",
        text: `Check out my official Bengaluru Civic Action citation! Level: ${Math.floor(points / 200) + 1} with ${points} XP!`,
        files: [file]
      };

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share(shareData);
      } else {
        triggerDownload();
      }
    } catch (err) {
      console.warn("Sharing failed, falling back to download:", err);
      triggerDownload();
    }
  };

  const triggerDownload = () => {
    if (!generatedImg) return;
    const a = document.createElement("a");
    a.href = generatedImg;
    a.download = `Community_Hero_Certificate_${profile.displayName || "Citizen"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div 
      className="fixed inset-0 z-55 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans"
      id="certificate-viewer-overlay"
    >
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 animate-scale-up relative"
        id="certificate-container"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-4.5 h-4.5" />
        </button>

        {/* Certificate Header details */}
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl bg-linear-to-br ${isLegendary ? "from-amber-400 to-amber-600" : "from-blue-500 to-indigo-600"} text-white shadow-lg`}>
            <Award className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">SECURE MUNICIPAL CITATION</span>
            <h1 className="text-xl font-black text-white leading-tight">Claim Your Civic Certificate</h1>
            <p className="text-xs text-slate-400 mt-1">
              {isLegendary 
                ? "Congratulations! You have exceeded 1000 XP and unlocked the Legendary tier certificate." 
                : `Earn 1000 XP to claim the Legendary Certificate. Current: ${points}/1000 XP. Displaying active Guardian Cadet citation.`
              }
            </p>
          </div>
        </div>

        {/* Dynamic Canvas element (Hidden while we show compiled image) */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Certificate Preview rendering */}
        <div className="relative w-full aspect-[4/3] rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 shadow-xl flex items-center justify-center">
          {generatedImg ? (
            <img 
              src={generatedImg} 
              alt="Impact Certificate Preview" 
              className="w-full h-full object-contain animate-fade-in" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500 text-xs font-mono">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span>COMPILING VECTOR CERTIFICATE...</span>
            </div>
          )}
        </div>

        {/* Progress bar to Legendary if Cadet */}
        {!isLegendary && (
          <div className="space-y-1.5" id="legendary-progress-bar">
            <div className="flex justify-between text-[9px] font-mono font-bold text-slate-500">
              <span>CADET LEVEL</span>
              <span className="text-blue-400">{points} / 1000 XP TO LEGENDARY HERO</span>
              <span>LEGENDARY</span>
            </div>
            <div className="w-full bg-slate-950 h-2.5 rounded-full border border-slate-850 overflow-hidden relative">
              <div 
                className="h-full bg-linear-to-r from-blue-500 to-indigo-600 transition-all duration-500 rounded-full"
                style={{ width: `${Math.min((points / 1000) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* CTAs */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleShare}
            disabled={!generatedImg}
            className="py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-500/20 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4 text-blue-200" />
            Share Certificate
          </button>
          <button
            onClick={triggerDownload}
            disabled={!generatedImg}
            className="py-3 px-6 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-extrabold text-xs rounded-xl disabled:opacity-50 cursor-pointer transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 text-slate-450" />
            Download PNG
          </button>
        </div>
      </div>
    </div>
  );
}
