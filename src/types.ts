export type IssueCategory =
  | "Pothole"
  | "Water Leak"
  | "Broken Streetlight"
  | "Trash & Dumping"
  | "Graffiti"
  | "Other";

export type IssueUrgency =
  | "Low"
  | "Medium"
  | "High"
  | "Critical";

export type IssueStatus =
  | "Reported"
  | "Verified"
  | "Assigned"
  | "In Progress"
  | "Repair Scheduled"
  | "Fix Completed"
  | "Resolved";

export type UserRole =
  | "Citizen"
  | "Official"
  | "Admin";

export type Department =
  | "BBMP"
  | "BWSSB"
  | "BESCOM"
  | "Other";

export const ISSUE_CATEGORIES: readonly IssueCategory[] = [
  "Pothole",
  "Water Leak",
  "Broken Streetlight",
  "Trash & Dumping",
  "Graffiti",
  "Other"
] as const;

export const ISSUE_URGENCIES: readonly IssueUrgency[] = [
  "Low",
  "Medium",
  "High",
  "Critical"
] as const;

export const ISSUE_STATUSES: readonly IssueStatus[] = [
  "Reported",
  "Verified",
  "Assigned",
  "In Progress",
  "Repair Scheduled",
  "Fix Completed",
  "Resolved"
] as const;

export const USER_ROLES: readonly UserRole[] = [
  "Citizen",
  "Official",
  "Admin"
] as const;

export const DEPARTMENTS: readonly Department[] = [
  "BBMP",
  "BWSSB",
  "BESCOM",
  "Other"
] as const;

export const DEPARTMENT_DISPLAY_NAMES: Record<Department, string> = {
  BBMP: "Bruhat Bengaluru Mahanagara Palike (BBMP)",
  BWSSB: "Bangalore Water Supply and Sewerage Board (BWSSB)",
  BESCOM: "Bangalore Electricity Supply Company (BESCOM)",
  Other: "Other Municipal Department"
};

/**
 * Valid canonical status transition graph.
 * Enforces the civic workflow:
 * Reported -> Verified -> Assigned -> In Progress / Repair Scheduled -> Fix Completed -> Resolved
 */
export const VALID_STATUS_TRANSITIONS: Record<IssueStatus, readonly IssueStatus[]> = {
  "Reported": ["Verified", "Assigned"],
  "Verified": ["Assigned", "In Progress", "Repair Scheduled"],
  "Assigned": ["In Progress", "Repair Scheduled"],
  "In Progress": ["Repair Scheduled", "Fix Completed", "Resolved"],
  "Repair Scheduled": ["In Progress", "Fix Completed", "Resolved"],
  "Fix Completed": ["Resolved", "In Progress"],
  "Resolved": []
};

/**
 * Validates whether an issue can transition from currentStatus to nextStatus
 */
export function canTransitionIssueStatus(currentStatus: IssueStatus, nextStatus: IssueStatus): boolean {
  if (currentStatus === nextStatus) return true;
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(nextStatus) : false;
}

/**
 * Returns allowed next statuses from the current status
 */
export function getNextAllowedStatuses(currentStatus: IssueStatus): IssueStatus[] {
  return [...(VALID_STATUS_TRANSITIONS[currentStatus] || [])];
}

/**
 * Alias for getNextAllowedStatuses for backwards and component compatibility
 */
export const getAvailableNextStatuses = getNextAllowedStatuses;

/**
 * Helper to normalize department strings from AI or legacy inputs to canonical Department
 */
export function normalizeDepartment(raw?: string | null): Department {
  if (!raw) return "BBMP";
  const upper = raw.toUpperCase();
  if (upper.includes("BWSSB") || upper.includes("WATER") || upper.includes("SEWER")) return "BWSSB";
  if (upper.includes("BESCOM") || upper.includes("ELECTRIC") || upper.includes("POWER") || upper.includes("LIGHT")) return "BESCOM";
  if (upper.includes("BBMP") || upper.includes("ROAD") || upper.includes("WASTE") || upper.includes("MUNICIPAL") || upper.includes("SOLID")) return "BBMP";
  if (DEPARTMENTS.includes(raw as Department)) return raw as Department;
  return "Other";
}

