# Samriddhi Parivar (Samriddhi-Parivar)
### Bengaluru's Next-Gen AI-Powered Civic Action Platform

<p align="center">
  <a href="https://ai.studio/build" target="_blank">
    <img src="https://img.shields.io/badge/Built%20with-Google%20AI%20Studio-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Built with Google AI Studio" height="40" />
  </a>
</p>

[![AI Studio Powered](https://img.shields.io/badge/AI_Studio-Gemini_3.5_Flash-blue.svg?logo=google&logoColor=white)](https://ai.studio/build)
[![Database](https://img.shields.io/badge/Database-Firebase_Firestore-orange.svg?logo=firebase&logoColor=white)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Samriddhi Parivar** is an advanced full-stack civic technology application designed for Bengaluru. It empowers citizens to identify, report, track, and collaboratively verify local infrastructural issues (like potholes, street light outages, garbage piles, and water leaks). 

By integrating **Multimodal Gemini AI** (vision, text, audio) and an interactive map experience, citizens can submit real-time reports that are automatically analyzed and prioritized. The platform gamifies community action with hero levels, badges, leaderboard ranks, and impact certificates, transforming civic responsibility into a rewarding collaborative experience.

---

## 🌟 Key Features

### 1. 🧠 Multimodal Gemini AI Reporter
* **Image/Vision Scanner**: Snap and upload a picture of an issue (e.g., a pothole). Gemini automatically identifies the hazard type, creates a descriptive title, lists recommended repair steps, and assesses the threat severity.
* **Voice Note Analysis**: Record audio descriptions directly. The backend transcribes and extracts the core problem details with context-aware semantic processing.
* **Language Translation**: Built-in dynamic translation support for local languages (Kannada, Hindi, etc.) powered by Google Translation API, bridging the language barrier for all residents.

### 2. 🗺️ Live Interactive Map & Hotspots
* Visual map dashboard featuring precise geotagging.
* Dynamic clustering and color-coded markers (Red = Critical, Orange = Moderate, Green = Resolved).
* Advanced **Geofire duplicate detector** that prevents report clutter by scanning nearby radius regions and querying Gemini to semantically verify if a newly submitted report is a duplicate of an existing unresolved one.

### 3. 📊 Predictive Analytics & SLAs
* **Predictive Hotspots Chart**: Uses historical frequency data to forecast localized infrastructure wear-and-tear.
* **SLA Compliance Summary**: Monitors municipal turnaround times across issue categories (e.g., Streetlight repairs vs. Potholes) to hold local departments accountable.

### 4. 🏆 Gamification & Civic Rewards
* **Hero Badges & Levels**: Earn points for reporting (50 pts), verifying (25 pts), and when an issue is successfully resolved (100 pts).
* **Live Leaderboard**: Compete with other civic heroes in your ward.
* **Civic Impact Certificate**: Download a beautiful, customized PDF certificate showcasing your total contributions to Bengaluru's development.

### 5. 🛡️ Robust Resilience Engine
* **Auto-Cooldown circuit breaker**: Features a built-in rate-limit/quota-exhaustion handler. If Gemini API rate limits (`429 RESOURCE_EXHAUSTED`) are met, the application seamlessly activates a global backoff cooldown and transitions to high-fidelity, heuristics-driven simulation fallbacks to guarantee uninterrupted user experience.
* **Offline Synchronization**: Locally queues reports and actions when network connectivity is lost, syncing them automatically with Firebase Firestore once the connection resumes.

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| **Frontend UI** | React 19, Vite, Tailwind CSS, Motion (Animations) |
| **Icons & Maps** | Lucide React, Leaflet, Leaflet-Geosearch |
| **Backend Server** | Express, Node.js, `tsx` (TypeScript Executor) |
| **Bundling / Build** | Vite, `esbuild` (Fast TypeScript server compilation) |
| **Database & Auth** | Firebase Firestore (Real-time DB), Firebase Auth (Anonymous & Email) |
| **AI Processing** | `@google/genai` (Official Google Generative AI SDK) |

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18 or higher recommended)
* **npm** (v9 or higher)
* **Firebase Project** (Firestore and Web Authentication enabled)

### Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/jc-kirthi/Samriddhi-Parivar.git
   cd Samriddhi-Parivar
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory (using `.env.example` as a guide):
   ```env
   # Firebase Web Configuration
   VITE_FIREBASE_API_KEY=your_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
   VITE_FIREBASE_PROJECT_ID=your_project_id_here
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
   VITE_FIREBASE_APP_ID=your_app_id_here
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id_here

   # Server Secret (Gemini API Access)
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   The backend server and client SPA will boot up concurrently. Open `http://localhost:3000` to interact with the platform.

5. **Build for Production:**
   ```bash
   npm run build
   ```
   This compiles static client assets into `dist/` and bundles the Express server into `dist/server.cjs` using esbuild for optimal container cold starts.

6. **Start Production Server:**
   ```bash
   npm run start
   ```

---

## 📂 Codebase Architecture

```
├── .env.example              # Template for required environment configuration
├── server.ts                 # Full-stack Express server with integrated Vite dev-middleware
├── package.json              # Project dependencies and deployment scripts
├── src/
│   ├── App.tsx               # Main application component & layout state
│   ├── main.tsx              # React mounting entrypoint
│   ├── index.css             # Tailored global styling and Tailwind setup
│   ├── types.ts              # Global TypeScript interfaces (Issue, Profile, Stats)
│   ├── components/           # Modularized UI Components
│   │   ├── HeroLanding.tsx   # Visually stunning landing panel with responsive layout
│   │   ├── MapContainer.tsx  # Dynamic Leaflet mapping and Geolocation
│   │   ├── IssueList.tsx     # Issue list container with live filtering
│   │   ├── ReportIssueModal.tsx # Multi-step report form with Gemini AI upload widgets
│   │   ├── GamificationPanel.tsx # Live leaderboard and badging details
│   │   ├── ImpactCertificate.tsx # Generatable community honor certificate
│   │   └── AuthModal.tsx     # Clean anonymous and password-based login flows
│   ├── lib/
│   │   ├── gemini.ts         # Gemini AI API caller with exponential backoff & cooldowns
│   │   ├── firebase.ts       # Firestore streams, subscriptions, and offline writes
│   │   └── AppContext.tsx    # Shared context, multi-lingual translations, and dark mode toggles
│   └── services/
│       └── duplicateDetector.ts # Geofire-based semantic duplicate analysis system
```

---

## 🤝 Contributing
Contributions are what make the community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

---

*Built with ❤️ for Bengaluru using Google AI Studio by Samriddhi Parivar.*
