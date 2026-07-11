/* Forensic brief data — times are hours from Mon Aug 29 2005 00:00 CDT */
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

/* Neighborhoods — finer grain than the original basins; pts are SVG map coords */
const ZONES = [
  { id: 'jeff', nm: 'Metairie / Jefferson', elev: -5, pop: 0, w: 0, lx: 70, ly: 330,
    pts: '0,150 166,150 166,472 200,530 245,566 170,612 60,665 0,720',
    kf: [[3, 0], [6, 1.5], [10, 2], [24, 1.5], [48, 1], [84, 0.5]],
    entry: 'jeff', streetAngle: 0,
    dos: 'Flooded 1–2 ft by rainfall alone: under the parish “doomsday plan” pump operators had been evacuated, so the Duncan & Bonnabel stations sat unmanned and non-functional through the storm. No major levee failure here — a controlled experiment in what rain does when nobody pumps.' },

  { id: 'westend', nm: 'West End / Lakewood', elev: -4, pop: 2000, w: 0.03, lx: 210, ly: 200,
    pts: '166,150 240,150 240,280 185,280 185,150',
    kf: [[6.5, 0], [7, 1.2], [12, 3.5], [18, 5.5], [30, 7.5], [48, 9], [84, 9]],
    entry: 'b17', streetAngle: 0,
    dos: 'West End yacht harbor and Lakewood took early water from the 17th St Canal breach as flow spilled south and east from Bellaire Drive. Ground roughly −3 to −5 ft.' },

  { id: 'lakeview', nm: 'Lakeview', elev: -7, pop: 5000, w: 0.08, lx: 260, ly: 255,
    pts: '240,150 321,152 321,380 185,380 185,280 240,280',
    kf: [[6.5, 0], [7, 1.5], [12, 4], [18, 6], [30, 8.5], [48, 10], [84, 10]],
    entry: 'b17', streetAngle: 0,
    dos: 'Ground −4 to −7 ft. Flooded by the 17th St Canal breach at Bellaire Dr from ~06:30 Aug 29. Water kept flowing until the basin equalized with the lake (~+3 ft) on Sep 1 — roughly 10 ft of standing water where the ground sits at −7.' },

  { id: 'citypark', nm: 'City Park / Filmore', elev: -3, pop: 3000, w: 0.04, lx: 420, ly: 230,
    pts: '321,152 430,154 430,300 321,300',
    kf: [[6.5, 0], [7.2, 1], [12, 3], [18, 5.5], [30, 7.5], [48, 8.5], [84, 8.5]],
    entry: 'lonN', streetAngle: 0,
    dos: 'City Park’s lagoons and the Filmore streets took London Avenue water from the north breach. Open parkland flooded first; the oak allées sat in several feet by Aug 30.' },

  { id: 'gentilly', nm: 'Gentilly', elev: -4, pop: 6000, w: 0.07, lx: 520, ly: 240,
    pts: '430,154 651,164 651,300 430,300',
    kf: [[6.5, 0], [7, 1.5], [12, 3.5], [18, 6], [30, 8], [48, 9], [84, 9]],
    entry: 'lonS', streetAngle: 0,
    dos: 'Ground −2 to −6 ft on the lake side of the Gentilly Ridge. Hit from both London Ave breaches: the east-side (south) breach ~06:00–07:00 sent 10+ ft into Filmore/Mirabeau; the west-side (north) breach followed 07:00–08:00.' },

  { id: 'mirabeau', nm: 'Mirabeau / St. Anthony', elev: -5, pop: 4000, w: 0.05, lx: 540, ly: 340,
    pts: '430,300 651,300 651,378 430,378',
    kf: [[6.5, 0], [7, 2], [12, 4.5], [18, 7], [30, 8.5], [48, 9.5], [84, 9.5]],
    entry: 'lonS', streetAngle: 0,
    dos: 'Direct path of the London Avenue south breach. Sand boiled out of the Pine Island beach trend; houses took 8–10+ ft. Among the first residential streets to go under from foundation failure rather than overtopping.' },

  { id: 'midcity', nm: 'Mid-City', elev: -4, pop: 8000, w: 0.08, lx: 360, ly: 430,
    pts: '185,380 430,378 430,518 300,518 245,500 185,472',
    kf: [[9, 0], [14, 1], [20, 2.5], [30, 4.5], [42, 6.5], [54, 8], [84, 8]],
    entry: 'gravity', streetAngle: 0.15,
    dos: 'No adjacent breach — this water arrived by gravity, flowing south from Lakeview and Gentilly over Aug 29–31. Slow fill, complete inundation: proof the city drowned as one connected vessel.' },

  { id: 'broadmoor', nm: 'Broadmoor / Fontainebleau', elev: -5, pop: 6000, w: 0.06, lx: 320, ly: 520,
    pts: '185,472 300,518 380,560 300,560 245,566 200,530',
    kf: [[10, 0], [16, 1.5], [24, 3.5], [36, 6], [48, 8], [84, 8]],
    entry: 'gravity', streetAngle: 0.2,
    dos: 'The floor of the bowl. Water pooled to ~8 ft. Interior pump stations lost power, then their dry floors, as the basin filled around them Aug 30–31.' },

  { id: 'treme', nm: 'Tremé / 7th Ward', elev: -2, pop: 5000, w: 0.05, lx: 480, ly: 470,
    pts: '430,378 651,378 651,518 430,518',
    kf: [[10, 0], [16, 1.2], [24, 3], [36, 5.5], [48, 7], [84, 7]],
    entry: 'gravity', streetAngle: 0.1,
    dos: 'Historic neighborhoods between the Gentilly Ridge and the CBD. Flooded from the north as Mid-City and Gentilly water sought the lowest path toward the river ridge.' },

  { id: 'cbd', nm: 'CBD / Warehouse / Superdome', elev: 1, pop: 12000, w: 0.06, lx: 560, ly: 545,
    pts: '430,518 651,518 668,600 640,616 566,590 505,560 470,560 430,540',
    kf: [[12, 0], [30, 1], [48, 2], [60, 3], [84, 3]],
    entry: 'gravity', streetAngle: 0.35,
    dos: 'Near sea level between the river ridge and the bowl. Stayed dry through landfall, then flooded 1–3 ft on Aug 30–31 as the bowl filled north of it. ~3 ft stood outside the Superdome.' },

  { id: 'fq', nm: 'French Quarter', elev: 8, pop: 5000, w: 0.03, lx: 560, ly: 620,
    pts: '470,560 566,586 620,610 600,640 520,620 470,600',
    kf: [[0, 0]],
    entry: 'none', streetAngle: 0.4,
    dos: 'The original city, built on the Mississippi’s natural levee — up to ~10–17 ft above sea level near the river. Wind damage, no floodwater. The 1718 town site survived what the 20th-century expansion into the drained backswamp could not.' },

  { id: 'marigny', nm: 'Marigny / Bywater', elev: 4, pop: 4000, w: 0.03, lx: 640, ly: 600,
    pts: '620,610 668,600 712,640 690,660 640,646 600,640',
    kf: [[0, 0], [36, 0.3], [60, 0.8], [84, 0.5]],
    entry: 'none', streetAngle: 0.35,
    dos: 'River-ridge and natural-levee ground east of the Quarter. Mostly dry; some ponding on the back edges where grade falls toward the Industrial Canal.' },

  { id: 'uptown', nm: 'Uptown / Garden District', elev: 5, pop: 8000, w: 0.05, lx: 245, ly: 585,
    pts: '185,472 200,530 245,566 258,616 210,636 166,612 166,472',
    kf: [[0, 0]],
    entry: 'none', streetAngle: 0.45,
    dos: 'River-ridge high ground: largely dry (its back-of-town edge grades into flooded Broadmoor). The S&WB Carrollton plant here generated the antique 25 Hz power the big pumps needed.' },

  { id: 'carrollton', nm: 'Carrollton / Riverbend', elev: 3, pop: 4000, w: 0.03, lx: 120, ly: 560,
    pts: '60,520 166,472 166,612 100,650 40,620',
    kf: [[8, 0], [20, 0.5], [40, 1], [84, 0.4]],
    entry: 'jeff', streetAngle: 0.5,
    dos: 'Transition from Jefferson Parish into Orleans along the riverbend. Mostly high enough; some back-of-town streets took shallow water from the idle Jefferson pumps and bowl spill.' },

  { id: 'lower9', nm: 'Lower Ninth Ward', elev: -2, pop: 5000, w: 0.04, lx: 760, ly: 500,
    pts: '674,398 828,400 836,560 800,600 712,620 690,580 674,540',
    kf: [[4.8, 0], [5.2, 2], [6, 4], [7.75, 6], [8.6, 10], [12, 12], [36, 12], [84, 11]],
    entry: 'ihnc', streetAngle: 0.05,
    dos: 'Two IHNC east-wall failures: ~05:00 (north) and the far larger ~07:45 breach (south) that a loose barge, ING 4727, rode through. The entire ward under 10–15 ft within hours — houses off foundations, residents chopping through roofs.' },

  { id: 'holycross', nm: 'Holy Cross', elev: 1, pop: 1500, w: 0.015, lx: 740, ly: 640,
    pts: '690,580 712,620 800,650 760,680 690,640',
    kf: [[5.5, 0], [7, 2], [9, 5], [12, 8], [36, 9], [84, 8]],
    entry: 'ihnc', streetAngle: 0.3,
    dos: 'Southern tip of the Lower 9th along the river. Slightly higher ground than the ward’s interior, but the IHNC breaches still put several feet into the streets and shotgun houses.' },

  { id: 'arabi', nm: 'Arabi', elev: -1, pop: 3500, w: 0, lx: 900, ly: 560,
    pts: '836,430 1000,520 980,600 900,620 838,560',
    kf: [[5, 0], [7, 3], [9, 6], [12, 8], [36, 10], [84, 9]],
    entry: 'mrgo', streetAngle: 0.2,
    dos: 'First St. Bernard streets hit when MR-GO levees failed before dawn. Surge ran inland house-to-house; many structures never recovered.' },

  { id: 'chalmette', nm: 'Chalmette / St. Bernard', elev: -1, pop: 5000, w: 0, lx: 1020, ly: 620,
    pts: '1000,520 1150,585 1120,622 1000,650 900,662 900,620 980,600',
    kf: [[5.2, 0], [7.5, 3.5], [10, 7], [14, 9], [36, 10], [84, 9]],
    entry: 'mrgo', streetAngle: 0.15,
    dos: 'Surge funneled up MR-GO overwhelmed ~20 reaches of levee. Water reached the courthouse’s second story; at St. Rita’s nursing home 34 residents drowned. Virtually every structure in the parish flooded.' },

  { id: 'noeast_n', nm: 'N.O. East — Lakefront', elev: -7, pop: 8000, w: 0.12, lx: 880, ly: 250,
    pts: '674,172 900,206 1150,208 1150,300 674,300',
    kf: [[5.5, 0], [6.7, 1.5], [12, 5], [24, 8], [48, 10], [84, 10]],
    entry: 'noeL', streetAngle: 0,
    dos: 'Ground −5 to −8 ft. Lakefront reaches overtopped as the Pontchartrain surge peaked. Remote sensing later put 16–20 ft of water in pockets near the lake — the deepest standing water in the city.' },

  { id: 'noeast_s', nm: 'N.O. East — South / Village', elev: -5, pop: 8000, w: 0.12, lx: 900, ly: 340,
    pts: '674,300 1150,300 1150,378 674,378',
    kf: [[5.5, 0], [6.7, 2], [12, 4.5], [24, 7], [48, 9], [84, 9]],
    entry: 'giww', streetAngle: 0,
    dos: 'GIWW levees on the south flank overtopped and breached by ~06:30. Water met lakefront flood from the north; the basin became a continuous lake within the day.' },

  { id: 'algiers', nm: 'Algiers (West Bank)', elev: 3, pop: 0, w: 0, lx: 480, ly: 740,
    pts: '280,700 520,680 620,700 580,780 300,790',
    kf: [[0, 0]],
    entry: 'none', streetAngle: 0.25,
    dos: 'West Bank of the Mississippi. Outside the east-bank bowl; escaped the catastrophic flooding that destroyed the east bank. Wind and power loss, not inundation, were the story here.' }
];

