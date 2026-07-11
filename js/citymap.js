/* Procedural city fabric: elevation field, streets, buildings, distance-to-breach */
const CityMap = (() => {
  const W = 1200, H = 820;
  const COLS = 400, ROWS = 274; // ~3 px/cell — fine enough for street channels
  const CW = W / COLS, CH = H / ROWS;

  let elev, zoneId, street, building, dist, land;
  let streetsSVG = [];
  let buildingsData = [];
  let zonePolys = [];

  const mulberry = (a) => () => {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  function parsePts(str) {
    return str.trim().split(/\s+/).map(p => {
      const [x, y] = p.split(',').map(Number);
      return [x, y];
    });
  }

  function pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1];
      const xj = pts[j][0], yj = pts[j][1];
      const inter = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
      if (inter) inside = !inside;
    }
    return inside;
  }

  function polyBounds(pts) {
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    pts.forEach(([x, y]) => {
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    });
    return { minX, minY, maxX, maxY };
  }

  function noise2(x, y, rnd) {
    // value noise via hashed lattice
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const h = (i, j) => {
      const n = Math.sin(i * 127.1 + j * 311.7 + rnd * 74.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  function fbm(x, y, seed) {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < 4; i++) {
      v += a * noise2(x * f, y * f, seed + i * 19);
      a *= 0.5; f *= 2;
    }
    return v;
  }

  function buildZoneIndex() {
    zonePolys = ZONES.map(z => ({ ...z, pts: parsePts(z.pts) }));
  }

  function zoneAt(x, y) {
    for (let i = 0; i < zonePolys.length; i++) {
      if (pointInPoly(x, y, zonePolys[i].pts)) return zonePolys[i];
    }
    return null;
  }

  function isWaterBody(x, y) {
    // Lake Pontchartrain
    if (y < 150) return true;
    if (y < 208) {
      // approximate lake southern shore from SVG path
      const shore =
        y < 152 + (x < 430 ? 0 : (x < 668 ? ((x - 430) / 238) * 18 : (x < 900 ? 18 + ((x - 668) / 232) * 32 : 50)));
      // simpler: lake fills top
      if (x < 668 && y < 152 + (x > 430 ? ((x - 430) / 238) * 20 : 0)) return true;
      if (x >= 668 && y < 170 + Math.min(38, (x - 668) * 0.08)) return true;
    }
    // Lake Borgne SE
    if (x > 930 && y > 420) {
      const edge = 420 + (x - 930) * 0.9;
      if (y > edge) return true;
    }
    // Mississippi corridor (rough)
    const riverY = riverCenterY(x);
    if (Math.abs(y - riverY) < 28 && y > 540) return true;
    // canals
    if (x > 170 && x < 181 && y > 150 && y < 472) return true;
    if (x > 325 && x < 334 && y > 152 && y < 430) return true;
    if (x > 465 && x < 474 && y > 154 && y < 416) return true;
    if (x > 655 && x < 670 && y > 162 && y < 626) return true;
    if (x > 662 && x < 1150 && y > 382 && y < 395) return true;
    // MR-GO wedge
    if (x > 760 && y > 382) {
      const gy = 382 + (x - 760) * 0.38;
      if (Math.abs(y - gy) < 10) return true;
    }
    return false;
  }

  function riverCenterY(x) {
    // rough fit to Mississippi path
    if (x < 245) return 700 - (x + 10) * 0.35;
    if (x < 455) return 566 + (x - 245) * 0.18;
    if (x < 566) return 604 - (x - 455) * 0.17;
    if (x < 668) return 585 + (x - 566) * 0.46;
    if (x < 900) return 632 + (x - 668) * 0.13;
    return 662 - (x - 900) * 0.07;
  }

  function buildGrids() {
    elev = new Float32Array(COLS * ROWS);
    zoneId = new Int16Array(COLS * ROWS);
    street = new Uint8Array(COLS * ROWS);
    building = new Uint8Array(COLS * ROWS);
    land = new Uint8Array(COLS * ROWS);
    dist = new Float32Array(COLS * ROWS);
    dist.fill(1e6);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const x = (c + 0.5) * CW, y = (r + 0.5) * CH;
        if (isWaterBody(x, y)) {
          land[i] = 0;
          elev[i] = -20;
          zoneId[i] = -1;
          continue;
        }
        const z = zoneAt(x, y);
        if (!z) {
          // marsh / unassigned land
          land[i] = y > 430 && x > 820 ? 2 : 0;
          elev[i] = -1 + fbm(x * 0.02, y * 0.02, 3) * 2;
          zoneId[i] = -1;
          continue;
        }
        land[i] = 1;
        zoneId[i] = ZONES.findIndex(zz => zz.id === z.id);
        // elevation: zone base + local microtopography + river-ridge boost
        const ridge = Math.max(0, 8 - Math.abs(y - riverCenterY(x)) * 0.08);
        const micro = (fbm(x * 0.035, y * 0.035, 7) - 0.5) * 2.2;
        const bowl = z.elev + micro + (z.elev >= 3 ? ridge * 0.35 : 0);
        elev[i] = bowl;
      }
    }
  }

  function paintStreetCell(x, y, halfW) {
    // stamp only cells whose centers fall within halfW of the stroke
    const r0 = Math.max(0, Math.floor((y - halfW) / CH));
    const r1 = Math.min(ROWS - 1, Math.floor((y + halfW) / CH));
    const c0 = Math.max(0, Math.floor((x - halfW) / CW));
    const c1 = Math.min(COLS - 1, Math.floor((x + halfW) / CW));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cx = (c + 0.5) * CW, cy = (r + 0.5) * CH;
        if (Math.hypot(cx - x, cy - y) > halfW + 0.4) continue;
        const i = r * COLS + c;
        if (land[i] === 1) street[i] = 1;
      }
    }
  }

  function drawLineStreet(x0, y0, x1, y1, width) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const steps = Math.ceil(len / 1.5);
    const halfW = Math.max(0.7, width * 0.55);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      paintStreetCell(x0 + dx * t, y0 + dy * t, halfW);
    }
    streetsSVG.push({ x0, y0, x1, y1, w: width });
  }

  function generateStreets() {
    streetsSVG = [];
    // major named roads
    MAJOR_ROADS.forEach(rd => {
      for (let i = 0; i < rd.pts.length - 1; i++) {
        const [x0, y0] = rd.pts[i], [x1, y1] = rd.pts[i + 1];
        drawLineStreet(x0, y0, x1, y1, 1.8);
      }
    });

    zonePolys.forEach((z, zi) => {
      const b = polyBounds(z.pts);
      const ang = z.streetAngle || 0;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const rnd = mulberry(1000 + zi * 97);
      // Wider block spacing so interiors remain for buildings (NOLA ~300–400 ft blocks)
      const spacingMaj = 36 + rnd() * 10;
      const spacingMin = 14 + rnd() * 4;

      // rotated grid axes
      const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
      const toLocal = (x, y) => {
        const dx = x - cx, dy = y - cy;
        return [dx * cos + dy * sin, -dx * sin + dy * cos];
      };
      const toWorld = (u, v) => {
        return [cx + u * cos - v * sin, cy + u * sin + v * cos];
      };

      const corners = z.pts.map(([x, y]) => toLocal(x, y));
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      corners.forEach(([u, v]) => {
        if (u < u0) u0 = u; if (u > u1) u1 = u;
        if (v < v0) v0 = v; if (v > v1) v1 = v;
      });

      // major avenues (u-const)
      for (let u = Math.ceil(u0 / spacingMaj) * spacingMaj; u <= u1; u += spacingMaj) {
        let seg = null;
        for (let v = v0; v <= v1; v += 3) {
          const [x, y] = toWorld(u, v);
          if (pointInPoly(x, y, z.pts) && !isWaterBody(x, y)) {
            if (!seg) seg = [x, y, x, y];
            else { seg[2] = x; seg[3] = y; }
          } else if (seg) {
            drawLineStreet(seg[0], seg[1], seg[2], seg[3], 1.25);
            seg = null;
          }
        }
        if (seg) drawLineStreet(seg[0], seg[1], seg[2], seg[3], 1.25);
      }
      // major (v-const)
      for (let v = Math.ceil(v0 / spacingMaj) * spacingMaj; v <= v1; v += spacingMaj) {
        let seg = null;
        for (let u = u0; u <= u1; u += 3) {
          const [x, y] = toWorld(u, v);
          if (pointInPoly(x, y, z.pts) && !isWaterBody(x, y)) {
            if (!seg) seg = [x, y, x, y];
            else { seg[2] = x; seg[3] = y; }
          } else if (seg) {
            drawLineStreet(seg[0], seg[1], seg[2], seg[3], 1.25);
            seg = null;
          }
        }
        if (seg) drawLineStreet(seg[0], seg[1], seg[2], seg[3], 1.25);
      }
      // minor streets
      for (let u = Math.ceil(u0 / spacingMin) * spacingMin; u <= u1; u += spacingMin) {
        if (Math.abs(((u % spacingMaj) + spacingMaj) % spacingMaj) < 3) continue;
        let seg = null;
        for (let v = v0; v <= v1; v += 4) {
          const [x, y] = toWorld(u, v);
          if (pointInPoly(x, y, z.pts) && !isWaterBody(x, y)) {
            if (!seg) seg = [x, y, x, y];
            else { seg[2] = x; seg[3] = y; }
          } else if (seg) {
            drawLineStreet(seg[0], seg[1], seg[2], seg[3], 0.75);
            seg = null;
          }
        }
        if (seg) drawLineStreet(seg[0], seg[1], seg[2], seg[3], 0.75);
      }
      for (let v = Math.ceil(v0 / spacingMin) * spacingMin; v <= v1; v += spacingMin) {
        if (Math.abs(((v % spacingMaj) + spacingMaj) % spacingMaj) < 3) continue;
        let seg = null;
        for (let u = u0; u <= u1; u += 4) {
          const [x, y] = toWorld(u, v);
          if (pointInPoly(x, y, z.pts) && !isWaterBody(x, y)) {
            if (!seg) seg = [x, y, x, y];
            else { seg[2] = x; seg[3] = y; }
          } else if (seg) {
            drawLineStreet(seg[0], seg[1], seg[2], seg[3], 0.75);
            seg = null;
          }
        }
        if (seg) drawLineStreet(seg[0], seg[1], seg[2], seg[3], 0.75);
      }
    });
  }

  function generateBuildings() {
    buildingsData = [];
    zonePolys.forEach((z, zi) => {
      if (z.id === 'algiers' || z.id === 'citypark') return; // park / sparse
      const rnd = mulberry(5000 + zi * 131);
      const b = polyBounds(z.pts);
      const dense = z.id === 'fq' || z.id === 'cbd' || z.id === 'marigny';
      const density = dense ? 0.78 : z.id === 'lower9' || z.id === 'holycross' ? 0.62 : 0.55;
      const step = dense ? 5.5 : 7.5;

      for (let y = b.minY + 3; y < b.maxY - 3; y += step) {
        for (let x = b.minX + 3; x < b.maxX - 3; x += step) {
          if (rnd() > density) continue;
          const jx = x + (rnd() - 0.5) * 2.2;
          const jy = y + (rnd() - 0.5) * 2.2;
          if (!pointInPoly(jx, jy, z.pts)) continue;
          if (isWaterBody(jx, jy)) continue;
          const ci = Math.floor(jx / CW), ri = Math.floor(jy / CH);
          if (ci < 0 || ri < 0 || ci >= COLS || ri >= ROWS) continue;
          const idx = ri * COLS + ci;
          if (street[idx] || land[idx] !== 1) continue;
          // keep a 1-cell setback from streets so footprints sit on blocks
          let nearSt = false;
          for (let dr = -1; dr <= 1 && !nearSt; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const rr = ri + dr, cc = ci + dc;
              if (rr < 0 || cc < 0 || rr >= ROWS || cc >= COLS) continue;
              if (street[rr * COLS + cc] && Math.abs(dr) + Math.abs(dc) === 1) { nearSt = true; break; }
            }
          }
          // prefer parcels adjacent to streets (urban fabric) but not on them
          if (!nearSt && rnd() > 0.35) continue;

          const w = 2.8 + rnd() * (dense ? 7 : 4.2);
          const h = 2.2 + rnd() * (dense ? 6 : 3.6);
          const rot = (z.streetAngle || 0) + (rnd() - 0.5) * 0.06;
          buildingsData.push({ x: jx, y: jy, w, h, rot, zone: zi, elev: elev[idx] });

          const hw = w / 2, hh = h / 2;
          for (let dy = -hh; dy <= hh; dy += CH * 0.7) {
            for (let dx = -hw; dx <= hw; dx += CW * 0.7) {
              const px = jx + dx * Math.cos(rot) - dy * Math.sin(rot);
              const py = jy + dx * Math.sin(rot) + dy * Math.cos(rot);
              const c2 = Math.floor(px / CW), r2 = Math.floor(py / CH);
              if (c2 >= 0 && r2 >= 0 && c2 < COLS && r2 < ROWS) {
                const ii = r2 * COLS + c2;
                if (land[ii] === 1 && !street[ii]) building[ii] = 1;
              }
            }
          }
        }
      }
    });
  }

  /* Multi-source distance field: street-preferential Dijkstra from breach points + gravity seeds */
  function buildDistanceField() {
    dist.fill(1e6);
    const heap = [];
    const push = (i, d) => {
      heap.push([d, i]);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heap[p][0] <= heap[k][0]) break;
        const t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length && last) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          let l = k * 2 + 1, r = l + 1, s = k;
          if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
          if (r < heap.length && heap[r][0] < heap[s][0]) s = r;
          if (s === k) break;
          const t = heap[k]; heap[k] = heap[s]; heap[s] = t; k = s;
        }
      }
      return top;
    };

    const seedBreach = (bx, by, extra) => {
      const c = clamp(Math.floor(bx / CW), 0, COLS - 1);
      const r = clamp(Math.floor(by / CH), 0, ROWS - 1);
      const i = r * COLS + c;
      if (dist[i] > extra) {
        dist[i] = extra;
        push(i, extra);
      }
      // seed neighborhood
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= ROWS || cc >= COLS) continue;
          const ii = rr * COLS + cc;
          if (land[ii] !== 1) continue;
          const d = extra + Math.hypot(dr, dc) * 0.5;
          if (d < dist[ii]) { dist[ii] = d; push(ii, d); }
        }
      }
    };

    // Map entry keys to breach coordinates / gravity seeds
    BREACH.forEach(b => seedBreach(b.x, b.y, 0));

    // Gravity-fill seeds along north edges of Mid-City / Broadmoor / Tremé / CBD
    [['midcity', 0], ['broadmoor', 8], ['treme', 6], ['cbd', 14], ['jeff', 0]].forEach(([id, delay]) => {
      const z = zonePolys.find(zz => zz.id === id);
      if (!z) return;
      const b = polyBounds(z.pts);
      for (let x = b.minX; x <= b.maxX; x += 8) {
        const y = b.minY + 2;
        if (pointInPoly(x, y, z.pts)) seedBreach(x, y, delay + 15);
      }
    });

    const N = COLS * ROWS;
    while (heap.length) {
      const [d, i] = pop();
      if (d > dist[i]) continue;
      const r = Math.floor(i / COLS), c = i % COLS;
      for (let k = 0; k < 8; k++) {
        const dr = [-1, -1, -1, 0, 0, 1, 1, 1][k];
        const dc = [-1, 0, 1, -1, 1, -1, 0, 1][k];
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= ROWS || cc >= COLS) continue;
        const j = rr * COLS + cc;
        if (land[j] !== 1) continue;
        // street cells are cheap (water prefers streets), buildings slightly costly, blocks medium
        let cost = (k % 2 === 0 ? 1.414 : 1.0);
        if (street[j]) cost *= 0.45;
        else if (building[j]) cost *= 1.55;
        else cost *= 1.0;
        // uphill penalty
        const de = elev[j] - elev[i];
        if (de > 0) cost *= 1 + de * 0.35;
        else cost *= 1 + de * 0.05;
        const nd = d + cost;
        if (nd < dist[j]) {
          dist[j] = nd;
          push(j, nd);
        }
      }
    }

    // normalize per-zone distances to 0..1 fill parameter stored back... keep raw for now
  }

  /* Per-zone max dist among land cells — for normalizing fill */
  let zoneMaxDist = [];
  function computeZoneMaxDist() {
    zoneMaxDist = ZONES.map(() => 1);
    for (let i = 0; i < COLS * ROWS; i++) {
      const z = zoneId[i];
      if (z < 0 || dist[i] >= 1e5) continue;
      if (dist[i] > zoneMaxDist[z]) zoneMaxDist[z] = dist[i];
    }
  }

  /* Bake street/building fabric to a canvas for crisp city texture */
  function bakeFabric() {
    const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!c) return null;
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    // darken street cells
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const idx = r * COLS + col;
        if (land[idx] !== 1) continue;
        const px = col * CW, py = r * CH;
        if (street[idx]) {
          x.fillStyle = 'rgba(200,220,235,0.14)';
          x.fillRect(px, py, CW + 0.5, CH + 0.5);
        }
      }
    }
    // vector streets on top for sharp lines
    streetsSVG.forEach(s => {
      x.beginPath();
      x.moveTo(s.x0, s.y0); x.lineTo(s.x1, s.y1);
      x.strokeStyle = s.w > 1.1 ? 'rgba(210,230,245,0.38)' : 'rgba(170,195,215,0.22)';
      x.lineWidth = s.w > 1.1 ? 1.3 : 0.65;
      x.lineCap = 'square';
      x.stroke();
    });
    // buildings
    buildingsData.forEach(b => {
      x.save();
      x.translate(b.x, b.y);
      x.rotate(b.rot);
      x.fillStyle = b.elev >= 3 ? 'rgba(90,104,84,0.95)' : b.elev >= 0 ? 'rgba(74,90,98,0.95)' : 'rgba(58,78,104,0.95)';
      x.strokeStyle = 'rgba(8,14,24,0.5)';
      x.lineWidth = 0.4;
      x.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      x.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
      x.restore();
    });
    return c;
  }

  function sample(x, y) {
    const c = clamp(Math.floor(x / CW), 0, COLS - 1);
    const r = clamp(Math.floor(y / CH), 0, ROWS - 1);
    const i = r * COLS + c;
    const zi = zoneId[i];
    return {
      elev: elev[i],
      zone: zi >= 0 ? ZONES[zi] : null,
      zoneIndex: zi,
      street: !!street[i],
      building: !!building[i],
      land: land[i],
      dist: dist[i],
      normDist: zi >= 0 ? dist[i] / zoneMaxDist[zi] : 1,
      c, r, i
    };
  }

  function init() {
    buildZoneIndex();
    buildGrids();
    generateStreets();
    generateBuildings();
    buildDistanceField();
    computeZoneMaxDist();
    const fabric = bakeFabric();
    return {
      W, H, COLS, ROWS, CW, CH,
      elev, zoneId, street, building, land, dist, zoneMaxDist,
      streetsSVG, buildingsData, zonePolys, fabric,
      sample, pointInPoly, parsePts
    };
  }

  return { init, sample: (...a) => sample(...a), get: () => ({
    W, H, COLS, ROWS, CW, CH, elev, zoneId, street, building, land, dist, zoneMaxDist,
    streetsSVG, buildingsData, zonePolys
  }) };
})();
