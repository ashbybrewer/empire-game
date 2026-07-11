/* Forensic Microscope — local 2.5D block view, street section, causal chain, evidence */
const Microscope = (() => {
  let root, canvas, cx, tab = 'block';
  let locked = null;      // { z, latlng }
  let preview = null;     // { z, latlng }
  let t = -13;
  let hoverTimer = null;
  let animId = 0;
  let pageHidden = false;
  let waterPhase = 0;
  let transectPts = null; // [L.LatLng, L.LatLng]
  let scanFlash = 0;
  let geomCache = new Map();
  let lastKey = '';

  const TABS = [
    ['block', 'Block View'],
    ['section', 'Street Section'],
    ['why', 'Why Flooded?'],
    ['evidence', 'Evidence']
  ];

  function active() {
    return locked || preview || null;
  }

  function hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function det(seed, i) {
    return hash(seed * 17.13 + i * 91.7);
  }

  /* Deterministic local block geometry around a lat/lng — not a second city map */
  function buildLocalGeom(lat, lon, elev) {
    const key = lat.toFixed(4) + ',' + lon.toFixed(4) + ':' + elev;
    if (geomCache.has(key)) return geomCache.get(key);
    if (geomCache.size > 40) geomCache.clear();

    const seed = Math.round(lat * 1e4) * 1000 + Math.round(Math.abs(lon) * 1e4) % 1000;
    const blocks = 3; // ~3×3 blocks
    const blockFt = 320;
    const streetFt = 48;
    const half = (blocks * blockFt + (blocks + 1) * streetFt) / 2;

    const streets = [];
    for (let i = 0; i <= blocks; i++) {
      const o = -half + i * (blockFt + streetFt) + streetFt / 2;
      streets.push({ axis: 'ns', x: o, w: streetFt });
      streets.push({ axis: 'ew', y: o, w: streetFt });
    }

    const buildings = [];
    let bi = 0;
    for (let by = 0; by < blocks; by++) {
      for (let bx = 0; bx < blocks; bx++) {
        const ox = -half + streetFt + bx * (blockFt + streetFt);
        const oy = -half + streetFt + by * (blockFt + streetFt);
        const lots = 2 + Math.floor(det(seed, bi) * 2); // 2–3 lots per side
        const lotW = (blockFt - 16) / lots;
        for (let side = 0; side < 2; side++) {
          for (let li = 0; li < lots; li++) {
            const pad = 6 + det(seed, bi + li + side * 9) * 8;
            const fw = lotW - pad;
            const fd = 38 + det(seed, bi * 3 + li) * 55;
            const x = ox + li * lotW + pad / 2;
            const y = side === 0 ? oy + 8 : oy + blockFt - 8 - fd;
            // Deterministic height from footprint (conservative residential)
            const footprint = fw * fd;
            const stories = footprint > 2800 ? 2 : 1;
            const h = stories * (10 + det(seed, bi + li * 5) * 4) + (footprint > 4000 ? 4 : 0);
            const lotElev = elev + (det(seed, bi + 40 + li) - 0.5) * 1.4
              + (Math.abs(x) + Math.abs(y)) / half * (elev < 0 ? -0.6 : 0.4);
            buildings.push({
              x, y, w: fw, d: fd, h,
              elev: lotElev,
              id: bi + '-' + side + '-' + li
            });
          }
        }
        bi++;
      }
    }

    // Contour-ish ground samples
    const ground = [];
    for (let gy = -half; gy <= half; gy += 40) {
      for (let gx = -half; gx <= half; gx += 40) {
        const gElev = elev
          + (det(seed, gx * 0.1 + gy) - 0.5) * 1.8
          + Math.sin(gx / 90) * 0.4
          + Math.cos(gy / 110) * 0.35;
        ground.push({ x: gx, y: gy, elev: gElev });
      }
    }

    const geom = { half, streets, buildings, ground, seed, blockFt, streetFt };
    geomCache.set(key, geom);
    return geom;
  }

  function peakDepth(z) {
    if (!z || !z.kf) return 0;
    return z.kf.reduce((m, p) => Math.max(m, p[1]), 0);
  }

  function peakTime(z) {
    if (!z || !z.kf) return null;
    let best = z.kf[0];
    z.kf.forEach(p => { if (p[1] >= best[1]) best = p; });
    return best[0];
  }

  function arrivalTime(z) {
    if (!z) return null;
    if (z.entry === 'none') return null;
    return ENTRY_TIME[z.entry] != null ? ENTRY_TIME[z.entry] : null;
  }

  function primaryBreach(z, time) {
    if (!z) return null;
    const st = MapView.floodState(z, time);
    if (st.breach) return st.breach;
    // fallback: first breach matching entry source
    return BREACH.find(b => b.source === z.entry) || null;
  }

  function secondarySource(z) {
    if (!z) return null;
    if (z.entry === 'lonS') return BREACH.find(b => b.id === 'lonN') || null;
    if (z.entry === 'lonN') return BREACH.find(b => b.id === 'lonS') || null;
    if (z.entry === 'ihnc') return BREACH.find(b => b.id === 'ihncS' || b.id === 'ihncN') || null;
    if (z.entry === 'gravity') return BREACH.find(b => b.id === 'b17') || null;
    return null;
  }

  function relevantPumps(z) {
    if (!z) return [];
    const map = {
      b17: ['ps6'], lonS: ['ps3'], lonN: ['ps3'], ihnc: ['ps19', 'ps5'],
      gravity: ['ps1', 'ps7'], mrgo: [], giww: ['noe'], noeL: ['noe'], jeff: ['jeffp']
    };
    const ids = map[z.entry] || [];
    return PUMPS.filter(p => ids.includes(p.id));
  }

  function pumpStatus(p, time) {
    let st = p.st[0][1];
    p.st.forEach(([tt, s]) => { if (time >= tt) st = s; });
    return st;
  }

  function flowBearing(z, time) {
    const st = MapView.floodState(z, time);
    if (st.bearing != null) return st.bearing;
    const b = primaryBreach(z, time);
    if (!b || !z) return 0;
    return Math.atan2(z.label[1] - b.lat, z.label[0] - b.lon) * 180 / Math.PI;
  }

  function confidence(z) {
    return MapView.confidenceForZone ? MapView.confidenceForZone(z) : { level: 'MODELED', score: 0.5 };
  }

  function modeledRoute(z) {
    if (!z) return null;
    const b = primaryBreach(z, Math.max(t, arrivalTime(z) || t));
    if (!b) return null;
    const lat0 = b.lat, lon0 = b.lon;
    const lat1 = locked && locked.latlng ? locked.latlng.lat : (preview && preview.latlng ? preview.latlng.lat : z.label[1]);
    const lon1 = locked && locked.latlng ? locked.latlng.lng : (preview && preview.latlng ? preview.latlng.lng : z.label[0]);
    // Low-ground corridor: slight bend toward lower elev (south of lake canals)
    const midLat = (lat0 + lat1) / 2 - 0.002;
    const midLon = (lon0 + lon1) / 2;
    return [[lat0, lon0], [midLat, midLon], [lat1, lon1]];
  }

  function sizeCanvas() {
    if (!canvas) return;
    const wrap = root.querySelector('.fm-viz');
    const r = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(200, r.width);
    const h = Math.max(220, r.height);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  /* ---- isometric helpers ---- */
  function iso(x, y, z) {
    return { X: (x - y) * 0.55, Y: (x + y) * 0.28 - z * 0.55 };
  }

  function drawBlockView(W, H, sel) {
    cx.clearRect(0, 0, W, H);
    // engineering sheet backdrop
    cx.fillStyle = '#0A111C';
    cx.fillRect(0, 0, W, H);
    cx.strokeStyle = 'rgba(29,49,73,.55)';
    cx.lineWidth = 1;
    for (let x = 0; x < W; x += 24) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); }
    for (let y = 0; y < H; y += 24) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }

    if (!sel) {
      drawBasinOverview(W, H);
      return;
    }

    const lat = sel.latlng.lat, lon = sel.latlng.lng;
    const geom = buildLocalGeom(lat, lon, sel.z.elev);
    const st = MapView.floodState(sel.z, t);
    const depth = st.depth;
    const peak = peakDepth(sel.z);
    const bearing = flowBearing(sel.z, t);
    const ox = W * 0.52, oy = H * 0.58;
    const scale = Math.min(W, H) / (geom.half * 2.6);

    const toScreen = (x, y, z) => {
      const p = iso(x, y, z);
      return { x: ox + p.X * scale, y: oy + p.Y * scale };
    };

    // Ground plane with slight elev contour
    const half = geom.half;
    const corners = [[-half, -half], [half, -half], [half, half], [-half, half]].map(([x, y]) => toScreen(x, y, 0));
    cx.beginPath();
    corners.forEach((p, i) => i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y));
    cx.closePath();
    cx.fillStyle = '#132238';
    cx.fill();
    cx.strokeStyle = 'rgba(127,196,220,.35)';
    cx.stroke();

    // Contour ticks
    cx.strokeStyle = 'rgba(127,196,220,.12)';
    geom.ground.forEach(g => {
      const p = toScreen(g.x, g.y, (g.elev - sel.z.elev) * 2);
      cx.beginPath(); cx.arc(p.x, p.y, 1.2, 0, 7); cx.stroke();
    });

    // Streets
    geom.streets.forEach(s => {
      if (s.axis === 'ns') {
        const a = toScreen(s.x - s.w / 2, -half, 0);
        const b = toScreen(s.x + s.w / 2, -half, 0);
        const c = toScreen(s.x + s.w / 2, half, 0);
        const d = toScreen(s.x - s.w / 2, half, 0);
        cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.lineTo(c.x, c.y); cx.lineTo(d.x, d.y); cx.closePath();
      } else {
        const a = toScreen(-half, s.y - s.w / 2, 0);
        const b = toScreen(half, s.y - s.w / 2, 0);
        const c = toScreen(half, s.y + s.w / 2, 0);
        const d = toScreen(-half, s.y + s.w / 2, 0);
        cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.lineTo(c.x, c.y); cx.lineTo(d.x, d.y); cx.closePath();
      }
      cx.fillStyle = '#1a2a3c';
      cx.fill();
      cx.strokeStyle = 'rgba(140,160,179,.25)';
      cx.stroke();
    });

    // Animated water sheet along streets / lots
    if (depth > 0.08) {
      const waterZ = depth * 1.8;
      const pulse = 0.85 + 0.15 * Math.sin(waterPhase);
      const a = clamp(0.18 + depth / 18, 0.15, 0.55) * pulse * Math.max(0.35, st.progress);
      cx.fillStyle = `rgba(30,110,160,${a})`;
      const wa = toScreen(-half, -half, waterZ);
      const wb = toScreen(half, -half, waterZ);
      const wc = toScreen(half, half, waterZ);
      const wd = toScreen(-half, half, waterZ);
      cx.beginPath(); cx.moveTo(wa.x, wa.y); cx.lineTo(wb.x, wb.y); cx.lineTo(wc.x, wc.y); cx.lineTo(wd.x, wd.y); cx.closePath();
      cx.fill();

      // Flow direction chevrons
      const ang = bearing * Math.PI / 180;
      const fx = Math.cos(ang) * half * 0.35;
      const fy = Math.sin(ang) * half * 0.35;
      for (let i = -1; i <= 1; i++) {
        const px = fx + Math.cos(ang + Math.PI / 2) * i * 40;
        const py = fy + Math.sin(ang + Math.PI / 2) * i * 40;
        const p0 = toScreen(px - Math.cos(ang) * 28, py - Math.sin(ang) * 28, waterZ + 1);
        const p1 = toScreen(px + Math.cos(ang) * 28, py + Math.sin(ang) * 28, waterZ + 1);
        cx.strokeStyle = 'rgba(255,180,84,.7)';
        cx.lineWidth = 1.5;
        cx.beginPath(); cx.moveTo(p0.x, p0.y); cx.lineTo(p1.x, p1.y); cx.stroke();
        const tip = toScreen(px + Math.cos(ang) * 28, py + Math.sin(ang) * 28, waterZ + 1);
        cx.fillStyle = 'rgba(255,180,84,.8)';
        cx.beginPath();
        cx.arc(tip.x, tip.y, 2.5, 0, 7);
        cx.fill();
      }
    }

    // Buildings extruded — sorted back-to-front
    const sorted = geom.buildings.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
    sorted.forEach(b => {
      const localDepth = Math.max(0, depth - Math.max(0, b.elev - sel.z.elev) * 0.3);
      drawBuilding(b, toScreen, localDepth, scale);
    });

    // Selected point
    const selP = toScreen(0, 0, depth + 2);
    cx.strokeStyle = '#FFB454';
    cx.lineWidth = 1.5;
    cx.beginPath(); cx.arc(selP.x, selP.y, 7, 0, 7); cx.stroke();
    cx.beginPath(); cx.moveTo(selP.x - 11, selP.y); cx.lineTo(selP.x + 11, selP.y); cx.stroke();
    cx.beginPath(); cx.moveTo(selP.x, selP.y - 11); cx.lineTo(selP.x, selP.y + 11); cx.stroke();

    // HUD: N arrow, scale, times, depths
    drawHud(W, H, sel, depth, peak);

    if (scanFlash > 0) {
      cx.fillStyle = `rgba(127,196,220,${0.08 * scanFlash})`;
      for (let y = 0; y < H; y += 3) cx.fillRect(0, y, W, 1);
    }
  }

  function drawBuilding(b, toScreen, depth, scale) {
    const h = b.h;
    const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.d;
    const base = 0;
    const top = h;

    // Flood classification colors
    let fill = '#2a3a4a', stroke = 'rgba(140,160,179,.45)';
    if (depth > 0.15 && depth < 1.5) { fill = '#2e4a58'; stroke = 'rgba(127,196,220,.5)'; } // yard/street
    else if (depth >= 1.5 && depth < 4) { fill = '#1e4a62'; stroke = 'rgba(127,196,220,.7)'; } // shallow structure
    else if (depth >= 4 && depth < 8) { fill = '#163d58'; stroke = 'rgba(255,90,69,.45)'; } // deep
    else if (depth >= 8) { fill = '#0f2e44'; stroke = 'rgba(255,90,69,.7)'; } // near-roof

    const bl = toScreen(x0, y0, base);
    const br = toScreen(x1, y0, base);
    const fr = toScreen(x1, y1, base);
    const fl = toScreen(x0, y1, base);
    const tl = toScreen(x0, y0, top);
    const tr = toScreen(x1, y0, top);
    const tfr = toScreen(x1, y1, top);
    const tfl = toScreen(x0, y1, top);

    // Left face
    cx.beginPath(); cx.moveTo(fl.x, fl.y); cx.lineTo(fr.x, fr.y); cx.lineTo(tfr.x, tfr.y); cx.lineTo(tfl.x, tfl.y); cx.closePath();
    cx.fillStyle = shade(fill, -18); cx.fill(); cx.strokeStyle = stroke; cx.lineWidth = 0.8; cx.stroke();
    // Right face
    cx.beginPath(); cx.moveTo(br.x, br.y); cx.lineTo(fr.x, fr.y); cx.lineTo(tfr.x, tfr.y); cx.lineTo(tr.x, tr.y); cx.closePath();
    cx.fillStyle = shade(fill, -8); cx.fill(); cx.stroke();
    // Roof
    cx.beginPath(); cx.moveTo(tl.x, tl.y); cx.lineTo(tr.x, tr.y); cx.lineTo(tfr.x, tfr.y); cx.lineTo(tfl.x, tfl.y); cx.closePath();
    cx.fillStyle = shade(fill, 10); cx.fill(); cx.stroke();

    // Depth ticks on front face when wet
    if (depth > 0.3) {
      const tickFt = Math.min(depth, h);
      const steps = Math.max(1, Math.floor(tickFt / 2));
      for (let i = 1; i <= steps; i++) {
        const zh = Math.min(i * 2, tickFt);
        const a = toScreen(x0, y1, zh);
        const c = toScreen(x1, y1, zh);
        cx.strokeStyle = 'rgba(127,196,220,.55)';
        cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(c.x, c.y); cx.stroke();
      }
    }
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
    return `rgb(${r|0},${g|0},${b|0})`;
  }

  function drawHud(W, H, sel, depth, peak) {
    // North arrow
    cx.save();
    cx.translate(W - 36, 36);
    cx.strokeStyle = '#7FC4DC'; cx.fillStyle = '#7FC4DC'; cx.lineWidth = 1.2;
    cx.beginPath(); cx.moveTo(0, 14); cx.lineTo(0, -14); cx.stroke();
    cx.beginPath(); cx.moveTo(0, -14); cx.lineTo(-4, -6); cx.lineTo(4, -6); cx.closePath(); cx.fill();
    cx.font = '9px IBM Plex Mono'; cx.textAlign = 'center'; cx.fillText('N', 0, -18);
    cx.restore();

    // Scale bar (~200 ft)
    cx.strokeStyle = '#8CA0B3'; cx.fillStyle = '#8CA0B3';
    cx.lineWidth = 1.5;
    cx.beginPath(); cx.moveTo(16, H - 18); cx.lineTo(86, H - 18); cx.stroke();
    cx.beginPath(); cx.moveTo(16, H - 22); cx.lineTo(16, H - 14); cx.stroke();
    cx.beginPath(); cx.moveTo(86, H - 22); cx.lineTo(86, H - 14); cx.stroke();
    cx.font = '9px IBM Plex Mono'; cx.textAlign = 'left';
    cx.fillText('≈ 200 ft', 16, H - 26);

    cx.fillStyle = '#8CA0B3';
    cx.fillText(fmtT(t), 16, 18);
    cx.fillStyle = '#E8E2D4';
    cx.font = '10px IBM Plex Mono';
    cx.fillText(`depth ${depth > 0.15 ? depth.toFixed(1) + ' ft' : 'dry'} · peak ${peak.toFixed(1)} ft`, 16, 34);
    cx.fillStyle = '#8CA0B3';
    cx.font = '9px IBM Plex Mono';
    cx.fillText(`${sel.latlng.lat.toFixed(5)}°N  ${Math.abs(sel.latlng.lng).toFixed(5)}°W · NAVD88`, 16, 48);
  }

  function drawBasinOverview(W, H) {
    cx.fillStyle = '#0A111C';
    cx.fillRect(0, 0, W, H);
    cx.fillStyle = '#7FC4DC';
    cx.font = '12px IBM Plex Mono';
    cx.textAlign = 'left';
    cx.fillText('CITYWIDE BASIN OVERVIEW', 16, 24);
    cx.fillStyle = '#8CA0B3';
    cx.font = '10px IBM Plex Mono';
    cx.fillText('Hover or click a neighborhood on the map to focus the microscope.', 16, 42);

    // Mini basin bars
    const rows = ZONES.filter(z => z.w > 0).sort((a, b) => MapView.depthAtZone(b, t) - MapView.depthAtZone(a, t)).slice(0, 10);
    rows.forEach((z, i) => {
      const d = MapView.depthAtZone(z, t);
      const y = 64 + i * 22;
      cx.fillStyle = '#8CA0B3';
      cx.font = '10px IBM Plex Mono';
      cx.fillText(z.nm.slice(0, 22), 16, y + 10);
      cx.fillStyle = '#132238';
      cx.fillRect(180, y, W - 220, 12);
      const ww = clamp(d / 12, 0, 1) * (W - 220);
      cx.fillStyle = d > 6 ? '#FF5A45' : '#1B5E8C';
      cx.fillRect(180, y, ww, 12);
      cx.fillStyle = '#E8E2D4';
      cx.fillText(d > 0.2 ? d.toFixed(1) + ' ft' : 'dry', W - 36, y + 10);
    });

    // Live breach strip
    cx.fillStyle = '#FFB454';
    cx.font = '9px IBM Plex Mono';
    cx.fillText('ACTIVE BREACHES @ ' + fmtT(t), 16, H - 48);
    let x = 16;
    BREACH.forEach(b => {
      const live = t >= b.t;
      cx.fillStyle = live ? '#FF5A45' : '#1D3149';
      cx.fillRect(x, H - 36, 10, 10);
      cx.fillStyle = live ? '#E8E2D4' : '#5B6B7A';
      cx.font = '8px IBM Plex Mono';
      cx.fillText(b.id, x + 14, H - 27);
      x += 70;
    });
  }

  function drawStreetSection(W, H, sel) {
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = '#0A111C';
    cx.fillRect(0, 0, W, H);

    if (!sel && !transectPts) {
      cx.fillStyle = '#7FC4DC';
      cx.font = '12px IBM Plex Mono';
      cx.fillText('STREET SECTION', 16, 24);
      cx.fillStyle = '#8CA0B3';
      cx.font = '10px IBM Plex Mono';
      cx.fillText('Select a location, or click DRAW TRANSECT and pick two points on the map.', 16, 44);
      cx.fillText('Escape cancels transect drawing.', 16, 60);
      return;
    }

    const pts = transectPts || autoTransect(sel);
    const profile = sampleTransect(pts, sel);
    const padL = 48, padR = 24, padT = 36, padB = 36;
    const plotW = W - padL - padR, plotH = H - padT - padB;

    const elevs = profile.map(p => p.elev);
    const water = profile.map(p => p.wse);
    const peakW = profile.map(p => p.peakWse);
    const minE = Math.min(...elevs, ...water, ...peakW) - 2;
    const maxE = Math.max(...elevs, ...water, ...peakW, ...profile.map(p => p.elev + p.bH)) + 3;

    const X = i => padL + (i / (profile.length - 1)) * plotW;
    const Y = ft => padT + (1 - (ft - minE) / (maxE - minE)) * plotH;

    // Grid
    cx.strokeStyle = 'rgba(29,49,73,.8)';
    cx.font = '9px IBM Plex Mono';
    cx.fillStyle = '#8CA0B3';
    cx.textAlign = 'right';
    for (let ft = Math.ceil(minE); ft <= Math.floor(maxE); ft += 2) {
      cx.beginPath(); cx.moveTo(padL, Y(ft)); cx.lineTo(W - padR, Y(ft)); cx.stroke();
      cx.fillText(ft + "'", padL - 6, Y(ft) + 3);
    }

    // Peak water
    cx.beginPath();
    profile.forEach((p, i) => i ? cx.lineTo(X(i), Y(p.peakWse)) : cx.moveTo(X(i), Y(p.peakWse)));
    cx.strokeStyle = 'rgba(255,90,69,.55)';
    cx.setLineDash([4, 3]);
    cx.lineWidth = 1.2;
    cx.stroke();
    cx.setLineDash([]);

    // Current water fill
    cx.beginPath();
    profile.forEach((p, i) => i ? cx.lineTo(X(i), Y(p.wse)) : cx.moveTo(X(i), Y(p.wse)));
    for (let i = profile.length - 1; i >= 0; i--) cx.lineTo(X(i), Y(profile[i].elev));
    cx.closePath();
    cx.fillStyle = 'rgba(27,94,140,.45)';
    cx.fill();
    cx.beginPath();
    profile.forEach((p, i) => i ? cx.lineTo(X(i), Y(p.wse)) : cx.moveTo(X(i), Y(p.wse)));
    cx.strokeStyle = '#7FC4DC';
    cx.lineWidth = 1.6;
    cx.stroke();

    // Ground
    cx.beginPath();
    profile.forEach((p, i) => i ? cx.lineTo(X(i), Y(p.elev)) : cx.moveTo(X(i), Y(p.elev)));
    cx.strokeStyle = '#C9CFAA';
    cx.lineWidth = 1.8;
    cx.stroke();

    // Street crown / sidewalks / buildings
    profile.forEach((p, i) => {
      if (p.kind === 'street') {
        cx.fillStyle = 'rgba(140,160,179,.25)';
        cx.fillRect(X(i) - 3, Y(p.elev) - 2, 6, 4);
      }
      if (p.kind === 'building') {
        cx.fillStyle = '#2a3a4a';
        cx.fillRect(X(i) - 5, Y(p.elev + p.bH), 10, Y(p.elev) - Y(p.elev + p.bH));
        cx.strokeStyle = 'rgba(127,196,220,.4)';
        cx.strokeRect(X(i) - 5, Y(p.elev + p.bH), 10, Y(p.elev) - Y(p.elev + p.bH));
      }
      if (p.kind === 'canal') {
        cx.fillStyle = 'rgba(27,94,140,.6)';
        cx.fillRect(X(i) - 6, Y(p.elev), 12, 8);
        cx.strokeStyle = '#FF5A45';
        cx.beginPath();
        cx.moveTo(X(i) - 10, Y(p.elev + 4));
        cx.lineTo(X(i) - 10, Y(p.elev));
        cx.lineTo(X(i) + 10, Y(p.elev));
        cx.lineTo(X(i) + 10, Y(p.elev + 4));
        cx.stroke();
      }
    });

    // Selected marker
    const mid = Math.floor(profile.length / 2);
    cx.strokeStyle = '#FFB454';
    cx.beginPath();
    cx.moveTo(X(mid), padT);
    cx.lineTo(X(mid), H - padB);
    cx.stroke();
    cx.fillStyle = '#FFB454';
    cx.font = '9px IBM Plex Mono';
    cx.textAlign = 'center';
    cx.fillText('SELECTED', X(mid), padT - 8);

    // Flow arrow
    if (sel) {
      const brg = flowBearing(sel.z, t);
      cx.fillStyle = '#FFB454';
      cx.textAlign = 'left';
      cx.fillText('INFLOW ≈ ' + bearingLabel(brg) + '  ·  ' + fmtT(t), padL, H - 12);
    }

    cx.fillStyle = '#8CA0B3';
    cx.textAlign = 'left';
    cx.font = '9px IBM Plex Mono';
    cx.fillText('ground', padL, 16);
    cx.fillStyle = '#7FC4DC'; cx.fillText('  current WSE', padL + 50, 16);
    cx.fillStyle = '#FF5A45'; cx.fillText('  peak WSE', padL + 140, 16);
  }

  function bearingLabel(deg) {
    const d = ((deg % 360) + 360) % 360;
    const dirs = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
    return dirs[Math.round(d / 45) % 8];
  }

  function autoTransect(sel) {
    if (!sel) return [L.latLng(29.97, -90.1), L.latLng(29.97, -90.09)];
    const brg = flowBearing(sel.z, t) * Math.PI / 180;
    // transect perpendicular to flow, ~800 ft
    const dLat = Math.sin(brg + Math.PI / 2) * 0.0018;
    const dLon = Math.cos(brg + Math.PI / 2) * 0.0018;
    const c = sel.latlng;
    return [L.latLng(c.lat - dLat, c.lng - dLon), L.latLng(c.lat + dLat, c.lng + dLon)];
  }

  function sampleTransect(pts, sel) {
    const n = 48;
    const a = pts[0], b = pts[1];
    const z = sel ? sel.z : nearestZone(a.lat, a.lng);
    const depth = z ? MapView.depthAtZone(z, t) : 0;
    const peak = z ? peakDepth(z) : 0;
    const elev0 = z ? z.elev : 0;
    const out = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const lat = a.lat + (b.lat - a.lat) * u;
      const lon = a.lng + (b.lng - a.lng) * u;
      // Synthetic but deterministic section: street crowns, lots, optional canal near center
      const wave = Math.sin(u * Math.PI * 6);
      let kind = 'lot';
      let elev = elev0 + wave * 0.35 + Math.sin(u * Math.PI) * 0.2;
      let bH = 0;
      if (Math.abs(u - 0.5) < 0.04 && z && (z.entry === 'b17' || z.entry === 'lonS' || z.entry === 'lonN' || z.entry === 'ihnc')) {
        kind = 'canal';
        elev = elev0 - 2.5;
      } else if (i % 7 === 0 || i % 7 === 1) {
        kind = 'street';
        elev = elev0 + 0.4; // crown
      } else if (i % 7 === 3 || i % 7 === 5) {
        kind = 'building';
        const fw = 30 + det(lat * 1e4, i) * 20;
        const fd = 40 + det(lon * 1e4, i) * 30;
        bH = (fw * fd > 2800 ? 2 : 1) * (10 + det(i, 3) * 4);
        elev = elev0 + (det(i, 9) - 0.5) * 0.6;
      } else {
        elev = elev0 + (det(i, 2) - 0.5) * 0.5; // sidewalk/lot
      }
      const wse = elev + (kind === 'canal' ? Math.max(depth, 2) : depth);
      const peakWse = elev0 + peak;
      out.push({ lat, lon, elev, kind, bH, wse: Math.max(elev, elev0 + depth * (kind === 'street' ? 1 : 0.95)), peakWse, depth });
    }
    // Fix wse to be a flat water surface across transect (engineering section)
    const wseFlat = elev0 + depth;
    const peakFlat = elev0 + peak;
    out.forEach(p => {
      p.wse = Math.max(p.elev, wseFlat);
      p.peakWse = Math.max(p.elev, peakFlat);
    });
    return out;
  }

  function nearestZone(lat, lon) {
    let best = null, bd = 1e9;
    ZONES.forEach(z => {
      const d = Math.hypot(z.label[1] - lat, z.label[0] - lon);
      if (d < bd) { bd = d; best = z; }
    });
    return best;
  }

  function renderWhy(sel) {
    const body = root.querySelector('.fm-detail');
    const read = root.querySelector('.fm-readout');
    if (!sel) {
      read.innerHTML = cityReadout();
      body.innerHTML = `<div class="fm-muted">Select a location to reconstruct the causal sequence from the existing breach chronology and basin model.</div>`;
      MapView.clearRoute();
      return;
    }
    const z = sel.z;
    const st = MapView.floodState(z, t);
    const depth = st.depth;
    const peak = peakDepth(z);
    const arr = arrivalTime(z);
    const b = primaryBreach(z, t);
    const sec = secondarySource(z);
    const pumps = relevantPumps(z);
    const conf = confidence(z);
    const srcLabel = b ? b.nm : (SOURCE_LABEL[z.entry] || z.entry);

    read.innerHTML = localReadout(sel, depth, peak, arr, srcLabel, conf);

    const steps = [];
    if (z.entry === 'none') {
      steps.push('Natural levee / river-ridge ground');
      steps.push('No breach pathway into this block');
      steps.push('Wind damage regime — remains dry in this model');
    } else if (z.entry === 'jeff') {
      steps.push('Rainfall exceeds local drainage');
      steps.push('Pump operators evacuated (doomsday plan)');
      steps.push('Shallow ponding accumulates');
      steps.push('Selected block reaches peak depth');
    } else if (z.entry === 'gravity') {
      steps.push('Upstream I-wall / canal failures');
      steps.push('Breach flow fills Lakeview / Gentilly');
      steps.push('Water follows low street corridors by gravity');
      steps.push('Selected neighborhood inundates');
      steps.push('Selected block reaches peak depth');
    } else {
      steps.push(b && b.sub && b.sub.indexOf('overtop') >= 0 ? 'Overtopping / erosion of earthen levee' : 'Floodwall / I-wall failure');
      steps.push('Breach flow enters basin');
      steps.push('Water follows low street corridor');
      steps.push('Selected neighborhood inundates');
      steps.push('Selected block reaches peak depth');
    }

    const pumpHtml = pumps.map(p => {
      const stt = pumpStatus(p, t);
      return `<span class="fm-chip">${p.nm}: <b class="st ${stt}">${stt}</b></span>`;
    }).join(' ') || '<span class="fm-muted">No mapped pump directly tied to this entry path.</span>';

    body.innerHTML = `
      <div class="fm-grid2">
        <div>
          <div class="fm-k">Primary source</div>
          <div class="fm-v accent">${srcLabel}</div>
          ${sec ? `<div class="fm-k" style="margin-top:8px">Secondary source</div><div class="fm-v">${sec.nm}</div>` : ''}
          <div class="fm-k" style="margin-top:8px">Causal sequence</div>
          <ol class="fm-seq">${steps.map(s => `<li>${s}</li>`).join('')}</ol>
        </div>
        <div>
          <div class="fm-k">Modeled route</div>
          <div class="fm-v">Highlighted on main map while this tab is active. Path is <b>modeled</b> — not a surveyed street-level observation.</div>
          <div class="fm-k" style="margin-top:8px">Relevant pumps</div>
          <div>${pumpHtml}</div>
          <div class="fm-k" style="margin-top:8px">Flow direction</div>
          <div class="fm-v">≈ ${bearingLabel(flowBearing(z, t))} (modeled from breach → block)</div>
          <div class="fm-k" style="margin-top:8px">Confidence</div>
          <div class="fm-v">${conf.level} · score ${(conf.score * 100).toFixed(0)}%</div>
        </div>
      </div>`;

    const route = modeledRoute(z);
    if (route) MapView.setRoute(route, { label: 'Modeled source→location route' });
  }

  function renderEvidence(sel) {
    const body = root.querySelector('.fm-detail');
    const read = root.querySelector('.fm-readout');
    if (!sel) {
      read.innerHTML = cityReadout();
      body.innerHTML = evidenceLegend();
      return;
    }
    const z = sel.z;
    const depth = MapView.depthAtZone(z, t);
    const peak = peakDepth(z);
    const arr = arrivalTime(z);
    const conf = confidence(z);
    const b = primaryBreach(z, t);
    const srcLabel = b ? b.nm : (SOURCE_LABEL[z.entry] || z.entry);

    read.innerHTML = localReadout(sel, depth, peak, arr, srcLabel, conf);

    const rows = [
      ['Ground elevation', `${z.elev >= 0 ? '+' : ''}${z.elev} ft NAVD88`, elevClass(z), 'Neighborhood profile elevation (approx. basin floor), not a surveyed lot grade.'],
      ['Current depth', depth > 0.15 ? depth.toFixed(1) + ' ft' : 'dry', 'MODELED', 'From existing flood reconstruction (basin keyframes × front progress).'],
      ['Peak depth', peak.toFixed(1) + ' ft', peakClass(z), 'Peak of the neighborhood depth curve used by the timeline model.'],
      ['First-water arrival', arr != null ? fmtT(arr) : '—', arr != null ? 'OBSERVED' : 'APPROXIMATE', 'Tied to documented breach / entry times in the chronology.'],
      ['Flood source', srcLabel, b ? 'OBSERVED' : 'MODELED', b ? 'Breach location from IPET/ILIT sequence.' : 'Assigned basin entry pathway.'],
      ['Flow route', 'Modeled corridor', 'MODELED', 'Straight/bent path from breach to selection — not historically surveyed street flow.'],
      ['Building height', 'Deterministic from footprint', 'APPROXIMATE', 'No parcel building heights in dataset; height = f(footprint area), no randomness.'],
      ['Water velocity', 'Not quantified', 'APPROXIMATE', 'Direction shown; magnitude not computed in this reconstruction.']
    ];

    body.innerHTML = `
      ${evidenceLegend()}
      <table class="fm-evtable"><thead><tr><th>Value</th><th>Reading</th><th>Class</th><th>Note</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td><span class="fm-tag ${r[2]}">${r[2]}</span></td><td>${r[3]}</td></tr>`).join('')}</tbody></table>
      <div class="fm-k" style="margin-top:10px">Methodology</div>
      <div class="fm-muted">Depths interpolate documented IPET/ILIT/ASCE checkpoints via the existing basin curves. Spatial front uses distance-to-breach and ground elevation. Building geometry is a local forensic schematic, not cadastral data.</div>
      <div class="fm-k" style="margin-top:8px">Assumptions</div>
      <div class="fm-muted">Uniform water-surface elevation across a neighborhood at a given time · street corridors follow cardinal grid · levee lines are approximate alignments · NAVD88 elevations are profile-level.</div>
      <div class="fm-warn">Precision warning: lot-level depths and exact street paths are reconstructed, not surveyed high-water marks at this point.</div>
      <label class="fm-check"><input type="checkbox" id="fm-conf"> Confidence overlay on main map</label>
    `;
    const cb = root.querySelector('#fm-conf');
    if (cb) {
      cb.checked = !!root._confOn;
      cb.onchange = () => {
        root._confOn = cb.checked;
        MapView.setConfidenceOverlay(cb.checked);
      };
    }
  }

  function elevClass(z) {
    if (z.entry === 'b17' || z.entry === 'lonS' || z.entry === 'ihnc') return 'INTERPOLATED';
    return 'APPROXIMATE';
  }
  function peakClass(z) {
    if (z.entry === 'b17' || z.entry === 'lonS' || z.entry === 'lonN' || z.entry === 'ihnc') return 'INTERPOLATED';
    if (z.entry === 'gravity') return 'MODELED';
    return 'APPROXIMATE';
  }

  function evidenceLegend() {
    return `<div class="fm-tags">
      <span class="fm-tag OBSERVED">OBSERVED</span>
      <span class="fm-tag INTERPOLATED">INTERPOLATED</span>
      <span class="fm-tag MODELED">MODELED</span>
      <span class="fm-tag APPROXIMATE">APPROXIMATE</span>
    </div>`;
  }

  function cityReadout() {
    let wet = 0;
    ZONES.forEach(z => { if (MapView.depthAtZone(z, t) > 0.2) wet++; });
    return `
      <div class="fm-k">Scope</div><div class="fm-v">Citywide basins</div>
      <div class="fm-k">Time</div><div class="fm-v">${fmtT(t)}</div>
      <div class="fm-k">Neighborhoods wet</div><div class="fm-v">${wet} / ${ZONES.length}</div>
      <div class="fm-k">Datum</div><div class="fm-v">NAVD88 · CDT</div>
      <div class="fm-k">Confidence</div><div class="fm-v">Mixed — see Evidence</div>`;
  }

  function localReadout(sel, depth, peak, arr, src, conf) {
    const z = sel.z;
    return `
      <div class="fm-k">Elevation</div><div class="fm-v">${z.elev >= 0 ? '+' : ''}${z.elev} ft NAVD88</div>
      <div class="fm-k">Current depth</div><div class="fm-v ${depth > 6 ? 'hot' : depth > 0.2 ? 'wet' : ''}">${depth > 0.15 ? depth.toFixed(1) + ' ft' : 'dry'}</div>
      <div class="fm-k">Peak depth</div><div class="fm-v">${peak.toFixed(1)} ft${peakTime(z) != null ? ' @ ' + fmtT(peakTime(z)) : ''}</div>
      <div class="fm-k">Arrival</div><div class="fm-v">${arr != null ? fmtT(arr) : '—'}</div>
      <div class="fm-k">Flood source</div><div class="fm-v">${src}</div>
      <div class="fm-k">Confidence</div><div class="fm-v">${conf.level}</div>`;
  }

  function updateHeader(sel) {
    const loc = root.querySelector('#fm-loc');
    const time = root.querySelector('#fm-time');
    const lock = root.querySelector('#fm-lock');
    time.textContent = fmtT(t);
    if (!sel) {
      loc.textContent = 'CITYWIDE';
      lock.textContent = 'UNLOCKED';
      lock.className = 'fm-lock';
      return;
    }
    loc.textContent = sel.z.nm.toUpperCase();
    if (locked) {
      lock.textContent = 'LOCKED';
      lock.className = 'fm-lock on';
    } else {
      lock.textContent = 'PREVIEW';
      lock.className = 'fm-lock preview';
    }
  }

  function paint() {
    if (!root || !canvas) return;
    const dim = sizeCanvas();
    if (!dim) return;
    const sel = active();
    updateHeader(sel);

    // Route only on Why tab
    if (tab !== 'why') MapView.clearRoute();

    if (tab === 'block') {
      drawBlockView(dim.w, dim.h, sel);
      root.querySelector('.fm-readout').innerHTML = sel
        ? localReadout(sel, MapView.depthAtZone(sel.z, t), peakDepth(sel.z), arrivalTime(sel.z),
          (primaryBreach(sel.z, t) || {}).nm || SOURCE_LABEL[sel.z.entry] || '—', confidence(sel.z))
        : cityReadout();
      root.querySelector('.fm-detail').innerHTML = sel
        ? `<div class="fm-muted">2.5D local reconstruction · buildings colored by inundation stage (dry → yard → shallow → deep → near-roof). Flow chevrons are modeled. Geometry is schematic block fabric, cached per location.</div>`
        : `<div class="fm-muted">Basin overview while no location is hovered or locked. Click the map to lock a forensic focus.</div>`;
    } else if (tab === 'section') {
      drawStreetSection(dim.w, dim.h, sel);
      root.querySelector('.fm-readout').innerHTML = sel
        ? localReadout(sel, MapView.depthAtZone(sel.z, t), peakDepth(sel.z), arrivalTime(sel.z),
          (primaryBreach(sel.z, t) || {}).nm || SOURCE_LABEL[sel.z.entry] || '—', confidence(sel.z))
        : cityReadout();
      root.querySelector('.fm-detail').innerHTML = `
        <div class="fm-row">
          <button class="btn ghost" id="fm-transect" type="button">Draw Transect</button>
          <span class="fm-muted">${transectPts ? 'Custom transect active · Escape to cancel draw mode' : 'Auto-transect perpendicular to modeled inflow · or draw two endpoints on the map'}</span>
        </div>`;
      const btn = root.querySelector('#fm-transect');
      if (btn) btn.onclick = () => {
        setTab('section');
        MapView.startTransect(pts => {
          transectPts = pts;
          MapView.setTransectLine(pts);
          // If no selection, invent one at midpoint
          if (!active()) {
            const mid = L.latLng((pts[0].lat + pts[1].lat) / 2, (pts[0].lng + pts[1].lng) / 2);
            const z = nearestZone(mid.lat, mid.lng);
            preview = { z, latlng: mid };
          }
          paint();
        });
        btn.textContent = 'Click two map points…';
      };
    } else if (tab === 'why') {
      // canvas shows mini schematic of route concept
      drawWhyCanvas(dim.w, dim.h, sel);
      renderWhy(sel);
    } else if (tab === 'evidence') {
      drawEvidenceCanvas(dim.w, dim.h, sel);
      renderEvidence(sel);
    }
  }

  function drawWhyCanvas(W, H, sel) {
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = '#0A111C';
    cx.fillRect(0, 0, W, H);
    if (!sel) {
      drawBasinOverview(W, H);
      return;
    }
    const z = sel.z;
    const b = primaryBreach(z, t);
    cx.fillStyle = '#7FC4DC';
    cx.font = '11px IBM Plex Mono';
    cx.fillText('MODELED SOURCE → BLOCK', 16, 22);
    // Simple schematic
    const x0 = 60, y0 = H / 2, x1 = W - 80, y1 = H / 2 + 20;
    cx.strokeStyle = '#FFB454';
    cx.setLineDash([6, 5]);
    cx.lineWidth = 2;
    cx.beginPath(); cx.moveTo(x0, y0); cx.quadraticCurveTo((x0 + x1) / 2, y0 - 50, x1, y1); cx.stroke();
    cx.setLineDash([]);
    cx.fillStyle = '#FF5A45';
    cx.beginPath(); cx.arc(x0, y0, 8, 0, 7); cx.fill();
    cx.fillStyle = '#7FC4DC';
    cx.beginPath(); cx.arc(x1, y1, 8, 0, 7); cx.fill();
    cx.fillStyle = '#E8E2D4';
    cx.font = '10px IBM Plex Mono';
    cx.fillText(b ? b.nm : 'SOURCE', x0 - 20, y0 + 28);
    cx.fillText(z.nm, x1 - 30, y1 + 28);
    cx.fillStyle = '#8CA0B3';
    cx.fillText('Dashed path = modeled corridor (also drawn on main map)', 16, H - 16);
  }

  function drawEvidenceCanvas(W, H, sel) {
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = '#0A111C';
    cx.fillRect(0, 0, W, H);
    const conf = sel ? confidence(sel.z) : { level: 'MIXED', score: 0.6, color: '#7FC4DC' };
    cx.strokeStyle = conf.color || '#7FC4DC';
    cx.lineWidth = 2;
    cx.beginPath();
    cx.arc(W / 2, H / 2, Math.min(W, H) * 0.22, 0, Math.PI * 2 * conf.score);
    cx.stroke();
    cx.fillStyle = '#E8E2D4';
    cx.font = '14px IBM Plex Mono';
    cx.textAlign = 'center';
    cx.fillText(conf.level, W / 2, H / 2 - 4);
    cx.fillStyle = '#8CA0B3';
    cx.font = '11px IBM Plex Mono';
    cx.fillText((conf.score * 100).toFixed(0) + '% score', W / 2, H / 2 + 16);
    cx.textAlign = 'left';
  }

  function setTab(id) {
    tab = id;
    root.querySelectorAll('.fm-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
    if (id !== 'why') MapView.clearRoute();
    if (id !== 'evidence') {
      // leave overlay state as user set
    }
    paint();
  }

  function setTime(nt) {
    t = nt;
    paint();
  }

  function previewAt(z, latlng) {
    if (locked) return;
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      const key = z ? z.id + (latlng ? latlng.lat.toFixed(4) : '') : '';
      if (key !== lastKey) { scanFlash = 1; lastKey = key; }
      preview = z ? { z, latlng: latlng || L.latLng(z.label[1], z.label[0]) } : null;
      paint();
    }, 40);
  }

  function lockAt(z, latlng) {
    locked = { z, latlng: latlng || L.latLng(z.label[1], z.label[0]) };
    preview = null;
    scanFlash = 1;
    paint();
  }

  function clearLock() {
    locked = null;
    paint();
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      if (MapView.cancelTransect()) {
        paint();
        return true;
      }
      if (locked) {
        clearLock();
        return true;
      }
    }
    return false;
  }

  function tick(now) {
    if (!pageHidden) {
      waterPhase = now / 700;
      if (scanFlash > 0) scanFlash = Math.max(0, scanFlash - 0.04);
      if (tab === 'block' && (active() && MapView.depthAtZone(active().z, t) > 0.1)) {
        paint();
      }
    }
    animId = requestAnimationFrame(tick);
  }

  function init(el) {
    root = el;
    root.innerHTML = `
      <div class="card-h">
        <b>Forensic Microscope</b>
        <span class="fm-meta"><span id="fm-loc">CITYWIDE</span> · <span id="fm-time">—</span> · <span id="fm-lock" class="fm-lock">UNLOCKED</span>
          <button type="button" class="btn ghost fm-clear" id="fm-clear">Clear</button></span>
      </div>
      <div class="fm-tabs">${TABS.map(([id, lab]) =>
        `<button type="button" class="fm-tab${id === 'block' ? ' on' : ''}" data-tab="${id}">${lab}</button>`
      ).join('')}</div>
      <div class="fm-body">
        <div class="fm-viz"><canvas id="fm-canvas"></canvas></div>
        <aside class="fm-readout"></aside>
      </div>
      <div class="fm-detail"></div>
    `;
    canvas = root.querySelector('#fm-canvas');
    cx = canvas.getContext('2d');
    root.querySelectorAll('.fm-tab').forEach(b => b.onclick = () => setTab(b.dataset.tab));
    root.querySelector('#fm-clear').onclick = () => clearLock();
    document.addEventListener('visibilitychange', () => {
      pageHidden = document.hidden;
    });
    addEventListener('resize', () => paint());
    paint();
    animId = requestAnimationFrame(tick);
  }

  return {
    init, setTime, previewAt, lockAt, clearLock, onKey, paint,
    getLocked: () => locked, getTab: () => tab
  };
})();