/**
 * Helper to normalize category strings safely
 */
export function normalizeIssueCategory(raw?: string | null): IssueCategory {
  if (!raw) return "Other";
  if (ISSUE_CATEGORIES.includes(raw as IssueCategory)) return raw as IssueCategory;
  const lower = raw.toLowerCase();
  if (lower.includes("pot") || lower.includes("hole") || lower.includes("road")) return "Pothole";
  if (lower.includes("water") || lower.includes("leak") || lower.includes("pipe") || lower.includes("flood")) return "Water Leak";
  if (lower.includes("light") || lower.includes("lamp") || lower.includes("dark") || lower.includes("street light")) return "Broken Streetlight";
  if (lower.includes("trash") || lower.includes("dump") || lower.includes("waste") || lower.includes("garbage")) return "Trash & Dumping";
  if (lower.includes("graffiti") || lower.includes("paint") || lower.includes("vandal")) return "Graffiti";
  return "Other";
}

/**
 * Helper to normalize urgency strings safely
 */
export function normalizeIssueUrgency(raw?: string | null): IssueUrgency {
  if (!raw) return "Medium";
  if (ISSUE_URGENCIES.includes(raw as IssueUrgency)) return raw as IssueUrgency;
  const lower = raw.toLowerCase();
  if (lower.includes("crit") || lower.includes("emerg")) return "Critical";
  if (lower.includes("high") || lower.includes("sev")) return "High";
  if (lower.includes("low") || lower.includes("min")) return "Low";
  return "Medium";
}

/**
 * Helper to normalize status strings safely
 */
export function normalizeIssueStatus(raw?: string | null): IssueStatus {
  if (!raw) return "Reported";
  if (ISSUE_STATUSES.includes(raw as IssueStatus)) return raw as IssueStatus;
  const lower = raw.toLowerCase();
  if (lower.includes("sched")) return "Repair Scheduled";
  if (lower.includes("prog") || lower.includes("work")) return "In Progress";
  if (lower.includes("comp")) return "Fix Completed";
  if (lower.includes("resolv") || lower.includes("done") || lower.includes("fixed")) return "Resolved";
  if (lower.includes("verif")) return "Verified";
  if (lower.includes("assign")) return "Assigned";
  return "Reported";
}

/**
 * Helper to normalize user role safely
 */
export function normalizeUserRole(raw?: string | null): UserRole {
  if (!raw) return "Citizen";
  if (USER_ROLES.includes(raw as UserRole)) return raw as UserRole;
  const lower = raw.toLowerCase();
  if (lower.includes("admin")) return "Admin";
  if (lower.includes("offic") || lower.includes("gov") || lower.includes("staff")) return "Official";
  return "Citizen";
}

/**
 * Validates if a user has Admin permissions
 */
export function isUserAdmin(email?: string | null, role?: UserRole): boolean {
  if (email && email.toLowerCase() === "its.me.jckirthi@gmail.com") return true;
  return role === "Admin";
}

/**
 * Validates if a user has Official permissions (Officials or Admins)
 */
export function isUserOfficial(email?: string | null, role?: UserRole): boolean {
  if (isUserAdmin(email, role)) return true;
  return role === "Official";
}

/**
 * Checks if a user has permission to update operational civic issue statuses
 */
export function canUserManageIssueStatus(role?: UserRole, email?: string | null): boolean {
  return isUserOfficial(email, role);
}

/**
 * Validates whether a citizen can verify a civic issue
 */
export function canCitizenVerifyIssue(issue: CivicIssue, userId: string): { allowed: boolean; reason?: string } {
  if (!userId) return { allowed: false, reason: "Authentication required to verify issues." };
  if (issue.reportedBy === userId) return { allowed: false, reason: "You cannot verify your own reported issue." };
  if (Array.isArray(issue.verifiedBy) && issue.verifiedBy.includes(userId)) {
    return { allowed: false, reason: "You have already verified this civic issue." };
  }
  return { allowed: true };
}

/**
 * PHASE 4: Structured Civic Intelligence types and helpers
 */
export interface PossibleDuplicateSummary {
  id: string;
  title: string;
  category: IssueCategory;
  locationName: string;
  status: IssueStatus;
  reportedAt: number;
  distanceMeters?: number;
}

