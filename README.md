# Flood Fight Lost — New Orleans Hurricane Protection System, Aug 28 – Sep 1, 2005

Interactive forensic engineering brief reconstructing the failure of the Lake Pontchartrain & Vicinity Hurricane Protection Project during Hurricane Katrina.

## Run

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` (needs network for Leaflet + basemap tiles).

## Features

- **Satellite** (Esri World Imagery + road overlay) or **Street map** (CARTO Voyager / OSM)
- Clickable neighborhoods, breaches, and pump stations
- Hover any neighborhood for ground elevation and water depth
- Timeline scrubber / play with hydrograph (page scroll stays put while playing)
- Pump-station state, basin depths, event log

## Sources

Breach times, capacities, stages, and flood extents from IPET / ILIT / ASCE and related public records. Neighborhood outlines are approximate engineering polygons aligned to canals, lake, river ridge, and IHNC — topology-faithful for the flood story, not a cadastral survey.
