/* Main UI — map assembly, dossier, hydrograph, hover readout */
(() => {
  const S = q => document.querySelector(q);
  const SA = q => document.querySelectorAll(q);
  const svgNS = 'http://www.w3.org/2000/svg';

  let t = -13, playing = false, speed = 1;
  const layers = { FLOOD: 1, STREETS: 1, BUILDINGS: 1, BREACHES: 1, PUMPS: 1, LEVEES: 1, LABELS: 1 };
  let city;

  const elevFill = e =>
    e >= 5 ? '#4A5240' : e >= 0 ? '#39443C' : e >= -3 ? '#30414C' : e >= -5 ? '#283B58' : '#203764';

  /* ---------- build static SVG geography ---------- */
  function buildBaseSVG() {
    const gZ = S('#zones');
    city.zonePolys.forEach((z) => {
      const p = document.createElementNS(svgNS, 'polygon');
      p.setAttribute('points', z.pts.map(([x, y]) => `${x},${y}`).join(' '));
      p.setAttribute('class', 'zone');
      p.setAttribute('fill', elevFill(z.elev));
      p.setAttribute('fill-opacity', '0.92');
      p.setAttribute('data-id', z.id);
      p.style.cursor = 'pointer';
      p.addEventListener('click', e => {
        e.stopPropagation();
        showDos(zoneHtml(z));
      });
      gZ.appendChild(p);
    });

    // streets tracked in SVG for layer toggle metrics; visual comes from fabric canvas
    const gSt = S('#streets');
    city.streetsSVG.forEach(s => {
      const ln = document.createElementNS(svgNS, 'line');
      ln.setAttribute('x1', s.x0); ln.setAttribute('y1', s.y0);
      ln.setAttribute('x2', s.x1); ln.setAttribute('y2', s.y1);
      gSt.appendChild(ln);
    });

    // bake fabric into overlay canvas (above SVG zones via stacking)
    const fab = S('#fabric');
    if (city.fabric) {
      fab.width = city.W;
      fab.height = city.H;
      fab.getContext('2d').drawImage(city.fabric, 0, 0);
    }

    // major road labels
    const gRl = S('#roadlabels');
    MAJOR_ROADS.forEach(rd => {
      const mid = rd.pts[Math.floor(rd.pts.length / 2)];
      const tx = document.createElementNS(svgNS, 'text');
      tx.setAttribute('x', mid[0]);
      tx.setAttribute('y', mid[1] - 3);
      tx.setAttribute('class', 'rdlbl');
      tx.setAttribute('text-anchor', 'middle');
      tx.textContent = rd.name;
      gRl.appendChild(tx);
    });

    // invisible hit-target buildings (visual is on fabric)
    const gBd = S('#buildings');
    city.buildingsData.forEach(b => {
      const r = document.createElementNS(svgNS, 'rect');
      r.setAttribute('x', b.x - b.w / 2);
      r.setAttribute('y', b.y - b.h / 2);
      r.setAttribute('width', b.w);
      r.setAttribute('height', b.h);
      r.setAttribute('class', 'bldg');
      r.setAttribute('transform', `rotate(${(b.rot * 180) / Math.PI} ${b.x} ${b.y})`);
      r.setAttribute('fill', 'transparent');
      r.setAttribute('stroke', 'transparent');
      r.style.cursor = 'pointer';
      r.style.pointerEvents = 'auto';
      const z = ZONES[b.zone];
      r.addEventListener('click', e => {
        e.stopPropagation();
        if (z) showDos(zoneHtml(z) + `<div class="k">Footprint</div><p>Schematic building on ≈ ${b.elev >= 0 ? '+' : ''}${b.elev.toFixed(1)} ft ground. Depth @ cursor time follows the neighborhood curve.</p>`);
      });
      gBd.appendChild(r);
    });

    // zone labels
    const gZL = S('#zonelabels');
    ZONES.forEach(z => {
      if (z.id === 'algiers') return;
      const lb = document.createElementNS(svgNS, 'text');
      lb.setAttribute('x', z.lx);
      lb.setAttribute('y', z.ly);
      lb.setAttribute('class', 'lbl zlbl');
      lb.setAttribute('text-anchor', 'middle');
      lb.textContent = z.nm.toUpperCase();
      gZL.appendChild(lb);
    });

    // breaches
    const gB = S('#breaches');
    BREACH.forEach(b => {
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'bmark');
      const ring = document.createElementNS(svgNS, 'circle');
      ring.setAttribute('cx', b.x); ring.setAttribute('cy', b.y);
      ring.setAttribute('r', 8); ring.setAttribute('class', 'bring');
      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', b.x); dot.setAttribute('cy', b.y); dot.setAttribute('r', 5);
      dot.setAttribute('fill', '#0A111C');
      dot.setAttribute('stroke', '#5B6B7A');
      dot.setAttribute('stroke-width', '1.5');
      g.append(ring, dot);
      b._dot = dot; b._ring = ring;
      g.addEventListener('click', e => {
        e.stopPropagation();
        showDos(`<h3>${b.nm}</h3><div class="k">${b.sub}</div><p>${b.dos}</p>`);
      });
      gB.appendChild(g);
    });

    // pumps
    const gP = S('#pumpmarks');
    PUMPS.forEach(p => {
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'pmark');
      const r = document.createElementNS(svgNS, 'rect');
      r.setAttribute('x', p.x - 5); r.setAttribute('y', p.y - 5);
      r.setAttribute('width', 10); r.setAttribute('height', 10);
      r.setAttribute('fill', '#7FC4DC');
      r.setAttribute('stroke', '#0A111C');
      r.setAttribute('stroke-width', '1.5');
      r.setAttribute('transform', `rotate(45 ${p.x} ${p.y})`);
      g.appendChild(r); p._r = r;
      g.addEventListener('click', e => {
        e.stopPropagation();
        showDos(`<h3>${p.nm}</h3><div class="k">Capacity</div><p>${p.cap}</p><div class="k">Account</div><p>${p.dos}</p>`);
      });
      gP.appendChild(g);
    });
  }

  function zoneHtml(z) {
    const d = lerp(z.kf, t);
    return `<h3>${z.nm}</h3>
      <div class="k">Ground elevation</div><p>${z.elev >= 0 ? '+' : ''}${z.elev} ft NAVD88 (approx.)</p>
      <div class="k">Water depth @ ${fmtT(t)}</div><p>${d > 0.2 ? d.toFixed(1) + ' ft' : 'dry'}</p>
      <div class="k">Account</div><p>${z.dos}</p>`;
  }

  /* ---------- side panel lists ---------- */
  function buildPanels() {
    const pumpsEl = S('#pumps');
    PUMPS.forEach(p => {
      const d = document.createElement('div');
      d.className = 'pump';
      d.innerHTML = `<span class="nm">${p.nm}</span><span class="cap">${p.cap}</span><span class="st" data-id="${p.id}">—</span>`;
      d.style.cursor = 'pointer';
      d.addEventListener('click', () => showDos(`<h3>${p.nm}</h3><div class="k">Capacity</div><p>${p.cap}</p><div class="k">Account</div><p>${p.dos}</p>`));
      pumpsEl.appendChild(d);
      p._st = d.querySelector('.st');
    });

    const tb = S('#depths tbody');
    ZONES.filter(z => z.id !== 'algiers').forEach(z => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML = `<td>${z.nm}</td><td>${z.elev >= 0 ? '+' : ''}${z.elev} ft</td><td class="d">dry</td>`;
      tr.addEventListener('click', () => showDos(zoneHtml(z)));
      tb.appendChild(tr);
      z._tr = tr; z._td = tr.querySelector('.d');
    });

    const logEl = S('#log');
    EVENTS.forEach(e => {
      const d = document.createElement('div');
      d.className = 'ev' + (e.sev ? ' sev' : '');
      d.innerHTML = `<div class="t">${fmtT(e.t)}</div><div class="h">${e.h}</div><p>${e.p}</p>`;
      d.addEventListener('click', () => { t = e.t; render(); });
      logEl.appendChild(d);
      e._el = d;
    });

    const togEl = S('#toggles');
    [
      ['FLOOD', 'floodwater'],
      ['STREETS', 'streets'],
      ['BUILDINGS', 'buildings'],
      ['BREACHES', 'breaches'],
      ['PUMPS', 'pump stations'],
      ['LEVEES', 'levees & walls'],
      ['LABELS', 'labels']
    ].forEach(([k, lab]) => {
      const b = document.createElement('button');
      b.className = 'tg on';
      b.textContent = lab;
      b.onclick = () => {
        layers[k] ^= 1;
        b.classList.toggle('on', !!layers[k]);
        applyLayers();
      };
      togEl.appendChild(b);
    });
  }

  function applyLayers() {
    S('#floodcanvas').style.display = layers.FLOOD ? '' : 'none';
    S('#fabric').style.opacity = (layers.STREETS || layers.BUILDINGS) ? '1' : '0';
    // When only one of streets/buildings is on, re-bake would be ideal; for toggles hide whole fabric if both off
    if (layers.STREETS && !layers.BUILDINGS) S('#fabric').style.opacity = '0.85';
    if (!layers.STREETS && layers.BUILDINGS) S('#fabric').style.opacity = '0.9';
    S('#streets').style.display = layers.STREETS ? '' : 'none';
    S('#buildings').style.display = layers.BUILDINGS ? '' : 'none';
    S('#breaches').style.display = layers.BREACHES ? '' : 'none';
    S('#pumpmarks').style.display = layers.PUMPS ? '' : 'none';
    S('#levees').style.display = layers.LEVEES ? '' : 'none';
    S('#zonelabels').style.display = layers.LABELS ? '' : 'none';
    S('#roadlabels').style.display = layers.LABELS ? '' : 'none';
    S('#labels').style.display = layers.LABELS ? '' : 'none';
  }

  function showDos(html) {
    S('#dosbody').innerHTML = html;
    S('#dossier').classList.add('on');
  }
  S('#dossier .x').onclick = () => S('#dossier').classList.remove('on');

  /* ---------- hover readout ---------- */
  function setupHover() {
    const tip = S('#hovertip');
    const mapwrap = S('#mapwrap');
    const svg = S('#map');

    const toSvg = (clientX, clientY) => {
      const pt = svg.createSVGPoint();
      pt.x = clientX; pt.y = clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      return pt.matrixTransform(ctm.inverse());
    };

    mapwrap.addEventListener('pointermove', ev => {
      const p = toSvg(ev.clientX, ev.clientY);
      if (!p) return;

      const c = clamp(Math.floor(p.x / city.CW), 0, city.COLS - 1);
      const r = clamp(Math.floor(p.y / city.CH), 0, city.ROWS - 1);
      const i = r * city.COLS + c;
      const land = city.land[i];
      if (!land) {
        tip.classList.remove('on');
        return;
      }
      const zi = city.zoneId[i];
      const z = zi >= 0 ? ZONES[zi] : null;
      const el = city.elev[i];
      const depth = FloodEngine.depthAt(p.x, p.y);
      const kind = city.street[i] ? 'street' : city.building[i] ? 'building' : 'block / yard';

      tip.innerHTML = `
        <div class="ht-name">${z ? z.nm : (land === 2 ? 'Marsh / St. Bernard fringe' : 'Unincorporated')}</div>
        <div class="ht-row"><span>Ground elev.</span><b>${el >= 0 ? '+' : ''}${el.toFixed(1)} ft</b></div>
        <div class="ht-row"><span>Water depth</span><b class="${depth > 6 ? 'hot' : depth > 0.2 ? 'wet' : ''}">${depth > 0.15 ? depth.toFixed(1) + ' ft' : 'dry'}</b></div>
        <div class="ht-row"><span>Surface</span><b>${kind}</b></div>
        ${depth > 0.15 ? `<div class="ht-row"><span>Water surface</span><b>${(el + depth).toFixed(1)} ft NAVD88</b></div>` : ''}
      `;
      tip.classList.add('on');

      const wr = mapwrap.getBoundingClientRect();
      let left = ev.clientX - wr.left + 14;
      let top = ev.clientY - wr.top + 14;
      if (left + 200 > wr.width) left = ev.clientX - wr.left - 210;
      if (top + 110 > wr.height) top = ev.clientY - wr.top - 100;
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    });

    mapwrap.addEventListener('pointerleave', () => tip.classList.remove('on'));

    // click empty land → zone dossier
    mapwrap.addEventListener('click', ev => {
      if (ev.target.closest('.bmark, .pmark, .x, button')) return;
      const p = toSvg(ev.clientX, ev.clientY);
      if (!p) return;
      const c = clamp(Math.floor(p.x / city.CW), 0, city.COLS - 1);
      const r = clamp(Math.floor(p.y / city.CH), 0, city.ROWS - 1);
      const zi = city.zoneId[r * city.COLS + c];
      if (zi >= 0) showDos(zoneHtml(ZONES[zi]));
    });
  }

  /* ---------- phases ---------- */
  function phase() {
    if (t < -13) return ['PRE-STORM · CAT 5 IN THE GULF', 0];
    if (t < 0) return ['MANDATORY EVACUATION', 0];
    if (t < 4.5) return ['SURGE BUILDING · PUMPS AT CAPACITY', 0];
    if (t < 6.17) return ['PERIMETER FAILING — PRE-LANDFALL', 1];
    if (t < 12) return ['CATASTROPHIC BREACHING', 1];
    if (t < 36) return ['THE BOWL FILLS', 1];
    if (t < 84) return ['CITY UNDER WATER · INFLOW CONTINUES', 1];
    return ['EQUALIZED WITH THE LAKE ≈ +3 FT', 0];
  }

  /* ---------- hydrograph ---------- */
  const cv = S('#hydro'), cx = cv.getContext('2d');
  let CW = 0, CH = 0;
  function sizeCanvas() {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    CW = r.width; CH = 150;
    cv.width = CW * dpr; cv.height = CH * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const tx = v => (v - T0) / (TEND - T0) * (CW - 20) + 10;
  const ty = ft => CH - 18 - (ft / 15) * (CH - 46);

  function drawHydro() {
    cx.clearRect(0, 0, CW, CH);
    cx.strokeStyle = '#1D3149'; cx.fillStyle = '#8CA0B3';
    cx.font = '9px IBM Plex Mono'; cx.textAlign = 'left';
    [[-20, ''], [0, 'MON AUG 29'], [24, 'TUE AUG 30'], [48, 'WED AUG 31'], [72, 'THU SEP 1']].forEach(([d, l]) => {
      cx.beginPath(); cx.moveTo(tx(d), 8); cx.lineTo(tx(d), CH - 16); cx.stroke();
      if (l) cx.fillText(l, tx(d) + 4, CH - 6);
    });
    cx.fillText('SUN AUG 28', tx(-20) + 4, CH - 6);
    cx.textAlign = 'right';
    [0, 5, 10, 15].forEach(ft => {
      cx.globalAlpha = 0.6; cx.fillText(ft + ' ft', CW - 2, ty(ft) + 3); cx.globalAlpha = 1;
    });
    cx.beginPath(); cx.moveTo(tx(T0), ty(LAKE[0][1]));
    for (let h = T0; h <= TEND; h += 0.5) cx.lineTo(tx(h), ty(lerp(LAKE, h)));
    cx.lineTo(tx(TEND), CH - 16); cx.lineTo(tx(T0), CH - 16); cx.closePath();
    cx.fillStyle = 'rgba(27,94,140,.35)'; cx.fill();
    cx.beginPath();
    for (let h = T0; h <= TEND; h += 0.5) {
      const X = tx(h), Y = ty(lerp(LAKE, h));
      h === T0 ? cx.moveTo(X, Y) : cx.lineTo(X, Y);
    }
    cx.strokeStyle = '#7FC4DC'; cx.lineWidth = 1.6; cx.stroke();
    cx.beginPath();
    for (let h = T0; h <= TEND; h += 0.5) {
      const X = tx(h), Y = ty(lerp(IHNC, h));
      h === T0 ? cx.moveTo(X, Y) : cx.lineTo(X, Y);
    }
    cx.strokeStyle = '#FFB454'; cx.lineWidth = 1.2; cx.setLineDash([4, 3]); cx.stroke(); cx.setLineDash([]);
    EVENTS.forEach(e => {
      const X = tx(e.t);
      cx.beginPath(); cx.moveTo(X, 14); cx.lineTo(X, ty(lerp(IHNC, e.t)));
      cx.strokeStyle = e.sev ? 'rgba(255,90,69,.55)' : 'rgba(140,160,179,.4)';
      cx.lineWidth = 1; cx.stroke();
      cx.beginPath(); cx.arc(X, 14, 3, 0, 7);
      cx.fillStyle = e.sev ? '#FF5A45' : '#8CA0B3'; cx.fill();
    });
    const X = tx(t);
    cx.fillStyle = 'rgba(232,226,212,.06)';
    cx.fillRect(tx(T0), 8, X - tx(T0), CH - 24);
    cx.beginPath(); cx.moveTo(X, 6); cx.lineTo(X, CH - 14);
    cx.strokeStyle = '#E8E2D4'; cx.lineWidth = 1.6; cx.stroke();
    cx.beginPath(); cx.moveTo(X - 5, 6); cx.lineTo(X + 5, 6); cx.lineTo(X, 13); cx.closePath();
    cx.fillStyle = '#E8E2D4'; cx.fill();
  }

  let dragging = false;
  function ptrT(ev) {
    const r = cv.getBoundingClientRect();
    return clamp(T0 + (ev.clientX - r.left - 10) / (r.width - 20) * (TEND - T0), T0, TEND);
  }
  cv.addEventListener('pointerdown', ev => {
    dragging = true;
    cv.setPointerCapture(ev.pointerId);
    const r = cv.getBoundingClientRect();
    const px = ev.clientX - r.left, py = ev.clientY - r.top;
    let hit = null;
    EVENTS.forEach(e => { if (Math.abs(tx(e.t) - px) < 6 && py < 22) hit = e; });
    t = hit ? hit.t : ptrT(ev);
    playing = false;
    S('#play').textContent = '▶ Run';
    render();
  });
  cv.addEventListener('pointermove', ev => { if (dragging) { t = ptrT(ev); render(); } });
  addEventListener('pointerup', () => { dragging = false; });

  S('#play').onclick = () => {
    playing = !playing;
    S('#play').textContent = playing ? '❚❚ Pause' : '▶ Run';
    if (playing && t >= TEND - 0.1) t = T0;
  };
  SA('.spd').forEach(b => b.onclick = () => {
    speed = +b.dataset.s;
    SA('.spd').forEach(x => x.classList.toggle('on', x === b));
  });
  addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { t = clamp(t + 0.25, T0, TEND); render(); }
    if (e.key === 'ArrowLeft') { t = clamp(t - 0.25, T0, TEND); render(); }
    if (e.key === ' ' && e.target === document.body) { e.preventDefault(); S('#play').click(); }
  });

  /* ---------- render ---------- */
  function render() {
    S('#clock').textContent = fmtT(t);
    const [pl, crit] = phase();
    const pe = S('#phaselbl');
    pe.textContent = pl;
    pe.classList.toggle('crit', !!crit);

    let pct = 0, exposed = 0;
    ZONES.forEach(z => {
      const d = lerp(z.kf, t);
      if (z._td) {
        z._td.textContent = d > 0.2 ? d.toFixed(1) : 'dry';
        z._tr.className = d > 6 ? 'deep' : d > 0.2 ? 'wet' : '';
      }
      if (z.w) pct += z.w * clamp(d / 1.5, 0, 1);
      if (z.pop) exposed += z.pop * clamp(d / 3, 0, 1);
    });
    const pctv = Math.round(pct * 100);
    S('#pctval').innerHTML = pctv + '<small>%</small>';
    S('#pctbar').style.width = pctv + '%';
    S('#floodpct-h').textContent = fmtT(t) + ' · ~' + pctv + '% of Orleans flooded';

    const rescued = Math.round(lerp(RESC, t));
    const stranded = Math.max(0, Math.round(exposed - rescued * 0.9));
    S('#strval').textContent = '≈' + stranded.toLocaleString();
    S('#rescnote').innerHTML = `Cumulative rescued ≈ <b>${rescued.toLocaleString()}</b>. Anchors: ~100,000 remained; ~60,000 ultimately rescued from homes (USCG ~34,000 in N.O.). Zone split is a model, not a count.`;

    const L = lerp(LOAD, t);
    S('#loadval').innerHTML = (L >= 10 ? L.toFixed(0) : L.toFixed(1)) + '<small>× capacity</small>';
    const lb = S('#loadbar');
    lb.style.width = clamp(L / 3 * 33.33, 2, 100) + '%';
    lb.classList.toggle('over', L > 1);
    const rg = S('#regime');
    if (t < 4.5 && L <= 1) { rg.textContent = 'NOMINAL — RAIN WITHIN CAPACITY'; rg.className = 'regime ok'; }
    else if (t < 4.5) { rg.textContent = 'RAIN REGIME — BANDS EXCEED ½ IN/HR DESIGN'; rg.className = 'regime rain'; }
    else if (t < 84) { rg.textContent = 'BREACH REGIME — LAKE FLOWS IN UNOPPOSED'; rg.className = 'regime breach'; }
    else { rg.textContent = 'EQUALIZED — INFLOW ENDED BY PHYSICS'; rg.className = 'regime ok'; }

    PUMPS.forEach(p => {
      let st = p.st[0][1];
      p.st.forEach(([tt, s]) => { if (t >= tt) st = s; });
      p._st.textContent = st.replace('NOPOWER', 'NO POWER');
      p._st.className = 'st ' + st;
      p._r.setAttribute('fill',
        st === 'ONLINE' ? '#69C98F' :
        st === 'STRAINED' ? '#FFB454' :
        st === 'UNMANNED' ? '#C7A6E8' :
        st === 'NOPOWER' ? '#E08B7B' : '#FF5A45');
    });

    BREACH.forEach(b => {
      const live = t >= b.t;
      b._dot.setAttribute('fill', live ? '#FF5A45' : '#0A111C');
      b._dot.setAttribute('stroke', live ? '#FF5A45' : '#5B6B7A');
      b._ring.classList.toggle('live', live && t < b.t + 6);
      b._ring.style.opacity = live && t < b.t + 6 ? '' : 0;
    });

    let nowEv = null;
    EVENTS.forEach(e => {
      const past = t >= e.t;
      e._el.classList.toggle('past', past);
      e._el.classList.toggle('now', past && t < e.t + 1.2);
      if (past) nowEv = e;
    });
    if (nowEv && playing) nowEv._el.scrollIntoView({ block: 'nearest' });

    FloodEngine.draw(t);
    drawHydro();
  }

  /* play loop */
  let last = performance.now();
  function loop(now) {
    const dt = (now - last) / 1000; last = now;
    if (playing) {
      t += dt * 1.2 * speed * (t > 4 && t < 12 ? 0.55 : 1);
      if (t >= TEND) { t = TEND; playing = false; S('#play').textContent = '▶ Run'; }
      render();
    }
    requestAnimationFrame(loop);
  }

  /* ---------- boot ---------- */
  function boot() {
    S('#boot').textContent = 'Building elevation field & street network…';
    // yield so the boot message paints
    requestAnimationFrame(() => {
      city = CityMap.init();
      S('#boot').textContent = 'Seeding breach-driven flood distances…';
      requestAnimationFrame(() => {
        buildBaseSVG();
        buildPanels();
        FloodEngine.init(city, S('#floodcanvas'));
        setupHover();
        applyLayers();
        sizeCanvas();
        // size flood canvas to map
        const syncFlood = () => {
          const wrap = S('#mapwrap');
          const fc = S('#floodcanvas');
          fc.style.width = '100%';
          fc.style.height = '100%';
        };
        syncFlood();
        render();
        S('#boot').classList.add('done');
        addEventListener('resize', () => { sizeCanvas(); drawHydro(); syncFlood(); FloodEngine.draw(t); });
        requestAnimationFrame(loop);
        // gentle wave animation while idle
        setInterval(() => { if (!playing) FloodEngine.draw(t); }, 80);
      });
    });
  }

  boot();
})();