export interface CivicIntelligenceResult {
  category: IssueCategory;
  urgency: IssueUrgency;
  severity: number; // 1 - 5 (integer)
  severityRationale: string;
  hazards: string[];
  suggestedDepartment: Department;
  suggestedSLAHours: number;
  recommendedAction: string;
  aiSummary: string;
  confidence: number; // 0.0 - 1.0

  // Contextual attributes
  title?: string;
  description?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;

  // Duplicate analysis signals
  duplicateProbability?: number; // 0.0 - 1.0
  possibleDuplicateIssueIds?: string[];
  possibleDuplicates?: PossibleDuplicateSummary[];
  duplicateRationale?: string;

  // Execution metadata
  simulated?: boolean;
  modelUsed?: string;
}

export type AIConfidenceLevel = "High" | "Moderate" | "Low";

export function getAIConfidenceLevel(confidence: number): AIConfidenceLevel {
  if (confidence >= 0.85) return "High";
  if (confidence >= 0.60) return "Moderate";
  return "Low";
}

export function getAIConfidenceDescription(confidence: number): string {
  if (confidence >= 0.85) return "High confidence — detection matches physical evidence strongly.";
  if (confidence >= 0.60) return "Moderate confidence — review recommended before dispatch.";
  return "Low confidence — please verify category and urgency carefully.";
}

/**
 * Validates and normalizes raw Gemini / heuristic AI intelligence outputs into a strict canonical schema
 */
export function validateAndNormalizeCivicIntelligence(
  raw: any,
  fallbackContext?: { text?: string; category?: IssueCategory; locationName?: string }
): CivicIntelligenceResult {
  if (!raw || typeof raw !== "object") {
    raw = {};
  }

  // 1. Category normalization
  const category = normalizeIssueCategory(raw.category || fallbackContext?.category || "Other");

  // 2. Urgency normalization
  const urgency = normalizeIssueUrgency(raw.urgency);

  // 3. Severity clamping (1 to 5 integer)
  let severity = 3;
  if (typeof raw.severity === "number" && !isNaN(raw.severity)) {
    severity = Math.max(1, Math.min(5, Math.round(raw.severity)));
  } else if (urgency === "Critical") {
    severity = 5;
  } else if (urgency === "High") {
    severity = 4;
  } else if (urgency === "Low") {
    severity = 2;
  }

  // 4. Severity Rationale
  let severityRationale = typeof raw.severityRationale === "string" && raw.severityRationale.trim()
    ? raw.severityRationale.trim()
    : `Assessed as level ${severity}/5 severity based on physical safety risk and municipal priority in Bengaluru.`;

  // 5. Hazards array validation
  let hazards: string[] = [];
  if (Array.isArray(raw.hazards)) {
    hazards = raw.hazards
      .filter((h: any) => typeof h === "string" && h.trim().length > 0)
      .map((h: string) => h.trim())
      .slice(0, 10);
  }

  // 6. Suggested Department validation
  const suggestedDepartment = normalizeDepartment(raw.suggestedDepartment || raw.department);

  // 7. Suggested SLA calculation / validation
  let suggestedSLAHours = 72;
  if (typeof raw.suggestedSLAHours === "number" && !isNaN(raw.suggestedSLAHours) && raw.suggestedSLAHours > 0) {
    suggestedSLAHours = Math.round(Math.min(720, Math.max(4, raw.suggestedSLAHours)));
  } else {
    if (urgency === "Critical" || severity === 5) suggestedSLAHours = 12;
    else if (urgency === "High" || severity === 4) suggestedSLAHours = 24;
    else if (urgency === "Medium" || severity === 3) suggestedSLAHours = 72;
    else suggestedSLAHours = 120;
  }

  // 8. Recommended Action
  let recommendedAction = typeof raw.recommendedAction === "string" && raw.recommendedAction.trim()
    ? raw.recommendedAction.trim()
    : `Inspect site and dispatch ${suggestedDepartment} field unit for repair.`;

  // 9. AI Summary
  let aiSummary = typeof raw.aiSummary === "string" && raw.aiSummary.trim()
    ? raw.aiSummary.trim()
    : `Identified a civic issue in category ${category} requiring ${suggestedDepartment} inspection.`;

  // 10. Confidence score (0.0 to 1.0)
  let confidence = 0.85;
  if (typeof raw.confidence === "number" && !isNaN(raw.confidence)) {
    confidence = Math.max(0, Math.min(1, parseFloat(raw.confidence.toFixed(2))));
  }

  // 11. Duplicate analysis signals
  let duplicateProbability: number | undefined = undefined;
  if (typeof raw.duplicateProbability === "number" && !isNaN(raw.duplicateProbability)) {
    duplicateProbability = Math.max(0, Math.min(1, parseFloat(raw.duplicateProbability.toFixed(2))));
  }

  let possibleDuplicateIssueIds: string[] | undefined = undefined;
  if (Array.isArray(raw.possibleDuplicateIssueIds)) {
    possibleDuplicateIssueIds = raw.possibleDuplicateIssueIds
      .filter((id: any) => typeof id === "string" && id.trim().length > 0)
      .map((id: string) => id.trim());
  }

  let possibleDuplicates: PossibleDuplicateSummary[] | undefined = undefined;
  if (Array.isArray(raw.possibleDuplicates)) {
    possibleDuplicates = raw.possibleDuplicates.map((dup: any) => ({
      id: String(dup.id || ""),
      title: String(dup.title || "Existing Civic Report"),
      category: normalizeIssueCategory(dup.category),
      locationName: String(dup.locationName || "Bengaluru"),
      status: normalizeIssueStatus(dup.status),
      reportedAt: typeof dup.reportedAt === "number" ? dup.reportedAt : Date.now(),
      distanceMeters: typeof dup.distanceMeters === "number" ? Math.round(dup.distanceMeters) : undefined
    }));
  }

  return {
    category,
    urgency,
    severity,
    severityRationale,
    hazards,
    suggestedDepartment,
    suggestedSLAHours,
    recommendedAction,
    aiSummary,
    confidence,
    title: typeof raw.title === "string" ? raw.title.trim() : undefined,
    description: typeof raw.description === "string" ? raw.description.trim() : fallbackContext?.text,
    locationName: typeof raw.locationName === "string" ? raw.locationName.trim() : fallbackContext?.locationName,
    latitude: typeof raw.latitude === "number" ? raw.latitude : undefined,
    longitude: typeof raw.longitude === "number" ? raw.longitude : undefined,
    duplicateProbability,
    possibleDuplicateIssueIds,
    possibleDuplicates,
    duplicateRationale: typeof raw.duplicateRationale === "string" ? raw.duplicateRationale : undefined,
    simulated: Boolean(raw.simulated),
    modelUsed: typeof raw.modelUsed === "string" ? raw.modelUsed : undefined
  };
}

