/* Leaflet map: satellite / streets + real neighborhood GeoJSON flood overlays */
const MapView = (() => {
  let map, zoneLayers = {}, breachMarkers = {}, pumpMarkers = {};
  let floodLayer, canalLayer, leveeLayer, labelLayer;
  let satLayer, streetLayer, hybridRoads;
  let onZoneClick = null;
  let hoverCb = null;
  let _t = -13;

  function depthStyle(depth, elev) {
    if (depth <= 0.15) {
      return {
        fillColor: elev >= 3 ? '#4a5c40' : elev >= 0 ? '#3a4a52' : '#2a3a55',
        fillOpacity: 0.08,
        color: '#7FC4DC',
        weight: 0.7,
        opacity: 0.3
      };
    }
    // Keep satellite streets readable under shallow water
    const a = clamp(0.22 + depth / 18, 0.22, 0.68);
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
      opacity: 0.55
    };
  }

  function styleForZone(z) {
    const d = lerp(z.kf, _t);
    const style = depthStyle(d, z.elev);
    if (d > 0.15 && z.entry !== 'none') {
      const tEntry = ENTRY_TIME[z.entry] != null ? ENTRY_TIME[z.entry] : 6.5;
      const progress = clamp((_t - tEntry) / (z.entry === 'gravity' ? 14 : 6), 0, 1);
      style.fillOpacity *= (0.4 + 0.6 * Math.max(progress, 0.45));
    }
    return style;
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
    floodLayer = L.layerGroup().addTo(map);
    labelLayer = L.layerGroup().addTo(map);

    CANALS.forEach(c => {
      L.polyline(c.latlngs, {
        color: '#5FA8C4', weight: 3.5, opacity: 0.95, lineJoin: 'round'
      }).bindTooltip(c.name, { sticky: true }).addTo(canalLayer);
    });

    LEVEES.forEach(l => {
      L.polyline(l.latlngs, {
        color: '#C9CFAA', weight: 2, opacity: 0.85, dashArray: '6 4'
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
              hoverCb && hoverCb(z, e.latlng, lerp(z.kf, _t));
            });
            lyr.on('mousemove', e => hoverCb && hoverCb(z, e.latlng, lerp(z.kf, _t)));
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
          hoverCb && hoverCb(z, e.latlng, lerp(z.kf, _t));
        });
        layer.on('mousemove', e => hoverCb && hoverCb(z, e.latlng, lerp(z.kf, _t)));
        layer.on('mouseout', () => {
          layer.setStyle(styleForZone(z));
          hoverCb && hoverCb(null);
        });
      }
      layer.addTo(floodLayer);
      zoneLayers[z.id] = layer;

      // labels only for major / flooded basins to reduce clutter
      const major = ['Lakeview','West End','Gentilly Terrace','Mid-City','Broadmoor','French Quarter',
        'Lower Ninth Ward','Holy Cross','Little Woods','Central Business District','Uptown',
        'Arabi','Chalmette / St. Bernard','Bywater','Treme - Lafitte'].includes(z.nm);
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
    const groups = { FLOOD: floodLayer, CANALS: canalLayer, LEVEES: leveeLayer, LABELS: labelLayer };
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

    PUMPS.forEach(p => {
      let st = p.st[0][1];
      p.st.forEach(([tt, s]) => { if (t >= tt) st = s; });
      const el = pumpMarkers[p.id].getElement();
      if (el) el.className = 'pump-mark leaflet-marker-icon leaflet-zoom-animated leaflet-interactive st-' + st;
    });
  }

  function invalidate() { if (map) map.invalidateSize(); }

  return { init, update, setBasemap, setLayerVisible, invalidate, getMap: () => map };
})();
