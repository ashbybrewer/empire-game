/* Breach-driven flood simulation + realistic canvas water renderer */
const FloodEngine = (() => {
  let city, depthBuf, foamBuf, canvas, ctx, off, octx, foamC, fctx;
  let lastT = -999;
  let wavePhase = 0;
  let animId = 0;

  // breach source → earliest breach time for that entry key
  const ENTRY_TIME = {};
  function buildEntryTimes() {
    BREACH.forEach(b => {
      const k = b.source;
      if (ENTRY_TIME[k] == null || b.t < ENTRY_TIME[k]) ENTRY_TIME[k] = b.t;
    });
    ENTRY_TIME.gravity = 8.5; // delayed gravity fill into Mid-City etc.
    ENTRY_TIME.jeff = 3;
    ENTRY_TIME.none = 1e9;
  }

  function zoneEntryTime(z) {
    return ENTRY_TIME[z.entry] != null ? ENTRY_TIME[z.entry] : 6.5;
  }

  function init(cityState, floodCanvas) {
    city = cityState;
    canvas = floodCanvas;
    ctx = canvas.getContext('2d', { alpha: true });
    buildEntryTimes();

    off = document.createElement('canvas');
    off.width = city.COLS;
    off.height = city.ROWS;
    octx = off.getContext('2d');
    depthBuf = new Float32Array(city.COLS * city.ROWS);
    foamBuf = new Uint8Array(city.COLS * city.ROWS);

    foamC = document.createElement('canvas');
    foamC.width = city.COLS;
    foamC.height = city.ROWS;
    fctx = foamC.getContext('2d');
  }

  /* Compute per-cell water depth at time t */
  function computeDepth(t) {
    const { COLS, ROWS, elev, zoneId, street, building, land, dist, zoneMaxDist } = city;
    const N = COLS * ROWS;
    depthBuf.fill(0);
    foamBuf.fill(0);

    // rain ponding before breaches (shallow, streets first)
    const rain = t < 4.5 ? clamp((t + 2) / 6, 0, 1) * 0.35 : 0;

    for (let i = 0; i < N; i++) {
      if (land[i] !== 1) continue;
      const zi = zoneId[i];
      if (zi < 0) continue;
      const z = ZONES[zi];
      const zoneDepth = lerp(z.kf, t); // documented basin depth target
      if (zoneDepth <= 0.05 && rain <= 0) continue;

      const tEntry = zoneEntryTime(z);
      const nd = dist[i] / (zoneMaxDist[zi] || 1);

      // street-first fill curve: streets inundate early, blocks lag, buildings lag more
      let lag = nd;
      if (street[i]) lag *= 0.55;
      else if (building[i]) lag = 0.35 + lag * 0.9;
      else lag = 0.12 + lag * 0.88;

      // time for front to reach this cell after entry
      // Streets race ahead; blocks/yards trail so channels stay visible for hours
      const spreadScale = z.entry === 'gravity' ? 26 : 14;
      const arrival = tEntry + lag * spreadScale;
      if (t < arrival && zoneDepth > 0) {
        // only streets get a whisper of water ahead of the front
        if (street[i] && t > tEntry && zoneDepth > 0.2) {
          const ahead = clamp((t - tEntry) / 2, 0, 1);
          depthBuf[i] = Math.min(zoneDepth, 0.35 + zoneDepth * 0.55 * ahead) * clamp(1.1 - nd, 0.2, 1);
        }
        continue;
      }

      if (zoneDepth <= 0.05) {
        if (rain > 0 && street[i]) depthBuf[i] = rain * (0.5 + (1 - nd) * 0.5);
        continue;
      }

      /* Once reached, depth tracks zone keyframe, with strong street-first bias early */
      const fill = clamp((t - arrival) / 2.2, 0, 1);
      let d;

      if (street[i]) {
        // streets: full depth quickly — the visible flood channels
        d = zoneDepth * (0.7 + 0.3 * fill);
        if (nd < 0.25) d = zoneDepth;
      } else if (building[i]) {
        // buildings: dry until street water rises, then climb walls
        const streetProxy = zoneDepth * fill;
        if (streetProxy < 0.8) d = 0;
        else if (streetProxy < 3) d = (streetProxy - 0.8) * 0.55;
        else d = zoneDepth * (0.5 + 0.5 * fill);
      } else {
        // open blocks / yards: lag streets hard so the grid reads as channels
        const blockDelay = 2.5 + nd * 6;
        const blockFill = clamp((t - arrival - blockDelay) / 5, 0, 1);
        d = zoneDepth * blockFill * (0.55 + 0.45 * fill);
        // eventually fill completely once basin is deep
        if (zoneDepth > 4 && fill > 0.85) d = Math.max(d, zoneDepth * (0.35 + 0.65 * clamp((t - arrival - 8) / 20, 0, 1)));
        if (nd < 0.15 && fill > 0.4) d = Math.max(d, zoneDepth * 0.45);
      }

      // near-breach cells deepen faster
      if (nd < 0.12 && !building[i]) d = Math.max(d, zoneDepth * clamp((t - tEntry) / 1.5, 0, 1));

      // microtopography — shallow cells on high micro bumps stay thinner
      const bump = elev[i] - z.elev;
      d = Math.max(0, d - bump * 0.35);

      depthBuf[i] = d;
    }

    // foam / wet edge detection
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        const i = r * COLS + c;
        const d = depthBuf[i];
        if (d <= 0.08) continue;
        let edge = false;
        if (depthBuf[i - 1] < 0.08 || depthBuf[i + 1] < 0.08 ||
            depthBuf[i - COLS] < 0.08 || depthBuf[i + COLS] < 0.08) edge = true;
        // also foam where depth is shallow
        if (edge || (d > 0.08 && d < 1.1)) foamBuf[i] = 1;
      }
    }

    lastT = t;
  }

  function depthToRGBA(d, streetCell, buildingCell, phase, x, y) {
    if (d <= 0.05) return null;
    const dn = clamp(d / 14, 0, 1);
    const wave = Math.sin(x * 0.35 + phase) * Math.cos(y * 0.28 - phase * 0.7) * 0.045;
    const caustic = Math.sin(x * 0.9 + y * 0.5 + phase * 1.3) * 0.035;
    // directional flow shimmer away from breaches
    const flow = Math.sin(x * 0.15 - y * 0.08 + phase * 0.6) * 0.02;

    let r, g, b, a;
    if (d < 0.8) {
      // first inches — dirty street water, still translucent so pavement reads
      r = 55; g = 105; b = 120;
      a = streetCell ? 0.42 : 0.28;
    } else if (d < 2) {
      r = 35 + dn * 15;
      g = 85 + dn * 25;
      b = 115 + dn * 30;
      a = 0.4 + dn * 0.25 + (streetCell ? 0.1 : 0);
    } else if (d < 5) {
      // muddy flood — brown-teal
      r = 28;
      g = 72 + dn * 18;
      b = 118 + dn * 22;
      a = 0.52 + dn * 0.25;
    } else if (d < 10) {
      r = 14;
      g = 52 + dn * 12;
      b = 105 + dn * 20;
      a = 0.68 + dn * 0.15;
    } else {
      r = 8; g = 38; b = 88;
      a = 0.88;
    }

    if (buildingCell) {
      if (d < 4) {
        // rooftops peeking — darker silhouette under translucent water
        r = Math.min(r, 40); g = Math.min(g, 70); b = Math.min(b, 95);
        a = Math.min(0.75, a + 0.12);
      } else {
        r *= 0.65; g *= 0.72; b *= 0.8;
        a = Math.min(0.95, a + 0.15);
      }
    }

    // street channels catch a slight specular highlight
    if (streetCell && d > 0.3 && d < 6) {
      g = Math.min(255, g + 12);
      b = Math.min(255, b + 18);
      a = Math.min(0.9, a + 0.06);
    }

    r = clamp(r + (wave + caustic + flow) * 90, 0, 255);
    g = clamp(g + (wave + caustic) * 110, 0, 255);
    b = clamp(b + wave * 70, 0, 255);
    a = clamp(a + wave * 0.12, 0.12, 0.96);
    return [r | 0, g | 0, b | 0, (a * 255) | 0];
  }

  function renderToOffscreen(phase) {
    const { COLS, ROWS, street, building } = city;
    const img = octx.createImageData(COLS, ROWS);
    const data = img.data;
    for (let i = 0, p = 0; i < COLS * ROWS; i++, p += 4) {
      const d = depthBuf[i];
      if (d <= 0.05) {
        data[p + 3] = 0;
        continue;
      }
      const r = i / COLS | 0, c = i % COLS;
      const rgba = depthToRGBA(d, street[i], building[i], phase, c, r);
      if (!rgba) { data[p + 3] = 0; continue; }
      data[p] = rgba[0]; data[p + 1] = rgba[1]; data[p + 2] = rgba[2]; data[p + 3] = rgba[3];
    }
    octx.putImageData(img, 0, 0);

    // foam layer
    const fimg = fctx.createImageData(COLS, ROWS);
    const fd = fimg.data;
    for (let i = 0, p = 0; i < COLS * ROWS; i++, p += 4) {
      if (!foamBuf[i]) { fd[p + 3] = 0; continue; }
      const shimmer = 180 + Math.sin(i * 0.2 + phase * 2) * 40;
      fd[p] = shimmer; fd[p + 1] = shimmer + 20; fd[p + 2] = 240; fd[p + 3] = 55;
    }
    fctx.putImageData(fimg, 0, 0);
  }

  function draw(t, opts = {}) {
    if (!city) return;
    const needRecompute = Math.abs(t - lastT) > 0.02;
    if (needRecompute) computeDepth(t);
    if (!opts.freezeWaves) wavePhase += 0.04;

    renderToOffscreen(wavePhase);

    // scale offscreen flood buffer up to map canvas with smoothing off for crisp cells,
    // then a light blur pass via drawImage scaling
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== (w * dpr | 0) || canvas.height !== (h * dpr | 0)) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // Nearest-neighbor upscale so street-scale channels stay crisp
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(off, 0, 0, w, h);

    // soft foam (allow mild smoothing only for foam)
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.75;
    ctx.drawImage(foamC, 0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;

    // breach inflow streaks (animated)
    if (opts.showInflow !== false) {
      BREACH.forEach(b => {
        if (t < b.t) return;
        const age = t - b.t;
        if (age > 30) return;
        const sx = (b.x / city.W) * w;
        const sy = (b.y / city.H) * h;
        const rad = 6 + Math.min(40, age * 3);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
        g.addColorStop(0, `rgba(255,90,69,${0.35 * clamp(1 - age / 30, 0, 1)})`);
        g.addColorStop(0.4, `rgba(30,110,160,${0.25 * clamp(1 - age / 20, 0, 1)})`);
        g.addColorStop(1, 'rgba(30,110,160,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  function depthAt(x, y) {
    const cc = clamp(Math.floor(x / city.CW), 0, city.COLS - 1);
    const rr = clamp(Math.floor(y / city.CH), 0, city.ROWS - 1);
    return depthBuf[rr * city.COLS + cc] || 0;
  }

  function startWaves(getT, isPlaying) {
    cancelAnimationFrame(animId);
    const tick = () => {
      const t = getT();
      // animate waves when playing or recently scrubbed
      draw(t, { freezeWaves: false });
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
  }

  function stopWaves() { cancelAnimationFrame(animId); }

  return { init, draw, computeDepth, depthAt, depthBuf: () => depthBuf, startWaves, stopWaves };
})();