const PUMPS = [
  { id: 'ps6', nm: 'DPS 6 — 17th St Canal', cap: '9,200 cfs', x: 184, y: 462,
    st: [[-20, 'ONLINE'], [0, 'STRAINED'], [6.4, 'NOPOWER'], [12, 'ABANDONED']],
    dos: 'The most powerful pump station in the world in 2005. With the 17th St Canal it moved 9,200 cfs — more than the other two outfall canals combined. Its discharge raised the water level in a canal whose wall failed 5 ft below its crown.' },
  { id: 'ps7', nm: 'DPS 7 — Orleans Ave Canal', cap: '2,200 cfs', x: 329, y: 420,
    st: [[-20, 'ONLINE'], [0, 'STRAINED'], [6.4, 'NOPOWER'], [14, 'ABANDONED']],
    dos: 'Feeds the one outfall canal that held — saved by an unintended 100-ft “spillway,” a legacy low section of wall near the lake that relieved pressure before the I-walls could fail.' },
  { id: 'ps3', nm: 'DPS 3 — London Ave Canal', cap: '5,200 cfs', x: 469, y: 406,
    st: [[-20, 'ONLINE'], [0, 'STRAINED'], [6.4, 'NOPOWER'], [10, 'FLOODED']],
    dos: 'Discharged into the canal that failed on both banks, ~4 ft below design stage, over the buried Pine Island beach sands. Station and crews were inside the flooded basin within hours.' },
  { id: 'ps1', nm: 'DPS 1 — Broadmoor', cap: '—', x: 300, y: 540,
    st: [[-20, 'ONLINE'], [0, 'STRAINED'], [6.4, 'NOPOWER'], [20, 'FLOODED']],
    dos: 'Deep-bowl interior station. Kept the neighborhood’s rain down early, then lost power and eventually its dry floor as the bowl filled around it Aug 30–31.' },
  { id: 'ps19', nm: 'DPS 19 — Florida Av / IHNC', cap: '—', x: 648, y: 352,
    st: [[-20, 'ONLINE'], [0, 'STRAINED'], [5.5, 'FLOODED']],
    dos: 'Sat beside the Industrial Canal as its east wall came apart; among the first stations drowned.' },
  { id: 'ps5', nm: 'DPS 5 — Lower Ninth Ward', cap: '—', x: 722, y: 470,
    st: [[-20, 'ONLINE'], [0, 'STRAINED'], [5.2, 'FLOODED']],
    dos: 'Overrun almost immediately by the IHNC breaches — under 10+ ft of water by mid-morning Aug 29.' },
  { id: 'noe', nm: 'DPS 10·14·15·16 — N.O. East', cap: '—', x: 905, y: 262,
    st: [[-20, 'ONLINE'], [0, 'STRAINED'], [6.7, 'NOPOWER'], [12, 'FLOODED']],
    dos: 'New Orleans East’s stations lost power and then their basements as GIWW and lakefront water converged; the basin they served took the deepest water in the city.' },
  { id: 'jeffp', nm: 'Duncan & Bonnabel — Jefferson', cap: '—', x: 95, y: 210,
    st: [[-20, 'ONLINE'], [-6, 'UNMANNED'], [40, 'ONLINE']],
    dos: 'Jefferson Parish’s “doomsday plan” evacuated pump operators before landfall. The stations rode out the storm intact but unmanned and idle — the parish flooded 1–2 ft on rainfall a working system was built to handle.' }
];

