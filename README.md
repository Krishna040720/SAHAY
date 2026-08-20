# SAHAY — Smart AI for Humanitarian Aid & Yielding Relief 🚨⛺

> **Unified Disaster Relief Coordination, AI Missing Person Matching, Real-Time GPS Camp Finder, and Multi-Agency Situational Broadcast Platform.**

Built for **Smart India Hackathon (SIH)** and multi-agency humanitarian disaster response operations (NDRF, SDRF, Indian Army, Red Cross, District Disaster Management Authorities, and Field Volunteers).

---

## 🌟 Key Highlights & Architecture

1. **🗺️ Interactive Real-Time OpenStreetMap (Leaflet)**:
   - Zero API key required, 100% free open-source map tiles.
   - Live bed vacancy tracking with color-coded status pins (🟢 Open, 🟡 Busy, 🔴 Full).
   - **📍 "Use My Current Live Location (GPS)"**: Instantly grabs device coordinates, calculates exact real distance in km to all relief camps, and sorts them by nearest safe shelter.
   - 1-click **🧭 Google Maps Directions** and **📞 Direct Phone Calling (`tel:`)** to camp coordinators.

2. **⛺ Dedicated Field Camp Registration for Rescue Teams**:
   - When NDRF or rescue teams set up a brand-new relief camp on the ground, they can register it with 1 click.
   - **"📍 Use My Current Location (GPS Auto-Fill)"** captures the exact mobile coordinates at the camp site.
   - Camp immediately appears on the live map, allows survivor check-ins, and broadcasts to the emergency feed.

3. **🔍 Multi-Factor AI Fuzzy Matching & Family Reunification**:
   - Deterministic multi-factor scoring: **Levenshtein Distance**, **Token Sort Ratio** (for name order permutations), **Soundex Phonetics** (for spelling variations across dialects), **Age Proximity**, and **Haversine Geo-Distance**.
   - AI Trust Credibility scoring combining source verification and corroboration.
   - **Real Distance Visualization**: Displays exact real distance in km between the family's reported location and the shelter where the person was located.
   - **🗺️ "View Reunification Route on Map"**: Draws a direct connecting path between family and camp on Leaflet.
   - **🖨️ Official Family Reunification Handover Pass**: Generates a printable verification record with `PASS-ID` for administrative/police sign-off.

4. **📸 Dual Photo Capture (Webcam & Gallery)**:
   - 📷 **Live Camera Capture**: Streams live device webcam/phone camera with 1-click snapshot for fast field intake.
   - 🖼️ **Gallery File Picker**: Upload saved photos from device storage.
   - 🔍 **High-Resolution Photo Lightbox**: Click any portrait thumbnail to zoom in for facial inspection.

5. **🔔 Multi-Camp Live Situational Alerts**:
   - Filing a missing report immediately triggers an **🚨 URGENT CAMP BROADCAST** banner across all relief shelters.
   - Real-time situational event stream of all survivor check-ins and camp setups.

6. **⚡ Disaster-Grade Reliability & Offline Resilience**:
   - **Form Autosave (`LocalStorage`)**: Form entries are saved on every keystroke so data is never lost if a device battery dies or connection drops.
   - **Network Monitor**: Automatic live detection of network connectivity status.
   - **📡 Offline GSM SMS Fallback Gateway**: Built-in parser for compact 2G SMS / USSD commands when internet is completely down.

---

## 📁 Repository Structure

```
sahay-disaster-relief/
├── public/                         # Modern Vanilla Frontend (Zero Build Step Needed)
│   ├── css/
│   │   └── style.css               # Clean responsive CSS styling & components
│   ├── js/
│   │   ├── api-client.js           # REST API client wrapper
│   │   ├── app.js                  # Main application controller & event wiring
│   │   ├── map-view.js             # Leaflet OpenStreetMap engine & route visualizer
│   │   └── ui-helpers.js           # Toast alerts, modals, distance & time formatters
│   └── index.html                  # Accessible, semantic UI layout
├── src/                            # Backend Engine (Pure Node.js)
│   ├── engine/
│   │   ├── matching.js             # AI fuzzy matching & scoring algorithm
│   │   ├── allocation.js           # Resource balance & deficit analysis
│   │   └── sms-gateway.js          # Offline 2G SMS text parser & dispatcher
│   ├── models/
│   │   └── repository.js           # In-memory database with realistic pre-seeded disaster data
│   ├── routes/
│   │   └── api.js                  # REST API endpoints & route handlers
│   └── utils/
│       └── validators.js           # Schema validation helpers
├── tests/                          # Automated Unit & Integration Tests
│   ├── api.test.js                 # HTTP API endpoints testing
│   ├── matching.test.js            # Fuzzy algorithm & phonetic tests
│   ├── allocation.test.js          # Deficit detection tests
│   ├── sms.test.js                 # SMS parser & gateway tests
│   └── validation.test.js          # Payload validation tests
├── package.json                    # Project configuration (Zero external dependencies)
├── server.js                       # Pure Node.js HTTP server & static file dispatcher
└── README.md                       # Documentation
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** (v18.0.0 or higher) — *No npm install required! Zero external dependencies.*

### 1. Run Automated Tests
```bash
npm test
# or
node --test tests/*.test.js
```
*Expected: 23/23 tests passing with 100% success rate.*

### 2. Start the Server
```bash
npm start
# or
node server.js
```

### 3. Open in Browser
- **Web App**: `http://localhost:3000`
- **API Health Check**: `http://localhost:3000/api/health`

---

## 🌐 Deploying to Cloud & GitHub

### Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit of SAHAY disaster relief platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/sahay-disaster-relief.git
git push -u origin main
```

### Deploy to Render / Railway / Heroku / Vercel
- **Build Command**: *(None required)*
- **Start Command**: `node server.js`
- **Environment Variables**: `PORT=3000` (or leave default assigned by platform)

---

## 🧪 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health check & uptime status |
| `GET` | `/api/stats` | High-level situation statistics |
| `GET` | `/api/camps` | List all verified relief camps |
| `GET` | `/api/camps/nearby?lat=...&lng=...` | Proximity search for nearest shelters |
| `POST` | `/api/camps` | Register a new relief camp |
| `PATCH`| `/api/camps/:id` | Update camp occupancy & status |
| `GET` | `/api/missing` | Retrieve missing person reports |
| `POST` | `/api/missing` | File missing report & trigger AI match search |
| `GET` | `/api/survivors` | Retrieve sheltered survivors list |
| `POST` | `/api/survivors` | Register survivor check-in |
| `GET` | `/api/matches` | Retrieve AI candidate match queue |
| `POST` | `/api/matches/:id/resolve` | Confirm (`CONFIRM`) or dismiss (`DISMISS`) match |
| `POST` | `/api/sms/parse` | Parse emergency 2G SMS command |
| `GET` | `/api/activities` | Real-time multi-agency situational alert feed |

---

## 📜 License
MIT License. Open source and free for humanitarian & disaster management operations.
