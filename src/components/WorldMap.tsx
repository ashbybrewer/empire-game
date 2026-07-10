import { factions, tradeRoutes } from '../data'
import type { MapLens, Region } from '../types'

interface WorldMapProps {
  regions: Region[]
  selectedId: string
  lens: MapLens
  tradePartners: string[]
  playerFactionId: string
  tradeOrigin: [number, number]
  onSelect: (region: Region) => void
}

const prosperityColor = (value: number) => {
  if (value >= 78) return '#c9a85c'
  if (value >= 65) return '#8e9662'
  if (value >= 52) return '#66877a'
  return '#536b69'
}

const resistanceColor = (value: number) => {
  if (value >= 90) return '#a84337'
  if (value >= 75) return '#b56a3c'
  if (value >= 55) return '#b59a52'
  if (value >= 35) return '#6f8d68'
  return '#477b6b'
}

function regionFill(region: Region, lens: MapLens) {
  if (lens === 'trade') return prosperityColor(region.prosperity)
  if (lens === 'resistance') return resistanceColor(region.resistance)
  return factions[region.owner]?.color ?? '#6b756d'
}

export function WorldMap({
  regions,
  selectedId,
  lens,
  tradePartners,
  playerFactionId,
  tradeOrigin,
  onSelect,
}: WorldMapProps) {
  return (
    <div className="world-map">
      <svg
        className="world-map__svg"
        viewBox="25 36 1000 565"
        role="group"
        aria-label="Campaign map of the Atlantic world, Africa, India, and China"
      >
        <defs>
          <linearGradient id="oceanGlow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#163334" />
            <stop offset="48%" stopColor="#102829" />
            <stop offset="100%" stopColor="#0c2022" />
          </linearGradient>
          <pattern id="oceanGrain" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M0 17 Q9 12 18 17 T36 17" fill="none" stroke="#83a5a0" strokeOpacity=".055" />
            <path d="M-18 30 Q-9 25 0 30 T18 30 T36 30" fill="none" stroke="#83a5a0" strokeOpacity=".04" />
          </pattern>
          <pattern id="landHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="#f2e6c7" strokeOpacity=".045" strokeWidth="2" />
          </pattern>
          <filter id="selectedGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#f0d38b" floodOpacity=".68" />
          </filter>
          <filter id="landShadow" x="-15%" y="-15%" width="130%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#020b0c" floodOpacity=".55" />
          </filter>
        </defs>

        <rect x="0" y="0" width="1080" height="620" fill="url(#oceanGlow)" />
        <rect x="0" y="0" width="1080" height="620" fill="url(#oceanGrain)" />

        <g className="map-grid" aria-hidden="true">
          {[110, 210, 310, 410, 510].map((y) => (
            <path key={`lat-${y}`} d={`M25 ${y} Q525 ${y - 16} 1025 ${y}`} />
          ))}
          {[150, 300, 450, 600, 750, 900].map((x) => (
            <path key={`long-${x}`} d={`M${x} 40 Q${x - 22} 320 ${x} 600`} />
          ))}
        </g>

        <g className="continent-silhouettes" filter="url(#landShadow)" aria-hidden="true">
          <path d="M40 72 L118 47 L212 53 L292 75 L357 121 L387 183 L355 260 L306 286 L264 329 L206 317 L155 281 L88 249 L50 180 Z" />
          <path d="M250 307 L318 296 L389 335 L473 382 L477 467 L418 532 L376 590 L320 575 L280 486 L245 398 Z" />
          <path d="M466 108 L495 82 L530 101 L568 129 L587 179 L550 247 L502 249 L471 215 Z" />
          <path d="M455 269 L531 254 L606 278 L671 329 L682 411 L651 511 L574 570 L512 538 L476 446 L442 354 Z" />
          <path d="M565 137 L677 109 L784 126 L897 111 L1004 148 L1027 229 L980 305 L916 361 L898 432 L845 444 L784 417 L720 457 L686 381 L701 288 L650 250 L574 234 Z" />
          <path d="M827 445 L902 447 L970 466 L954 507 L877 502 L831 479 Z" />
        </g>

        <g className="trade-routes" aria-hidden="true">
          {tradeRoutes.map((route) => (
            <path
              key={route.id}
              d={route.d}
              className={`trade-route trade-route--${route.tone} ${lens === 'trade' ? 'is-prominent' : ''}`}
            />
          ))}
          {tradePartners.map((regionId) => {
            const destination = regions.find((region) => region.id === regionId)
            if (!destination) return null
            const [x, y] = destination.label
            const [originX, originY] = tradeOrigin
            return (
              <path
                key={`accord-${regionId}`}
                d={`M ${originX} ${originY} Q ${(originX + x) / 2} ${Math.max(52, Math.min(250, Math.min(originY, y) - 75))} ${x} ${y}`}
                className="trade-route trade-route--accord is-prominent"
              />
            )
          })}
        </g>

        <g className={`regions regions--${lens}`}>
          {regions.map((region) => {
            const isSelected = selectedId === region.id
            return (
              <g key={region.id} className={`region ${isSelected ? 'is-selected' : ''}`}>
                <path
                  d={region.path}
                  fill={regionFill(region, lens)}
                  className="region__shape"
                  filter={isSelected ? 'url(#selectedGlow)' : undefined}
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
                <path d={region.path} fill="url(#landHatch)" className="region__texture" />
                <g
                  className="region__label"
                  transform={`translate(${region.label[0]} ${region.label[1]})`}
                  onClick={() => onSelect(region)}
                >
                  <text className="region__name" textAnchor="middle">
                    {region.name}
                  </text>
                  <text className="region__owner" y="11" textAnchor="middle">
                    {factions[region.owner]?.shortName}
                  </text>
                </g>
                {region.owner === playerFactionId && (
                  <g className="player-standard" transform={`translate(${region.label[0] - 3} ${region.label[1] - 21})`}>
                    <path d="M0 0 L6 3 L0 6 L-6 3 Z" />
                  </g>
                )}
                {region.ports >= 3 && (
                  <g
                    className="map-marker map-marker--port"
                    transform={`translate(${region.label[0] - 19} ${region.label[1] + 19})`}
                    aria-hidden="true"
                  >
                    <circle r="5.5" />
                    <path d="M0 -3 L0 3 M-3 0 Q0 5 3 0 M-2 -2 L2 -2" />
                  </g>
                )}
                {region.garrison >= 75 && (
                  <g
                    className="map-marker map-marker--army"
                    transform={`translate(${region.label[0] + 20} ${region.label[1] - 17})`}
                    aria-hidden="true"
                  >
                    <rect x="-7" y="-5" width="14" height="10" rx="1" />
                    <text textAnchor="middle" y="2.5">Ⅱ</text>
                  </g>
                )}
              </g>
            )
          })}
        </g>

        <g className="map-place-labels" aria-hidden="true">
          <text x="397" y="188" transform="rotate(-16 397 188)">NORTH ATLANTIC</text>
          <text x="408" y="326" transform="rotate(7 408 326)">SOUTH ATLANTIC</text>
          <text x="691" y="515" transform="rotate(-24 691 515)">INDIAN OCEAN</text>
          <text x="968" y="394" transform="rotate(-15 968 394)">SOUTH CHINA SEA</text>
        </g>

        <g className="map-compass" transform="translate(986 522)" aria-hidden="true">
          <circle r="29" />
          <circle r="23" />
          <path d="M0 -20 L5 -4 L0 0 L-5 -4 Z" className="compass-north" />
          <path d="M0 20 L5 4 L0 0 L-5 4 Z" />
          <path d="M-20 0 L-4 -5 L0 0 L-4 5 Z M20 0 L4 -5 L0 0 L4 5 Z" />
          <text y="-34" textAnchor="middle">N</text>
        </g>
      </svg>
      <div className="map-vignette" />
    </div>
  )
}
