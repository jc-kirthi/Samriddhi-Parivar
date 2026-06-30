# Security Specification & Test Suite (Phase 0)

This document outlines the data invariants, security boundaries, and validation rules for Firestore collections in the Community Hero application. It defines 12 distinct malicious payloads designed to test our rules against privilege escalation, identity spoofing, value poisoning, and status shortcutting.

## 1. Data Invariants

1. **User Identity Invariant**: A user's profile can only be created or modified by the authenticated user matching the document ID (`request.auth.uid == userId`).
2. **XP & Badge Protection Invariant**: Users cannot unilaterally inflate their `points` or arbitrarily award themselves badges without performing verified actions (reporting, verifying, or resolving).
3. **Issue Ownership Invariant**: The `reportedBy` field must match the authenticated user Uid when creating an issue.
4. **Self-Verification Invariant**: A user cannot verify an issue they reported themselves.
5. **Double-Verification Invariant**: A user cannot verify the same issue multiple times (they can only append their Uid to `verifiedBy` if it's not already present).
6. **Immutable Fields**: `createdAt`, `reportedAt`, `reportedBy` must remain unmodified after creation.
7. **Terminal State Locking**: Once an issue's status is `Resolved`, it is locked and cannot be updated except by admins or via validated city workflows.
8. **DDoS/Poisoning Prevention**: Every string property must have strict upper-bound limits (e.g., description length <= 1000 characters) to prevent database resource exhaustion.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads attempt to bypass authorization or corrupt state, and must always be rejected by the security rules:

### P1: Profile Hijacking (Identity Spoofing)
An attacker logs in as `attacker_123` and attempts to edit the profile of `victim_456`.
```json
// path: /users/victim_456
{
  "uid": "victim_456",
  "displayName": "Hacked User",
  "email": "victim@hacked.com",
  "points": 9999
}
```

### P2: Self-Awarding XP (Value Poisoning)
An attacker logs in as `attacker_123` and attempts to overwrite their own points to a high number without performing reports/verifications.
```json
// path: /users/attacker_123
{
  "uid": "attacker_123",
  "displayName": "Cheater",
  "email": "cheat@games.com",
  "points": 1000000,
  "badges": ["Super Citizen", "Elite Validator"],
  "reportedCount": 0,
  "verifiedCount": 0,
  "resolvedCount": 0
}
```

### P3: Forged Badge Award (Identity Spoofing)
An attacker attempts to write the "Elite Validator" badge to their profile without meeting the 5 verified issues requirement.
```json
// path: /users/attacker_123 (Update)
{
  "badges": ["First Step", "Elite Validator"]
}
```

### P4: Issue Reporter Spoofing
An attacker reports a pothole but sets the `reportedBy` field to a different user, aiming to frame them or steal/award rewards maliciously.
```json
// path: /issues/issue_xyz
{
  "id": "issue_xyz",
  "title": "Huge Pothole",
  "description": "On Guadalupe",
  "category": "Pothole",
  "urgency": "Low",
  "locationName": "Guadalupe St",
  "latitude": 30.2,
  "longitude": -97.7,
  "status": "Reported",
  "reportedBy": "victim_uid",
  "reportedByName": "Victim User",
  "reportedAt": 1782394200000,
  "verificationsCount": 0,
  "verifiedBy": []
}
```

### P5: Instant Resolve (State Shortcutting)
A user reports an issue and immediately marks its status as "Resolved" to harvest 100 points without any verification or city work.
```json
// path: /issues/issue_abc
{
  "id": "issue_abc",
  "title": "Broken light",
  "description": "Pecan street",
  "category": "Broken Streetlight",
  "urgency": "Low",
  "locationName": "Pecan St",
  "latitude": 30.2,
  "longitude": -97.7,
  "status": "Resolved",
  "reportedBy": "attacker_123",
  "reportedByName": "Attacker",
  "reportedAt": 1782394200000,
  "verificationsCount": 0,
  "verifiedBy": []
}
```

### P6: Self-Verification
An attacker attempts to verify an issue they reported themselves by adding their Uid to `verifiedBy`.
```json
// path: /issues/attacker_reported_issue (Update)
{
  "verifiedBy": ["attacker_123"],
  "verificationsCount": 1
}
```

### P7: Double-Verification (Spamming)
A user attempts to verify an issue twice by appending their Uid twice to `verifiedBy` or incrementing the count without appending a new valid user.
```json
// path: /issues/issue_456 (Update)
{
  "verifiedBy": ["user_abc", "user_abc"],
  "verificationsCount": 2
}
```

### P8: String Value Poisoning (DDoS / Wallet Drain)
An attacker injects an extremely large 1MB description string into an issue or profile name.
```json
// path: /issues/issue_123 (Update)
{
  "description": "[A string repeating characters for 1MB...]"
}
```

### P9: Illegal Urgency Modification
A user tries to escalate an issue reported by another user by altering the `urgency` parameter from `Low` to `Critical`.
```json
// path: /issues/other_user_issue (Update)
{
  "urgency": "Critical"
}
```

### P10: Modifying Reported Time (Temporal Forgery)
An attacker changes the `reportedAt` timestamp to past or future values to skew sorting and analytics.
```json
// path: /issues/issue_123 (Update)
{
  "reportedAt": 0
}
```

### P11: Overwriting Resolved Issues
An attacker attempts to set a previously `Resolved` issue back to `Reported` to restart verification loops.
```json
// path: /issues/resolved_issue_789 (Update)
{
  "status": "Reported"
}
```

### P12: Anonymous Write Bypass
An unauthenticated guest client attempts to post a new report directly to the database.
```json
// path: /issues/guest_issue (No Auth Header)
{
  "id": "guest_issue",
  "title": "Anonymous Report",
  "description": "I am not signed in",
  "category": "Other",
  "urgency": "Low",
  "locationName": "Austin",
  "latitude": 30.2,
  "longitude": -97.7,
  "status": "Reported",
  "reportedBy": "guest",
  "reportedByName": "Guest",
  "reportedAt": 1782394200000,
  "verificationsCount": 0,
  "verifiedBy": []
}
```

---

## 3. Test Runner Specification

```typescript
// firestore.rules.test.ts (Conceptual Unit Test)
import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "applied-rune-6j1d7",
    firestore: {
      rules: `rules_version = '2'; ...`
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Community Hero Security Rule Tests", () => {
  test("P1 should be rejected: profile hijacking", async () => {
    const context = testEnv.authenticatedContext("attacker_123");
    const db = context.firestore();
    const docRef = doc(db, "users/victim_456");
    await expect(setDoc(docRef, { uid: "victim_456", displayName: "Hacked" }))
      .rejects.toThrow("PERMISSION_DENIED");
  });

  test("P2 should be rejected: self-awarding XP", async () => {
    const context = testEnv.authenticatedContext("attacker_123");
    const db = context.firestore();
    const docRef = doc(db, "users/attacker_123");
    await expect(updateDoc(docRef, { points: 1000000 }))
      .rejects.toThrow("PERMISSION_DENIED");
  });

  test("P5 should be rejected: instant resolve state shortcutting", async () => {
    const context = testEnv.authenticatedContext("attacker_123");
    const db = context.firestore();
    const docRef = doc(db, "issues/issue_abc");
    await expect(setDoc(docRef, { status: "Resolved", reportedBy: "attacker_123" }))
      .rejects.toThrow("PERMISSION_DENIED");
  });

  test("P12 should be rejected: unauthenticated client report", async () => {
    const context = testEnv.unauthenticatedContext();
    const db = context.firestore();
    const docRef = doc(db, "issues/guest_issue");
    await expect(setDoc(docRef, { title: "Anonymous" }))
      .rejects.toThrow("PERMISSION_DENIED");
  });
});
```