export interface CivicIssue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  urgency: IssueUrgency;
  locationName: string;
  latitude: number;
  longitude: number;
  status: IssueStatus;
  reportedBy: string;
  reportedByName: string;
  reportedAt: number; // millisecond timestamp
  verificationsCount: number;
  verifiedBy: string[]; // array of user uids
  imageUrl?: string;
  voiceUrl?: string;

  // Vision Analysis (Enhancement 1)
  severity?: number; // 1-5
  severityRationale?: string;
  department?: Department;
  hazards?: string[];
  aiConfidence?: number;
  aiSummary?: string;

  // Voice Enrichment (Enhancement 2)
  voiceTranscript?: string;
  locationHints?: string[];
  landmarks?: string[];

  // SLA and Timestamps (Enhancement 5)
  timestamps?: {
    reported?: number;
    verified?: number;
    assigned?: number;
    inProgress?: number;
    repairScheduled?: number;
    fixCompleted?: number;
    resolved?: number;
  };
  assignedDepartment?: Department;
  slaExpectedHours?: number;

  // Community & Geohash (Enhancement 6)
  upvotesCount?: number;
  upvotedBy?: string[]; // uids of users who upvoted
  geohash?: string;

  // Duplicate Detection (Enhancement 8)
  relatedIssues?: string[]; // duplicate/related issue IDs
  embedding?: number[];

  // Multilingual Support (Enhancement 9)
  originalLanguage?: string;
  originalTitle?: string;
  originalDescription?: string;

  // Authority Dashboard & Responses (Enhancement 10)
  officialResponse?: string;
  officialResponseAt?: number;

  // Offline Pending indicator
  isOfflinePending?: boolean;
}

