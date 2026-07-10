import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo'
import type { LineString, Polygon } from 'geojson'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import countriesTopology from 'world-atlas/countries-110m.json'
import landTopology from 'world-atlas/land-110m.json'
import { factions } from '../data'
import { regionGeography } from '../regionGeography'
import type { MapLens, Region } from '../types'

interface WorldMapProps {
  regions: Region[]
  selectedId: string
  lens: MapLens
  tradePartners: string[]
  playerFactionId: string
  tradeOriginId: string
  year: number
  onSelect: (region: Region) => void
}

const MAP_WIDTH = 1100
const MAP_HEIGHT = 580
const sphere = { type: 'Sphere' } as const
const projection = geoNaturalEarth1().fitExtent(
  [[20, 18], [MAP_WIDTH - 20, MAP_HEIGHT - 18]],
  sphere,
)
const makePath = geoPath(projection)
const graticule = geoGraticule10()

const landData = landTopology as unknown as Topology<{ land: GeometryCollection }>
const countriesData = countriesTopology as unknown as Topology<{ countries: GeometryCollection }>
const landFeature = feature(landData, landData.objects.land)
const countryBorders = mesh(
  countriesData,
  countriesData.objects.countries,
  (left, right) => left !== right,
)

const prosperityColor = (value: number) => {
  if (value >= 78) return '#b88b39'
  if (value >= 65) return '#8a8752'
  if (value >= 52) return '#668276'
  return '#66736b'
}

const resistanceColor = (value: number) => {
  if (value >= 90) return '#9f3f32'
  if (value >= 75) return '#ad6638'
  if (value >= 55) return '#a88a43'
  if (value >= 35) return '#6e8561'
  return '#477465'
}

function regionFill(region: Region, lens: MapLens) {
  if (lens === 'trade') return prosperityColor(region.prosperity)
  if (lens === 'resistance') return resistanceColor(region.resistance)
  return factions[region.owner]?.color ?? '#6b756d'
}

function polygonPath(coordinates: [number, number][]) {
  const polygon: Polygon = { type: 'Polygon', coordinates: [coordinates] }
  return makePath(polygon) ?? ''
}

function routePath(from: [number, number], to: [number, number]) {
  const line: LineString = { type: 'LineString', coordinates: [from, to] }
  return makePath(line) ?? ''
}

const staticRoutes: Array<{
  id: string
  from: [number, number]
  to: [number, number]
  tone: 'player' | 'rival' | 'contested'
}> = [
  { id: 'north-atlantic', from: [-4, 51], to: [-74, 40], tone: 'player' },
  { id: 'west-africa', from: [-4, 51], to: [-2, 7], tone: 'rival' },
  { id: 'cape-route', from: [-4, 51], to: [20, -34], tone: 'player' },
  { id: 'india-route', from: [20, -34], to: [87, 22], tone: 'player' },
  { id: 'china-route', from: [87, 22], to: [113, 24], tone: 'contested' },
]

const atlasLabels: Array<{
  text: string
  coordinate: [number, number]
  className: string
}> = [
  { text: 'NORTH AMERICA', coordinate: [-105, 24], className: 'continent' },
  { text: 'SOUTH AMERICA', coordinate: [-60, -32], className: 'continent' },
  { text: 'AFRICA', coordinate: [20, 23], className: 'continent' },
  { text: 'ASIA', coordinate: [92, 8], className: 'continent' },
  { text: 'NORTH ATLANTIC OCEAN', coordinate: [-34, 27], className: 'ocean' },
  { text: 'SOUTH ATLANTIC', coordinate: [-22, -28], className: 'ocean' },
  { text: 'INDIAN OCEAN', coordinate: [70, -27], className: 'ocean' },
  { text: 'NORTH PACIFIC', coordinate: [-157, 17], className: 'ocean' },
  { text: 'SOUTH CHINA SEA', coordinate: [128, 7], className: 'ocean' },
]

