<div align="center">

# 🎥 CamSpy

### AI-Powered Real-Time Surveillance Dashboard

[![Live Demo](https://img.shields.io/badge/Live%20Demo-camspy.vercel.app-00ffd5?style=for-the-badge&logo=vercel&logoColor=white)](https://camspy.vercel.app)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-COCO--SSD-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://www.tensorflow.org/js)
[![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

> **Browser-based, zero-cloud, real-time AI object detection and surveillance hub.**  
> The neural network runs 100% in your browser — no GPU server required.

</div>

---

## ✨ Features

### 📷 Live Camera Feed
- **Single & 4-Camera Grid** view with one-click toggle
- **4 simulated CCTV styles** from a single webcam:
  - `CAM 01` — Normal Selected Source
  - `CAM 02` — Thermal Infrared (hue-rotated)
  - `CAM 03` — Night Vision (green tint)
  - `CAM 04` — Retro Surveillance (greyscale)
- **IoU-based persistent object tracking** — stable `#ID` labels across frames
- **CCTV timestamp overlay** burned into secondary feeds (UTC)

### 🤖 AI Detection Engine
- Powered by **TensorFlow.js + COCO-SSD** (80 object classes)
- Runs **100% in the browser** — no server GPU, no cloud API
- Decoupled **inference ↔ render loop**: smooth 60fps canvas at all times
  - Single mode: ~15 fps inference
  - Grid mode: ~5 fps per camera (round-robin)
- Configurable **confidence threshold** (30–95%, default 50%)
- **HIGH / MED / LOW severity** classification per detection

### 🎨 Drawing Tools
| Tool | Action |
|---|---|
| **Tripwire** | Draw a line — alert triggers when any object crosses it |
| **Zone** | Draw a polygon — alert triggers on object entry |
| **Heatmap** | Live density heatmap overlay on the video feed |
| **Clear** | Erase all drawn boundaries |

### 🔔 Alerts & Notifications
- **Audio siren** via Web Audio API with volume control
- **Quiet Hours** — schedule suppression windows (e.g. 09:00–18:00)
- **Browser Push Notifications** (one-time permission)
- **Webhook relay** — POST detection events to any URL (Slack, Discord, n8n, etc.)

### 📼 Incident Clip Recording
- 2-second rolling **pre-buffer** via `MediaRecorder`
- Captures pre-buffer + 5-second post-clip on detection trigger
- Clips saved as `.webm` and available for download from the event log

### 📊 Overview Dashboard
- **System Vitals** — CPU, RAM, DB load, encryption status
- **Detection Metrics** — total count, trend %, HIGH/MED/LOW severity breakdown
- **Session Uptime Clock** — live `hh:mm:ss` ticking from sensor power-on
- **Detection Cluster Heatmap** — shows where in the frame detections cluster (reveals patrol blind spots)
- **Schedule / Quiet Hours** — alert suppression time window picker
- **Recent Alerts** — last 6 detections styled as a live feed

### 📈 Metrics & Analytics
- **Rolling timeline chart** — detections per time bucket (1 min / 5 min / 1 hr / all-time)
- **Class breakdown donut chart** — which object types trigger most
- **Event log table** — ID, label, confidence, timestamp, clip download / delete
- **CSV export** — download full sensor log as `.csv`

### 🎛️ Diagnostics
- **170+ class target filter** — modal drawer with select-all / none / invert
- Threshold slider, alarm toggle, volume control
- Live **terminal log** with timestamped system messages
- Webhook URL + Push Notifications config

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3, FastAPI, Uvicorn |
| Database | SQLite via SQLAlchemy 2.x ORM |
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES2022) |
| AI Model | TensorFlow.js + COCO-SSD (browser, WebGL) |
| Charts | Chart.js |
| Icons | Font Awesome 6 |
| Fonts | Inter, Outfit, Orbitron, Share Tech Mono |
| Deployment | Vercel (serverless) |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- A modern browser (Chrome / Edge recommended for best WebGL performance)
- A webcam

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/deepesh07-max/Camspy.git
cd Camspy

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Start the dev server
python main.py
```

### Open in browser
```
http://127.0.0.1:8000
```

> **After any code change**, hard-refresh with `Ctrl + Shift + R` to clear browser cache.

---

## 📁 Project Structure

```
CamSpy/
├── main.py              ← FastAPI server — all REST API routes
├── models.py            ← SQLAlchemy DetectionEvent model
├── database.py          ← SQLite engine + session management
├── requirements.txt     ← Python dependencies
├── sensor_log.db        ← SQLite database (auto-created)
├── vercel.json          ← Vercel deployment config
├── templates/
│   └── index.html       ← Single-page dashboard (4 tab views)
└── static/
    ├── css/
    │   └── style.css    ← Premium dark cyberpunk theme
    ├── js/
    │   └── app.js       ← All frontend logic (~2,950 lines)
    └── clips/           ← Saved incident WebM video clips
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Dashboard HTML |
| `GET` | `/api/events` | Latest 100 detection logs |
| `POST` | `/api/events` | Log a new detection event |
| `POST` | `/api/events/{id}/clip` | Upload base64 incident video clip |
| `DELETE` | `/api/events/{id}` | Delete event + video file |
| `DELETE` | `/api/events` | Clear all events |
| `GET` | `/api/export` | Download all logs as CSV |

### Detection Event Schema

```json
{
  "id": 42,
  "label": "person",
  "confidence": 0.8714,
  "timestamp": "2026-06-04T09:08:24Z",
  "bbox": "[120, 45, 310, 480]",
  "clip_url": "/static/clips/incident_42.webm"
}
```

---

## ☁️ Deployment on Vercel

The included `vercel.json` routes all traffic to the FastAPI app.

```bash
vercel --prod
```

> ⚠️ **Note:** Vercel's filesystem is read-only except `/tmp`, so the SQLite DB resets on each cold start. For persistent storage, replace SQLite with a hosted database (e.g. [Supabase](https://supabase.com) or [Neon](https://neon.tech)).

---

## ⚠️ Known Limitations

| Limitation | Reason |
|---|---|
| Pen/pencil misclassified as scissors | COCO-SSD has 80 fixed classes; "pen" is not one of them |
| 4 cameras use one physical webcam | CAMs 02–04 are CSS-filtered clones of CAM 01 |
| Vercel DB is ephemeral | Use PostgreSQL for persistent production storage |
| Detection limited to 80 COCO classes | Upgrade to YOLOv8 for broader object recognition |

---

## 🗺️ Roadmap

- [ ] YOLOv8 model integration (600+ classes)
- [ ] Real 4-camera USB device support
- [ ] Face recognition module
- [ ] RTSP/IP camera stream support
- [ ] PostgreSQL production database
- [ ] Mobile responsive layout
- [ ] Multi-user auth system

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ❤️ by [Deepesh](https://github.com/deepesh07-max)

⭐ **Star this repo** if you found it useful!

</div>