/**
 * Normalizes any raw document object into a fully typed, canonical CivicIssue
 */
export function normalizeCivicIssue(raw: any): CivicIssue {
  if (!raw || typeof raw !== "object") {
    return {
      id: "unknown",
      title: "Untitled Civic Issue",
      description: "",
      category: "Other",
      urgency: "Medium",
      locationName: "Bengaluru",
      latitude: 12.9716,
      longitude: 77.5946,
      status: "Reported",
      reportedBy: "anonymous",
      reportedByName: "Citizen",
      reportedAt: Date.now(),
      verificationsCount: 0,
      verifiedBy: []
    };
  }

  const category = normalizeIssueCategory(raw.category);
  const urgency = normalizeIssueUrgency(raw.urgency);
  const status = normalizeIssueStatus(raw.status);
  const department = raw.department ? normalizeDepartment(raw.department) : undefined;
  const assignedDepartment = raw.assignedDepartment ? normalizeDepartment(raw.assignedDepartment) : undefined;

  const timestamps = raw.timestamps || {};
  if (!timestamps.reported && raw.reportedAt) {
    timestamps.reported = raw.reportedAt;
  }

  return {
    id: String(raw.id || ""),
    title: String(raw.title || "Civic Issue"),
    description: String(raw.description || ""),
    category,
    urgency,
    locationName: String(raw.locationName || "Bengaluru"),
    latitude: typeof raw.latitude === "number" ? raw.latitude : 12.9716,
    longitude: typeof raw.longitude === "number" ? raw.longitude : 77.5946,
    status,
    reportedBy: String(raw.reportedBy || ""),
    reportedByName: String(raw.reportedByName || "Citizen"),
    reportedAt: typeof raw.reportedAt === "number" ? raw.reportedAt : Date.now(),
    verificationsCount: typeof raw.verificationsCount === "number" ? raw.verificationsCount : 0,
    verifiedBy: Array.isArray(raw.verifiedBy) ? raw.verifiedBy : [],
    imageUrl: raw.imageUrl || undefined,
    voiceUrl: raw.voiceUrl || undefined,
    severity: typeof raw.severity === "number" ? raw.severity : undefined,
    severityRationale: raw.severityRationale || undefined,
    department,
    hazards: Array.isArray(raw.hazards) ? raw.hazards : undefined,
    aiConfidence: typeof raw.aiConfidence === "number" ? raw.aiConfidence : undefined,
    aiSummary: raw.aiSummary || undefined,
    voiceTranscript: raw.voiceTranscript || undefined,
    locationHints: Array.isArray(raw.locationHints) ? raw.locationHints : undefined,
    landmarks: Array.isArray(raw.landmarks) ? raw.landmarks : undefined,
    timestamps,
    assignedDepartment,
    slaExpectedHours: typeof raw.slaExpectedHours === "number" ? raw.slaExpectedHours : undefined,
    upvotesCount: typeof raw.upvotesCount === "number" ? raw.upvotesCount : undefined,
    upvotedBy: Array.isArray(raw.upvotedBy) ? raw.upvotedBy : undefined,
    geohash: raw.geohash || undefined,
    relatedIssues: Array.isArray(raw.relatedIssues) ? raw.relatedIssues : undefined,
    embedding: Array.isArray(raw.embedding) ? raw.embedding : undefined,
    originalLanguage: raw.originalLanguage || undefined,
    originalTitle: raw.originalTitle || undefined,
    originalDescription: raw.originalDescription || undefined,
    officialResponse: raw.officialResponse || undefined,
    officialResponseAt: typeof raw.officialResponseAt === "number" ? raw.officialResponseAt : undefined,
    isOfflinePending: Boolean(raw.isOfflinePending)
  };
}

export interface CivicComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  points: number;
  badges: string[];
  reportedCount: number;
  verifiedCount: number;
  resolvedCount: number;
  role?: UserRole;
}

export interface LeaderboardUser {
  uid: string;
  displayName: string;
  points: number;
  reportedCount: number;
  verifiedCount: number;
  badges: string[];
  role?: UserRole;
}

