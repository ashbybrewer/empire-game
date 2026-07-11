/* Leaflet map: satellite/streets, real canal GeoJSON, elevation-aware flood flow */
const MapView = (() => {
  let map, zoneLayers = {}, breachMarkers = {}, pumpMarkers = {};
  let floodLayer, canalLayer, leveeLayer, labelLayer, flowLayer;
  let satLayer, streetLayer, hybridRoads;
  let onZoneClick = null;
  let hoverCb = null;
  let _t = -13;
  let flowCircles = [];

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
    // Lower ground reads darker/wetter sooner; progress gates how far water has spread
    const p = progress == null ? 1 : progress;
    const a = clamp((0.18 + depth / 16) * (0.35 + 0.65 * p), 0.12, 0.72);
    let fill;
    if (depth < 2) fill = '#4aa0bc';
    else if (depth < 5) fill = '#2a7aa8';
    else if (depth < 10) fill = '#15608a';
    else fill = '#0c4068';
    return {
      fillColor: fill,
      fillOpacity: a,
      color: depth > 6 ? '#FF5A45' : '#7FC4DC',
      weight: 1,
      opacity: 0.5
    };
  }

  /* Elevation + distance-from-breach flood routing */
  function floodState(z, t) {
    const dTarget = lerp(z.kf, t);
    if (dTarget <= 0.05 || z.entry === 'none') return { depth: 0, progress: 0 };

    const tEntry = ENTRY_TIME[z.entry] != null ? ENTRY_TIME[z.entry] : 6.5;
    if (t < tEntry - 0.05) return { depth: 0, progress: 0 };

    // Rain-only basins (Jefferson): no breach routing — ponding from unloaded pumps
    if (z.entry === 'jeff') {
      const progress = clamp((t - tEntry) / 5, 0, 1);
      return { depth: dTarget * progress, progress };
    }

    // Nearest live breach that can feed this basin
    let distKm = 12;
    BREACH.forEach(b => {
      if (t < b.t) return;
      const feeds =
        (z.entry === b.source) ||
        (z.entry === 'gravity' && (b.source === 'b17' || b.source === 'lonS' || b.source === 'lonN'));
      if (!feeds) return;
      const dlat = (z.label[1] - b.lat) * 111;
      const dlon = (z.label[0] - b.lon) * 111 * Math.cos(z.label[1] * Math.PI / 180);
      distKm = Math.min(distKm, Math.hypot(dlat, dlon));
    });
    if (z.entry === 'gravity') {
      distKm = Math.max(distKm, 2.5);
    }

    // Low ground floods first / faster (elev -8..+8 → factor)
    const elevFactor = clamp(1.15 - (z.elev + 7) / 14, 0.45, 1.35);
    const spreadHrs = (0.35 + distKm * 0.85) / elevFactor * (z.entry === 'gravity' ? 1.6 : 1);
    const progress = clamp((t - tEntry) / Math.max(spreadHrs, 0.25), 0, 1);

    // Depth tracks basin curve but is gated by how far the front has reached
    const depth = dTarget * Math.pow(progress, z.elev < -3 ? 0.55 : 0.75);
    return { depth, progress };
  }

  function styleForZone(z) {
    const { depth, progress } = floodState(z, _t);
    return depthStyle(depth, z.elev, progress);
  }

  function init(container, opts = {}) {
    onZoneClick = opts.onZoneClick || null;
    hoverCb = opts.onHover || null;

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

    // Real canal geometries (OSM waterbodies + digitized centerlines ON the channels)
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

    // Lakefront / wall alignments as light dashed guides (approximate)
    (opts.levees || LEVEES || []).forEach(l => {
      L.polyline(l.latlngs, {
        color: '#C9CFAA', weight: 2, opacity: 0.7, dashArray: '6 4'
      }).bindTooltip(l.name, { sticky: true }).addTo(leveeLayer);
    });

    ZONES.forEach(z => {
      let layer;
      if (z.feature) {
        layer = L.geoJSON(z.feature, {
          style: () => styleForZone(z),
          onEachFeature: (feat, lyr) => {
            lyr.on('click', () => onZoneClick && onZoneClick(z));
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
        layer.on('click', () => onZoneClick && onZoneClick(z));
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

      // Flood-flow plume ring (grows after breach — water spreading into low ground)
      const plume = L.circle([b.lat, b.lon], {
        radius: 80,
        color: '#FF5A45',
        weight: 1,
        opacity: 0,
        fillColor: '#1B5E8C',
        fillOpacity: 0,
        interactive: false
      }).addTo(flowLayer);
      flowCircles.push({ b, plume });
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
    return map;
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

    // Expanding flood plumes from breaches — faster into low ground (visual of flow)
    flowCircles.forEach(({ b, plume }) => {
      if (t < b.t) {
        plume.setStyle({ opacity: 0, fillOpacity: 0 });
        return;
      }
      const age = t - b.t;
      // radius grows for ~10–18 hours then holds (meters)
      const r = 120 + Math.min(age, 18) * 220;
      const fade = age < 24 ? 0.22 : clamp(0.22 * (1 - (age - 24) / 40), 0.05, 0.22);
      plume.setRadius(r);
      plume.setStyle({
        opacity: clamp(0.55 - age * 0.015, 0.15, 0.55),
        fillOpacity: fade,
        fillColor: '#1B6E9C',
        color: '#FF5A45'
      });
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

  return { init, update, setBasemap, setLayerVisible, invalidate, getMap: () => map, depthAtZone, floodState };
})();
