export interface CivicIssue {
  id: string;
  title: string;
  description: string;
  category: "Pothole" | "Water Leak" | "Broken Streetlight" | "Trash & Dumping" | "Graffiti" | "Other";
  urgency: "Low" | "Medium" | "High" | "Critical";
  locationName: string;
  latitude: number;
  longitude: number;
  status: "Reported" | "Verified" | "Assigned" | "In Progress" | "Resolved" | "Repair Scheduled" | "Fix Completed";
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
  department?: string;
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
    resolved?: number;
  };
  assignedDepartment?: string;
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
}

export interface LeaderboardUser {
  uid: string;
  displayName: string;
  points: number;
  reportedCount: number;
  verifiedCount: number;
  badges: string[];
}
