import React, { useState } from "react";
import { CivicIssue } from "../types";
import { updateIssueStatus } from "../lib/firebase";
import { 
  ShieldAlert, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Activity, 
  FileText, 
  User, 
  Navigation, 
  AlertTriangle,
  Loader2,
  Sparkles,
  ClipboardList,
  Wrench,
  CheckCircle2,
  MapPin,
  TrendingUp,
  Inbox,
  ChevronRight
} from "lucide-react";

interface OfficialDashboardProps {
  issues: CivicIssue[];
  onSelectIssueOnMap: (issue: CivicIssue) => void;
  language: string;
  isJoined?: boolean;
}

export default function OfficialDashboard({ 
  issues, 
  onSelectIssueOnMap,
  language,
  isJoined = true
}: OfficialDashboardProps) {
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [officialResponse, setOfficialResponse] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all-pending");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");

  const selectedIssue = issues.find(i => i.id === selectedIssueId);

  // Filter issues for priority queue
  const filteredIssues = issues.filter(issue => {
    // Priority filters
    if (statusFilter === "all-pending") {
      if (issue.status === "Resolved" || issue.status === "Fix Completed") return false;
    } else if (statusFilter !== "all" && issue.status !== statusFilter) {
      return false;
    }

    if (urgencyFilter !== "all" && issue.urgency !== urgencyFilter) {
      return false;
    }

    return true;
  });

  // Sort queue by priority score (Urgency + Verifications Count)
  const getPriorityScore = (issue: CivicIssue) => {
    let score = (issue.verificationsCount || 0) * 10;
    if (issue.urgency === "Critical") score += 100;
    else if (issue.urgency === "High") score += 50;
    else if (issue.urgency === "Medium") score += 20;
    return score;
  };

  const sortedIssues = [...filteredIssues].sort((a, b) => getPriorityScore(b) - getPriorityScore(a));

  // Stats Counters
  const pendingCount = issues.filter(i => i.status === "Reported" || i.status === "Verified").length;
  const scheduledCount = issues.filter(i => i.status === "Repair Scheduled" || i.status === "In Progress").length;
  const completedCount = issues.filter(i => i.status === "Fix Completed" || i.status === "Resolved").length;

  const handleUpdateStatus = async (newStatus: CivicIssue["status"]) => {
    if (!selectedIssueId) return;
    setIsUpdating(true);
    try {
      await updateIssueStatus(selectedIssueId, newStatus, officialResponse);
      // Success toast / event notification gets triggered
      const notificationEvent = new CustomEvent("new_official_notification", {
        detail: {
          title: "Status Updated Successfully",
          body: `Issue is now marked as "${newStatus}". Dispatch notifications sent to citizen.`,
          type: "success"
        }
      });
      window.dispatchEvent(notificationEvent);
      setOfficialResponse("");
    } catch (err: any) {
      console.error(err);
      const notificationEvent = new CustomEvent("new_official_notification", {
        detail: {
          title: "Update Failed",
          body: err.message || "An error occurred while updating status.",
          type: "error"
        }
      });
      window.dispatchEvent(notificationEvent);
    } finally {
      setIsUpdating(false);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "Critical":
        return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-350 dark:border-rose-900/40";
      case "High":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-350 dark:border-amber-900/40";
      case "Medium":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-350 dark:border-blue-900/40";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Reported":
        return "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/10 dark:text-rose-400";
      case "Verified":
        return "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/10 dark:text-amber-400";
      case "In Progress":
        return "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/10 dark:text-sky-400";
      case "Repair Scheduled":
        return "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/10 dark:text-indigo-400";
      case "Fix Completed":
        return "bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-950/10 dark:text-teal-400";
      case "Resolved":
        return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/10 dark:text-emerald-400";
      default:
        return "bg-slate-50 text-slate-750 border-slate-100";
    }
  };

  return (
    <div className="space-y-6" id="official-dashboard-workspace">
      
      {/* Top Welcome & Summary Bar */}
      <div className="p-6 bg-linear-to-r from-slate-900 to-slate-950 text-white rounded-2xl shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-mono font-bold uppercase rounded-full tracking-wider border border-blue-500/30">
                Official Government View
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">BBMP Portal Connected</span>
            </div>
            <h2 className="text-xl font-black tracking-tight">SAMRIDDHI PARIVAR Municipal Control</h2>
            <p className="text-xs text-slate-400 font-medium">Official triage console for rapid community repair dispatches</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-center min-w-[90px]">
              <span className="text-xs text-slate-400 block font-medium">Pending Action</span>
              <span className="text-xl font-black text-rose-400 font-mono">{pendingCount}</span>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-center min-w-[90px]">
              <span className="text-xs text-slate-400 block font-medium">Crews Dispatched</span>
              <span className="text-xl font-black text-amber-400 font-mono">{scheduledCount}</span>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-center min-w-[90px]">
              <span className="text-xs text-slate-400 block font-medium">Completed</span>
              <span className="text-xl font-black text-emerald-400 font-mono">{completedCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle: Priority Queue Triage */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Triage filters and queues list */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-colors duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-slate-500" />
                Priority Triage Queue
              </h3>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-150 dark:border-slate-700 rounded-xl outline-none cursor-pointer"
                >
                  <option value="all-pending">All Open / Active</option>
                  <option value="all">Show All Records</option>
                  <option value="Reported">Reported</option>
                  <option value="Verified">Verified</option>
                  <option value="Repair Scheduled">Repair Scheduled</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Fix Completed">Fix Completed</option>
                  <option value="Resolved">Resolved</option>
                </select>

                <select
                  value={urgencyFilter}
                  onChange={(e) => setUrgencyFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-150 dark:border-slate-700 rounded-xl outline-none cursor-pointer"
                >
                  <option value="all">All Urgencies</option>
                  <option value="Critical">Critical Only</option>
                  <option value="High">High Only</option>
                  <option value="Medium">Medium Only</option>
                  <option value="Low">Low Only</option>
                </select>
              </div>
            </div>

            {/* Sorted Issues Loop */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[580px] overflow-y-auto pr-1 mt-2">
              {sortedIssues.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                  <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {!isJoined ? "Sign In Required" : "Queue is Clear"}
                    </h4>
                    <p className="text-xs text-slate-450 dark:text-slate-500 mt-0.5 max-w-[280px] mx-auto">
                      {!isJoined 
                        ? "Please sign in or join to view active triage issues and municipal controls." 
                        : "No civic issues match the selected queue filters."}
                    </p>
                  </div>
                </div>
              ) : (
                sortedIssues.map((issue) => {
                  const isSelected = selectedIssueId === issue.id;
                  const priorityScore = getPriorityScore(issue);

                  return (
                    <div
                      key={issue.id}
                      onClick={() => {
                        setSelectedIssueId(issue.id);
                        onSelectIssueOnMap(issue);
                      }}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all ${
                        isSelected 
                          ? "bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-blue-600 pl-3" 
                          : "hover:bg-slate-50/80 dark:hover:bg-slate-850/50"
                      }`}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-1.5 py-0.5 text-[8px] font-extrabold uppercase rounded-md tracking-wider border ${getUrgencyBadge(issue.urgency)}`}>
                            {issue.urgency}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[8px] font-extrabold uppercase rounded-md border ${getStatusBadge(issue.status)}`}>
                            {issue.status}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 font-semibold">
                            {issue.category}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{issue.title}</h4>
                        
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {issue.locationName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(issue.reportedAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1 font-mono text-amber-600 dark:text-amber-400 font-bold">
                            ★ {issue.verificationsCount || 0} verifications
                          </span>
                        </div>
                      </div>

                      {/* Priority Score representation */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          <span className="text-[9px] font-mono text-slate-400 font-bold block">PRIORITY</span>
                          <span className={`text-xs font-black font-mono ${
                            priorityScore >= 100 ? "text-rose-600 dark:text-rose-400" :
                            priorityScore >= 50 ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
                          }`}>{priorityScore} XP</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Right: Detailed Dispatch & Triage Controls */}
        <div className="lg:col-span-1">
          {selectedIssue ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col gap-5 sticky top-24 transition-colors duration-300 animate-fade-in" id="official-dispatch-panel">
              
              {/* Issue Details Header */}
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">ID: {selectedIssue.id.substring(0, 10)}...</span>
                  <span className={`px-1.5 py-0.5 text-[8.5px] font-black rounded ${getStatusBadge(selectedIssue.status)}`}>
                    {selectedIssue.status}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1">{selectedIssue.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-3 font-medium">
                  {selectedIssue.description}
                </p>
              </div>

              {/* Media Attachment if present */}
              {selectedIssue.imageUrl && (
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Attached Evidence</span>
                  <img 
                    src={selectedIssue.imageUrl} 
                    alt="Evidence" 
                    referrerPolicy="no-referrer"
                    className="w-full h-32 object-cover rounded-xl border border-slate-100"
                  />
                </div>
              )}

              {/* Duplicate/Merged list if present */}
              {selectedIssue.relatedIssues && selectedIssue.relatedIssues.length > 0 && (
                <div className="bg-amber-50/50 dark:bg-amber-950/10 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Super-Report Active
                  </span>
                  <p className="text-[10px] text-amber-600/90 dark:text-amber-450 mt-1 leading-relaxed font-semibold">
                    Smart duplicates detected and auto-merged into this super-report.
                  </p>
                  <ul className="text-[9px] font-mono text-amber-500/80 dark:text-amber-500 mt-1.5 list-disc pl-4 space-y-0.5">
                    {selectedIssue.relatedIssues.map((ref, i) => (
                      <li key={i}>{ref}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Handoff Status controls */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                  Municipal Handoff & Dispatch
                </label>

                {/* Dispatch text log / crew assignment comments */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Official Response & Crew Logs</span>
                  <textarea
                    rows={3}
                    placeholder="E.g., Sector 4 crew dispatched. Repair scheduled for June 30th morning. Service Engineer: Mr. R. Kumar."
                    value={officialResponse}
                    onChange={(e) => setOfficialResponse(e.target.value)}
                    className="w-full p-2.5 text-xs text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-400 font-medium"
                  />
                </div>

                {/* Handoff actions buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpdateStatus("Repair Scheduled")}
                    disabled={isUpdating}
                    className="py-2.5 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-150 text-indigo-700 font-extrabold rounded-xl transition-all text-xs flex flex-col items-center justify-center gap-1 cursor-pointer border border-indigo-200/40 disabled:opacity-50"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Schedule Repair</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus("In Progress")}
                    disabled={isUpdating}
                    className="py-2.5 bg-sky-50 hover:bg-sky-100 active:bg-sky-150 text-sky-700 font-extrabold rounded-xl transition-all text-xs flex flex-col items-center justify-center gap-1 cursor-pointer border border-sky-200/40 disabled:opacity-50"
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Begin Work</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus("Fix Completed")}
                    disabled={isUpdating}
                    className="py-2.5 bg-teal-50 hover:bg-teal-100 active:bg-teal-150 text-teal-700 font-extrabold rounded-xl transition-all text-xs flex flex-col items-center justify-center gap-1 cursor-pointer border border-teal-200/40 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Fix Completed</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus("Resolved")}
                    disabled={isUpdating}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all text-xs flex flex-col items-center justify-center gap-1 cursor-pointer shadow-md shadow-emerald-900/10 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Resolve Issue</span>
                  </button>
                </div>

                {isUpdating && (
                  <div className="flex items-center justify-center gap-2 text-xs font-mono text-blue-500 py-1 font-bold animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>UPDATING DISPATCH STATE...</span>
                  </div>
                )}
              </div>

              {/* Show existing official logs */}
              {selectedIssue.officialResponse && (
                <div className="p-3 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-wider block">Official Dispatch Logs</span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed italic">
                    "{selectedIssue.officialResponse}"
                  </p>
                  {selectedIssue.officialResponseAt && (
                    <span className="text-[9px] font-mono text-slate-400 block mt-1">
                      Logged at: {new Date(selectedIssue.officialResponseAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )}

            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 shadow-xs text-center flex flex-col items-center justify-center gap-3 sticky top-24 min-h-[300px] transition-colors duration-300">
              <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-700 animate-pulse" />
              <div>
                <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">Select a Civic Issue</h4>
                <p className="text-xs text-slate-450 dark:text-slate-500 mt-1 max-w-[200px] mx-auto font-medium leading-relaxed">
                  Choose a ticket from the priority queue or interactive map to open dispatch controls.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
