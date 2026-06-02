/* ==========================================================================
   CAMSPY ENGINE — v3 (Original HUD Layout)
   Wires exactly to the rebuilt index.html DOM IDs.
   TensorFlow.js COCO-SSD | Web Audio | FastAPI Backend
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {

    /* -------------------------------------------------------
       DOM NODES — every ID exists in the current index.html
    ------------------------------------------------------- */
    const $  = id => document.getElementById(id);
    const $$ = sel => document.querySelector(sel);

    const el = {
        // Header
        timestamp:      $("header-timestamp"),
        engineBadge:    $("model-status-badge"),

        // Feed section
        liveIndicator:  $("live-indicator"),
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

        // Filter buttons
        btnSelectAll:   $("btn-select-all"),
        btnSelectNone:  $("btn-select-none"),
        btnInvert:      $("btn-invert"),
        filterBadge:    $("filter-active-badge"),

        // Data actions
        btnExportCsv:   $("btn-export-csv-new"),
        btnClearDb:     $("btn-clear-db-new"),

        // Log table
        logSearch:      $("log-search"),
        logTbody:       $("event-log-tbody"),
    };

    /* -------------------------------------------------------
       STATE
    ------------------------------------------------------- */
    const TARGET_KEYS = [
        "person","cell_phone","laptop","keyboard","cup","bottle",
        "chair","couch","potted_plant","book","clock","scissors",
        "backpack","umbrella","dog","cat",
        "handbag","tie","suitcase","bicycle","mouse"
    ];

    const state = {
        model:          null,
        ready:          false,
        active:         false,
        deviceId:       null,
        threshold:      0.65,
        targets:        new Set(TARGET_KEYS),

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
       ENGINE BADGE
    ------------------------------------------------------- */
    function setBadge(mode, text) {
        if (!el.engineBadge) return;
        el.engineBadge.className = `engine-badge badge-${mode}`;
        el.engineBadge.innerHTML =
            mode === "loading" ? `<i class="fa-solid fa-circle-notch fa-spin"></i> ${text}` :
            mode === "online"  ? `<i class="fa-solid fa-circle-check"></i> ${text}` :
                                 `<i class="fa-solid fa-circle-xmark"></i> ${text}`;
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
                    backgroundColor: "rgba(0,229,200,0.15)",
                    borderColor: "rgba(0,229,200,0.7)",
                    borderWidth: 1.5,
                    barThickness: 18,
                    hoverBackgroundColor: "rgba(0,229,200,0.3)"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "#0b0e15",
                        titleFont: { family: "Orbitron", size: 9, weight: "700" },
                        bodyFont:  { family: "Orbitron", size: 9 },
                        borderColor: "rgba(0,229,200,0.4)",
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid: { color: "rgba(255,255,255,0.03)" },
                        ticks: { color: "#5a7080", font: { family: "Orbitron", size: 8, weight: "600" } }
                    },
                    y: {
                        grid: { color: "rgba(255,255,255,0.03)" },
                        beginAtZero: true,
                        ticks: { color: "#5a7080", font: { family: "Orbitron", size: 8, weight: "600" }, stepSize: 1 }
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
        state.chart.data.labels             = sorted.map(x => x[0]);
        state.chart.data.datasets[0].data  = sorted.map(x => x[1]);
        state.chart.update();
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
        if (!confirm("Clear ALL sensor event logs?")) return;
        try {
            const r = await fetch("/api/events", { method: "DELETE" });
            if (r.ok) loadLogs();
        } catch(e) { console.error("clearAll:", e); }
    }

    /* -------------------------------------------------------
       TABLE RENDERER
    ------------------------------------------------------- */
    function renderTable(logs) {
        const q  = (el.logSearch?.value || "").trim().toLowerCase();
        const fl = logs.filter(l => l.label.includes(q));
        if (!el.logTbody) return;
        el.logTbody.innerHTML = "";

        if (!fl.length) {
            el.logTbody.innerHTML = `<tr class="empty-row"><td colspan="5">
                <i class="fa-solid fa-wave-square"></i>
                <p>No events found — start detection to populate logs.</p>
            </td></tr>`;
            return;
        }

        fl.forEach(log => {
            const pct = Math.round(log.confidence * 100);
            const ts  = new Date(log.timestamp).toLocaleString();
            const cls = badgeClass(log.label);
            let barColor = "#00e5c8";
            if (log.confidence < 0.6)       barColor = "#f43f5e";
            else if (log.confidence < 0.75) barColor = "#f59e0b";
            else                             barColor = "#22d3a5";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>#${String(log.id).padStart(4,"0")}</td>
                <td><span class="lbadge ${cls}">${log.label}</span></td>
                <td>
                    <div class="conf-cell">
                        <div class="conf-bar"><div class="conf-fill" style="width:${pct}%;background:${barColor}"></div></div>
                        <span class="conf-pct">${pct}%</span>
                    </div>
                </td>
                <td>${ts}</td>
                <td><button class="btn-del" data-id="${log.id}"><i class="fa-solid fa-trash"></i></button></td>
            `;
            tr.querySelector(".btn-del").addEventListener("click", () => deleteEvent(log.id));
            el.logTbody.appendChild(tr);
        });
    }

    function badgeClass(label) {
        if (label === "person")    return "lbadge-red";
        if (label === "cell_phone") return "lbadge-amber";
        if (label === "laptop")    return "lbadge-blue";
        if (label === "dog" || label === "cat") return "lbadge-green";
        return "";
    }

    /* -------------------------------------------------------
       CAMERA MANAGEMENT
    ------------------------------------------------------- */
    async function populateCamList() {
        try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            const cams = devs.filter(d => d.kind === "videoinput");
            if (!el.selectCamera) return;
            el.selectCamera.innerHTML = "";
            if (!cams.length) {
                el.selectCamera.innerHTML = `<option>No cameras found</option>`;
                return;
            }
            cams.forEach((c, i) => {
                const o = document.createElement("option");
                o.value       = c.deviceId;
                o.textContent = c.label || `Camera ${i+1}`;
                if (c.deviceId === state.deviceId) o.selected = true;
                el.selectCamera.appendChild(o);
            });
        } catch(e) { console.error("populateCamList:", e); }
    }

    async function pickBestCamera() {
        const VIRTUAL = ["link to windows","phone link","virtual","droidcam","epoccam","ivcam","disconnected"];
        try {
            // brief request to unlock labels
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
        showLoading("CONNECTING WEBCAM", "Requesting camera stream...");

        if (_camTimer) clearTimeout(_camTimer);
        _camTimer = setTimeout(() => {
            if (!state.active) showLoading("TIMEOUT", "Select your webcam in the dropdown below.");
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
                    console.warn("Primary camera stream busy or unavailable. Attempting generic fallback...", firstErr);
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        },
                        audio: false
                    });
                    // Reset deviceId to let browser selection take over
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
                    el.diagSensorState.className   = "diag-value text-cyan";
                }

                requestAnimationFrame(loop);
            };
        } catch(err) {
            clearTimeout(_camTimer);
            hideLoading();
            setPowerUI(false);
            if (el.vpStandby) el.vpStandby.classList.remove("hide");
            console.error("Camera error:", err.name, err.message);
            alert(`Camera error: ${err.name} — ${err.message}`);
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
        if (el.fpsDisplay)     el.fpsDisplay.textContent     = "0 FPS";
        if (el.latencyDisplay) el.latencyDisplay.textContent = "0 ms";
        if (el.diagSensorState) {
            el.diagSensorState.textContent = "STANDBY";
            el.diagSensorState.className   = "diag-value text-amber";
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
       DETECTION LOOP
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
       PROCESS + DRAW DETECTIONS
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
       HUD BOUNDING BOX RENDERER
    ------------------------------------------------------- */
    const PALETTE = {
        person:    { c:"#f43f5e", d:"rgba(244,63,94,0.1)",    g:"rgba(244,63,94,0.5)" },
        cell_phone:{ c:"#f59e0b", d:"rgba(245,158,11,0.1)",   g:"rgba(245,158,11,0.5)" },
        laptop:    { c:"#38bdf8", d:"rgba(56,189,248,0.1)",   g:"rgba(56,189,248,0.5)" },
        dog:       { c:"#22d3a5", d:"rgba(34,211,165,0.1)",   g:"rgba(34,211,165,0.5)" },
        cat:       { c:"#22d3a5", d:"rgba(34,211,165,0.1)",   g:"rgba(34,211,165,0.5)" },
        _default:  { c:"#00e5c8", d:"rgba(0,229,200,0.1)",    g:"rgba(0,229,200,0.5)" },
    };

    function drawBoxes(preds) {
        preds.forEach(p => {
            const [x, y, w, h] = p.bbox;
            const label = p.class;
            const score = Math.round(p.score * 100);
            const P     = PALETTE[label] || PALETTE._default;
            const cl    = Math.min(16, Math.min(w, h) / 4);

            // Fill
            ctx2d.fillStyle = P.d;
            ctx2d.fillRect(x, y, w, h);

            // Glowing border
            ctx2d.save();
            ctx2d.strokeStyle = P.c;
            ctx2d.lineWidth   = 1.5;
            ctx2d.shadowColor = P.g;
            ctx2d.shadowBlur  = 12;
            ctx2d.strokeRect(x, y, w, h);
            ctx2d.restore();

            // Corner brackets
            ctx2d.strokeStyle = P.c;
            ctx2d.lineWidth   = 2.5;
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

            // Centre tick marks
            ctx2d.strokeStyle = P.c;
            ctx2d.lineWidth   = 0.5;
            ctx2d.globalAlpha = 0.4;
            ctx2d.beginPath();
            ctx2d.moveTo(x+w/2, y);     ctx2d.lineTo(x+w/2, y+8);
            ctx2d.moveTo(x+w/2, y+h);   ctx2d.lineTo(x+w/2, y+h-8);
            ctx2d.moveTo(x, y+h/2);     ctx2d.lineTo(x+8, y+h/2);
            ctx2d.moveTo(x+w, y+h/2);   ctx2d.lineTo(x+w-8, y+h/2);
            ctx2d.stroke();
            ctx2d.globalAlpha = 1;

            // Label badge
            const txt = `${label.replace(/_/g," ").toUpperCase()} ${score}%`;
            ctx2d.font = `bold 8px 'Orbitron', monospace`;
            const tw   = ctx2d.measureText(txt).width;

            ctx2d.fillStyle   = P.c;
            ctx2d.shadowColor = P.c;
            ctx2d.shadowBlur  = 6;
            ctx2d.fillRect(x, y - 17, tw + 12, 17);
            ctx2d.shadowBlur  = 0;

            ctx2d.fillStyle = "#060a0f";
            ctx2d.fillText(txt, x + 6, y - 5);

            // Radar line from centre
            ctx2d.strokeStyle = "rgba(0,229,200,0.08)";
            ctx2d.lineWidth   = 0.5;
            ctx2d.globalAlpha = 0.5;
            ctx2d.beginPath();
            ctx2d.moveTo(el.canvas.width/2, el.canvas.height/2);
            ctx2d.lineTo(x+w/2, y+h/2);
            ctx2d.stroke();
            ctx2d.globalAlpha = 1;
        });
    }

    /* -------------------------------------------------------
       EVENT LISTENERS
    ------------------------------------------------------- */

    // Sensor Power toggle
    if (el.powerSwitch) {
        el.powerSwitch.addEventListener("change", e => {
            if (e.target.checked) startCamera(); else stopCamera();
        });
    }

    // Camera dropdown
    if (el.selectCamera) {
        el.selectCamera.addEventListener("change", e => {
            state.deviceId = e.target.value;
            if (state.active) { stopCamera(); startCamera(); }
        });
    }

    // Confidence threshold
    if (el.threshSlider) {
        const syncThresh = val => {
            state.threshold = val / 100;
            if (el.statThreshold) el.statThreshold.textContent = `${val}%`;
        };
        el.threshSlider.addEventListener("input", e => syncThresh(+e.target.value));
        syncThresh(+el.threshSlider.value);
    }

    // Alarm switch
    if (el.alarmSwitch) {
        el.alarmSwitch.addEventListener("change", e => {
            state.alarmOn = e.target.checked;
            if (state.alarmOn) {
                initAudio();
                if (state.audioCtx?.state === "suspended") state.audioCtx.resume();
            }
        });
    }

    // Volume slider
    if (el.volumeSlider) {
        el.volumeSlider.addEventListener("input", e => {
            state.volume = e.target.value / 100;
            if (el.volumeVal) el.volumeVal.textContent = `${e.target.value}%`;
        });
    }

    // Target checkboxes
    TARGET_KEYS.forEach(key => {
        const box = $(` class-${key}`.trim()) || $(`class-${key}`);
        if (box) {
            box.addEventListener("change", e => {
                if (e.target.checked) state.targets.add(key);
                else                  state.targets.delete(key);
                updateAlarmTargetDiag();
            });
        }
    });

    function updateAlarmTargetDiag() {
        if (el.diagAlarmTarget) {
            el.diagAlarmTarget.textContent =
                state.targets.size === TARGET_KEYS.length ? "ALL" :
                state.targets.size === 0 ? "NONE" :
                `${state.targets.size} CLASS`;
        }
        if (el.filterBadge) {
            el.filterBadge.textContent = state.targets.size + " ACTIVE";
        }
    }

    if (el.btnSelectAll) {
        el.btnSelectAll.addEventListener("click", () => {
            TARGET_KEYS.forEach(k => {
                const b = $(`class-${k}`);
                if (b) { b.checked = true; state.targets.add(k); }
            });
            updateAlarmTargetDiag();
        });
    }
    if (el.btnSelectNone) {
        el.btnSelectNone.addEventListener("click", () => {
            TARGET_KEYS.forEach(k => {
                const b = $(`class-${k}`);
                if (b) { b.checked = false; state.targets.delete(k); }
            });
            updateAlarmTargetDiag();
        });
    }
    if (el.btnInvert) {
        el.btnInvert.addEventListener("click", () => {
            TARGET_KEYS.forEach(k => {
                const b = $(`class-${k}`);
                if (!b) return;
                if (b.checked) {
                    b.checked = false;
                    state.targets.delete(k);
                } else {
                    b.checked = true;
                    state.targets.add(k);
                }
            });
            updateAlarmTargetDiag();
        });
    }

    // Log search
    if (el.logSearch) {
        el.logSearch.addEventListener("input", () => renderTable(state.logs));
    }

    // Export CSV
    if (el.btnExportCsv) {
        el.btnExportCsv.addEventListener("click", () => { window.location.href = "/api/export"; });
    }

    // Clear DB
    if (el.btnClearDb) {
        el.btnClearDb.addEventListener("click", clearAll);
    }

    /* -------------------------------------------------------
       INITIALISATION
    ------------------------------------------------------- */
    async function init() {
        initChart();
        await loadLogs();
        await populateCamList();

        // Show standby state while model loads
        showLoading("INITIALIZING NEURAL NET", "Downloading COCO-SSD model weights...");

        try {
            state.model = await cocoSsd.load();
            state.ready = true;
            setBadge("online", "ONLINE");
            hideLoading();

            // Show standby icon — waiting for user to toggle power
            if (el.vpStandby) el.vpStandby.classList.remove("hide");

            // Pick best camera but DON'T auto-start — let user toggle sensor power
            await pickBestCamera();

        } catch(e) {
            console.error("Model load failed:", e);
            setBadge("error", "ERROR");
            showLoading("MODEL LOAD FAILED", "Check internet connection and reload.");
        }
    }

    init();
});