const BREACH = [
  { id: 'mrgo', x: 1040, y: 512, t: 4.5, nm: 'MR-GO levees (~20 reaches)', sub: 'overtopped & eroded, pre-dawn', source: 'mrgo',
    dos: 'Surge riding the MR-GO/GIWW “funnel” reached ~15–18 ft against earthen levees built partly of dredged shell and sand. Waves ate them from the crown down at ~20 locations before dawn.' },
  { id: 'ihncN', x: 671, y: 432, t: 5.0, nm: 'IHNC East — north breach', sub: '~05:00 · floodwall monolith', source: 'ihnc',
    dos: '~05:00: a floodwall section on the Industrial Canal’s east side failed as the funnel surge (peaking ~14 ft in the canal) overtopped and scoured it. First water into the Lower Ninth Ward — before landfall.' },
  { id: 'noeL', x: 900, y: 206, t: 6.2, nm: 'N.O. East lakefront', sub: 'overtopping, surge peak', source: 'noeL',
    dos: 'Lakefront reaches overtopped as the Pontchartrain surge peaked ~10–12 ft; the only true lakefront breach was here in New Orleans East — likely pure overtopping, per IPET.' },
  { id: 'b17', x: 183, y: 296, t: 6.5, nm: '17th St Canal — east I-wall', sub: '~06:30 (early rpts 09:45) · Bellaire Dr', source: 'b17',
    dos: 'The signature failure. Water in the canal stood ~5 ft BELOW the wall crown — half design load — when the soft-clay foundation sheared and the I-wall translated sideways. Sheet piles: 17 ft deep; the soils needed 31–46 ft.' },
  { id: 'lonS', x: 476, y: 332, t: 6.6, nm: 'London Ave — south breach (east)', sub: '06:00–07:00 · Mirabeau/Warrington', source: 'lonS',
    dos: 'Failed ~4 ft below design stage. Seepage through the buried Pine Island beach sand blew out the landside; a 20-ft monolith went first, sand fanned into Filmore under 10+ ft of water.' },
  { id: 'giww', x: 860, y: 388, t: 6.7, nm: 'GIWW levees — N.O. East south flank', sub: '~06:30 · overtopped & breached', source: 'giww',
    dos: 'By ~06:30 the Gulf Intracoastal Waterway levees along New Orleans East’s southern edge were overtopped and breaching, per IPET largely as designed-but-overwhelmed sections.' },
  { id: 'ihncS', x: 672, y: 478, t: 7.75, nm: 'IHNC East — south breach + barge', sub: '~07:45 · the big one', source: 'ihnc',
    dos: 'A far larger second failure ~07:45. The barge ING 4727 came through the gap. Combined with the north breach it put the entire Lower Ninth under 10–15 ft within the hour.' },
  { id: 'lonN', x: 460, y: 238, t: 7.9, nm: 'London Ave — north breach (west)', sub: '07:00–08:00 · Robert E. Lee/Pratt', source: 'lonN',
    dos: 'The opposite bank went next: a ~410-ft failure as canal stage hit only ~El 7–8 NAVD88. Both banks of one canal, both below design load — a design verdict, not an act of God.' }
];

