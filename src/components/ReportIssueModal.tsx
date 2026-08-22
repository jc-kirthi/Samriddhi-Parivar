import React, { useState, useRef, useEffect } from "react";
import { 
  X, 
  MapPin, 
  Image as ImageIcon, 
  Mic, 
  Square, 
  Play, 
  Trash2, 
  Wand2, 
  Send, 
  AlertCircle,
  Check,
  AlertTriangle,
  UploadCloud,
  Loader2,
  Sparkles,
  Shield,
  Clock,
  Building2,
  Info,
  CheckCircle2,
  Plus,
  ArrowRight,
  ThumbsUp
} from "lucide-react";
import { 
  CivicIssue, 
  CivicIntelligenceResult, 
  PossibleDuplicateSummary,
  getAIConfidenceLevel, 
  getAIConfidenceDescription,
  validateAndNormalizeCivicIntelligence,
  Department
} from "../types";
import { auth, reportIssue, verifyIssue, signInAnonymously, getOrCreateUserProfile } from "../lib/firebase";
import { useApp } from "../lib/AppContext";

const getNeighborhood = (lat: number, lng: number): string | null => {
  const neighborhoods = [
    { name: "Indiranagar", lat: 12.9784, lng: 77.6408 },
    { name: "Koramangala", lat: 12.9352, lng: 77.6245 },
    { name: "Jayanagar", lat: 12.9279, lng: 77.5909 },
    { name: "Malleshwaram", lat: 12.9915, lng: 77.5712 },
    { name: "Whitefield", lat: 12.9698, lng: 77.7499 },
    { name: "Hebbal", lat: 13.0285, lng: 77.5896 },
    { name: "JP Nagar", lat: 12.9100, lng: 77.5900 },
    { name: "HSR Layout", lat: 12.9105, lng: 77.6450 },
    { name: "Marathahalli", lat: 12.9565, lng: 77.7011 },
    { name: "Lalbagh", lat: 12.9601, lng: 77.5866 },
    { name: "MG Road Central District", lat: 12.9716, lng: 77.5946 }
  ];

  let nearest = null;
  let minDistance = Infinity;

  for (const n of neighborhoods) {
    const dist = Math.sqrt(Math.pow(n.lat - lat, 2) + Math.pow(n.lng - lng, 2));
    if (dist < minDistance) {
      minDistance = dist;
      nearest = n;
    }
  }

  if (nearest && minDistance < 0.08) {
    return nearest.name;
  }
  return null;
};

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
  isSampleTestMode?: boolean;
}

