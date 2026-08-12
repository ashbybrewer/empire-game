/* Leaflet map: satellite/streets, real canal GeoJSON, elevation-aware flood flow */
const MapView = (() => {
  let map, zoneLayers = {}, breachMarkers = {}, pumpMarkers = {};
  let floodLayer, canalLayer, leveeLayer, labelLayer, flowLayer, routeLayer, confLayer, transectLayer;
  let satLayer, streetLayer, hybridRoads;
  let onZoneClick = null;
  let hoverCb = null;
  let mapClickCb = null;
  let _t = -13;
  let flowCircles = [];
  let confOn = false;
  let transectMode = false;
  let transectPts = [];
  let transectCb = null;

  function depthStyle(depth, elev, progress) {
    if (depth <= 0.12) {
      return {
        fillColor: elev >= 3 ? '#4a5c40' : elev >= 0 ? '#3a4a52' : '#2a3a55',
        fillOpacity: 0.06,
        color: '#7FC4DC',
        weight: 0.6,
        opacity: 0.28
      };
    }
    const p = progress == null ? 1 : progress;
    // Soften early shallow film so water reads as advancing street corridors first
    const frontGate = p < 0.35 ? 0.45 + p : 0.35 + 0.65 * p;
    const a = clamp((0.16 + depth / 15) * frontGate, 0.10, 0.78);
    let fill;
    if (depth < 1.2) fill = '#5aadc4';
    else if (depth < 2.5) fill = '#3d92b4';
    else if (depth < 5) fill = '#2a7aa8';
    else if (depth < 10) fill = '#15608a';
    else fill = '#0c4068';
    return {
      fillColor: fill,
      fillOpacity: a,
      color: depth > 6 ? '#FF5A45' : '#7FC4DC',
      weight: p < 0.55 ? 1.4 : 1,
      opacity: p < 0.55 ? 0.65 : 0.5,
      dashArray: p < 0.4 && depth < 4 ? '3 4' : null
    };
  }

  /* Elevation + distance-from-breach flood routing */
  function floodState(z, t) {
    const dTarget = lerp(z.kf, t);
    if (dTarget <= 0.05 || z.entry === 'none') return { depth: 0, progress: 0, source: null, bearing: null };

    const tEntry = ENTRY_TIME[z.entry] != null ? ENTRY_TIME[z.entry] : 6.5;
    if (t < tEntry - 0.05) return { depth: 0, progress: 0, source: null, bearing: null };

    if (z.entry === 'jeff') {
      const progress = clamp((t - tEntry) / 5, 0, 1);
      return { depth: dTarget * progress, progress, source: 'jeff', bearing: 0 };
    }

    let distKm = 12;
    let srcBreach = null;
    BREACH.forEach(b => {
      if (t < b.t) return;
      const feeds =
        (z.entry === b.source) ||
        (z.entry === 'gravity' && (b.source === 'b17' || b.source === 'lonS' || b.source === 'lonN'));
      if (!feeds) return;
      const dlat = (z.label[1] - b.lat) * 111;
      const dlon = (z.label[0] - b.lon) * 111 * Math.cos(z.label[1] * Math.PI / 180);
      const d = Math.hypot(dlat, dlon);
      if (d < distKm) { distKm = d; srcBreach = b; }
    });
    if (z.entry === 'gravity') distKm = Math.max(distKm, 2.5);

    const elevFactor = clamp(1.15 - (z.elev + 7) / 14, 0.45, 1.35);
    const spreadHrs = (0.45 + distKm * 0.95) / elevFactor * (z.entry === 'gravity' ? 1.75 : 1);
    const progress = clamp((t - tEntry) / Math.max(spreadHrs, 0.3), 0, 1);
    const depth = dTarget * Math.pow(progress, z.elev < -3 ? 0.5 : 0.72);
    let bearing = null;
    if (srcBreach) {
      bearing = Math.atan2(z.label[1] - srcBreach.lat, z.label[0] - srcBreach.lon) * 180 / Math.PI;
    }
    return { depth, progress, source: srcBreach ? srcBreach.id : z.entry, bearing, breach: srcBreach };
  }

  function styleForZone(z) {
    const { depth, progress } = floodState(z, _t);
    return depthStyle(depth, z.elev, progress);
  }

  function confidenceForZone(z) {
    if (z.entry === 'none') return { level: 'APPROXIMATE', color: '#5B6B7A', score: 0.35 };
    if (z.entry === 'b17' || z.entry === 'lonS' || z.entry === 'lonN' || z.entry === 'ihnc')
      return { level: 'OBSERVED', color: '#69C98F', score: 0.85 };
    if (z.entry === 'mrgo' || z.entry === 'giww' || z.entry === 'noeL')
      return { level: 'INTERPOLATED', color: '#FFB454', score: 0.7 };
    if (z.entry === 'gravity') return { level: 'MODELED', color: '#7FC4DC', score: 0.55 };
    return { level: 'APPROXIMATE', color: '#8CA0B3', score: 0.4 };
  }

  function init(container, opts = {}) {
    onZoneClick = opts.onZoneClick || null;
    hoverCb = opts.onHover || null;
    mapClickCb = opts.onMapClick || null;

    map = L.map(container, {
      center: [29.975, -90.05],
      zoom: 12,
      minZoom: 11,
      maxZoom: 17,
      zoomControl: true,
      attributionControl: true
    });

    satLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 17, attribution: 'Tiles © Esri' }
    );
    streetLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { maxZoom: 17, subdomains: 'abcd', attribution: '© OSM © CARTO' }
    );
    hybridRoads = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 17, opacity: 0.9, attribution: 'Roads © Esri' }
    );

    satLayer.addTo(map);
    hybridRoads.addTo(map);

    canalLayer = L.layerGroup().addTo(map);
    leveeLayer = L.layerGroup().addTo(map);
    flowLayer = L.layerGroup().addTo(map);
    floodLayer = L.layerGroup().addTo(map);
    labelLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    confLayer = L.layerGroup();
    transectLayer = L.layerGroup().addTo(map);

    if (opts.canals) {
      L.geoJSON(opts.canals, {
        style: f => {
          const kind = f.properties.kind;
          if (kind === 'waterbody') {
            return { color: '#5FA8C4', weight: 1, opacity: 0.9, fillColor: '#1a5a7a', fillOpacity: 0.75 };
          }
          return { color: '#6EB8D4', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' };
        },
        onEachFeature: (f, layer) => {
          layer.bindTooltip(f.properties.name, { sticky: true });
        }
      }).addTo(canalLayer);
    }

    (opts.levees || LEVEES || []).forEach(l => {
      L.polyline(l.latlngs, {
        color: '#C9CFAA', weight: 2.2, opacity: 0.85, dashArray: '7 5'
      }).bindTooltip(l.name + ' · approx. alignment', { sticky: true }).addTo(leveeLayer);
    });

    ZONES.forEach(z => {
      let layer;
      if (z.feature) {
        layer = L.geoJSON(z.feature, {
          style: () => styleForZone(z),
          onEachFeature: (feat, lyr) => {
            lyr.on('click', e => {
              if (transectMode) return;
              L.DomEvent.stopPropagation(e);
              onZoneClick && onZoneClick(z, e.latlng);
            });
            lyr.on('mouseover', e => {
              lyr.setStyle({ weight: 2.2, opacity: 1 });
              const st = floodState(z, _t);
              hoverCb && hoverCb(z, e.latlng, st.depth);
            });
            lyr.on('mousemove', e => {
              const st = floodState(z, _t);
              hoverCb && hoverCb(z, e.latlng, st.depth);
            });
            lyr.on('mouseout', () => {
              lyr.setStyle(styleForZone(z));
              hoverCb && hoverCb(null);
            });
          }
        });
      } else {
        const latlngs = z.ring.map(([lon, lat]) => [lat, lon]);
        layer = L.polygon(latlngs, styleForZone(z));
        layer.on('click', e => {
          if (transectMode) return;
          L.DomEvent.stopPropagation(e);
          onZoneClick && onZoneClick(z, e.latlng);
        });
        layer.on('mouseover', e => {
          layer.setStyle({ weight: 2.2, opacity: 1 });
          hoverCb && hoverCb(z, e.latlng, floodState(z, _t).depth);
        });
        layer.on('mousemove', e => hoverCb && hoverCb(z, e.latlng, floodState(z, _t).depth));
        layer.on('mouseout', () => {
          layer.setStyle(styleForZone(z));
          hoverCb && hoverCb(null);
        });
      }
      layer.addTo(floodLayer);
      zoneLayers[z.id] = layer;

      const confStyle = () => {
        const conf = confidenceForZone(z);
        return { fillColor: conf.color, fillOpacity: 0.28, color: conf.color, weight: 0.8, opacity: 0.5 };
      };
      if (z.feature) {
        L.geoJSON(z.feature, { style: confStyle, interactive: false }).addTo(confLayer);
      } else if (z.ring) {
        L.polygon(z.ring.map(([lon, lat]) => [lat, lon]), Object.assign(confStyle(), { interactive: false })).addTo(confLayer);
      }

      const major = ['Lakeview', 'West End', 'Gentilly Terrace', 'Mid-City', 'Broadmoor', 'French Quarter',
        'Lower Ninth Ward', 'Holy Cross', 'Little Woods', 'Central Business District', 'Uptown',
        'Arabi', 'Chalmette / St. Bernard', 'Bywater', 'Treme - Lafitte'].includes(z.nm);
      if (major) {
        L.marker([z.label[1], z.label[0]], {
          interactive: false,
          icon: L.divIcon({
            className: 'zone-label',
            html: `<span>${z.nm.toUpperCase()}</span>`,
            iconSize: [140, 18],
            iconAnchor: [70, 9]
          })
        }).addTo(labelLayer);
      }
    });

    BREACH.forEach(b => {
      const m = L.circleMarker([b.lat, b.lon], {
        radius: 7, color: '#5B6B7A', fillColor: '#0A111C', fillOpacity: 1, weight: 2
      });
      m.bindTooltip(b.nm, { direction: 'top' });
      m.on('click', () => opts.onBreachClick && opts.onBreachClick(b));
      m.addTo(map);
      breachMarkers[b.id] = m;

      const plume = L.circle([b.lat, b.lon], {
        radius: 80, color: '#FF5A45', weight: 1, opacity: 0,
        fillColor: '#1B5E8C', fillOpacity: 0, interactive: false
      }).addTo(flowLayer);
      const plume2 = L.circle([b.lat, b.lon], {
        radius: 40, color: '#7FC4DC', weight: 1, opacity: 0,
        fillColor: '#2a7aa8', fillOpacity: 0, interactive: false
      }).addTo(flowLayer);
      flowCircles.push({ b, plume, plume2 });
    });

    PUMPS.forEach(p => {
      const m = L.marker([p.lat, p.lon], {
        icon: L.divIcon({
          className: 'pump-mark',
          html: '<i></i>',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        })
      });
      m.bindTooltip(p.nm, { direction: 'top' });
      m.on('click', () => opts.onPumpClick && opts.onPumpClick(p));
      m.addTo(map);
      pumpMarkers[p.id] = m;
    });

    map.fitBounds([[29.91, -90.16], [30.03, -89.90]], { padding: [16, 16] });
    map.on('mouseout', () => hoverCb && hoverCb(null));
    map.on('click', e => {
      if (transectMode) {
        handleTransectClick(e.latlng);
        return;
      }
      mapClickCb && mapClickCb(e.latlng);
    });
    return map;
  }

  function handleTransectClick(latlng) {
    transectPts.push(latlng);
    redrawTransect();
    if (transectPts.length >= 2) {
      const pts = transectPts.slice(0, 2);
      transectMode = false;
      map.getContainer().style.cursor = '';
      transectCb && transectCb(pts);
      transectPts = [];
    }
  }

  function redrawTransect() {
    transectLayer.clearLayers();
    transectPts.forEach(p => {
      L.circleMarker(p, { radius: 5, color: '#FFB454', fillColor: '#FFB454', fillOpacity: 1, weight: 1 }).addTo(transectLayer);
    });
    if (transectPts.length === 2) {
      L.polyline(transectPts, { color: '#FFB454', weight: 2, dashArray: '4 3' }).addTo(transectLayer);
    }
  }

  function startTransect(cb) {
    if (!map || !transectLayer) return;
    transectMode = true;
    transectPts = [];
    transectCb = cb;
    transectLayer.clearLayers();
    map.getContainer().style.cursor = 'crosshair';
  }

  function cancelTransect() {
    if (!transectMode && !transectPts.length) return false;
    transectMode = false;
    transectPts = [];
    if (transectLayer) transectLayer.clearLayers();
    if (map) map.getContainer().style.cursor = '';
    return true;
  }

  function setTransectLine(pts) {
    if (!transectLayer) return;
    transectLayer.clearLayers();
    if (!pts || pts.length < 2) return;
    L.polyline(pts, { color: '#FFB454', weight: 2, dashArray: '4 3' }).addTo(transectLayer);
    pts.forEach(p => L.circleMarker(p, { radius: 4, color: '#FFB454', fillColor: '#FFB454', fillOpacity: 1 }).addTo(transectLayer));
  }

  function setRoute(latlngs, opts = {}) {
    if (!routeLayer) return;
    routeLayer.clearLayers();
    if (!latlngs || latlngs.length < 2) return;
    L.polyline(latlngs, {
      color: opts.color || '#FFB454',
      weight: 2.5,
      opacity: 0.9,
      dashArray: '6 5'
    }).bindTooltip(opts.label || 'Modeled flow route', { sticky: true }).addTo(routeLayer);
    L.circleMarker(latlngs[0], { radius: 5, color: '#FF5A45', fillColor: '#FF5A45', fillOpacity: 1, weight: 1 }).addTo(routeLayer);
    L.circleMarker(latlngs[latlngs.length - 1], { radius: 5, color: '#7FC4DC', fillColor: '#7FC4DC', fillOpacity: 1, weight: 1 }).addTo(routeLayer);
  }

  function clearRoute() { if (routeLayer) routeLayer.clearLayers(); }

  function setConfidenceOverlay(on) {
    confOn = !!on;
    if (!map || !confLayer) return;
    if (confOn) confLayer.addTo(map);
    else map.removeLayer(confLayer);
  }

  function setBasemap(mode) {
    map.removeLayer(satLayer);
    map.removeLayer(streetLayer);
    map.removeLayer(hybridRoads);
    if (mode === 'streets') streetLayer.addTo(map);
    else { satLayer.addTo(map); hybridRoads.addTo(map); }
    canalLayer.addTo(map);
    leveeLayer.addTo(map);
    flowLayer.addTo(map);
    floodLayer.addTo(map);
    labelLayer.addTo(map);
    routeLayer.addTo(map);
    transectLayer.addTo(map);
    if (confOn) confLayer.addTo(map);
    Object.values(breachMarkers).forEach(m => m.addTo(map));
    Object.values(pumpMarkers).forEach(m => m.addTo(map));
  }

  function setLayerVisible(key, on) {
    if (key === 'BREACHES') {
      Object.values(breachMarkers).forEach(m => on ? m.addTo(map) : map.removeLayer(m));
      return;
    }
    if (key === 'PUMPS') {
      Object.values(pumpMarkers).forEach(m => on ? m.addTo(map) : map.removeLayer(m));
      return;
    }
    const groups = { FLOOD: floodLayer, CANALS: canalLayer, LEVEES: leveeLayer, LABELS: labelLayer, FLOW: flowLayer };
    const g = groups[key];
    if (!g) return;
    if (on) g.addTo(map); else map.removeLayer(g);
  }

  function update(t) {
    _t = t;
    ZONES.forEach(z => {
      const layer = zoneLayers[z.id];
      if (!layer) return;
      const style = styleForZone(z);
      if (layer.setStyle) layer.setStyle(style);
      else layer.eachLayer(l => l.setStyle(style));
    });

    BREACH.forEach(b => {
      const live = t >= b.t;
      breachMarkers[b.id].setStyle({
        fillColor: live ? '#FF5A45' : '#0A111C',
        color: live ? '#FF5A45' : '#5B6B7A',
        radius: live && t < b.t + 6 ? 9 : 7
      });
    });

    flowCircles.forEach(({ b, plume, plume2 }) => {
      if (t < b.t) {
        plume.setStyle({ opacity: 0, fillOpacity: 0 });
        if (plume2) plume2.setStyle({ opacity: 0, fillOpacity: 0 });
        return;
      }
      const age = t - b.t;
      const r = 100 + Math.min(age, 20) * 240;
      const fade = age < 24 ? 0.2 : clamp(0.2 * (1 - (age - 24) / 40), 0.04, 0.2);
      plume.setRadius(r);
      plume.setStyle({
        opacity: clamp(0.55 - age * 0.012, 0.12, 0.55),
        fillOpacity: fade,
        fillColor: '#1B6E9C',
        color: '#FF5A45'
      });
      if (plume2) {
        const r2 = 60 + Math.min(age, 8) * 90;
        plume2.setRadius(r2);
        plume2.setStyle({
          opacity: clamp(0.45 - age * 0.02, 0.08, 0.45),
          fillOpacity: clamp(0.28 - age * 0.015, 0.05, 0.28),
          fillColor: '#3d92b4',
          color: '#7FC4DC'
        });
      }
    });

    PUMPS.forEach(p => {
      let st = p.st[0][1];
      p.st.forEach(([tt, s]) => { if (t >= tt) st = s; });
      const el = pumpMarkers[p.id].getElement();
      if (el) el.className = 'pump-mark leaflet-marker-icon leaflet-zoom-animated leaflet-interactive st-' + st;
    });
  }

  function depthAtZone(z, t) {
    return floodState(z, t == null ? _t : t).depth;
  }

  function invalidate() { if (map) map.invalidateSize(); }

  return {
    init, update, setBasemap, setLayerVisible, invalidate, getMap: () => map,
    depthAtZone, floodState, confidenceForZone,
    startTransect, cancelTransect, setTransectLine, isTransectMode: () => transectMode,
    setRoute, clearRoute, setConfidenceOverlay
  };
})();