const EVENTS = [
  { t: -17, sev: 0, h: 'Katrina reaches Category 5', p: '175 mph, 902 mb over the open Gulf — among the strongest Atlantic hurricanes on record, aimed at the delta.' },
  { t: -13, sev: 0, h: 'First-ever mandatory evacuation', p: 'Nagin orders the city out ~11:00 Sun; ~1.2M leave the metro. ~100,000 — many without cars — remain. NWS issues its “devastating damage” bulletin.' },
  { t: -8, sev: 0, h: 'Superdome opens as refuge of last resort', p: '~10–12,000 shelter inside by nightfall with ~48 hrs of food and water.' },
  { t: -2, sev: 0, h: 'Outer bands arrive · pumps spin up', p: 'Rain begins over the bowl. S&WB stations staffed and pumping into the outfall canals. Jefferson Parish has already evacuated its pump operators.' },
  { t: 3, sev: 1, h: 'The funnel loads up', p: 'Surge driven across Lake Borgne stacks into the GIWW/MR-GO confluence. Rain bands of 1–3 in/hr begin outrunning a system built for ½ in/hr sustained.' },
  { t: 4.5, sev: 1, h: 'MR-GO levees fail (~20 reaches)', p: 'Waves erode the earthen levees before dawn. St. Bernard’s buffer is gone; ~15–18 ft of surge works inland.' },
  { t: 5.0, sev: 1, h: 'IHNC east wall breaches — Lower 9th flooding', p: '~05:00, before landfall. Water is in the streets of the Lower Ninth Ward while the eye is still offshore.' },
  { t: 6.17, sev: 1, h: 'LANDFALL — Buras, LA', p: '06:10, Category 3, 125 mph. The eye passes just east of the city; downtown winds Cat 1 with violent gusts.' },
  { t: 6.4, sev: 1, h: 'Citywide power failure', p: '~06:30 most of New Orleans goes dark; phones die within hours. Pumps needing Entergy feeds stop.' },
  { t: 6.5, sev: 1, h: '17th St Canal wall fails — water 5 ft below crown', p: 'IPET puts it ~06:30 (early press said 09:45). Foundation shear, not overtopping. Lakeview begins taking lake water through a gap that scours to 450 ft.' },
  { t: 6.6, sev: 1, h: 'London Ave south breach', p: 'East bank fails ~4 ft below design stage; sand and water into Filmore/Mirabeau.' },
  { t: 6.7, sev: 1, h: 'GIWW levees overtopped — N.O. East flooding', p: 'The south flank of New Orleans East breaches by ~06:30; lakefront overtops as surge peaks.' },
  { t: 7.75, sev: 1, h: 'Second, larger IHNC breach + barge', p: '~07:45. ING 4727 rides through. The whole Lower Ninth goes under 10–15 ft within the hour.' },
  { t: 7.9, sev: 1, h: 'London Ave north breach — both banks gone', p: '~410 ft of the west I-wall fails at canal stage ~El 7–8. Four I-wall failures now stand, all below design load.' },
  { t: 8.23, sev: 1, h: 'NWS flash-flood warning cites levee breach', p: '08:14 bulletin names the Industrial Canal failure — official confirmation the protection system is open.' },
  { t: 9, sev: 1, h: 'Rooftops', p: 'Lower 9th and St. Bernard residents chop through attics; water at the courthouse’s second story; 34 drown at St. Rita’s nursing home.' },
  { t: 12, sev: 1, h: 'The bowl is filling from five directions', p: 'Roughly 20% of the city underwater by early afternoon; hundreds of distress calls logged by 14:00. Coast Guard begins hoists — 1,000+ saved day one.' },
  { t: 16, sev: 1, h: 'Pump stations flooded, crews withdrawn', p: 'Stations sit at the inland canal ends — inside the basin. As water reaches switchgear, remaining operators evacuate.' },
  { t: 22, sev: 1, h: '“Significant” loss of life reported', p: '23:00: Nagin confirms bodies in the water, mostly in the east. Water is still flowing in through the breaches.' },
  { t: 30, sev: 1, h: 'Aug 30: still rising', p: 'Lake water pours through 17th St and London Ave gaps toward equilibrium. CBD streets flood 1–3 ft; “dodged the bullet” dies as a headline.' },
  { t: 36, sev: 1, h: '~80% of the city underwater', p: 'Superdome swells to 15–20,000 as rescues arrive; the Convention Center — dry, unsupplied — begins filling on its own.' },
  { t: 55, sev: 0, h: 'Sandbag drops at the 17th St gap', p: 'Helicopters begin dropping 3,000-lb bags Aug 31. Engineers estimate weeks, not days, for closure. Blanco orders everyone remaining out of the city.' },
  { t: 60, sev: 0, h: 'Aug 31: depths peak', p: '16–20 ft in pockets of New Orleans East; 10–15 ft Lower 9th; ~10 ft Lakeview; the bowl holds tens of billions of gallons.' },
  { t: 84, sev: 0, h: 'Sep 1: equalization — the flood “ends” by physics', p: 'Inflow stops when the city’s water meets the lake at ≈ +3 ft. Superdome >30,000; Convention Center ~25,000.' },
  { t: 89.5, sev: 0, h: 'Aftermath', p: 'First pumps restart Sep 5. Rita refloods ~40% on Sep 24. The city is dry Oct 11 — 43 days. Toll: ~1,400 dead. ASCE: two-thirds of the flooding was avoidable.' }
];