const compressAndResizeImage = (file: File, maxWidth = 600, maxHeight = 600): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(event.target?.result as string || "");
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as JPEG with 0.7 quality to ensure small size (usually <50KB)
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
        resolve(compressedBase64);
      };
      img.onerror = () => {
        reject(new Error("Failed to load image for compression"));
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

export default function ReportIssueModal({ isOpen, onClose, lat, lng, isSampleTestMode = false }: ReportIssueModalProps) {
  // Global context support
  const { t, startSpeechRecognition } = useApp();

  // STT states
  const [isSTTActive, setIsSTTActive] = useState(false);
  const [sttError, setSttError] = useState("");

  // Report Inputs
  const [textDescription, setTextDescription] = useState("");

  // Simulation test states
  const [testStep, setTestStep] = useState<"welcome" | "attaching" | "typing" | "analyzing" | "review" | "complete">("welcome");

  // Auto-run or reset simulation when isSampleTestMode changes
  useEffect(() => {
    if (!isSampleTestMode || !isOpen) return;
    
    // Reset inputs
    setTestStep("welcome");
    setTextDescription("");
    setTitle("");
    setCategory("Other");
    setUrgency("Medium");
    setLocationName(`Bengaluru (Coordinate: ${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    setDescription("");
    setRecommendedAction("");
    setImageFile(null);
    setImagePreview(null);
    setImageBase64(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioBase64(null);
    setAiAnalyzed(false);
    setAnalyzing(false);
    setIsSimulatedResponse(false);
    setVisionAnalysis(null);
  }, [isSampleTestMode, isOpen, lat, lng]);

  const startAutoSimulation = () => {
    setTestStep("attaching");
    
    // Step 1: Simulate attaching a high-fidelity image
    setTimeout(() => {
      const streetlightSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="100%" height="100%" fill="%230F172A"/><circle cx="200" cy="100" r="50" fill="%23FEF08A" opacity="0.1" filter="blur(15px)"/><circle cx="200" cy="100" r="5" fill="%23FEF08A"/><path d="M200,40 L200,260" stroke="%23334155" stroke-width="8"/><path d="M170,80 L230,80 L200,40 Z" fill="%231E293B"/><text x="40" y="270" fill="%2364748B" font-family="monospace" font-size="11" font-weight="bold">MOCK_IMAGE: ST_LIGHT_BLACKOUT_CO-302</text></svg>`;
      setImagePreview(streetlightSvg);
      setImageBase64("MOCK_BASE64_STREET_LIGHT");
      setTestStep("typing");
      
      // Step 2: Simulate typing a description
      setTimeout(() => {
        setTextDescription("Streetlight is fully blackout near 100 E 6th St crosswalk. This intersection is very busy and lacks pedestrian safety visibility.");
        setTestStep("analyzing");
        setAnalyzing(true);
        
        // Step 3: Simulate Gemini AI multi-modal inspector analyzing
        setTimeout(() => {
          setAnalyzing(false);
          setIsSimulatedResponse(true);
          setAiAnalyzed(true);
          
          // Populate final review details
          setTitle("Streetlight Blackout near Indiranagar 100 Feet Rd");
          setCategory("Broken Streetlight");
          setUrgency("High");
          setLocationName("100 Feet Rd, Indiranagar, Bengaluru, KA 560038");
          setDescription("Streetlight is fully blackout near 100 Feet Rd crosswalk. This intersection is very busy and lacks pedestrian safety visibility.");
          setRecommendedAction("BESCOM dispatch: replace ballast and LED module on streetlight pole #BLR-I-201.");
          
          setSeverity(4);
          setSeverityRationale("Severe dark spot created at critical crosswalk with high pedestrian footfall.");
          setHazards(["High pedestrian traffic hazard", "Severe dark spot at main crosswalk"]);
          setSuggestedDepartment("BESCOM");
          setSuggestedSLAHours(24);
          setAiSummary("Identified complete structural failure of public streetlight fixture near pedestrian crosswalk. High hazard level.");
          setConfidence(0.98);
          setDuplicateProbability(0.12);
          setPossibleDuplicates([]);
          setDuplicateRationale("No matching active streetlight issues found within 350m radius.");
          setShowDuplicateWarning(false);

          setVisionAnalysis({
            category: "Broken Streetlight",
            severity: 4,
            department: "BESCOM (Bangalore Electricity Supply Company)",
            hazards: ["High pedestrian traffic hazard", "Severe dark spot at main crosswalk"],
            confidence: 0.98,
            summary: "Identified complete structural failure of public streetlight fixture. High hazard level due to pedestrian crosswalk proximity. Recommendation generated for BESCOM."
          });
          
          setTestStep("review");
        }, 1800);
      }, 1500);
    }, 1200);
  };
  
  // Image Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [playbackActive, setPlaybackActive] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // AI Analysis results state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [aiAnalyzed, setAiAnalyzed] = useState(false);
  const [isSimulatedResponse, setIsSimulatedResponse] = useState(false);

  // Vision Analysis states (for the streaming card feature)
  interface VisionAnalysisResult {
    category: string;
    severity: number;
    department: string;
    hazards: string[];
    confidence: number;
    summary: string;
    simulated?: boolean;
  }
  const [visionAnalysis, setVisionAnalysis] = useState<VisionAnalysisResult | null>(null);
  const [streamedVisionAnalysis, setStreamedVisionAnalysis] = useState<Partial<VisionAnalysisResult>>({});
  const [visionStreamingStep, setVisionStreamingStep] = useState<string>("");
  const [imageAnalysisStage, setImageAnalysisStage] = useState<"idle" | "scanning" | "streaming" | "complete">("idle");
  const [animatingConfidence, setAnimatingConfidence] = useState<number>(0);

  useEffect(() => {
    if (imageAnalysisStage === "scanning" || imageAnalysisStage === "streaming") {
      setAnimatingConfidence(0);
      const interval = setInterval(() => {
        setAnimatingConfidence((prev) => {
          if (prev >= 87) {
            clearInterval(interval);
            return 87;
          }
          return prev + Math.floor(Math.random() * 5) + 3;
        });
      }, 150);
      return () => clearInterval(interval);
    } else if (imageAnalysisStage === "complete") {
      const finalConf = streamedVisionAnalysis.confidence ? Math.round(streamedVisionAnalysis.confidence * 100) : 95;
      setAnimatingConfidence(finalConf);
    }
  }, [imageAnalysisStage, streamedVisionAnalysis.confidence]);

  // Form Field States (filled either by AI or manually)
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CivicIssue["category"]>("Other");
  const [urgency, setUrgency] = useState<CivicIssue["urgency"]>("Medium");
  const [locationName, setLocationName] = useState(`Bengaluru (Coordinate: ${lat.toFixed(4)}, ${lng.toFixed(4)})`);
  const [description, setDescription] = useState("");
  const [recommendedAction, setRecommendedAction] = useState("");

  // Phase 4 Structured Civic Intelligence States
  const [civicIntelligence, setCivicIntelligence] = useState<CivicIntelligenceResult | null>(null);
  const [severity, setSeverity] = useState<number>(3);
  const [severityRationale, setSeverityRationale] = useState<string>("");
  const [hazards, setHazards] = useState<string[]>([]);
  const [newHazardInput, setNewHazardInput] = useState<string>("");
  const [suggestedDepartment, setSuggestedDepartment] = useState<Department>("BBMP");
  const [suggestedSLAHours, setSuggestedSLAHours] = useState<number>(48);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0.85);
  const [duplicateProbability, setDuplicateProbability] = useState<number>(0);
  const [possibleDuplicates, setPossibleDuplicates] = useState<PossibleDuplicateSummary[]>([]);
  const [duplicateRationale, setDuplicateRationale] = useState<string>("");
  const [showDuplicateWarning, setShowDuplicateWarning] = useState<boolean>(false);
  const [verifyingExistingId, setVerifyingExistingId] = useState<string | null>(null);
  const [verifySuccessMessage, setVerifySuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Speech-to-Text (STT) dictation
  const handleDictate = (targetSetter: React.Dispatch<React.SetStateAction<string>>) => {
    if (isSTTActive) {
      setIsSTTActive(false);
      return;
    }

    setIsSTTActive(true);
    setSttError("");

    const recognitionInstance = startSpeechRecognition(
      (text) => {
        targetSetter((prev) => (prev ? prev + " " + text : text));
        setIsSTTActive(false);
      },
      (err) => {
        console.error("Speech recognition error:", err);
        setSttError("Voice recognition failed. Please try typing or verify mic permissions.");
        setIsSTTActive(false);
      }
    );
  };

  if (!isOpen) return null;

  // --- Image Drag & Drop Handlers ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Only image files are supported!");
      return;
    }
    setImageFile(file);
    compressAndResizeImage(file)
      .then((compressedBase64) => {
        setImagePreview(compressedBase64);
        setImageBase64(compressedBase64.split(",")[1] || null);
      })
      .catch((err) => {
        console.error("Compression failed, falling back to original", err);
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result?.toString();
          setImagePreview(base64String || null);
          setImageBase64(base64String?.split(",")[1] || null);
        };
        reader.readAsDataURL(file);
      });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImageFile(e.target.files[0]);
    }
  };

  // --- Voice Note Recording Handlers ---
  const startRecording = async () => {
    setAnalysisError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlobObj = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlobObj);
        const url = URL.createObjectURL(audioBlobObj);
        setAudioUrl(url);

        // Convert Blob to base64 for Gemini
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result?.toString();
          setAudioBase64(base64String?.split(",")[1] || null);
        };
        reader.readAsDataURL(audioBlobObj);

        // Close mic tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
      setAnalysisError("Microphone access denied. Please write your report or check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const togglePlayback = () => {
    if (audioPlayerRef.current) {
      if (playbackActive) {
        audioPlayerRef.current.pause();
        setPlaybackActive(false);
      } else {
        audioPlayerRef.current.play();
        setPlaybackActive(true);
      }
    }
  };

  const clearAudio = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioBase64(null);
    setPlaybackActive(false);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageBase64(null);
  };

  // --- Start Vision Streaming Character Character Typing Effect ---
  const startVisionAnalysisStreaming = (result: VisionAnalysisResult) => {
    setImageAnalysisStage("streaming");
    setStreamedVisionAnalysis({});
    
    let currentCategory = "";
    let currentDepartment = "";
    let currentSummary = "";
    let currentHazards: string[] = [];
    
    // Stage 1: stream category
    let index = 0;
    const catInterval = setInterval(() => {
      if (index < result.category.length) {
        currentCategory += result.category[index];
        setStreamedVisionAnalysis(prev => ({ ...prev, category: currentCategory }));
        index++;
      } else {
        clearInterval(catInterval);
        
        // Stage 2: set severity and stream department
        setStreamedVisionAnalysis(prev => ({ ...prev, severity: result.severity }));
        let deptIndex = 0;
        const deptInterval = setInterval(() => {
          if (deptIndex < result.department.length) {
            currentDepartment += result.department[deptIndex];
            setStreamedVisionAnalysis(prev => ({ ...prev, department: currentDepartment }));
            deptIndex++;
          } else {
            clearInterval(deptInterval);
            
            // Stage 3: set confidence and stream hazards one by one
            setStreamedVisionAnalysis(prev => ({ ...prev, confidence: result.confidence }));
            let hazardIndex = 0;
            const hazardInterval = setInterval(() => {
              if (hazardIndex < result.hazards.length) {
                currentHazards = [...currentHazards, result.hazards[hazardIndex]];
                setStreamedVisionAnalysis(prev => ({ ...prev, hazards: currentHazards }));
                hazardIndex++;
              } else {
                clearInterval(hazardInterval);
                
                // Stage 4: stream summary word by word
                const summaryWords = result.summary.split(" ");
                let wordIndex = 0;
                const summaryInterval = setInterval(() => {
                  if (wordIndex < summaryWords.length) {
                    currentSummary += (wordIndex === 0 ? "" : " ") + summaryWords[wordIndex];
                    setStreamedVisionAnalysis(prev => ({ ...prev, summary: currentSummary }));
                    wordIndex++;
                  } else {
                    clearInterval(summaryInterval);
                    setImageAnalysisStage("complete");
                  }
                }, 40); // speed of typing words
              }
            }, 300); // delay between hazards
          }
        }, 15); // speed of typing department
      }
    }, 20); // speed of typing category
  };

  // --- Call Gemini backend analyzer ---
  const handleAnalyzeWithAI = async () => {
    if (!textDescription && !imageBase64 && !audioBase64) {
      setAnalysisError("Please provide some details: write some text, upload an image, or record a voice note.");
      return;
    }

    setAnalyzing(true);
    setAnalysisError("");
    setAiAnalyzed(false);
    setVisionAnalysis(null);
    setStreamedVisionAnalysis({});
    setImageAnalysisStage("idle");

    let stepInterval: any = null;
    if (imageBase64) {
      setImageAnalysisStage("scanning");
      const steps = [
        "Initializing camera frame analyzer...",
        "Identifying physical pavement distress contours...",
        "Locating municipal safety hazard clusters...",
        "Evaluating structural threat levels...",
        "Routing to responsible city departments...",
        "Synthesizing inspector analysis report..."
      ];
      let stepIdx = 0;
      setVisionStreamingStep(steps[0]);
      stepInterval = setInterval(() => {
        stepIdx = (stepIdx + 1) % steps.length;
        setVisionStreamingStep(steps[stepIdx]);
      }, 1500);
    }

    try {
      // 1. If there's an image, run the dedicated image vision analyzer first
      let visionResult: VisionAnalysisResult | null = null;
      if (imageBase64) {
        try {
          const visionRes = await fetch("/api/analyze-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image: imageBase64,
              imageMimeType: imageFile?.type || "image/jpeg"
            })
          });
          const visionData = await visionRes.json();
          if (visionData.success && visionData.analysis) {
            visionResult = visionData.analysis;
            setVisionAnalysis(visionResult);
            if (stepInterval) clearInterval(stepInterval);
            // Start the streaming typing animation
            startVisionAnalysisStreaming(visionResult!);
          } else {
            console.warn("Vision analysis endpoint failed, falling back to general analyzer.");
          }
        } catch (vErr) {
          console.error("Error during image vision analysis endpoint call:", vErr);
        }
      }

      // 2. Call the multi-modal civic intelligence analyzer
      const response = await fetch("/api/analyze-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textDescription,
          image: imageBase64,
          imageMimeType: imageFile?.type || "image/jpeg",
          audio: audioBase64,
          audioMimeType: "audio/webm",
          latitude: lat,
          longitude: lng
        })
      });

      const data = await response.json();
      if (data.success && data.analysis) {
        // Validate and normalize into canonical CivicIntelligenceResult
        const normalized = validateAndNormalizeCivicIntelligence(data.analysis, {
          text: textDescription,
          category: (visionResult?.category as any) || category,
          locationName: locationName
        });

        setCivicIntelligence(normalized);
        setTitle(normalized.title || "New Civic Report");
        setCategory(normalized.category);
        setUrgency(normalized.urgency);
        setSeverity(normalized.severity);
        setSeverityRationale(normalized.severityRationale);
        setHazards(normalized.hazards);
        setSuggestedDepartment(normalized.suggestedDepartment);
        setSuggestedSLAHours(normalized.suggestedSLAHours);
        setAiSummary(normalized.aiSummary);
        setConfidence(normalized.confidence);
        setDuplicateProbability(normalized.duplicateProbability || 0);
        setPossibleDuplicates(normalized.possibleDuplicates || []);
        setDuplicateRationale(normalized.duplicateRationale || "");

        if (normalized.locationName && normalized.locationName !== "Bengaluru Civic Center") {
          setLocationName(normalized.locationName);
        }

        // Build a comprehensive description
        let finalDesc = normalized.description || textDescription;
        if (visionResult && !finalDesc.includes("[Visual Hazards Identified]")) {
          finalDesc = `${visionResult.summary}\n\n[Visual Hazards Identified]\n• ${visionResult.hazards.join("\n• ")}\n\n[Citizen Notes]\n${textDescription || "No notes entered."}`;
        }
        setDescription(finalDesc);

        // Build dispatch recommendations
        let finalAction = normalized.recommendedAction || "Inspect site and schedule resolution.";
        if (visionResult?.department && !finalAction.includes("[Route to:")) {
          finalAction = `[Route to: ${visionResult.department}] ${finalAction}`;
        }
        setRecommendedAction(finalAction);

        if ((normalized.duplicateProbability && normalized.duplicateProbability >= 0.5) || (normalized.possibleDuplicates && normalized.possibleDuplicates.length > 0)) {
          setShowDuplicateWarning(true);
        }

        setIsSimulatedResponse(Boolean(data.simulated || visionResult?.simulated || normalized.simulated));
        
        // If there is NO image, we directly move to final form
        if (!imageBase64) {
          setAiAnalyzed(true);
        }
      } else {
        throw new Error(data.error || "Failed to analyze layout.");
      }
    } catch (err: any) {
      console.error(err);
      if (stepInterval) clearInterval(stepInterval);
      setAnalysisError("Gemini analysis error: " + (err.message || "Please complete details manually below."));
      setAiAnalyzed(true);
    } finally {
      if (stepInterval) clearInterval(stepInterval);
      setAnalyzing(false);
    }
  };

  // Render the Vision Streaming Card
  const renderVisionStreamingCard = () => {
    if (imageAnalysisStage === "idle") return null;

    const isScanning = imageAnalysisStage === "scanning";
    const data = streamedVisionAnalysis;

    // Severity styling helpers
    const getSeverityStyles = (sev?: number) => {
      if (!sev) return { text: "text-slate-450", bg: "bg-slate-800", label: "Pending" };
      if (sev >= 5) return { text: "text-rose-400", bg: "bg-rose-950/50 border border-rose-900/30", label: "Critical Hazard" };
      if (sev >= 4) return { text: "text-orange-400", bg: "bg-orange-950/50 border border-orange-900/30", label: "High Urgency" };
      if (sev >= 3) return { text: "text-amber-400", bg: "bg-amber-950/50 border border-amber-900/30", label: "Moderate Risk" };
      return { text: "text-emerald-400", bg: "bg-emerald-950/50 border border-emerald-900/30", label: "Low Impact" };
    };

    const sevStyles = getSeverityStyles(data.severity);

    return (
      <div className="p-5 bg-slate-950 text-slate-100 rounded-2xl border border-slate-850 shadow-2xl relative overflow-hidden flex flex-col gap-4 animate-scale-up" id="vision-streaming-card">
        {/* Pulsing Scanner Light Effect */}
        {isScanning && (
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-scanner-beam"></div>
        )}

        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-850 pb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isScanning ? "bg-blue-500 animate-pulse" : "bg-emerald-500 animate-pulse"}`}></div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Gemini 2.5 Vision Feed</span>
          </div>
          {isScanning ? (
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-blue-400 bg-blue-950/40 border border-blue-900/30 px-2 py-0.5 rounded-full font-bold">
              <Loader2 className="w-3 h-3 animate-spin" />
              SCANNING IN PROGRESS
            </div>
          ) : (
            <div className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <Check className="w-3 h-3" />
              ANALYSIS STREAMED
            </div>
          )}
        </div>

        {/* Scan Status / Steps */}
        {isScanning ? (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
            {imagePreview && (
              <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-800 shadow-lg">
                <img src={imagePreview} className="w-full h-full object-cover opacity-80" alt="Scan preview" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                {/* Horizontal Scanning Line */}
                <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_10px_#3b82f6] animate-scanner-down"></div>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-200">{t("Processing Image Proof...")}</p>
              <p className="text-xs text-slate-400 font-mono animate-pulse">{visionStreamingStep}</p>
            </div>
            
            {/* Live Streaming Confidence Progress Bar */}
            <div className="w-full max-w-xs space-y-2 mt-2 bg-slate-900/40 p-3 rounded-xl border border-slate-850/80">
              <div className="flex justify-between items-center text-[10px] font-mono font-bold">
                <span className="text-slate-450">STREAMING CONFIDENCE</span>
                <span className="text-blue-400 font-black tracking-wide animate-pulse">{animatingConfidence}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/60 relative">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 rounded-full"
                  style={{ width: `${animatingConfidence}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs font-medium">
            {/* Split layout for metadata */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* Category */}
              <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-850">
                <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase mb-1">Identified Category</span>
                {data.category ? (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-scale-up">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                    {t(data.category)}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-600 animate-pulse">Classifying...</span>
                )}
              </div>

              {/* Severity */}
              <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-850">
                <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase mb-1">Hazard Severity</span>
                {data.severity !== undefined ? (
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${sevStyles.bg} ${sevStyles.text}`}>
                      Lvl {data.severity}/5
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{sevStyles.label}</span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-slate-600 animate-pulse">Calculating...</span>
                )}
              </div>
            </div>

            {/* Department Assignment */}
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-850 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase mb-1">Responsible Municipal Division</span>
                  {data.department ? (
                    <span className="text-xs font-bold text-slate-200">{data.department}</span>
                  ) : (
                    <span className="text-xs font-bold text-slate-600 animate-pulse">Determining jurisdiction...</span>
                  )}
                </div>
                {animatingConfidence > 0 && (
                  <div className="text-right">
                    <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase mb-1">AI Confidence</span>
                    <span className="text-xs font-mono font-extrabold text-teal-400">{animatingConfidence}%</span>
                  </div>
                )}
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800/40">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-teal-400 transition-all duration-500 rounded-full"
                  style={{ width: `${animatingConfidence}%` }}
                />
              </div>
            </div>

            {/* Identified Hazards */}
            <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-850">
              <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase mb-1.5">Immediate Environmental Hazards</span>
              {data.hazards && data.hazards.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.hazards.map((hazard, index) => (
                    <span key={index} className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-950/40 text-rose-300 border border-rose-900/40 rounded-lg text-[10px] font-semibold animate-scale-up">
                      <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
                      {hazard}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs font-bold text-slate-600 animate-pulse">Running risk assessment...</span>
              )}
            </div>

            {/* Summary */}
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-850 relative">
              <span className="block text-[9px] font-mono font-bold text-slate-500 uppercase mb-1.5">AI Inspector Summary</span>
              {data.summary ? (
                <p className="text-xs font-medium text-slate-300 leading-relaxed italic pr-4">
                  "{data.summary}"
                </p>
              ) : (
                <p className="text-xs font-medium text-slate-600 animate-pulse">Drafting structural executive brief...</p>
              )}
            </div>
          </div>
        )}

        {/* Actions inside Streaming Card */}
        {imageAnalysisStage === "complete" && (
          <div className="mt-2 pt-3 border-t border-slate-850 flex items-center justify-between gap-3">
            <span className="text-[10px] font-mono text-slate-500 font-bold">Press Proceed to edit details</span>
            <button
              type="button"
              onClick={() => setAiAnalyzed(true)}
              className="py-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-all shadow-md shadow-blue-900/30 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
              id="proceed-to-form-btn"
            >
              <span>{t("Proceed to Review Form")}</span>
              <Send className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  // --- Hazard tag handlers ---
  const handleAddHazard = () => {
    if (!newHazardInput.trim()) return;
    const cleanTag = newHazardInput.trim();
    if (!hazards.includes(cleanTag)) {
      setHazards([...hazards, cleanTag]);
    }
    setNewHazardInput("");
  };

  const handleRemoveHazard = (hazardToRemove: string) => {
    setHazards(hazards.filter((h) => h !== hazardToRemove));
  };

  // --- Duplicate Verification Handlers ---
  const handleVerifyExistingIssue = async (existingIssueId: string) => {
    setVerifyingExistingId(existingIssueId);
    setVerifySuccessMessage(null);
    try {
      let currentUser = auth.currentUser;
      if (!currentUser && isSampleTestMode) {
        try {
          const userCredential = await signInAnonymously(auth);
          currentUser = userCredential.user as any;
          if (currentUser) {
            await getOrCreateUserProfile(currentUser);
          }
        } catch (authErr) {
          console.error("Auto guest login during test mode failed:", authErr);
        }
      }

      if (!currentUser) {
        alert("Please sign in or enter as Guest to verify reports!");
        setVerifyingExistingId(null);
        return;
      }

      await verifyIssue(existingIssueId, currentUser.uid);
      setVerifySuccessMessage("Thank you! Your verification has been recorded (+25 XP awarded).");
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error("Verification error:", err);
      alert(err.message || "Failed to verify existing report.");
      setVerifyingExistingId(null);
    }
  };

  // --- Submit Finished Report to Firestore ---
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let currentUser = auth.currentUser;
    if (!currentUser && isSampleTestMode) {
      try {
        const userCredential = await signInAnonymously(auth);
        currentUser = userCredential.user as any;
        if (currentUser) {
          await getOrCreateUserProfile(currentUser);
        }
      } catch (authErr) {
        console.error("Auto guest login during test mode failed:", authErr);
      }
    }

    if (!currentUser) {
      alert("Please sign in or enter as Guest to submit reports!");
      return;
    }

    try {
      await reportIssue({
        title: (title || "New civic report").substring(0, 150),
        description: (description || textDescription || "No detailed description provided.").substring(0, 4500),
        category,
        urgency,
        locationName: (locationName || "Bengaluru").substring(0, 800),
        latitude: Number(lat),
        longitude: Number(lng),
        reportedBy: currentUser.uid,
        reportedByName: (currentUser.displayName || "Anonymous Hero").substring(0, 95),
        imageUrl: imagePreview || undefined,
        voiceUrl: audioUrl || undefined,
        severity: severity,
        severityRationale: severityRationale || undefined,
        department: suggestedDepartment,
        assignedDepartment: suggestedDepartment,
        hazards: hazards.length > 0 ? hazards : undefined,
        aiConfidence: confidence,
        aiSummary: aiSummary || undefined
      });

      if (isSampleTestMode) {
        setTestStep("complete");
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      alert("Submission error: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in" id="report-modal-overlay">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 flex flex-col" id="report-modal-container">
        
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">{t("File a Civic Report")}</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                {(() => {
                  const neighborhood = getNeighborhood(lat, lng);
                  if (neighborhood) {
                    return `📍 ${neighborhood}, Bengaluru`;
                  }
                  return "📍 Bengaluru, Karnataka";
                })()}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            id="report-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 flex-1">

          {/* Interactive Simulation Test Banner */}
          {isSampleTestMode && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 shadow-lg" id="simulation-onboarding-panel">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-400 tracking-wider font-mono">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  GEMINI AI LIVE DEMONSTRATION
                </span>
                <span className="text-[10px] bg-blue-950/40 text-blue-400 font-mono font-bold px-2 py-0.5 rounded border border-blue-900/50">
                {testStep === "welcome" && "DEMO: READY"}
                {testStep === "attaching" && "STAGE: ATTACHING EVIDENCE"}
                {testStep === "typing" && "STAGE: ENTERING DESCRIPTION"}
                {testStep === "analyzing" && "STAGE: GEMINI AI INSPECTION"}
                {testStep === "review" && "STAGE: VERIFY & SUBMIT"}
                {testStep === "complete" && "STAGE: SUCCESSFUL SUBMISSION"}
              </span>
            </div>
            
            <div className="text-xs text-slate-300 font-medium leading-relaxed">
              {testStep === "welcome" && "Let's run a simulated test of the civic submission process. This automated tool will demonstrate how citizens attach photos, describe issues, and let Gemini AI automatically categorize and assess reports before live database submission."}
              {testStep === "attaching" && "📷 Simulating high-fidelity evidence collection... Attaching a photo of a broken streetlight."}
              {testStep === "typing" && "✍️ Entering citizen detailed report description... Simulating real-time keyboard inputs."}
              {testStep === "analyzing" && "🤖 Activating Multimodal Gemini AI inspector... Analyzing physical evidence, identifying crosswalk hazards, and routing to BESCOM / BBMP division."}
              {testStep === "review" && "✅ AI analysis complete! The review form below is prefilled. Inspect the details, then click the glowing 'Submit Civic Report' button below to execute a real submission."}
              {testStep === "complete" && "🎉 Civic report submitted successfully! High-Fidelity issue reported on the map with active GPS tracking and +50 XP awarded to user score."}
            </div>

              {testStep === "welcome" ? (
                <button
                  type="button"
                  onClick={startAutoSimulation}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-blue-950/50 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Play className="w-3.5 h-3.5" fill="currentColor" />
                  Start Automated Test Walkthrough
                </button>
              ) : (
                <div className="space-y-1.5">
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{
                        width: 
                          testStep === "attaching" ? "25%" : 
                          testStep === "typing" ? "50%" : 
                          testStep === "analyzing" ? "75%" : "100%"
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono font-bold text-slate-500">
                    <span>Evidence</span>
                    <span>Description</span>
                    <span>AI Inspect</span>
                    <span>Submit</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 1: Citizen inputs (Multimodal) */}
          {!aiAnalyzed && (
            <div className="space-y-4" id="multimodal-inputs-container">
              {imageAnalysisStage !== "idle" ? (
                /* Display Streaming Card while processing / completed */
                <div className="space-y-4">
                  {renderVisionStreamingCard()}
                  
                  {/* Option to clear/reset vision stage if they want to go back */}
                  {imageAnalysisStage === "complete" && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageAnalysisStage("idle");
                        setVisionAnalysis(null);
                        setStreamedVisionAnalysis({});
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 underline block text-center w-full"
                    >
                      {t("← Re-upload or edit inputs")}
                    </button>
                  )}
                </div>
              ) : (
                /* Regular Citizen Inputs */
                <>
                  <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start gap-3">
                    <Wand2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-800 leading-relaxed font-medium">
                      <span className="font-bold block text-blue-900 mb-0.5">{t("Gemini Multimodal Reporter")}</span>
                      {t("You can upload a photo of the issue, record an audio description, or type what you see. The Gemini API will automatically categorize, name, and assess the urgency of the report.")}
                    </div>
                  </div>

                  {/* Text Description */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("What is the issue? (Optional if uploading photo or voice)")}</label>
                      <button
                        type="button"
                        onClick={() => handleDictate(setTextDescription)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                          isSTTActive
                            ? "bg-rose-100 text-rose-700 border-rose-200 animate-pulse"
                            : "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-100"
                        }`}
                      >
                        <Mic className="w-3 h-3" />
                        <span>{isSTTActive ? t("Listening...") : t("Dictate")}</span>
                      </button>
                    </div>
                    <textarea
                      value={textDescription}
                      onChange={(e) => setTextDescription(e.target.value)}
                      placeholder={t("Describe what you see (e.g. 'There's a deep pothole near Indiranagar 100 Feet Road, water is pooling around it and two-wheelers are swerving...')")}
                      rows={3}
                      className="w-full p-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                    />
                    {sttError && <p className="text-[10px] text-rose-500 font-medium mt-1">{sttError}</p>}
                  </div>

                  {/* Multimodal uploads Grid (Image + Audio) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Image upload (Drag & Drop + Input Click) */}
                    <div 
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all ${
                        isDragging 
                          ? "border-blue-500 bg-blue-50/30" 
                          : imagePreview 
                            ? "border-gray-200 bg-gray-50/20" 
                            : "border-gray-200 hover:border-blue-400 hover:bg-slate-50/50"
                      }`}
                      id="image-dropzone"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        className="hidden"
                        id="image-upload-input"
                      />

                      {imagePreview ? (
                        <div className="relative w-full max-h-36 overflow-hidden rounded-lg group">
                          <img 
                            src={imagePreview} 
                            alt="Issue Preview" 
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <button 
                              type="button"
                              onClick={clearImage}
                              className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => fileInputRef.current?.click()} 
                          className="cursor-pointer py-4 w-full flex flex-col items-center"
                        >
                          <UploadCloud className="w-8 h-8 text-gray-400 mb-2 group-hover:text-blue-500" />
                          <span className="text-xs font-bold text-gray-700">{t("Add Photo Evidence")}</span>
                          <p className="text-[10px] text-gray-400 mt-1">{t("Drag and drop or click to upload")}</p>
                        </div>
                      )}
                    </div>

                    {/* Voice note recorder (Web Audio / MediaRecorder) */}
                    <div className="border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center bg-slate-50/40">
                      <span className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                        <Mic className="w-4 h-4 text-blue-600" />
                        {t("Record Voice Note")}
                      </span>

                      {isRecording ? (
                        <div className="flex flex-col items-center gap-2 py-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-rose-600 rounded-full animate-ping"></span>
                            <span className="text-xs font-bold text-rose-600">{t("Recording live mic...")}</span>
                          </div>
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="py-1.5 px-3 bg-slate-800 text-white rounded-lg flex items-center gap-1.5 hover:bg-slate-900 transition-colors shadow-xs cursor-pointer text-xs font-semibold"
                          >
                            <Square className="w-3.5 h-3.5 fill-white" />
                            {t("Stop Recording")}
                          </button>
                        </div>
                      ) : audioUrl ? (
                        <div className="flex flex-col items-center gap-3 w-full">
                          <div className="flex items-center justify-between gap-3 p-2 bg-white rounded-lg border border-gray-100 w-full">
                            <button
                              type="button"
                              onClick={togglePlayback}
                              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Play className="w-4 h-4 fill-blue-600" />
                            </button>
                            <audio 
                              ref={audioPlayerRef} 
                              src={audioUrl} 
                              onEnded={() => setPlaybackActive(false)}
                              className="hidden" 
                            />
                            <span className="text-[10px] font-mono text-gray-400 font-bold">voice_note.webm</span>
                            <button
                              type="button"
                              onClick={clearAudio}
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 transition-colors shadow-sm cursor-pointer text-xs font-bold"
                        >
                          <Mic className="w-4 h-4" />
                          {t("Start Mic Recording")}
                        </button>
                      )}
                      <p className="text-[9px] text-gray-400 text-center mt-3 leading-relaxed">{t("Speak and describe the issue out loud instead of writing it!")}</p>
                    </div>

                  </div>

                  {analysisError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span className="text-xs font-medium text-rose-600 leading-relaxed">{analysisError}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setAiAnalyzed(true)} // skip to manual entry
                      className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {t("Write Manually Instead")}
                    </button>

                    <button
                      type="button"
                      onClick={handleAnalyzeWithAI}
                      disabled={analyzing || (!textDescription && !imageBase64 && !audioBase64)}
                      className="py-2.5 px-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 text-white font-bold rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer text-sm"
                      id="ai-analyze-btn"
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t("Gemini Analyzing...")}
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          {t("Analyze with Gemini AI")}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Section 2: Review Form / Manual details (Post AI or Direct Manual) */}
          {aiAnalyzed && (
            <div className="space-y-5 animate-scale-up" id="final-report-container">
              
              {/* Success notification if existing report verified */}
              {verifySuccessMessage && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-200 animate-fade-in" id="verify-success-toast">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="text-xs font-semibold">{verifySuccessMessage}</div>
                </div>
              )}

              {/* Duplicate Detection Warning Banner */}
              {showDuplicateWarning && possibleDuplicates.length > 0 && !verifySuccessMessage && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700/60 rounded-2xl space-y-3.5 shadow-sm" id="duplicate-warning-banner">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          {t("Potential Existing Issue Detected")} ({Math.round(duplicateProbability * 100)}% {t("match")})
                        </h4>
                        <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 font-medium">
                          {duplicateRationale || t("An active report with matching location and category was found nearby.")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* List of matched existing issues */}
                  <div className="space-y-2">
                    {possibleDuplicates.map((dup) => (
                      <div key={dup.id} className="p-3 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-gray-900 dark:text-slate-100 truncate">{dup.title}</span>
                            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 rounded-md">
                              {dup.category}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md">
                              {dup.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-slate-400">
                            <span>📍 ~{dup.distanceMeters}m away</span>
                            {dup.verificationsCount !== undefined && (
                              <span>• {dup.verificationsCount} verified</span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={verifyingExistingId === dup.id}
                          onClick={() => handleVerifyExistingIssue(dup.id)}
                          className="shrink-0 py-2 px-3.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                          id={`verify-existing-btn-${dup.id}`}
                        >
                          {verifyingExistingId === dup.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>{t("Verifying...")}</span>
                            </>
                          ) : (
                            <>
                              <ThumbsUp className="w-3.5 h-3.5" />
                              <span>{t("Verify Existing")} (+25 XP)</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <span className="text-amber-800 dark:text-amber-400 font-medium">
                      {t("Is this a completely separate incident?")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDuplicateWarning(false)}
                      className="font-bold text-amber-900 dark:text-amber-200 hover:underline cursor-pointer"
                    >
                      {t("Proceed with New Report")} →
                    </button>
                  </div>
                </div>
              )}

              {/* Gemini Civic Guardian — AI Advisory Intelligence Card */}
              {(title || severityRationale || aiSummary) && (
                <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-md space-y-3.5" id="ai-civic-intelligence-card">
                  {/* Card Header & Confidence Gauge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-950/60 border border-blue-800/50 rounded-lg text-blue-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-100">{t("Civic Guardian AI Advisory")}</span>
                          {isSimulatedResponse && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-amber-950/60 text-amber-400 border border-amber-800/40 rounded font-semibold">
                              SIMULATED
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {getAIConfidenceDescription(confidence)}
                        </p>
                      </div>
                    </div>

                    {/* Calibrated Confidence Badge */}
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                        getAIConfidenceLevel(confidence) === "High"
                          ? "bg-emerald-950/50 text-emerald-300 border-emerald-800/50"
                          : getAIConfidenceLevel(confidence) === "Moderate"
                          ? "bg-amber-950/50 text-amber-300 border-amber-800/50"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          getAIConfidenceLevel(confidence) === "High"
                            ? "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                            : getAIConfidenceLevel(confidence) === "Moderate"
                            ? "bg-amber-400"
                            : "bg-slate-400"
                        }`} />
                        {getAIConfidenceLevel(confidence)} Confidence ({Math.round(confidence * 100)}%)
                      </span>
                    </div>
                  </div>

                  {/* Grid: Severity + Department SLA */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Severity Level (1 to 5) */}
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">{t("Hazard Severity")}</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          severity >= 5 ? "bg-rose-950/60 text-rose-300 border border-rose-800/50" :
                          severity >= 4 ? "bg-orange-950/60 text-orange-300 border border-orange-800/50" :
                          severity >= 3 ? "bg-amber-950/60 text-amber-300 border border-amber-800/50" :
                          "bg-emerald-950/60 text-emerald-300 border border-emerald-800/50"
                        }`}>
                          Lvl {severity}/5 • {
                            severity >= 5 ? "Critical Hazard" :
                            severity >= 4 ? "High Urgency" :
                            severity >= 3 ? "Moderate Risk" :
                            "Low Impact"
                          }
                        </span>
                      </div>

                      {/* Visual segmented level bar */}
                      <div className="grid grid-cols-5 gap-1 pt-1">
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <div
                            key={lvl}
                            className={`h-1.5 rounded-full transition-all ${
                              lvl <= severity
                                ? lvl >= 5 ? "bg-rose-500"
                                : lvl >= 4 ? "bg-orange-500"
                                : lvl >= 3 ? "bg-amber-500"
                                : "bg-emerald-500"
                                : "bg-slate-800"
                            }`}
                          />
                        ))}
                      </div>

                      {severityRationale && (
                        <p className="text-[10px] text-slate-400 italic pt-1 leading-snug">
                          {severityRationale}
                        </p>
                      )}
                    </div>

                    {/* Department & SLA Routing */}
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">{t("Suggested Jurisdiction & SLA")}</span>
                      <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-200 bg-slate-800 px-2.5 py-1 rounded-lg">
                          <Building2 className="w-3.5 h-3.5 text-blue-400" />
                          {suggestedDepartment}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-teal-300 bg-teal-950/50 border border-teal-800/40 px-2 py-1 rounded-lg">
                          <Clock className="w-3 h-3 text-teal-400" />
                          {suggestedSLAHours}h SLA Target
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-500 pt-0.5">
                        {t("AI Advisory: Subject to official municipal verification.")}
                      </p>
                    </div>
                  </div>

                  {/* Environmental Hazards Tags */}
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">{t("Environmental Hazards Identified")}</span>
                      <span className="text-[10px] text-slate-500">{hazards.length} {t("detected")}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {hazards.map((hz, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-950/40 text-rose-200 border border-rose-900/40 rounded-lg text-xs font-medium">
                          <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                          <span>{hz}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveHazard(hz)}
                            className="text-rose-400 hover:text-rose-200 ml-0.5 cursor-pointer"
                            title="Remove hazard tag"
                          >
                            ×
                          </button>
                        </span>
                      ))}

                      {/* Add Hazard Mini-Input */}
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="text"
                          value={newHazardInput}
                          onChange={(e) => setNewHazardInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddHazard();
                            }
                          }}
                          placeholder={t("+ Add hazard...")}
                          className="text-[11px] px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-28"
                        />
                        {newHazardInput && (
                          <button
                            type="button"
                            onClick={handleAddHazard}
                            className="p-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Executive Brief */}
                  {aiSummary && (
                    <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/80">
                      <span className="block text-[10px] font-mono uppercase text-slate-500 font-bold mb-1">{t("Executive Brief")}</span>
                      <p className="text-xs text-slate-300 italic leading-relaxed">
                        "{aiSummary}"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Form for final submission */}
              <form onSubmit={handleFinalSubmit} className="space-y-4" id="final-report-form">
                {/* Title Input */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">{t("Issue Title")}</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("e.g. Major Water Pipe Leak")}
                    className="w-full p-3 text-sm border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Category + Urgency Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">{t("Category")}</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as CivicIssue["category"])}
                      className="w-full p-3 text-sm border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="Pothole">{t("Pothole")}</option>
                      <option value="Water Leak">{t("Water Leak")}</option>
                      <option value="Broken Streetlight">{t("Broken Streetlight")}</option>
                      <option value="Trash & Dumping">{t("Trash & Dumping")}</option>
                      <option value="Graffiti">{t("Graffiti")}</option>
                      <option value="Other">{t("Other")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">{t("Urgency Level")}</label>
                    <select
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value as CivicIssue["urgency"])}
                      className="w-full p-3 text-sm border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    >
                      <option value="Low">{t("Low")}</option>
                      <option value="Medium">{t("Medium")}</option>
                      <option value="High">{t("High")}</option>
                      <option value="Critical">{t("Critical")}</option>
                    </select>
                  </div>
                </div>

                {/* Location Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">{t("Location / Address")}</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-blue-600" />
                    <input
                      type="text"
                      required
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      placeholder={t("e.g. Indiranagar 100 Feet Rd and 12th Main")}
                      className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                {/* Detailed Description */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider">{t("Description")}</label>
                    <button
                      type="button"
                      onClick={() => handleDictate(setDescription)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        isSTTActive
                          ? "bg-rose-100 text-rose-700 border-rose-200 animate-pulse"
                          : "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                      }`}
                    >
                      <Mic className="w-3 h-3" />
                      <span>{isSTTActive ? t("Listening...") : t("Dictate")}</span>
                    </button>
                  </div>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("Provide precise details of the issue...")}
                    rows={4}
                    className="w-full p-3 text-sm border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Recommended Action */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">{t("Dispatch Recommendations (For Civil Crews)")}</label>
                  <input
                    type="text"
                    value={recommendedAction}
                    onChange={(e) => setRecommendedAction(e.target.value)}
                    placeholder={t("e.g. Seal the leaking pipe valve")}
                    className="w-full p-3 text-sm border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50 dark:bg-slate-800/50"
                  />
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAiAnalyzed(false);
                    }}
                    className="text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    ← {t("Go Back")}
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="py-2.5 px-4 text-xs font-bold text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    >
                      {t("Cancel")}
                    </button>

                    <button
                      type="submit"
                      className={`py-2.5 px-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer text-sm ${
                        isSampleTestMode && testStep === "review"
                          ? "ring-4 ring-amber-500 animate-pulse shadow-lg shadow-amber-500/20"
                          : "shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                      }`}
                      id="submit-report-final"
                    >
                      <Send className="w-4 h-4" />
                      {t("Submit Civic Report")} (+50 XP)
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