export function WorldMap({
  regions,
  selectedId,
  lens,
  tradePartners,
  playerFactionId,
  tradeOriginId,
  year,
  onSelect,
}: WorldMapProps) {
  const origin = regionGeography[tradeOriginId]?.label ?? [-4, 51]

  return (
    <div className="world-map world-map--atlas">
      <svg
        className="world-map__svg"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="group"
        aria-label={`Political atlas of the world in ${year}`}
      >
        <defs>
          <filter id="paperGrain" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency=".76" numOctaves="3" seed="19" result="noise" />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0.33 0 0 0 0 0.26 0 0 0 0 0.16 0 0 0 .12 0"
            />
          </filter>
          <filter id="atlasLandShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2.2" floodColor="#3a2b1b" floodOpacity=".38" />
          </filter>
          <filter id="selectedAtlasGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f3d680" floodOpacity=".9" />
          </filter>
          <pattern id="atlasHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#3d3021" strokeOpacity=".085" strokeWidth=".7" />
          </pattern>
          <pattern id="oceanStipple" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M0 12 Q5 9 10 12 T20 12" fill="none" stroke="#597a79" strokeOpacity=".1" strokeWidth=".6" />
          </pattern>
          <clipPath id="atlasLandClip">
            <path d={makePath(landFeature) ?? ''} />
          </clipPath>
        </defs>

        <path className="atlas-ocean" d={makePath(sphere) ?? ''} />
        <path className="atlas-ocean-lines" d={makePath(sphere) ?? ''} />
        <path className="atlas-graticule" d={makePath(graticule) ?? ''} />

        <g filter="url(#atlasLandShadow)">
          <path className="atlas-land" d={makePath(landFeature) ?? ''} />
        </g>

        <g className={`atlas-regions regions--${lens}`} clipPath="url(#atlasLandClip)">
          {regions.map((region) => {
            const geography = regionGeography[region.id]
            if (!geography) return null
            const isSelected = selectedId === region.id
            return (
              <g key={region.id} className={`region atlas-region ${isSelected ? 'is-selected' : ''}`}>
                <path
                  d={polygonPath(geography.polygon)}
                  fill={regionFill(region, lens)}
                  className="region__shape atlas-region__wash"
                  filter={isSelected ? 'url(#selectedAtlasGlow)' : undefined}
                  onClick={() => onSelect(region)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelect(region)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${region.name}, controlled by ${factions[region.owner]?.name}`}
                />
                <path d={polygonPath(geography.polygon)} fill="url(#atlasHatch)" className="region__texture" />
              </g>
            )
          })}
        </g>

        <g className="trade-routes" aria-hidden="true">
          {staticRoutes.map((route) => (
            <path
              key={route.id}
              d={routePath(route.from, route.to)}
              className={`trade-route trade-route--${route.tone} ${lens === 'trade' ? 'is-prominent' : ''}`}
            />
          ))}
          {tradePartners.map((regionId) => {
            const destination = regionGeography[regionId]
            if (!destination) return null
            return (
              <path
                key={`accord-${regionId}`}
                d={routePath(origin, destination.label)}
                className="trade-route trade-route--accord is-prominent"
              />
            )
          })}
        </g>

        <path className="atlas-borders" d={makePath(countryBorders) ?? ''} />
        <path className="atlas-coastline" d={makePath(landFeature) ?? ''} />

        <g className="atlas-labels">
          {atlasLabels.map((label) => {
            const point = projection(label.coordinate)
            if (!point) return null
            return (
              <text
                key={label.text}
                x={point[0]}
                y={point[1]}
                className={`atlas-place-label atlas-place-label--${label.className}`}
                textAnchor="middle"
              >
                {label.text}
              </text>
            )
          })}
        </g>

        <g className="atlas-region-labels">
          {regions.map((region) => {
            const geography = regionGeography[region.id]
            const point = geography ? projection(geography.label) : null
            if (!point) return null
            const isCompact = ['british-isles', 'france', 'iberia', 'gold-coast', 'zulu-kingdom', 'java'].includes(region.id)
            return (
              <g
                key={`label-${region.id}`}
                className={`region__label ${selectedId === region.id ? 'is-selected' : ''}`}
                transform={`translate(${point[0]} ${point[1]})`}
              >
                <circle className="atlas-capital-dot" r={isCompact ? 1.7 : 2.1} />
                <text className="region__name atlas-region__name" y={isCompact ? -5 : -6} textAnchor="middle">
                  {region.name}
                </text>
                {!isCompact && (
                  <text className="region__owner atlas-region__owner" y="8" textAnchor="middle">
                    {factions[region.owner]?.shortName}
                  </text>
                )}
                {region.owner === playerFactionId && (
                  <path className="atlas-player-standard" d="M-3 -14 L4 -11 L-3 -8 Z" />
                )}
              </g>
            )
          })}
        </g>

        <g className="atlas-operational-markers" aria-hidden="true">
          {regions.map((region) => {
            const geography = regionGeography[region.id]
            const point = geography ? projection(geography.label) : null
            if (!point) return null
            return (
              <g key={`markers-${region.id}`}>
                {region.ports >= 3 && (
                  <g className="map-marker map-marker--port" transform={`translate(${point[0] - 10} ${point[1] + 13})`}>
                    <circle r="4.6" />
                    <path d="M0 -2.7 L0 2.7 M-2.5 0 Q0 4 2.5 0 M-1.8 -1.8 L1.8 -1.8" />
                  </g>
                )}
                {region.garrison >= 75 && (
                  <g className="map-marker map-marker--army" transform={`translate(${point[0] + 10} ${point[1] + 13})`}>
                    <rect x="-6" y="-4" width="12" height="8" rx=".7" />
                    <text textAnchor="middle" y="2">Ⅱ</text>
                  </g>
                )}
              </g>
            )
          })}
        </g>

        <g className="atlas-cartouche" transform="translate(550 23)" aria-hidden="true">
          <path d="M-94 0 L-82 -9 L82 -9 L94 0 L82 9 L-82 9 Z" />
          <text textAnchor="middle" y="-1">A NEW POLITICAL ATLAS</text>
          <text className="atlas-cartouche__year" textAnchor="middle" y="6">{year}</text>
        </g>

        <g className="map-compass atlas-compass" transform="translate(1030 500)" aria-hidden="true">
          <circle r="31" />
          <circle r="25" />
          <path d="M0 -22 L5 -4 L0 0 L-5 -4 Z" className="compass-north" />
          <path d="M0 22 L5 4 L0 0 L-5 4 Z" />
          <path d="M-22 0 L-4 -5 L0 0 L-4 5 Z M22 0 L4 -5 L0 0 L4 5 Z" />
          <text y="-36" textAnchor="middle">N</text>
          <text y="43" textAnchor="middle">S</text>
          <text x="-40" y="3" textAnchor="middle">W</text>
          <text x="40" y="3" textAnchor="middle">E</text>
        </g>

        <g className="atlas-scale" transform="translate(58 526)" aria-hidden="true">
          <text x="0" y="-8">SCALE OF GEOGRAPHICAL MILES</text>
          <path d="M0 0 H130 M0 -3 V3 M32 -3 V3 M65 -3 V3 M98 -3 V3 M130 -3 V3" />
          <text x="0" y="12">0</text>
          <text x="58" y="12">1,000</text>
          <text x="119" y="12">2,000</text>
        </g>

        <rect className="atlas-neatline atlas-neatline--outer" x="7" y="7" width="1086" height="566" />
        <rect className="atlas-neatline atlas-neatline--inner" x="13" y="13" width="1074" height="554" />
        <rect className="atlas-paper-grain" x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} />
      </svg>
      <div className="map-vignette atlas-vignette" />
    </div>
  )
}