const LAKE = [[-20, 1], [-6, 2], [0, 3], [3, 5], [5, 7.5], [7, 9.5], [8.5, 11], [10, 10], [12, 8], [16, 6], [20, 4.5], [24, 4], [36, 3.4], [48, 3.2], [60, 3], [90, 3]];
const IHNC = [[-20, 1], [-4, 2.5], [0, 4], [3, 8], [5, 12], [7, 14], [8.5, 14], [10, 12], [12, 9], [16, 6.5], [24, 4.5], [36, 3.6], [48, 3.2], [90, 3]];
const LOAD = [[-20, 0.1], [-4, 0.4], [0, 1.2], [3, 3], [4.5, 6], [6.5, 20], [8, 40], [12, 35], [24, 20], [48, 8], [84, 1.5], [90, 1]];
const RESC = [[0, 0], [10, 0], [14, 1500], [24, 8000], [36, 25000], [60, 45000], [90, 60000]];

/* Named major roads drawn on the map */
const MAJOR_ROADS = [
  { name: 'CANAL ST', pts: [[470, 560], [560, 545], [640, 560]] },
  { name: 'CLAIBORNE', pts: [[200, 500], [400, 490], [600, 500], [720, 520]] },
  { name: 'ST. CHARLES', pts: [[200, 600], [280, 580], [400, 590], [500, 600]] },
  { name: 'ESPLANADE', pts: [[480, 400], [520, 500], [560, 600]] },
  { name: 'Elysian Fields', pts: [[560, 400], [600, 500], [640, 600]] },
  { name: 'ROBERT E. LEE', pts: [[185, 220], [400, 220], [650, 230]] },
  { name: 'I-10', pts: [[0, 480], [200, 470], [450, 460], [700, 450], [950, 470], [1150, 500]] },
  { name: 'I-610', pts: [[185, 340], [400, 335], [650, 340]] },
  { name: 'JUDGE PEREZ', pts: [[850, 480], [1000, 560], [1120, 610]] },
  { name: 'HAYNE BLVD', pts: [[680, 190], [900, 200], [1100, 205]] },
  { name: 'CHEF MENTEUR', pts: [[680, 350], [900, 355], [1100, 360]] },
  { name: 'WEST END BLVD', pts: [[175, 160], [175, 350], [180, 460]] },
  { name: 'ORLEANS AVE', pts: [[329, 160], [329, 400]] },
  { name: 'LONDON AVE', pts: [[470, 160], [470, 400]] }
];
