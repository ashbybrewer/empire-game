# Flood Fight Lost — New Orleans Hurricane Protection System, Aug 28 – Sep 1, 2005

Interactive forensic engineering brief reconstructing the failure of the Lake Pontchartrain & Vicinity Hurricane Protection Project during Hurricane Katrina.

## Run

Open `index.html` in a modern browser (no build step). For local modules / CORS-free loading:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Features

- Schematic but topology-faithful base map of the Orleans bowl, outfall canals, IHNC, MR-GO, and St. Bernard
- Dense procedural street grid and building footprints per neighborhood
- Clickable neighborhoods, breaches, and pump stations (dossier panel)
- Hover any map cell for ground elevation and water depth
- Breach-driven flood fill: water enters at failure points and spreads street-first, then block-by-block
- Master hydrograph scrubber, pump-station state, and event log

## Sources

Breach times, capacities, stages, and flood extents are drawn from IPET / ILIT / ASCE findings and related public records. Continuous depth curves between documented checkpoints are interpolations for legibility, not false precision.
