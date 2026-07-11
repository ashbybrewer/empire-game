/* Timeline data + flood profiles mapped onto real neighborhood GeoJSON */
const T0 = -20, TEND = 90;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (kf, t) => {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 1; i < kf.length; i++) {
    if (t <= kf[i][0]) {
      const [a, va] = kf[i - 1], [b, vb] = kf[i];
      return va + (vb - va) * (t - a) / (b - a);
    }
  }
  return kf[kf.length - 1][1];
};
const fmtT = t => {
  const abs = t + 24, d = Math.floor(abs / 24);
  const names = ['SUN 28', 'MON 29', 'TUE 30', 'WED 31', 'THU 1'];
  let hr = ((abs % 24) + 24) % 24;
  const h = Math.floor(hr), m = Math.round((hr - h) * 60);
  return `${names[clamp(d, 0, 4)]} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/* Flood profiles — keyed by id; neighborhoods inherit via HOOD_PROFILE */
const PROFILES = {
  dry_ridge: {
    elev: 6, pop: 0, w: 0, entry: 'none', kf: [[0, 0]],
    dos: 'Natural levee / river-ridge ground. Wind damage, little or no floodwater.'
  },
  lakeview: {
    elev: -7, pop: 4000, w: 0.07, entry: 'b17',
    kf: [[6.5,0],[7,1.5],[12,4],[18,6],[30,8.5],[48,10],[84,10]],
    dos: 'Ground −4 to −7 ft. Flooded by the 17th St Canal breach at Bellaire Dr from ~06:30 Aug 29.'
  },
  westend: {
    elev: -4, pop: 1500, w: 0.025, entry: 'b17',
    kf: [[6.5,0],[7,1.2],[12,3.5],[18,5.5],[30,7.5],[48,9],[84,9]],
    dos: 'West End / Lakewood took early water from the 17th St Canal breach.'
  },
  citypark: {
    elev: -3, pop: 2000, w: 0.03, entry: 'lonN',
    kf: [[6.5,0],[7.2,1],[12,3],[18,5.5],[30,7.5],[48,8.5],[84,8.5]],
    dos: 'City Park and Filmore took London Avenue water from the north breach.'
  },
  gentilly: {
    elev: -4, pop: 5000, w: 0.06, entry: 'lonS',
    kf: [[6.5,0],[7,1.5],[12,3.5],[18,6],[30,8],[48,9],[84,9]],
    dos: 'Hit from both London Ave breaches over the Pine Island beach sand trend.'
  },
  mirabeau: {
    elev: -5, pop: 3000, w: 0.04, entry: 'lonS',
    kf: [[6.5,0],[7,2],[12,4.5],[18,7],[30,8.5],[48,9.5],[84,9.5]],
    dos: 'Direct path of the London Avenue south breach. Houses took 8–10+ ft.'
  },
  midcity: {
    elev: -4, pop: 6000, w: 0.07, entry: 'gravity',
    kf: [[9,0],[14,1],[20,2.5],[30,4.5],[42,6.5],[54,8],[84,8]],
    dos: 'No adjacent breach — water arrived by gravity from Lakeview and Gentilly over Aug 29–31.'
  },
  broadmoor: {
    elev: -5, pop: 4500, w: 0.05, entry: 'gravity',
    kf: [[10,0],[16,1.5],[24,3.5],[36,6],[48,8],[84,8]],
    dos: 'Floor of the bowl. Water pooled to ~8 ft.'
  },
  treme: {
    elev: -2, pop: 4000, w: 0.04, entry: 'gravity',
    kf: [[10,0],[16,1.2],[24,3],[36,5.5],[48,7],[84,7]],
    dos: 'Flooded from the north as Mid-City and Gentilly water sought the river ridge.'
  },
  cbd: {
    elev: 1, pop: 8000, w: 0.05, entry: 'gravity',
    kf: [[12,0],[30,1],[48,2],[60,3],[84,3]],
    dos: 'Stayed dry through landfall, then flooded 1–3 ft Aug 30–31. ~3 ft outside the Superdome.'
  },
  fq: {
    elev: 8, pop: 3000, w: 0.02, entry: 'none', kf: [[0, 0]],
    dos: 'Built on the Mississippi’s natural levee. Wind damage, no floodwater.'
  },
  marigny: {
    elev: 4, pop: 2500, w: 0.02, entry: 'none',
    kf: [[0,0],[36,.3],[60,.8],[84,.5]],
    dos: 'River-ridge ground. Mostly dry; some ponding toward the Industrial Canal.'
  },
  lower9: {
    elev: -2, pop: 4500, w: 0.04, entry: 'ihnc',
    kf: [[4.8,0],[5.2,2],[6,4],[7.75,6],[8.6,10],[12,12],[36,12],[84,11]],
    dos: 'Two IHNC east-wall failures (~05:00 and ~07:45 with barge ING 4727). Under 10–15 ft within hours.'
  },
  holycross: {
    elev: 1, pop: 1200, w: 0.012, entry: 'ihnc',
    kf: [[5.5,0],[7,2],[9,5],[12,8],[36,9],[84,8]],
    dos: 'Southern tip of the Lower 9th along the river — several feet of water.'
  },
  noeast_deep: {
    elev: -7, pop: 6000, w: 0.1, entry: 'noeL',
    kf: [[5.5,0],[6.7,1.5],[12,5],[24,8],[48,10],[84,10]],
    dos: 'Lakefront / low N.O. East. Overtopping and deepest standing water (16–20 ft in pockets).'
  },
  noeast: {
    elev: -5, pop: 6000, w: 0.1, entry: 'giww',
    kf: [[5.5,0],[6.7,2],[12,4.5],[24,7],[48,9],[84,9]],
    dos: 'GIWW levees overtopped and breached by ~06:30; basin filled from south and north.'
  },
  westbank: {
    elev: 3, pop: 0, w: 0, entry: 'none', kf: [[0, 0]],
    dos: 'West Bank of the Mississippi. Outside the east-bank bowl; escaped catastrophic flooding.'
  },
  jeff: {
    elev: -5, pop: 0, w: 0, entry: 'jeff',
    kf: [[3,0],[6,1.5],[10,2],[24,1.5],[48,1],[84,.5]],
    dos: 'Jefferson Parish flooded 1–2 ft on rainfall with unmanned pumps (doomsday plan).'
  }
};

/* Map Click-That-Hood names → flood profile ids */
const HOOD_PROFILE = {
  'Lakeview': 'lakeview',
  'Lakewood': 'westend',
  'West End': 'westend',
  'Lakeshore - Lake Vista': 'westend',
  'Navarre': 'lakeview',
  'City Park': 'citypark',
  'Fillmore': 'citypark',
  'Bayou St. John': 'citypark',
  'Gentilly Terrace': 'gentilly',
  'Gentilly Woods': 'gentilly',
  'Milneburg': 'gentilly',
  'Pontchartrain Park': 'gentilly',
  'Dillard': 'gentilly',
  'St.  Anthony': 'mirabeau',
  'St. Roch': 'mirabeau',
  'St. Bernard Area': 'mirabeau',
  'Desire Area': 'mirabeau',
  'Desire Dev': 'mirabeau',
  'Florida Area': 'mirabeau',
  'Florida Dev': 'mirabeau',
  'Mid-City': 'midcity',
  'Tulane - Gravier': 'midcity',
  'Gert Town': 'midcity',
  'B. W. Cooper': 'midcity',
  'Iberville': 'midcity',
  'Broadmoor': 'broadmoor',
  'Marlyville - Fontainbleau': 'broadmoor',
  'Dixon': 'broadmoor',
  'Hollygrove': 'broadmoor',
  'Treme - Lafitte': 'treme',
  'Seventh Ward': 'treme',
  'Fairgrounds': 'treme',
  'Central Business District': 'cbd',
  'Central City': 'cbd',
  'St. Thomas Dev': 'cbd',
  'French Quarter': 'fq',
  'Marigny': 'marigny',
  'Bywater': 'marigny',
  'St. Claude': 'marigny',
  'Lower Ninth Ward': 'lower9',
  'Holy Cross': 'holycross',
  'Little Woods': 'noeast_deep',
  'Lake Terrace & Oaks': 'noeast_deep',
  'Pines Village': 'noeast',
  'Plum Orchard': 'noeast',
  'Read Blvd East': 'noeast',
  'Read Blvd West': 'noeast',
  'West Lake Forest': 'noeast',
  'Village De Lest': 'noeast',
  'Viavant': 'noeast',
  'Lake Catherine': 'noeast_deep',
  'Uptown': 'dry_ridge',
  'Garden District': 'dry_ridge',
  'Lower Garden District': 'dry_ridge',
  'Irish Channel': 'dry_ridge',
  'East Riverside': 'dry_ridge',
  'West Riverside': 'dry_ridge',
  'Audubon': 'dry_ridge',
  'Black Pearl': 'dry_ridge',
  'East Carrollton': 'dry_ridge',
  'Leonidas': 'dry_ridge',
  'Freret': 'dry_ridge',
  'Milan': 'dry_ridge',
  'Touro': 'dry_ridge',
  'Algiers Point': 'westbank',
  'Behrman': 'westbank',
  'Fischer Dev': 'westbank',
  'McDonogh': 'westbank',
  'Mcdonogh': 'westbank',
  'Old Aurora': 'westbank',
  'New Aurora - English Turn': 'westbank',
  'Tall Timbers - Brechtel': 'westbank',
  'Whitney': 'westbank',
  'U.S. Naval Base': 'westbank'
};

/* Extra St. Bernard polygons (not in Orleans hoods file) */
const EXTRA_ZONES = [
  { id: 'arabi', nm: 'Arabi', elev: -1, pop: 3500, w: 0, entry: 'mrgo',
    label: [-89.980, 29.962],
    ring: [[-89.995,29.978],[-89.955,29.975],[-89.950,29.958],[-89.970,29.952],[-89.995,29.955],[-89.995,29.978]],
    kf: [[5,0],[7,3],[9,6],[12,8],[36,10],[84,9]],
    dos: 'First St. Bernard streets hit when MR-GO levees failed before dawn.' },
  { id: 'chalmette', nm: 'Chalmette / St. Bernard', elev: -1, pop: 5000, w: 0, entry: 'mrgo',
    label: [-89.950, 29.945],
    ring: [[-89.955,29.975],[-89.905,29.965],[-89.895,29.940],[-89.925,29.928],[-89.970,29.952],[-89.950,29.958],[-89.955,29.975]],
    kf: [[5.2,0],[7.5,3.5],[10,7],[14,9],[36,10],[84,9]],
    dos: 'Surge funneled up MR-GO. Water to the courthouse’s second story; 34 drowned at St. Rita’s.' }
];

/* ZONES is built at runtime from GeoJSON + profiles for the side panel */
let ZONES = [];

function profileForName(name) {
  const id = HOOD_PROFILE[name] || 'dry_ridge';
  const p = PROFILES[id];
  return { profileId: id, ...p };
}

function buildZonesFromGeoJSON(fc) {
  const zones = [];
  fc.features.forEach((f, i) => {
    const nm = f.properties.name;
    const p = profileForName(nm);
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    const walk = c => {
      if (typeof c[0] === 'number') {
        if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0];
        if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1];
      } else c.forEach(walk);
    };
    walk(f.geometry.coordinates);
    zones.push({
      id: 'n' + i,
      nm,
      elev: p.elev,
      pop: p.pop,
      w: p.w,
      entry: p.entry,
      kf: p.kf,
      dos: p.dos,
      profileId: p.profileId,
      label: [(minX + maxX) / 2, (minY + maxY) / 2],
      feature: f
    });
  });
  EXTRA_ZONES.forEach(z => zones.push({ ...z, feature: null }));

  // Many hoods share a profile — normalize so Orleans % ≈ documented anchors
  // and stranded population peaks near the ~100k who remained.
  const flooded = zones.filter(z => z.w > 0);
  const wSum = flooded.reduce((s, z) => s + z.w, 0) || 1;
  flooded.forEach(z => { z.w = z.w / wSum; });
  const popSum = zones.reduce((s, z) => s + (z.pop || 0), 0) || 1;
  const popScale = 95000 / popSum;
  zones.forEach(z => { z.pop = Math.round((z.pop || 0) * popScale); });

  ZONES = zones;
  return zones;
}

const PUMPS = [
  { id: 'ps6', nm: 'DPS 6 — 17th St Canal', cap: '9,200 cfs', lon: -90.1215, lat: 29.980,
    st: [[-20,'ONLINE'],[0,'STRAINED'],[6.4,'NOPOWER'],[12,'ABANDONED']],
    dos: 'Most powerful pump station in the world in 2005. Discharged into the canal whose wall failed 5 ft below its crown.' },
  { id: 'ps7', nm: 'DPS 7 — Orleans Ave Canal', cap: '2,200 cfs', lon: -90.101, lat: 29.982,
    st: [[-20,'ONLINE'],[0,'STRAINED'],[6.4,'NOPOWER'],[14,'ABANDONED']],
    dos: 'Feeds the one outfall canal that held — saved by an unintended legacy low section near the lake.' },
  { id: 'ps3', nm: 'DPS 3 — London Ave Canal', cap: '5,200 cfs', lon: -90.076, lat: 29.984,
    st: [[-20,'ONLINE'],[0,'STRAINED'],[6.4,'NOPOWER'],[10,'FLOODED']],
    dos: 'Discharged into the canal that failed on both banks over the buried Pine Island beach sands.' },
  { id: 'ps1', nm: 'DPS 1 — Broadmoor', cap: '—', lon: -90.105, lat: 29.950,
    st: [[-20,'ONLINE'],[0,'STRAINED'],[6.4,'NOPOWER'],[20,'FLOODED']],
    dos: 'Deep-bowl interior station. Lost power, then its dry floor, as the bowl filled Aug 30–31.' },
  { id: 'ps19', nm: 'DPS 19 — Florida Av / IHNC', cap: '—', lon: -90.030, lat: 29.985,
    st: [[-20,'ONLINE'],[0,'STRAINED'],[5.5,'FLOODED']],
    dos: 'Sat beside the Industrial Canal as its east wall came apart.' },
  { id: 'ps5', nm: 'DPS 5 — Lower Ninth Ward', cap: '—', lon: -90.012, lat: 29.975,
    st: [[-20,'ONLINE'],[0,'STRAINED'],[5.2,'FLOODED']],
    dos: 'Overrun almost immediately by the IHNC breaches.' },
  { id: 'noe', nm: 'DPS 10·14·15·16 — N.O. East', cap: '—', lon: -89.970, lat: 30.005,
    st: [[-20,'ONLINE'],[0,'STRAINED'],[6.7,'NOPOWER'],[12,'FLOODED']],
    dos: 'Lost power and basements as GIWW and lakefront water converged.' },
  { id: 'jeffp', nm: 'Duncan & Bonnabel — Jefferson', cap: '—', lon: -90.155, lat: 30.005,
    st: [[-20,'ONLINE'],[-6,'UNMANNED'],[40,'ONLINE']],
    dos: 'Operators evacuated before landfall. Stations intact but idle — parish flooded 1–2 ft on rainfall alone.' }
];

const BREACH = [
  { id: 'mrgo', lon: -89.940, lat: 29.955, t: 4.5, nm: 'MR-GO levees (~20 reaches)', sub: 'overtopped & eroded, pre-dawn', source: 'mrgo',
    dos: 'Surge riding the MR-GO/GIWW funnel reached ~15–18 ft. Waves ate earthen levees at ~20 locations before dawn.' },
  { id: 'ihncN', lon: -90.027, lat: 29.980, t: 5.0, nm: 'IHNC East — north breach', sub: '~05:00 · floodwall monolith', source: 'ihnc',
    dos: '~05:00: east Industrial Canal floodwall failed. First water into the Lower Ninth — before landfall.' },
  { id: 'noeL', lon: -89.960, lat: 30.018, t: 6.2, nm: 'N.O. East lakefront', sub: 'overtopping, surge peak', source: 'noeL',
    dos: 'Lakefront reaches overtopped as Pontchartrain surge peaked ~10–12 ft.' },
  { id: 'b17', lon: -90.1195, lat: 30.0065, t: 6.5, nm: '17th St Canal — east I-wall', sub: '~06:30 · Bellaire Dr', source: 'b17',
    dos: 'Signature failure. Water ~5 ft BELOW wall crown when soft-clay foundation sheared. Sheet piles 17 ft; soils needed 31–46 ft.' },
  { id: 'lonS', lon: -90.072, lat: 29.992, t: 6.6, nm: 'London Ave — south breach (east)', sub: '06:00–07:00 · Mirabeau', source: 'lonS',
    dos: 'Failed ~4 ft below design stage. Seepage through Pine Island beach sand; sand into Filmore under 10+ ft.' },
  { id: 'giww', lon: -89.980, lat: 29.980, t: 6.7, nm: 'GIWW levees — N.O. East south', sub: '~06:30 · overtopped & breached', source: 'giww',
    dos: 'GIWW levees along N.O. East’s southern edge overtopped and breaching by ~06:30.' },
  { id: 'ihncS', lon: -90.025, lat: 29.968, t: 7.75, nm: 'IHNC East — south breach + barge', sub: '~07:45 · the big one', source: 'ihnc',
    dos: 'Larger second failure ~07:45. Barge ING 4727 came through. Whole Lower Ninth under 10–15 ft within the hour.' },
  { id: 'lonN', lon: -90.075, lat: 30.010, t: 7.9, nm: 'London Ave — north breach (west)', sub: '07:00–08:00 · Robert E. Lee', source: 'lonN',
    dos: '~410 ft of the west I-wall failed at canal stage ~El 7–8. Both banks, both below design load.' }
];

const EVENTS = [
  { t: -17, sev: 0, h: 'Katrina reaches Category 5', p: '175 mph, 902 mb over the open Gulf — among the strongest Atlantic hurricanes on record.' },
  { t: -13, sev: 0, h: 'First-ever mandatory evacuation', p: 'Nagin orders the city out ~11:00 Sun; ~1.2M leave the metro. ~100,000 remain.' },
  { t: -8, sev: 0, h: 'Superdome opens as refuge of last resort', p: '~10–12,000 shelter inside by nightfall with ~48 hrs of food and water.' },
  { t: -2, sev: 0, h: 'Outer bands arrive · pumps spin up', p: 'Rain begins over the bowl. S&WB stations pumping. Jefferson has already evacuated its pump operators.' },
  { t: 3, sev: 1, h: 'The funnel loads up', p: 'Surge stacks into the GIWW/MR-GO confluence. Rain bands outrunning a system built for ½ in/hr.' },
  { t: 4.5, sev: 1, h: 'MR-GO levees fail (~20 reaches)', p: 'Waves erode the earthen levees before dawn. St. Bernard’s buffer is gone.' },
  { t: 5.0, sev: 1, h: 'IHNC east wall breaches — Lower 9th flooding', p: '~05:00, before landfall. Water in the streets of the Lower Ninth while the eye is still offshore.' },
  { t: 6.17, sev: 1, h: 'LANDFALL — Buras, LA', p: '06:10, Category 3, 125 mph. Eye passes just east of the city.' },
  { t: 6.4, sev: 1, h: 'Citywide power failure', p: '~06:30 most of New Orleans goes dark. Pumps needing Entergy feeds stop.' },
  { t: 6.5, sev: 1, h: '17th St Canal wall fails — water 5 ft below crown', p: 'IPET ~06:30. Foundation shear, not overtopping. Lakeview takes lake water through a gap that scours to 450 ft.' },
  { t: 6.6, sev: 1, h: 'London Ave south breach', p: 'East bank fails ~4 ft below design stage; sand and water into Filmore/Mirabeau.' },
  { t: 6.7, sev: 1, h: 'GIWW levees overtopped — N.O. East flooding', p: 'South flank of New Orleans East breaches by ~06:30.' },
  { t: 7.75, sev: 1, h: 'Second, larger IHNC breach + barge', p: '~07:45. ING 4727 rides through. Whole Lower Ninth under 10–15 ft within the hour.' },
  { t: 7.9, sev: 1, h: 'London Ave north breach — both banks gone', p: '~410 ft of the west I-wall fails. Four I-wall failures, all below design load.' },
  { t: 8.23, sev: 1, h: 'NWS flash-flood warning cites levee breach', p: '08:14 bulletin names the Industrial Canal failure.' },
  { t: 9, sev: 1, h: 'Rooftops', p: 'Lower 9th and St. Bernard residents chop through attics; 34 drown at St. Rita’s.' },
  { t: 12, sev: 1, h: 'The bowl is filling from five directions', p: 'Roughly 20% of the city underwater by early afternoon. Coast Guard begins hoists.' },
  { t: 16, sev: 1, h: 'Pump stations flooded, crews withdrawn', p: 'Stations sit at inland canal ends — inside the basin. Operators evacuate as water reaches switchgear.' },
  { t: 22, sev: 1, h: '“Significant” loss of life reported', p: '23:00: Nagin confirms bodies in the water. Water still flowing in through the breaches.' },
  { t: 30, sev: 1, h: 'Aug 30: still rising', p: 'Lake water pours through 17th St and London Ave gaps. CBD streets flood 1–3 ft.' },
  { t: 36, sev: 1, h: '~80% of the city underwater', p: 'Superdome swells to 15–20,000; Convention Center begins filling on its own.' },
  { t: 55, sev: 0, h: 'Sandbag drops at the 17th St gap', p: 'Helicopters drop 3,000-lb bags Aug 31. Blanco orders everyone remaining out.' },
  { t: 60, sev: 0, h: 'Aug 31: depths peak', p: '16–20 ft in pockets of N.O. East; 10–15 ft Lower 9th; ~10 ft Lakeview.' },
  { t: 84, sev: 0, h: 'Sep 1: equalization — the flood “ends” by physics', p: 'Inflow stops when city water meets the lake at ≈ +3 ft.' },
  { t: 89.5, sev: 0, h: 'Aftermath', p: 'Pumps restart Sep 5. Rita refloods ~40% Sep 24. Dry Oct 11 — 43 days. ASCE: two-thirds avoidable.' }
];

const LAKE = [[-20,1],[-6,2],[0,3],[3,5],[5,7.5],[7,9.5],[8.5,11],[10,10],[12,8],[16,6],[20,4.5],[24,4],[36,3.4],[48,3.2],[60,3],[90,3]];
const IHNC = [[-20,1],[-4,2.5],[0,4],[3,8],[5,12],[7,14],[8.5,14],[10,12],[12,9],[16,6.5],[24,4.5],[36,3.6],[48,3.2],[90,3]];
const LOAD = [[-20,.1],[-4,.4],[0,1.2],[3,3],[4.5,6],[6.5,20],[8,40],[12,35],[24,20],[48,8],[84,1.5],[90,1]];
const RESC = [[0,0],[10,0],[14,1500],[24,8000],[36,25000],[60,45000],[90,60000]];

const ENTRY_TIME = { mrgo: 4.5, ihnc: 5.0, noeL: 6.2, b17: 6.5, lonS: 6.6, giww: 6.7, lonN: 7.9, gravity: 8.5, jeff: 3, none: 1e9 };

const CANALS = [
  { name: '17th St Canal', latlngs: [[30.027,-90.1215],[29.978,-90.1215]] },
  { name: 'Orleans Ave Canal', latlngs: [[30.025,-90.101],[29.982,-90.101]] },
  { name: 'London Ave Canal', latlngs: [[30.023,-90.076],[29.984,-90.076]] },
  { name: 'IHNC / Industrial Canal', latlngs: [[30.022,-90.027],[29.945,-90.027]] },
  { name: 'GIWW', latlngs: [[29.980,-90.027],[29.980,-89.900]] },
  { name: 'MR-GO', latlngs: [[29.980,-90.010],[29.940,-89.880]] }
];

const LEVEES = [
  { name: 'Lakefront', latlngs: [[30.027,-90.185],[30.027,-90.125],[30.025,-90.095],[30.022,-90.040],[30.018,-89.920]] },
  { name: '17th St walls', latlngs: [[30.027,-90.1228],[29.978,-90.1228]] },
  { name: 'London walls', latlngs: [[30.023,-90.0772],[29.984,-90.0772]] },
  { name: 'IHNC walls', latlngs: [[30.022,-90.0285],[29.945,-90.0285]] }
];
