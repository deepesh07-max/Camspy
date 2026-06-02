/* ==========================================================================
   CAMSPY ENGINE — v4 (Dynamic High-Scale Filter Architecture & Resq.io Style)
   Wires to the rebuilt dashboard templates/index.html elements.
   TensorFlow.js COCO-SSD | Web Audio | FastAPI Backend
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {

    /* -------------------------------------------------------
       DOM NODES
     ------------------------------------------------------- */
    const $  = id => document.getElementById(id);
    const $$ = sel => document.querySelector(sel);

    const el = {
        // Header
        timestamp:      $("header-timestamp"),
        engineBadge:    $("model-status-badge"),

        // Feed section
        loadingOverlay: $("loading-overlay"),
        loadingTitle:   $("loading-title"),
        loadingDesc:    $("loading-desc"),
        progressFill:   $("progress-fill"),
        vpStandby:      $("vp-standby"),
        alertBanner:    $("detection-alert-banner"),
        alertText:      $("alert-banner-text"),
        recBadge:       $("rec-badge"),
        webcam:         $("webcam"),
        canvas:         $("hud-overlay"),

        // Stats strip
        fpsDisplay:     $("fps-display"),
        latencyDisplay: $("latency-display"),
        resolution:     $$(".pg-val"),

        // Diagnostics
        diagSensorState: $("diag-sensor-state"),
        diagAlarmTarget: $("diag-alarm-target"),
        diagSynthStatus: $("diag-synth-status"),
        totalEvents:     $("cumulative-counter"),

        // Controls
        powerSwitch:    $("switch-sensor-power-new"),
        selectCamera:   $("select-camera"),
        threshSlider:   $("slider-threshold-new"),
        statThreshold:  $("stat-threshold"),
        dialTooltip:    $("dial-tooltip"),
        alarmSwitch:    $("switch-sound-alarm"),
        volumeSlider:   $("slider-volume"),
        volumeVal:      $("val-volume-new"),

        // Filters Search & List
        filterSearch:   $("filter-search"),
        filterGrid:     $("filter-grid"),
        filterBadge:    $("filter-active-badge"),

        // Filter Action buttons
        btnSelectAll:   $("btn-select-all"),
        btnSelectNone:  $("btn-select-none"),
        btnInvert:      $("btn-invert"),

        // Data actions
        btnExportCsv:   $("btn-export-csv-new"),
        btnClearDb:     $("btn-clear-db-new"),

        // Log table
        logSearch:      $("log-search"),
        logTbody:       $("event-log-tbody"),
    };

    /* -------------------------------------------------------
       HIGH-SCALE FILTER DATA (170+ Categories)
     ------------------------------------------------------- */
    const FILTER_CATEGORIES = {
        "Vehicles & Transit": [
            "car", "bicycle", "motorcycle", "airplane", "bus", "train", 
            "truck", "boat", "helicopter", "ambulance", "fire_engine", 
            "police_car", "skateboard", "stroller", "wheelchair", "traffic_light",
            "fire_hydrant", "stop_sign", "parking_meter"
        ],
        "Electronics & Utilities": [
            "tv", "laptop", "mouse", "remote", "keyboard", "cell_phone", 
            "microwave", "oven", "toaster", "refrigerator", "camera", 
            "headphone", "speaker", "clock", "phone", "computer", 
            "router", "game_console"
        ],
        "Animals": [
            "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", 
            "bear", "zebra", "giraffe", "lion", "tiger", "monkey", 
            "rabbit", "deer", "squirrel", "fish", "snake", "frog"
        ],
        "Indoor & Furniture": [
            "chair", "couch", "bed", "dining_table", "toilet", "bench", 
            "desk", "shelf", "wardrobe", "mirror", "window", "door", 
            "lamp", "vase", "rug", "pillow", "blanket", "drawer"
        ],
        "Kitchen & Dining": [
            "bottle", "wine_glass", "cup", "fork", "knife", "spoon", 
            "bowl", "plate", "pot", "pan", "kettle", "glass", "mug", 
            "pitcher", "sink", "fork", "knife", "spoon", "bowl"
        ],
        "Sports & Outdoor": [
            "frisbee", "skis", "snowboard", "sports_ball", "kite", 
            "baseball_bat", "baseball_glove", "surfboard", "tennis_racket", 
            "golf_club", "backpack", "umbrella", "suitcase"
        ],
        "Personal & Clothing": [
            "person", "handbag", "tie", "watch", "glasses", "shoes", 
            "socks", "pants", "shirt", "jacket", "hat", "scarf", 
            "glove", "wallet", "ring"
        ],
        "Office & Tools": [
            "book", "scissors", "pen", "pencil", "paper", "folder", 
            "calendar", "calculator", "stapler", "ruler", "tape", 
            "hammer", "screwdriver", "wrench", "pliers", "drill"
        ],
        "Food": [
            "banana", "apple", "sandwich", "orange", "broccoli", "carrot", 
            "hot_dog", "pizza", "donut", "cake", "bread", "cheese", 
            "egg", "milk", "butter", "meat", "chicken", "fruit", "vegetable"
        ],
        "General / Other": [
            "potted_plant", "teddy_bear", "hair_drier", "toothbrush", 
            "toothpaste", "soap", "brush", "comb", "key", "coin", 
            "toy", "box", "bin", "basket", "bucket", "broom"
        ]
    };

    // Flatten keys to build target set & retain quick search capabilities
    const TARGET_KEYS = [];
    for (const cat in FILTER_CATEGORIES) {
        FILTER_CATEGORIES[cat] = [...new Set(FILTER_CATEGORIES[cat])]; // Remove duplicates
        TARGET_KEYS.push(...FILTER_CATEGORIES[cat]);
    }
    const ALL_UNIQUE_KEYS = [...new Set(TARGET_KEYS)];

    /* -------------------------------------------------------
       STATE
     ------------------------------------------------------- */
    const state = {
        model:          null,
        ready:          false,
        active:         false,
        deviceId:       null,
        threshold:      0.65,
        targets:        new Set(ALL_UNIQUE_KEYS), // Default: all active

        fps:            0,
        latency:        0,
        frameCount:     0,
        fpsTimer:       performance.now(),

        audioCtx:       null,
        volume:         0.5,
        alarmOn:        true,
        ringing:        false,

        cooldown:       5000,
        lastLogged:     new Map(),
        prevSet:        new Set(),

        chart:          null,
        timelineChart:  null,
        detectionBuffer: [],   // [{ts: ms, label: str}]  – live rolling store
        activeWindow:   60,    // seconds (0 = all-time)
        logs:           [],
    };

    const ctx2d = el.canvas.getContext("2d");

    /* -------------------------------------------------------
       CLOCK
     ------------------------------------------------------- */
    function tick() {
        if (!el.timestamp) return;
        const d   = new Date();
        const p   = n => String(n).padStart(2,"0");
        el.timestamp.textContent =
            `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ` +
            `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
    tick();
    setInterval(tick, 1000);

    /* -------------------------------------------------------
       ENGINE STATUS ACCENT BADGE
     ------------------------------------------------------- */
    function setBadge(mode, text) {
        if (!el.engineBadge) return;
        el.engineBadge.className = `status-badge`;
        
        let dotColor = "amber";
        let spinIcon = "";
        
        if (mode === "loading") {
            dotColor = "amber";
            spinIcon = `<i class="fa-solid fa-circle-notch fa-spin" style="margin-right: 6px;"></i>`;
        } else if (mode === "online") {
            dotColor = "green";
        } else {
            dotColor = "red";
        }

        el.engineBadge.innerHTML = `<span class="status-dot ${dotColor}"></span> ${spinIcon}${text}`;
    }

    /* -------------------------------------------------------
       DYNAMIC FILTER RENDERER WITH LOGICAL GROUPINGS & SEARCH
     ------------------------------------------------------- */
    function getCategoryIcon(key) {
        if (key === "person") return "fa-solid fa-user";
        if (key === "car" || key === "truck" || key === "bus" || key === "ambulance" || key === "police_car" || key === "fire_engine") return "fa-solid fa-car";
        if (key === "bicycle" || key === "motorcycle") return "fa-solid fa-bicycle";
        if (key === "airplane" || key === "helicopter") return "fa-solid fa-plane";
        if (key === "boat") return "fa-solid fa-ship";
        if (key === "tv" || key === "laptop" || key === "computer") return "fa-solid fa-desktop";
        if (key === "mouse") return "fa-solid fa-mouse";
        if (key === "keyboard") return "fa-solid fa-keyboard";
        if (key === "cell_phone" || key === "phone") return "fa-solid fa-mobile-screen-button";
        if (key === "dog") return "fa-solid fa-dog";
        if (key === "cat") return "fa-solid fa-cat";
        if (key === "backpack") return "fa-solid fa-backpack";
        if (key === "umbrella") return "fa-solid fa-umbrella";
        if (key === "handbag") return "fa-solid fa-bag-shopping";
        if (key === "tie") return "fa-solid fa-tie";
        if (key === "suitcase") return "fa-solid fa-suitcase";
        if (key === "book") return "fa-solid fa-book";
        if (key === "clock") return "fa-solid fa-clock";
        if (key === "scissors") return "fa-solid fa-scissors";
        if (key === "bottle") return "fa-solid fa-bottle-water";
        if (key === "cup" || key === "mug" || key === "glass") return "fa-solid fa-cup-togo";
        if (key === "chair" || key === "couch" || key === "bench") return "fa-solid fa-chair";
        if (key === "potted_plant") return "fa-solid fa-seedling";
        if (key === "key") return "fa-solid fa-key";
        if (key === "wallet") return "fa-solid fa-wallet";
        if (key === "apple" || key === "banana" || key === "sandwich" || key === "orange" || key === "pizza") return "fa-solid fa-utensils";
        // Default fallbacks
        return "fa-solid fa-tag";
    }

    function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function renderFilters() {
        if (!el.filterGrid) return;
        const q = (el.filterSearch?.value || "").trim().toLowerCase();
        el.filterGrid.innerHTML = "";

        let hasAnyVisible = false;

        for (const [category, items] of Object.entries(FILTER_CATEGORIES)) {
            // Check if items match query search
            const matchedItems = items.filter(item => {
                const formatted = item.replace(/_/g, " ").toLowerCase();
                return item.includes(q) || formatted.includes(q);
            });

            if (matchedItems.length === 0) continue;
            hasAnyVisible = true;

            // Create Category header
            const header = document.createElement("div");
            header.className = "filter-category-header";
            header.textContent = category.toUpperCase();
            el.filterGrid.appendChild(header);

            // Create dynamic flex/grid container
            const grid = document.createElement("div");
            grid.className = "dynamic-filter-grid";

            matchedItems.forEach(key => {
                const isChecked = state.targets.has(key);
                const icon = getCategoryIcon(key);
                const labelText = capitalizeFirst(key.replace(/_/g, " "));

                const label = document.createElement("label");
                label.className = "fc-dynamic";
                label.innerHTML = `
                    <input type="checkbox" id="class-${key}" ${isChecked ? "checked" : ""}>
                    <span><i class="${icon}"></i> ${labelText}</span>
                `;

                const chk = label.querySelector("input");
                chk.addEventListener("change", e => {
                    if (e.target.checked) {
                        state.targets.add(key);
                    } else {
                        state.targets.delete(key);
                    }
                    updateAlarmTargetDiag();
                });

                grid.appendChild(label);
            });

            el.filterGrid.appendChild(grid);
        }

        if (!hasAnyVisible) {
            el.filterGrid.innerHTML = `<div class="empty-state" style="padding: 18px 0; color: #475569;"><p>No classes match your search</p></div>`;
        }
    }

    /* -------------------------------------------------------
       AUDIO SYNTH
     ------------------------------------------------------- */
    function initAudio() {
        if (state.audioCtx) return;
        try {
            state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (el.diagSynthStatus) {
                el.diagSynthStatus.textContent = "ONLINE";
            }
        } catch(e) { console.warn("AudioContext unavailable"); }
    }

    function beep() {
        if (!state.audioCtx || !state.alarmOn || state.ringing) return;
        state.ringing = true;
        try {
            const osc  = state.audioCtx.createOscillator();
            const gain = state.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(state.audioCtx.destination);
            osc.type = "sine";
            osc.frequency.setValueAtTime(880, state.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1400, state.audioCtx.currentTime + 0.15);
            gain.gain.setValueAtTime(state.volume * 0.15, state.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, state.audioCtx.currentTime + 0.22);
            osc.start();
            osc.stop(state.audioCtx.currentTime + 0.25);
            osc.onended = () => { state.ringing = false; };
        } catch(e) { state.ringing = false; }
    }

    /* -------------------------------------------------------
       CHART
     ------------------------------------------------------- */
    function initChart() {
        const c = $("analytics-chart");
        if (!c) return;
        state.chart = new Chart(c, {
            type: "bar",
            data: {
                labels: [],
                datasets: [{
                    label: "Detections",
                    data: [],
                    backgroundColor: "rgba(0, 255, 213, 0.12)",
                    borderColor: "rgba(0, 255, 213, 0.65)",
                    borderWidth: 1.5,
                    borderRadius: 4,
                    barThickness: 16,
                    hoverBackgroundColor: "rgba(0, 255, 213, 0.35)"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "#0e111a",
                        titleFont: { family: "Inter", size: 9, weight: "700" },
                        bodyFont:  { family: "Inter", size: 9 },
                        borderColor: "rgba(0, 255, 213, 0.35)",
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: { color: "rgba(255,255,255,0.02)" },
                        ticks: { color: "#64748b", font: { family: "Inter", size: 8, weight: "600" } }
                    },
                    y: {
                        grid: { color: "rgba(255,255,255,0.02)" },
                        beginAtZero: true,
                        ticks: { color: "#64748b", font: { family: "Inter", size: 8, weight: "600" }, stepSize: 1 }
                    }
                }
            }
        });
    }

    function refreshChart(logs) {
        if (!state.chart) return;
        const freq = {};
        logs.forEach(l => { const k = l.label.toUpperCase(); freq[k] = (freq[k]||0)+1; });
        const sorted = Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,8);
        state.chart.data.labels            = sorted.map(x => x[0]);
        state.chart.data.datasets[0].data  = sorted.map(x => x[1]);
        state.chart.update();
    }

    /* -------------------------------------------------------
       ROLLING TIME-WINDOW CHART
     ------------------------------------------------------- */
    function initTimelineChart() {
        const c = $("timeline-chart");
        if (!c) return;
        state.timelineChart = new Chart(c, {
            type: "line",
            data: {
                labels: [],
                datasets: [{
                    label: "Detections",
                    data: [],
                    borderColor: "rgba(0, 255, 213, 0.85)",
                    backgroundColor: "rgba(0, 255, 213, 0.07)",
                    borderWidth: 1.8,
                    fill: true,
                    tension: 0.45,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: "rgba(0, 255, 213, 0.9)",
                    pointBorderWidth: 0,
                    pointHoverBackgroundColor: "#fff"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 250, easing: "easeOutQuart" },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "#0e111a",
                        titleFont: { family: "Inter", size: 9, weight: "700" },
                        bodyFont:  { family: "Inter", size: 9 },
                        borderColor: "rgba(0, 255, 213, 0.3)",
                        borderWidth: 1,
                        callbacks: {
                            label: ctx => ` ${ctx.parsed.y} detection${ctx.parsed.y !== 1 ? "s" : ""}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: "rgba(255,255,255,0.025)" },
                        ticks: {
                            color: "#475569",
                            font: { family: "Inter", size: 8, weight: "600" },
                            maxRotation: 0
                        }
                    },
                    y: {
                        grid: { color: "rgba(255,255,255,0.025)" },
                        beginAtZero: true,
                        min: 0,
                        ticks: {
                            color: "#475569",
                            font: { family: "Inter", size: 8, weight: "600" },
                            stepSize: 1,
                            precision: 0
                        }
                    }
                }
            }
        });
    }

    function refreshTimelineChart() {
        if (!state.timelineChart) return;
        const now       = Date.now();
        const windowSec = state.activeWindow;
        const windowMs  = windowSec === 0 ? Infinity : windowSec * 1000;

        // Choose bucket granularity based on selected window
        let bucketSec, numBuckets;
        if (windowSec === 0) {
            // All-time: 10 dynamic buckets across the full span
            numBuckets = 10;
            const oldest  = state.detectionBuffer.length > 0 ? state.detectionBuffer[0].ts : now;
            const spanSec = Math.max(60, (now - oldest) / 1000);
            bucketSec = Math.ceil(spanSec / numBuckets);
        } else if (windowSec <= 30)  { bucketSec = 5;  numBuckets = 6;  }
        else if (windowSec <= 60)   { bucketSec = 5;  numBuckets = 12; }
        else                         { bucketSec = 20; numBuckets = 15; }

        // Purge entries outside the finite window (keep a tiny buffer for smooth edges)
        if (windowMs !== Infinity) {
            const cutoff = now - windowMs - bucketSec * 1000;
            state.detectionBuffer = state.detectionBuffer.filter(d => d.ts >= cutoff);
        }

        // Build bucket counts and labels (newest bucket = rightmost = "now")
        const buckets = new Array(numBuckets).fill(0);
        const labels  = [];
        for (let i = 0; i < numBuckets; i++) {
            const secAgo = (numBuckets - 1 - i) * bucketSec;
            labels.push(secAgo === 0 ? "now" : `-${secAgo}s`);
        }

        state.detectionBuffer.forEach(d => {
            const ageSec     = (now - d.ts) / 1000;
            const bucketIdx  = numBuckets - 1 - Math.floor(ageSec / bucketSec);
            if (bucketIdx >= 0 && bucketIdx < numBuckets) buckets[bucketIdx]++;
        });

        state.timelineChart.data.labels            = labels;
        state.timelineChart.data.datasets[0].data  = buckets;
        state.timelineChart.update("none"); // skip animation for smooth rolling feel
    }

    /* -------------------------------------------------------
       BACKEND API
     ------------------------------------------------------- */
    async function loadLogs() {
        try {
            const r = await fetch("/api/events");
            if (!r.ok) throw new Error();
            state.logs = await r.json();
            if (el.totalEvents) el.totalEvents.textContent = state.logs.length;
            renderTable(state.logs);
            refreshChart(state.logs);
        } catch(e) { console.error("loadLogs:", e); }
    }

    async function postEvent(label, confidence, bbox) {
        try {
            const r = await fetch("/api/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ label, confidence, bbox })
            });
            if (r.ok) loadLogs();
        } catch(e) { console.error("postEvent:", e); }
    }

    async function deleteEvent(id) {
        try {
            const r = await fetch(`/api/events/${id}`, { method: "DELETE" });
            if (r.ok) loadLogs();
        } catch(e) { console.error("deleteEvent:", e); }
    }

    async function clearAll() {
        if (!confirm("Wipe all persistent sensor logs?")) return;
        try {
            const r = await fetch("/api/events", { method: "DELETE" });
            if (r.ok) loadLogs();
        } catch(e) { console.error("clearAll:", e); }
    }

    /* -------------------------------------------------------
       TABLE LOGS RENDERER
     ------------------------------------------------------- */
    function renderTable(logs) {
        const q  = (el.logSearch?.value || "").trim().toLowerCase();
        const fl = logs.filter(l => l.label.includes(q));
        if (!el.logTbody) return;
        el.logTbody.innerHTML = "";

        if (!fl.length) {
            el.logTbody.innerHTML = `<tr class="empty-row"><td colspan="5">
                <div class="empty-state">
                    <i class="fa-solid fa-signature"></i>
                    <p>No detection incident events logged matching search filters.</p>
                </div>
            </td></tr>`;
            return;
        }

        fl.forEach(log => {
            const pct = Math.round(log.confidence * 100);
            const ts  = new Date(log.timestamp).toLocaleString();
            const cls = badgeClass(log.label);
            let barColor = "var(--cyan)";
            if (log.confidence < 0.6)       barColor = "var(--red)";
            else if (log.confidence < 0.75) barColor = "var(--amber)";
            else                             barColor = "var(--green)";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>#${String(log.id).padStart(4,"0")}</td>
                <td><span class="event-badge ${cls}">${log.label}</span></td>
                <td>
                    <div class="conf-bar-cell">
                        <div class="conf-track-bar"><div class="conf-track-fill" style="width:${pct}%;background:${barColor}"></div></div>
                        <span>${pct}%</span>
                    </div>
                </td>
                <td>${ts}</td>
                <td><button class="btn-delete-row" data-id="${log.id}"><i class="fa-solid fa-trash-can"></i></button></td>
            `;
            tr.querySelector(".btn-delete-row").addEventListener("click", () => deleteEvent(log.id));
            el.logTbody.appendChild(tr);
        });
    }

    function badgeClass(label) {
        if (label === "person")    return "eb-red";
        if (label === "cell_phone" || label === "phone") return "eb-amber";
        if (label === "laptop" || label === "computer")    return "eb-blue";
        if (label === "dog" || label === "cat") return "eb-green";
        return "eb-cyan";
    }

    /* -------------------------------------------------------
       CAMERA STREAM MANAGEMENT
     ------------------------------------------------------- */
    async function populateCamList() {
        try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            const cams = devs.filter(d => d.kind === "videoinput");
            if (!el.selectCamera) return;
            el.selectCamera.innerHTML = "";
            if (!cams.length) {
                el.selectCamera.innerHTML = `<option>No webcams found</option>`;
                return;
            }
            cams.forEach((c, i) => {
                const o = document.createElement("option");
                o.value       = c.deviceId;
                o.textContent = c.label || `Surveillance Camera ${i+1}`;
                if (c.deviceId === state.deviceId) o.selected = true;
                el.selectCamera.appendChild(o);
            });
        } catch(e) { console.error("populateCamList:", e); }
    }

    async function pickBestCamera() {
        const VIRTUAL = ["link to windows","phone link","virtual","droidcam","epoccam","ivcam","disconnected"];
        try {
            const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
            tmp.getTracks().forEach(t => t.stop());
        } catch(_) {}
        const devs = await navigator.mediaDevices.enumerateDevices();
        const cams = devs.filter(d => d.kind === "videoinput");
        let best = cams[0];
        for (const c of cams) {
            const lbl = (c.label || "").toLowerCase();
            if (lbl && !VIRTUAL.some(v => lbl.includes(v))) { best = c; break; }
        }
        if (best) state.deviceId = best.deviceId;
        await populateCamList();
    }

    let _camTimer = null;

    async function startCamera() {
        initAudio();
        showLoading("CONNECTING SENSOR FEED", "Tuning secure pipeline stream...");

        if (_camTimer) clearTimeout(_camTimer);
        _camTimer = setTimeout(() => {
            if (!state.active) showLoading("FEED TIMEOUT", "Please choose target webcam dropdown source.");
        }, 6000);

        const constraints = {
            video: {
                ...(state.deviceId ? { deviceId: { exact: state.deviceId } } : { facingMode: "user" }),
                width:  { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        try {
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (firstErr) {
                if (state.deviceId) {
                    console.warn("Target webcam stream busy. Toggling generic fallback...", firstErr);
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                        audio: false
                    });
                    state.deviceId = null;
                } else {
                    throw firstErr;
                }
            }
            el.webcam.srcObject = stream;

            el.webcam.onloadedmetadata = async () => {
                clearTimeout(_camTimer);
                await el.webcam.play();
                hideLoading();
                syncCanvas();
                await populateCamList();

                if (el.resolution) el.resolution.textContent = `${el.webcam.videoWidth} x ${el.webcam.videoHeight}`;

                state.active = true;
                setPowerUI(true);

                if (el.recBadge) el.recBadge.classList.add("active");
                if (el.vpStandby) el.vpStandby.classList.add("hide");
                if (el.diagSensorState) {
                    el.diagSensorState.textContent = "ACTIVE";
                    el.diagSensorState.className   = "m-value text-green";
                }

                requestAnimationFrame(loop);
            };
        } catch(err) {
            clearTimeout(_camTimer);
            hideLoading();
            setPowerUI(false);
            if (el.vpStandby) el.vpStandby.classList.remove("hide");
            console.error("Camera error:", err.name, err.message);
            alert(`Stream error: ${err.name} — ${err.message}`);
        }
    }

    function stopCamera() {
        const s = el.webcam.srcObject;
        if (s) s.getTracks().forEach(t => t.stop());
        el.webcam.srcObject = null;

        state.active = false;
        setPowerUI(false);
        ctx2d.clearRect(0, 0, el.canvas.width, el.canvas.height);

        if (el.recBadge)   el.recBadge.classList.remove("active");
        if (el.alertBanner) el.alertBanner.classList.add("hide");
        if (el.vpStandby) el.vpStandby.classList.remove("hide");
        if (el.fpsDisplay)     el.fpsDisplay.textContent     = "– FPS";
        if (el.latencyDisplay) el.latencyDisplay.textContent = "– ms";
        if (el.diagSensorState) {
            el.diagSensorState.textContent = "STANDBY";
            el.diagSensorState.className   = "m-value text-amber";
        }
    }

    function setPowerUI(on) {
        if (el.powerSwitch) el.powerSwitch.checked = on;
    }

    function syncCanvas() {
        el.canvas.width  = el.webcam.videoWidth  || el.webcam.clientWidth;
        el.canvas.height = el.webcam.videoHeight || el.webcam.clientHeight;
    }
    window.addEventListener("resize", syncCanvas);

    function showLoading(title, desc) {
        if (!el.loadingOverlay) return;
        el.loadingOverlay.classList.remove("hide");
        if (el.loadingTitle) el.loadingTitle.textContent = title;
        if (el.loadingDesc)  el.loadingDesc.textContent  = desc;
        if (el.vpStandby)    el.vpStandby.classList.add("hide");
    }
    function hideLoading() {
        if (el.loadingOverlay) el.loadingOverlay.classList.add("hide");
    }

    /* -------------------------------------------------------
       INFERENCE LOOP
     ------------------------------------------------------- */
    async function loop() {
        if (!state.active) return;
        const t0 = performance.now();
        try {
            const preds = await state.model.detect(el.webcam);
            state.latency = Math.round(performance.now() - t0);
            if (el.latencyDisplay) el.latencyDisplay.textContent = `${state.latency} ms`;
            countFPS();
            processDetections(preds);
        } catch(e) { console.error("Inference error:", e); }
        requestAnimationFrame(loop);
    }

    function countFPS() {
        const now = performance.now();
        state.frameCount++;
        if (now >= state.fpsTimer + 1000) {
            state.fps       = Math.round((state.frameCount * 1000) / (now - state.fpsTimer));
            state.frameCount = 0;
            state.fpsTimer  = now;
            if (el.fpsDisplay) el.fpsDisplay.textContent = `${state.fps} FPS`;
        }
    }

    /* -------------------------------------------------------
       PROCESS + RENDER DETECTIONS
     ------------------------------------------------------- */
    function processDetections(preds) {
        ctx2d.clearRect(0, 0, el.canvas.width, el.canvas.height);

        const hits = [];
        const curr = new Set();

        preds.forEach(p => {
            const label = p.class.toLowerCase().replace(/ /g, "_");
            if (p.score >= state.threshold && state.targets.has(label)) {
                hits.push({ ...p, class: label });
                curr.add(label);
            }
        });

        if (hits.length) {
            if (el.alertBanner) el.alertBanner.classList.remove("hide");
            if (el.alertText)   el.alertText.textContent = `${hits[0].class.toUpperCase().replace(/_/g," ")} LOCKED`;
            beep();

            const now = Date.now();
            // Push every hit into the rolling detection buffer (for the timeline chart)
            hits.forEach(h => { state.detectionBuffer.push({ ts: now, label: h.class }); });
            refreshTimelineChart();

            hits.forEach(h => {
                const last = state.lastLogged.get(h.class) || 0;
                if (now - last > state.cooldown || !state.prevSet.has(h.class)) {
                    postEvent(h.class, h.score, h.bbox);
                    state.lastLogged.set(h.class, now);
                }
            });
        } else {
            if (el.alertBanner) el.alertBanner.classList.add("hide");
        }

        state.prevSet = curr;
        drawBoxes(hits);
    }

    /* -------------------------------------------------------
       HUD CANVAS OVERLAY
     ------------------------------------------------------- */
    const PALETTE = {
        person:    { c:"#f43f5e", d:"rgba(244,63,94,0.06)",    g:"rgba(244,63,94,0.4)" },
        cell_phone:{ c:"#f59e0b", d:"rgba(245,158,11,0.06)",   g:"rgba(245,158,11,0.4)" },
        laptop:    { c:"#3b82f6", d:"rgba(59,130,246,0.06)",   g:"rgba(59,130,246,0.4)" },
        dog:       { c:"#10b981", d:"rgba(16,185,129,0.06)",   g:"rgba(16,185,129,0.4)" },
        cat:       { c:"#10b981", d:"rgba(16,185,129,0.06)",   g:"rgba(16,185,129,0.4)" },
        _default:  { c:"#00ffd5", d:"rgba(0, 255, 213, 0.06)",  g:"rgba(0, 255, 213, 0.4)" },
    };

    function drawBoxes(preds) {
        preds.forEach(p => {
            const [x, y, w, h] = p.bbox;
            const label = p.class;
            const score = Math.round(p.score * 100);
            const P     = PALETTE[label] || PALETTE._default;
            const cl    = Math.min(16, Math.min(w, h) / 4);

            // Fill background translucent box
            ctx2d.fillStyle = P.d;
            ctx2d.fillRect(x, y, w, h);

            // Stroke glowing outer frame
            ctx2d.save();
            ctx2d.strokeStyle = P.c;
            ctx2d.lineWidth   = 1.5;
            ctx2d.shadowColor = P.g;
            ctx2d.shadowBlur  = 12;
            ctx2d.strokeRect(x, y, w, h);
            ctx2d.restore();

            // Corner brackets
            ctx2d.strokeStyle = P.c;
            ctx2d.lineWidth   = 3.0;
            ctx2d.shadowColor = P.c;
            ctx2d.shadowBlur  = 6;
            [
                [[x+cl,y],[x,y],[x,y+cl]],
                [[x+w-cl,y],[x+w,y],[x+w,y+cl]],
                [[x+cl,y+h],[x,y+h],[x,y+h-cl]],
                [[x+w-cl,y+h],[x+w,y+h],[x+w,y+h-cl]]
            ].forEach(pts => {
                ctx2d.beginPath();
                ctx2d.moveTo(...pts[0]);
                ctx2d.lineTo(...pts[1]);
                ctx2d.lineTo(...pts[2]);
                ctx2d.stroke();
            });
            ctx2d.shadowBlur = 0;

            // Centre crosshairs
            ctx2d.strokeStyle = P.c;
            ctx2d.lineWidth   = 0.5;
            ctx2d.globalAlpha = 0.35;
            ctx2d.beginPath();
            ctx2d.moveTo(x+w/2, y);     ctx2d.lineTo(x+w/2, y+8);
            ctx2d.moveTo(x+w/2, y+h);   ctx2d.lineTo(x+w/2, y+h-8);
            ctx2d.moveTo(x, y+h/2);     ctx2d.lineTo(x+8, y+h/2);
            ctx2d.moveTo(x+w, y+h/2);   ctx2d.lineTo(x+w-8, y+h/2);
            ctx2d.stroke();
            ctx2d.globalAlpha = 1;

            // Floating Label Banner
            const textString = `${label.replace(/_/g," ").toUpperCase()} ${score}%`;
            ctx2d.font = `600 9px 'Inter', sans-serif`;
            const textWidth = ctx2d.measureText(textString).width;

            ctx2d.fillStyle   = P.c;
            ctx2d.shadowColor = P.c;
            ctx2d.shadowBlur  = 6;
            ctx2d.fillRect(x, y - 18, textWidth + 14, 18);
            ctx2d.shadowBlur  = 0;

            ctx2d.fillStyle = "#07090e";
            ctx2d.fillText(textString, x + 7, y - 6);

            // Vector center sweep lines
            ctx2d.strokeStyle = "rgba(0, 255, 213, 0.05)";
            ctx2d.lineWidth   = 0.5;
            ctx2d.globalAlpha = 0.4;
            ctx2d.beginPath();
            ctx2d.moveTo(el.canvas.width/2, el.canvas.height/2);
            ctx2d.lineTo(x+w/2, y+h/2);
            ctx2d.stroke();
            ctx2d.globalAlpha = 1;
        });
    }

    /* -------------------------------------------------------
       EVENT BINDINGS
     ------------------------------------------------------- */

    // Sensor Switch Power
    if (el.powerSwitch) {
        el.powerSwitch.addEventListener("change", e => {
            if (e.target.checked) startCamera(); else stopCamera();
        });
    }

    // Input dropdown source
    if (el.selectCamera) {
        el.selectCamera.addEventListener("change", e => {
            state.deviceId = e.target.value;
            if (state.active) { stopCamera(); startCamera(); }
        });
    }

    // Threshold sensitivity control
    if (el.threshSlider) {
        const syncThresh = val => {
            state.threshold = val / 100;
            if (el.statThreshold) el.statThreshold.textContent = `${val}%`;
        };
        el.threshSlider.addEventListener("input", e => syncThresh(+e.target.value));
        syncThresh(+el.threshSlider.value);
    }

    // Siren alarm toggle
    if (el.alarmSwitch) {
        el.alarmSwitch.addEventListener("change", e => {
            state.alarmOn = e.target.checked;
            if (state.alarmOn) {
                initAudio();
                if (state.audioCtx?.state === "suspended") state.audioCtx.resume();
            }
        });
    }

    // Alarm Volume control
    if (el.volumeSlider) {
        el.volumeSlider.addEventListener("input", e => {
            state.volume = e.target.value / 100;
            if (el.volumeVal) el.volumeVal.textContent = `${e.target.value}%`;
        });
    }

    // Search filters listener
    if (el.filterSearch) {
        el.filterSearch.addEventListener("input", () => {
            renderFilters();
        });
    }

    // Update diagnosis info status
    function updateAlarmTargetDiag() {
        if (!el.diagAlarmTarget) return;
        el.diagAlarmTarget.textContent =
            state.targets.size === ALL_UNIQUE_KEYS.length ? "ALL" :
            state.targets.size === 0 ? "NONE" :
            `${state.targets.size} CLASS`;

        if (el.filterBadge) {
            el.filterBadge.textContent = `${state.targets.size} ACTIVE`;
        }
    }

    // Bulk selections
    if (el.btnSelectAll) {
        el.btnSelectAll.addEventListener("click", () => {
            ALL_UNIQUE_KEYS.forEach(k => state.targets.add(k));
            ALL_UNIQUE_KEYS.forEach(k => {
                const b = document.getElementById(`class-${k}`);
                if (b) b.checked = true;
            });
            updateAlarmTargetDiag();
        });
    }

    if (el.btnSelectNone) {
        el.btnSelectNone.addEventListener("click", () => {
            state.targets.clear();
            ALL_UNIQUE_KEYS.forEach(k => {
                const b = document.getElementById(`class-${k}`);
                if (b) b.checked = false;
            });
            updateAlarmTargetDiag();
        });
    }

    if (el.btnInvert) {
        el.btnInvert.addEventListener("click", () => {
            ALL_UNIQUE_KEYS.forEach(k => {
                if (state.targets.has(k)) {
                    state.targets.delete(k);
                    const b = document.getElementById(`class-${k}`);
                    if (b) b.checked = false;
                } else {
                    state.targets.add(k);
                    const b = document.getElementById(`class-${k}`);
                    if (b) b.checked = true;
                }
            });
            updateAlarmTargetDiag();
        });
    }

    // Incident log table search query
    if (el.logSearch) {
        el.logSearch.addEventListener("input", () => renderTable(state.logs));
    }

    // System exports logs to CSV file
    if (el.btnExportCsv) {
        el.btnExportCsv.addEventListener("click", () => { window.location.href = "/api/export"; });
    }

    // Wipe logs database
    if (el.btnClearDb) {
        el.btnClearDb.addEventListener("click", clearAll);
    }

    /* -------------------------------------------------------
       INITIALIZATION
     ------------------------------------------------------- */
    async function init() {
        initChart();
        initTimelineChart();
        renderFilters();
        updateAlarmTargetDiag();
        await loadLogs();
        await populateCamList();

        // Wire up time-window tab buttons
        document.querySelectorAll(".chart-tab").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".chart-tab").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                state.activeWindow = parseInt(btn.dataset.window, 10);
                refreshTimelineChart();
            });
        });

        // Rolling 2-second tick — makes the chart scroll forward even with no new events
        setInterval(refreshTimelineChart, 2000);

        showLoading("INITIALIZING NEURAL NET", "Fetching COCO-SSD weights from node...");

        try {
            state.model = await cocoSsd.load();
            state.ready = true;
            setBadge("online", "ONLINE");
            hideLoading();

            if (el.vpStandby) el.vpStandby.classList.remove("hide");
            await pickBestCamera();

        } catch(e) {
            console.error("TensorFlow initialization error:", e);
            setBadge("error", "ERROR");
            showLoading("NEURAL NETWORK ERROR", "Network error. Check server logs.");
        }
    }

    init();
});
