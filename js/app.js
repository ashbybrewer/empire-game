/* Main UI — Leaflet map + hydrograph + side panel + forensic microscope */
(() => {
  const S = q => document.querySelector(q);
  const SA = q => document.querySelectorAll(q);

  let t = -13, playing = false, speed = 0.25; // default 15 simulated minutes / real second
  const layers = { FLOOD: 1, CANALS: 1, BREACHES: 1, PUMPS: 1, LEVEES: 1, LABELS: 1 };

  function showDos(html) {
    S('#dosbody').innerHTML = html;
    S('#dossier').classList.add('on');
  }
  S('#dossier .x').onclick = () => S('#dossier').classList.remove('on');

  function zoneDepth(z) {
    return MapView.depthAtZone ? MapView.depthAtZone(z, t) : lerp(z.kf, t);
  }

  function zoneHtml(z) {
    const d = zoneDepth(z);
    const st = MapView.floodState ? MapView.floodState(z, t) : { progress: 1 };
    return `<h3>${z.nm}</h3>
      <div class="k">Ground elevation</div><p>${z.elev >= 0 ? '+' : ''}${z.elev} ft NAVD88 (approx.)</p>
      <div class="k">Water depth @ ${fmtT(t)}</div><p>${d > 0.2 ? d.toFixed(1) + ' ft' : 'dry'}${st.progress < 0.99 && d > 0.2 ? ` · front ${(st.progress * 100).toFixed(0)}% into basin` : ''}</p>
      <div class="k">Account</div><p>${z.dos}</p>`;
  }

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
    const tableNames = new Set([
      'Lakeview', 'West End', 'Gentilly Terrace', 'St.  Anthony', 'Mid-City', 'Broadmoor',
      'Treme - Lafitte', 'Central Business District', 'French Quarter', 'Bywater',
      'Lower Ninth Ward', 'Holy Cross', 'Little Woods', 'Uptown', 'Arabi', 'Chalmette / St. Bernard'
    ]);
    ZONES.filter(z => tableNames.has(z.nm)).forEach(z => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML = `<td>${z.nm}</td><td>${z.elev >= 0 ? '+' : ''}${z.elev} ft</td><td class="d">dry</td>`;
      tr.addEventListener('click', () => {
        showDos(zoneHtml(z));
        Microscope.lockAt(z, L.latLng(z.label[1], z.label[0]));
      });
      tb.appendChild(tr);
      z._tr = tr; z._td = tr.querySelector('.d');
    });

    // Visual event chronology strip (between map and microscope) — no forced autoscroll
    const rail = S('#evrail');
    EVENTS.forEach(e => {
      const d = document.createElement('div');
      d.className = 'ev-chip' + (e.sev ? ' sev' : '');
      d.innerHTML = `<div class="t">${fmtT(e.t)}</div><div class="h">${e.h}</div><p>${e.p}</p>`;
      d.addEventListener('click', () => { t = e.t; playing = false; S('#play').textContent = '▶ Run'; render(); });
      rail.appendChild(d);
      e._el = d;
    });

    const togEl = S('#toggles');
    [
      ['FLOOD', 'floodwater'],
      ['CANALS', 'canals'],
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
        MapView.setLayerVisible(k, !!layers[k]);
      };
      togEl.appendChild(b);
    });

    SA('[data-basemap]').forEach(b => {
      b.onclick = () => {
        SA('[data-basemap]').forEach(x => x.classList.toggle('on', x === b));
        MapView.setBasemap(b.dataset.basemap);
      };
    });
  }

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
  const hydroTip = S('#hydrotip');
  let CW = 0, CH = 0;
  function sizeCanvas() {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    CW = r.width; CH = 120;
    cv.width = CW * dpr; cv.height = CH * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const tx = v => (v - T0) / (TEND - T0) * (CW - 20) + 10;
  const ty = ft => CH - 16 - (ft / 15) * (CH - 40);

  function drawHydro() {
    cx.clearRect(0, 0, CW, CH);
    cx.strokeStyle = '#1D3149'; cx.fillStyle = '#8CA0B3';
    cx.font = '9px IBM Plex Mono'; cx.textAlign = 'left';
    [[-20, ''], [0, 'MON AUG 29'], [24, 'TUE AUG 30'], [48, 'WED AUG 31'], [72, 'THU SEP 1']].forEach(([d, l]) => {
      cx.beginPath(); cx.moveTo(tx(d), 8); cx.lineTo(tx(d), CH - 14); cx.stroke();
      if (l) cx.fillText(l, tx(d) + 4, CH - 4);
    });
    cx.fillText('SUN AUG 28', tx(-20) + 4, CH - 4);
    cx.textAlign = 'right';
    [0, 5, 10, 15].forEach(ft => {
      cx.globalAlpha = 0.6; cx.fillText(ft + ' ft', CW - 2, ty(ft) + 3); cx.globalAlpha = 1;
    });
    cx.beginPath(); cx.moveTo(tx(T0), ty(LAKE[0][1]));
    for (let h = T0; h <= TEND; h += 0.5) cx.lineTo(tx(h), ty(lerp(LAKE, h)));
    cx.lineTo(tx(TEND), CH - 14); cx.lineTo(tx(T0), CH - 14); cx.closePath();
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
      cx.beginPath(); cx.arc(X, 14, 3.5, 0, 7);
      cx.fillStyle = e.sev ? '#FF5A45' : '#E8E2D4'; cx.fill();
    });
    const X = tx(t);
    cx.fillStyle = 'rgba(232,226,212,.06)';
    cx.fillRect(tx(T0), 8, X - tx(T0), CH - 22);
    cx.beginPath(); cx.moveTo(X, 6); cx.lineTo(X, CH - 12);
    cx.strokeStyle = '#E8E2D4'; cx.lineWidth = 1.6; cx.stroke();
    cx.beginPath(); cx.moveTo(X - 5, 6); cx.lineTo(X + 5, 6); cx.lineTo(X, 13); cx.closePath();
    cx.fillStyle = '#E8E2D4'; cx.fill();
  }

  function pinAt(px, py) {
    let hit = null;
    EVENTS.forEach(e => {
      if (Math.abs(tx(e.t) - px) < 7 && py < 26) hit = e;
    });
    return hit;
  }

  function showHydroTip(e, clientX, clientY) {
    if (!e) { hydroTip.classList.remove('on'); return; }
    hydroTip.innerHTML = `<div class="ht${e.sev ? ' sev' : ''}">${fmtT(e.t)}</div>
      <div class="hh">${e.h}</div><div class="hp">${e.p}</div>`;
    hydroTip.classList.add('on');
    const wrap = S('#tl').getBoundingClientRect();
    let left = clientX - wrap.left + 12;
    let top = clientY - wrap.top + 12;
    if (left + 240 > wrap.width) left = clientX - wrap.left - 250;
    if (top + 90 > wrap.height) top = Math.max(4, clientY - wrap.top - 90);
    hydroTip.style.left = left + 'px';
    hydroTip.style.top = top + 'px';
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
    const hit = pinAt(px, py);
    t = hit ? hit.t : ptrT(ev);
    playing = false;
    S('#play').textContent = '▶ Run';
    render();
  });
  cv.addEventListener('pointermove', ev => {
    const r = cv.getBoundingClientRect();
    const px = ev.clientX - r.left, py = ev.clientY - r.top;
    if (dragging) { t = ptrT(ev); render(); hydroTip.classList.remove('on'); return; }
    showHydroTip(pinAt(px, py), ev.clientX, ev.clientY);
  });
  cv.addEventListener('pointerleave', () => hydroTip.classList.remove('on'));
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
  S('#stepBack').onclick = () => { t = clamp(t - 1 / 60, T0, TEND); playing = false; S('#play').textContent = '▶ Run'; render(); };
  S('#stepFwd').onclick = () => { t = clamp(t + 1 / 60, T0, TEND); playing = false; S('#play').textContent = '▶ Run'; render(); };
  addEventListener('keydown', e => {
    if (Microscope.onKey(e)) return;
    if (e.key === 'ArrowRight') { t = clamp(t + 1 / 60, T0, TEND); render(); }
    if (e.key === 'ArrowLeft') { t = clamp(t - 1 / 60, T0, TEND); render(); }
    if (e.key === ' ' && e.target === document.body) { e.preventDefault(); S('#play').click(); }
  });

  /* hover tip */
  function onHover(z, latlng, depth) {
    const tip = S('#hovertip');
    if (!z) { tip.classList.remove('on'); return; }
    const d = depth != null ? depth : zoneDepth(z);
    tip.innerHTML = `
      <div class="ht-name">${z.nm}</div>
      <div class="ht-row"><span>Ground elev.</span><b>${z.elev >= 0 ? '+' : ''}${z.elev} ft</b></div>
      <div class="ht-row"><span>Water depth</span><b class="${d > 6 ? 'hot' : d > 0.2 ? 'wet' : ''}">${d > 0.15 ? d.toFixed(1) + ' ft' : 'dry'}</b></div>
      ${d > 0.15 ? `<div class="ht-row"><span>Water surface</span><b>${(z.elev + d).toFixed(1)} ft NAVD88</b></div>` : ''}
    `;
    tip.classList.add('on');
  }

  function render() {
    S('#clock').textContent = fmtT(t);
    const [pl, crit] = phase();
    const pe = S('#phaselbl');
    pe.textContent = pl;
    pe.classList.toggle('crit', !!crit);

    let pct = 0, exposed = 0;
    ZONES.forEach(z => {
      const d = zoneDepth(z);
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
    S('#rescnote').innerHTML = `Cumulative rescued ≈ <b>${rescued.toLocaleString()}</b>. Anchors: ~100,000 remained; ~60,000 ultimately rescued from homes (USCG ~34,000 in N.O.).`;

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
    });

    // Event strip: highlight only — never force-scroll the rail during play
    EVENTS.forEach(e => {
      const past = t >= e.t;
      e._el.classList.toggle('past', past);
      e._el.classList.toggle('now', past && t < e.t + 1.2);
    });

    MapView.update(t);
    drawHydro();
    Microscope.setTime(t);
  }

  let last = performance.now();
  function loop(now) {
    const dt = (now - last) / 1000; last = now;
    if (playing) {
      const cascade = (t > 4 && t < 12) ? 0.7 : 1;
      t += dt * speed * cascade;
      if (t >= TEND) { t = TEND; playing = false; S('#play').textContent = '▶ Run'; }
      render();
    }
    requestAnimationFrame(loop);
  }

  function boot() {
    S('#boot').textContent = 'Loading neighborhood plat…';
    Promise.all([
      fetch('data/nola-neighborhoods.geojson').then(r => { if (!r.ok) throw new Error('hoods'); return r.json(); }),
      fetch('data/nola-canals.geojson').then(r => { if (!r.ok) throw new Error('canals'); return r.json(); })
    ])
      .then(([hoods, canals]) => {
        buildZonesFromGeoJSON(hoods);
        S('#boot').textContent = 'Loading basemap…';
        buildPanels();
        MapView.init(S('#leaflet'), {
          canals,
          levees: LEVEES,
          onZoneClick: (z, latlng) => {
            showDos(zoneHtml(z));
            Microscope.lockAt(z, latlng || L.latLng(z.label[1], z.label[0]));
          },
          onBreachClick: b => showDos(`<h3>${b.nm}</h3><div class="k">${b.sub}</div><p>${b.dos}</p>`),
          onPumpClick: p => showDos(`<h3>${p.nm}</h3><div class="k">Capacity</div><p>${p.cap}</p><div class="k">Account</div><p>${p.dos}</p>`),
          onHover: (z, latlng, depth) => {
            const tip = S('#hovertip');
            if (!z) {
              tip.classList.remove('on');
              Microscope.previewAt(null);
              return;
            }
            onHover(z, latlng, depth);
            Microscope.previewAt(z, latlng);
            const wrap = S('#mapwrap');
            const pt = MapView.getMap().latLngToContainerPoint(latlng);
            let left = pt.x + 14, top = pt.y + 14;
            if (left + 200 > wrap.clientWidth) left = pt.x - 210;
            if (top + 100 > wrap.clientHeight) top = pt.y - 100;
            tip.style.left = left + 'px';
            tip.style.top = top + 'px';
          }
        });
        Microscope.init(S('#microscope'));
        sizeCanvas();
        render();
        S('#boot').classList.add('done');
        requestAnimationFrame(() => { MapView.invalidate(); Microscope.paint(); });
        addEventListener('resize', () => { sizeCanvas(); drawHydro(); MapView.invalidate(); Microscope.paint(); });
        requestAnimationFrame(loop);
      })
      .catch(err => {
        console.error(err);
        S('#boot').textContent = 'Failed to load map data — check console';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
