import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  Anchor,
  Bell,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Coins,
  Compass,
  Crown,
  Flag,
  Globe2,
  Handshake,
  Landmark,
  Leaf,
  Menu,
  Minus,
  PackageOpen,
  Plus,
  Scale,
  ScrollText,
  Shield,
  Ship,
  Sparkles,
  Swords,
  TrendingUp,
  Users,
  Wheat,
  X,
} from 'lucide-react'
import { campaignPresets, defaultCampaign } from './campaigns'
import { WorldMap } from './components/WorldMap'
import { factions, regions as initialRegions } from './data'
import { isColonialHolding, manufactureLabel, rivalColonialClaims, runMercantileTick } from './mercantile'
import type {
  BattlePlan,
  BattleResult,
  CampaignEvent,
  CampaignPreset,
  MapLens,
  Region,
  Resources,
} from './types'
import './styles.css'

type View = 'campaign' | 'diplomacy' | 'ledger' | 'military'

const BattleModal = lazy(() =>
  import('./components/BattleModal').then((module) => ({ default: module.BattleModal })),
)

const seasons = ['Spring', 'Summer', 'Autumn', 'Winter']

const navItems: Array<{ id: View; label: string; icon: typeof Globe2 }> = [
  { id: 'campaign', label: 'Campaign', icon: Globe2 },
  { id: 'diplomacy', label: 'Diplomacy', icon: Handshake },
  { id: 'ledger', label: 'Mercantile ledger', icon: Landmark },
  { id: 'military', label: 'War council', icon: Swords },
]

const lensOptions: Array<{ id: MapLens; label: string }> = [
  { id: 'political', label: 'Political' },
  { id: 'trade', label: 'Raw & markets' },
  { id: 'resistance', label: 'Resistance' },
]

const eventIcons = {
  diplomacy: Handshake,
  trade: Ship,
  conflict: Swords,
  world: Globe2,
}

const relationLabel = (value: number) => {
  if (value >= 60) return 'Aligned'
  if (value >= 25) return 'Cordial'
  if (value >= 0) return 'Open to talks'
  if (value >= -25) return 'Wary'
  return 'Hostile'
}

const formatPopulation = (value: number) => {
  if (value >= 10) return `${value.toFixed(0)}m`
  return `${value.toFixed(1)}m`
}

const getOpeningEvents = (campaign: CampaignPreset): CampaignEvent[] => [
  {
    id: 1,
    type: 'world',
    title: campaign.title,
    body: campaign.campaignSummary,
    turn: 1,
  },
  {
    id: 2,
    type: 'conflict',
    title: 'Borders under pressure',
    body: `${factions[campaign.factionId].name} has called its leaders together to determine the coming season’s strategy.`,
    turn: 1,
  },
  {
    id: 3,
    type: 'diplomacy',
    title: 'Messengers return',
    body: 'Neighboring powers are weighing trade, alliance, and the risk of open conflict.',
    turn: 1,
  },
]

const getPerspectiveRegions = (campaign: CampaignPreset): Region[] =>
  initialRegions.map((region) => ({
    ...region,
    relation:
      region.owner === campaign.factionId
        ? 100
        : campaign.rivalIds.includes(region.owner)
          ? -35
          : factions[region.owner]?.kind === 'sovereign'
            ? 18
            : 0,
  }))

function App() {
  const [activeCampaign, setActiveCampaign] = useState<CampaignPreset>(defaultCampaign)
  const [regions, setRegions] = useState<Region[]>(() => getPerspectiveRegions(defaultCampaign))
  const [selectedId, setSelectedId] = useState(defaultCampaign.homeRegionId)
  const [lens, setLens] = useState<MapLens>('political')
  const [view, setView] = useState<View>('campaign')
  const [turn, setTurn] = useState(1)
  const [resources, setResources] = useState<Resources>(defaultCampaign.resources)
  const [events, setEvents] = useState<CampaignEvent[]>(getOpeningEvents(defaultCampaign))
  const [battleRegion, setBattleRegion] = useState<Region | null>(null)
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [briefOpen, setBriefOpen] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [tradePartners, setTradePartners] = useState<string[]>(defaultCampaign.tradePartners)
  const toastTimerRef = useRef<number | null>(null)
  const eventIdRef = useRef(4)

  const selected = regions.find((region) => region.id === selectedId) ?? regions[0]
  const selectedFaction = factions[selected.owner]
  const playerFactionId = activeCampaign.factionId
  const playerFaction = factions[playerFactionId]
  const controlledRegions = regions.filter((region) => region.owner === playerFactionId)
  const colonies = controlledRegions.filter((region) =>
    isColonialHolding(region, playerFactionId, activeCampaign.homeRegionId),
  )
  const hasTradeAccord = tradePartners.includes(selected.id)
  const canProjectPower =
    selected.isCoastal || controlledRegions.some((region) => region.theater === selected.theater)

  const homeRegion = regions.find((region) => region.id === activeCampaign.homeRegionId) ?? controlledRegions[0] ?? regions[0]
  const objectiveProgress =
    activeCampaign.objectiveMetric === 'accords'
      ? Math.min(activeCampaign.objectiveTarget, tradePartners.length)
      : activeCampaign.objectiveMetric === 'colonies'
        ? Math.min(activeCampaign.objectiveTarget, colonies.length)
        : Math.min(
            activeCampaign.objectiveTarget,
            controlledRegions.filter((region) =>
              activeCampaign.factionId === 'unitedStates'
                ? region.theater === 'North America'
                : region.theater === homeRegion.theater,
            ).length,
          )

  const currentYear = activeCampaign.startYear + Math.floor((turn - 1) / 4)
  const date = useMemo(() => {
    const seasonIndex = (turn - 1) % 4
    return `${seasons[seasonIndex]} ${currentYear}`
  }, [currentYear, turn])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setNotificationsOpen(false)
      setBriefOpen(false)
      setBattleRegion(null)
      setBattleResult(null)
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  const showToast = (message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    setToast(message)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600)
  }

  const addEvent = (event: Omit<CampaignEvent, 'id' | 'turn'>) => {
    setEvents((current) => [
      { ...event, id: eventIdRef.current++, turn },
      ...current,
    ].slice(0, 8))
  }

  const updateSelected = (changes: Partial<Region>) => {
    setRegions((current) =>
      current.map((region) => (region.id === selected.id ? { ...region, ...changes } : region)),
    )
  }

  const formatTreasury = (value: number) =>
    `${activeCampaign.treasuryPrefix}${value.toLocaleString()}${activeCampaign.treasuryPrefix ? 'k' : ''}`

  const selectCampaign = (campaign: CampaignPreset) => {
    setActiveCampaign(campaign)
    setRegions(getPerspectiveRegions(campaign))
    setSelectedId(campaign.homeRegionId)
    setTurn(1)
    setResources({ ...campaign.resources })
    setTradePartners([...campaign.tradePartners])
    setEvents(getOpeningEvents(campaign))
    setBattleRegion(null)
    setBattleResult(null)
    setLens('political')
    setView('campaign')
    setBriefOpen(false)
    showToast(`Now leading ${factions[campaign.factionId].name}`)
  }

  const leadSelectedNation = () => {
    const faction = selectedFaction
    const sandboxCampaign: CampaignPreset = {
      id: `sandbox-${faction.id}`,
      factionId: faction.id,
      title: `${faction.shortName} Ascendant`,
      subtitle: `Open campaign · ${currentYear}`,
      startYear: currentYear,
      homeRegionId: selected.id,
      treasuryLabel: faction.kind === 'sovereign' ? 'NATIONAL STORES' : 'TREASURY',
      treasuryPrefix: faction.id === 'unitedStates' ? '$' : faction.kind === 'imperial' ? '£' : '',
      legitimacyLabel: faction.kind === 'sovereign' ? 'COHESION' : 'LEGITIMACY',
      resources: {
        treasury: Math.round(1450 + selected.prosperity * 12),
        supply: Math.min(92, 48 + Math.round(selected.garrison / 2)),
        influence: Math.min(90, 36 + Math.round(selected.prosperity / 2)),
        legitimacy: Math.min(94, 55 + Math.round(selected.resistance / 3)),
        industry: faction.kind === 'sovereign' ? 14 : Math.round(30 + selected.prosperity / 3),
        rawStock: 20,
        manufactures: 10,
      },
      tradePartners: [],
      rivalIds:
        faction.kind === 'imperial' || faction.kind === 'commercial'
          ? ['britain', 'france', 'spain', 'portugal', 'netherlands', 'unitedStates'].filter((id) => id !== faction.id).slice(0, 5)
          : [playerFactionId, ...activeCampaign.rivalIds.filter((id) => id !== faction.id)].slice(0, 3),
      objectiveTitle: faction.kind === 'sovereign' ? 'Regional ascendancy' : 'Colonial scramble',
      objectiveBody:
        faction.kind === 'sovereign'
          ? `Control three regions in ${selected.theater}`
          : 'Hold six colonies outside the metropole',
      objectiveTarget: faction.kind === 'sovereign' ? 3 : 6,
      objectiveMetric: faction.kind === 'sovereign' ? 'regions' : 'colonies',
      doctrine: selected.doctrineDetail,
      campaignSummary: `Lead ${faction.name} in an open campaign beginning from ${selected.name}. Race rival empires for colonies, raw materials, and markets.`,
      warActionLabel: faction.kind === 'sovereign' ? 'Muster field host' : 'Dispatch column',
    }
    selectCampaign(sandboxCampaign)
  }

  const handleTrade = () => {
    if (hasTradeAccord) {
      showToast('A reciprocal trade accord is already active.')
      return
    }
    if (resources.influence < 8) {
      showToast('Not enough influence to charter a mission.')
      return
    }
    setResources((current) => ({
      ...current,
      influence: current.influence - 8,
      treasury: current.treasury + 60,
    }))
    updateSelected({
      relation: Math.min(100, selected.relation + 8),
      prosperity: Math.min(100, selected.prosperity + 2),
    })
    setTradePartners((current) => [...current, selected.id])
    addEvent({
      type: 'trade',
      title: `Commercial mission to ${selected.name}`,
      body: `${selectedFaction.shortName} merchants agreed to reciprocal market access.`,
    })
    showToast('Trade charter signed · New seasonal revenue')
  }

  const handleEnvoy = () => {
    if (selected.relation >= 100) {
      showToast('Relations are already at their diplomatic ceiling.')
      return
    }
    if (resources.influence < 12) {
      showToast('Not enough influence to dispatch an embassy.')
      return
    }
    setResources((current) => ({
      ...current,
      influence: current.influence - 12,
      legitimacy: Math.min(100, current.legitimacy + 1),
    }))
    updateSelected({
      relation: Math.min(100, selected.relation + 15),
      resistance: Math.max(0, selected.resistance - 4),
    })
    addEvent({
      type: 'diplomacy',
      title: `Delegation received in ${selected.name}`,
      body: `Formal talks with ${selectedFaction.name} have improved relations.`,
    })
    showToast('Envoys received · Relations improved')
  }

  const handleInvest = () => {
    if (selected.prosperity >= 100) {
      showToast('This region is already fully developed.')
      return
    }
    if (resources.treasury < 240) {
      showToast('The treasury cannot fund this project.')
      return
    }
    setResources((current) => ({
      ...current,
      treasury: current.treasury - 240,
      supply: Math.min(100, current.supply + 5),
    }))
    updateSelected({ prosperity: Math.min(100, selected.prosperity + 5) })
    addEvent({
      type: 'trade',
      title: `Public works completed in ${selected.name}`,
      body: 'Road and harbor improvements have raised local prosperity.',
    })
    showToast('Infrastructure expanded · Prosperity +5')
  }

  const handleReinforce = () => {
    if (resources.supply < 8) {
      showToast('At least 8 supply is required to reinforce this garrison.')
      return
    }
    setResources((current) => ({ ...current, supply: current.supply - 8 }))
    updateSelected({ garrison: Math.min(100, selected.garrison + 12) })
    addEvent({
      type: 'conflict',
      title: `Garrison reinforced in ${selected.name}`,
      body: 'Fresh stores and replacements have reached the local command.',
    })
    showToast('Garrison reinforced · 8 supply committed')
  }

  const startCampaign = () => {
    if (!canProjectPower) {
      showToast('No viable campaign route reaches this interior territory.')
      return
    }
    if (resources.supply < 16 && resources.influence < 12) {
      showToast('The council needs either 16 supply or 12 influence.')
      return
    }
    setBattleRegion(selected)
  }

  const resolveBattle = (result: BattleResult, plan: BattlePlan) => {
    if (!battleRegion) return
    const target = battleRegion
    const wasAccord = plan === 'parley' && result.title === 'Accord reached'
    const supplyCost = plan === 'advance' ? 16 : plan === 'adapt' ? 22 : 0

    setResources((current) => ({
      ...current,
      supply: Math.max(0, current.supply - supplyCost),
      influence: plan === 'parley' ? Math.max(0, current.influence - 12) : current.influence,
      legitimacy: Math.max(0, Math.min(100, current.legitimacy + result.legitimacy)),
    }))

    setRegions((current) =>
      current.map((region) => {
        if (region.id !== target.id) return region
        if (result.victory) {
          return {
            ...region,
            owner: playerFactionId,
            resistance: Math.max(55, region.resistance - 8),
            relation: -65,
            garrison: 42,
          }
        }
        if (wasAccord) {
          return {
            ...region,
            relation: Math.min(100, region.relation + 22),
            prosperity: Math.min(100, region.prosperity + 3),
          }
        }
        return { ...region, garrison: Math.max(20, region.garrison - result.oppositionCasualties / 2) }
      }),
    )

    if (wasAccord && !tradePartners.includes(target.id)) {
      setTradePartners((current) => [...current, target.id])
    }
    addEvent({
      type: plan === 'parley' ? 'diplomacy' : 'conflict',
      title: result.title,
      body: result.summary,
    })
    setBattleRegion(null)
    setBattleResult(result)
  }

  const endTurn = () => {
    const tradeIncome = tradePartners.length * 70
    const activeOccupations = controlledRegions.filter((region) => region.resistance >= 55).length
    const supplyDelta = Math.max(-12, 17 - colonies.length * 2 - activeOccupations * 3)
    const nextTurn = turn + 1

    const mercantile = runMercantileTick(regions, resources, playerFaction, activeCampaign.homeRegionId)
    const scramble = rivalColonialClaims(regions, playerFactionId, activeCampaign.rivalIds, nextTurn)
    if (scramble.claim) {
      setRegions(scramble.regions)
    }

    setTurn(nextTurn)
    setResources({
      ...mercantile.resources,
      treasury: mercantile.resources.treasury + tradeIncome,
      supply: Math.max(0, Math.min(100, resources.supply + supplyDelta)),
      influence: Math.min(100, resources.influence + 9),
      legitimacy: Math.max(
        0,
        resources.legitimacy - (colonies.length > 5 ? 2 : 0) - (scramble.claim ? 1 : 0),
      ),
    })

    const scrambleEvent = scramble.claim
      ? {
          title: `${factions[scramble.claim.rivalId].shortName} plants a flag`,
          body: `${factions[scramble.claim.rivalId].name} has claimed ${scramble.claim.regionName}. The scramble for colonies continues.`,
          type: 'conflict' as const,
        }
      : null

    const worldEvents =
      playerFaction.kind === 'sovereign'
        ? [
            {
              title: 'Gunpowder smoke on the horizon',
              body: 'A colonial column has been sighted near the frontier—muskets, bayonets, and wagon guns.',
            },
            {
              title: 'Council runners return',
              body: 'Neighboring leaders are prepared to discuss mutual defense against the scramble.',
            },
            {
              title: 'Merchants offer powder and cloth',
              body: 'Trade goods would strengthen supply but may deepen dependence on a coastal empire.',
            },
            {
              title: 'Communities renew their levy',
              body: 'Defenders gather spears, shields, trade muskets, and report on roads and passes.',
            },
          ]
        : [
            {
              title: 'Colonial raw materials arrive',
              body: `${mercantile.rawExtracted} cargoes of colonial goods have reached the metropole. Industry stands at ${mercantile.resources.industry}.`,
            },
            {
              title: 'Mills turn out finished goods',
              body: `Workshops produced ${mercantile.goodsProduced} manufactures from colonial raw stock for sale into overseas markets.`,
            },
            {
              title: 'Rival surveyors on the coast',
              body: 'Another European power is sounding harbors and offering treaties for coastal concessions.',
            },
            {
              title: 'Market demand from the colonies',
              body: `Colonial markets absorbed ${mercantile.goodsSold} finished goods. More colonies mean more raw materials—and more buyers.`,
            },
          ]
    const next = worldEvents[(nextTurn - 2) % worldEvents.length]
    setEvents((current) =>
      [
        ...(scrambleEvent
          ? [{ ...scrambleEvent, id: eventIdRef.current++, turn: nextTurn }]
          : []),
        { ...next, id: eventIdRef.current++, turn: nextTurn, type: 'world' as const },
        ...current,
      ].slice(0, 8),
    )
    showToast(
      scramble.claim
        ? `${factions[scramble.claim.rivalId].shortName} claimed ${scramble.claim.regionName}`
        : `Turn advanced · ${mercantile.summary.split(' · ')[0]} · +${formatTreasury(mercantile.marketIncome + tradeIncome)}`,
    )
  }

  return (
    <div className="game-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">
            <Compass size={25} strokeWidth={1.5} />
            <span className="brand-mark__dot" />
          </div>
          <div className="brand-copy">
            <span>SOVEREIGNS</span>
            <small>AN AGE OF CONTEST</small>
          </div>
        </div>

        <div className="campaign-title">
          <span>{activeCampaign.title.toUpperCase()}</span>
          <button onClick={() => setBriefOpen(true)}>
            {date} <ChevronDown size={13} />
          </button>
        </div>

        <div className="resource-bar" aria-label="National resources">
          <div className="resource-item">
            <span className="resource-icon resource-icon--treasury"><Coins size={16} /></span>
            <div><small>{activeCampaign.treasuryLabel}</small><strong>{formatTreasury(resources.treasury)}</strong></div>
            <span className="resource-delta">{colonies.length} col.</span>
          </div>
          <div className="resource-item">
            <span className="resource-icon"><PackageOpen size={16} /></span>
            <div><small>SUPPLY</small><strong>{resources.supply}</strong></div>
            <span className="resource-cap">/100</span>
          </div>
          <div className="resource-item">
            <span className="resource-icon"><Landmark size={16} /></span>
            <div><small>INDUSTRY</small><strong>{resources.industry}</strong></div>
            <span className="resource-cap">/100</span>
          </div>
          <div className="resource-item">
            <span className="resource-icon"><Wheat size={16} /></span>
            <div><small>RAW / GOODS</small><strong>{resources.rawStock}/{resources.manufactures}</strong></div>
          </div>
          <div className="resource-item">
            <span className="resource-icon"><Scale size={16} /></span>
            <div><small>{activeCampaign.legitimacyLabel}</small><strong>{resources.legitimacy}</strong></div>
            <span className={`status-dot ${resources.legitimacy < 50 ? 'is-warning' : ''}`} />
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className={`icon-button notification-button ${notificationsOpen ? 'is-active' : ''}`}
            onClick={() => setNotificationsOpen((current) => !current)}
            aria-label="Open dispatches"
            aria-expanded={notificationsOpen}
          >
            <Bell size={18} />
            <span />
          </button>
          <button className="end-turn-button" onClick={endTurn}>
            <span><small>END TURN</small><strong>{date}</strong></span>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <div className="game-body">
        <aside className="navigation-rail">
          <div className="rail-top">
            <button className="rail-menu" onClick={() => setBriefOpen(true)} aria-label="Open campaign brief"><Menu size={19} /></button>
            <span className="rail-divider" />
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={`nav-button ${view === item.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setView(item.id)
                    setLens(item.id === 'ledger' ? 'trade' : item.id === 'military' ? 'resistance' : 'political')
                  }}
                  aria-label={item.label}
                  aria-current={view === item.id ? 'page' : undefined}
                  title={item.label}
                >
                  <Icon size={19} strokeWidth={1.7} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
          <div className="rail-bottom">
            <button className="nav-button" onClick={() => setBriefOpen(true)} aria-label="Campaign codex">
              <BookOpen size={19} strokeWidth={1.7} />
              <span>Codex</span>
            </button>
            <button className="player-crest" onClick={() => setBriefOpen(true)} aria-label="Change playable nation">
              {playerFaction.kind === 'imperial' ? <Crown size={15} /> : <Shield size={15} />}
              <span>{playerFaction.emblem}</span>
            </button>
          </div>
        </aside>

        <main className="campaign-stage">
          <div className="stage-header">
            <div className="stage-title">
              <span className="section-eyebrow">
                {view === 'campaign' && 'WORLD CAMPAIGN'}
                {view === 'diplomacy' && 'FOREIGN OFFICE'}
                {view === 'ledger' && 'MERCANTILE BOARD'}
                {view === 'military' && 'WAR COUNCIL'}
              </span>
              <h1>
                {view === 'campaign' && 'Theaters of the scramble'}
                {view === 'diplomacy' && 'Treaties & relations'}
                {view === 'ledger' && 'Raw materials & markets'}
                {view === 'military' && 'Field command'}
              </h1>
            </div>

            <div className="rivalry-strip">
              <span>RIVAL INTEREST</span>
              {activeCampaign.rivalIds.map((factionId) => (
                <div className="rival-chip" key={factionId}>
                  <i style={{ background: factions[factionId].color }} />
                  {factions[factionId].shortName}
                </div>
              ))}
            </div>

            <div className="map-lenses">
              {lensOptions.map((option) => (
                <button
                  key={option.id}
                  className={lens === option.id ? 'is-active' : ''}
                  onClick={() => setLens(option.id)}
                  aria-pressed={lens === option.id}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <section className="map-frame">
            <div className="map-objectives">
              <div className="objectives-header">
                <span><Flag size={13} /> CABINET OBJECTIVES</span>
                <small>2 ACTIVE</small>
              </div>
              <div className="objective">
                <div className="objective-ring" style={{ '--progress': `${(objectiveProgress / activeCampaign.objectiveTarget) * 100}%` } as React.CSSProperties}>
                  <span>{objectiveProgress}/{activeCampaign.objectiveTarget}</span>
                </div>
                <div>
                  <strong>{activeCampaign.objectiveTitle}</strong>
                  <small>{activeCampaign.objectiveBody}</small>
                </div>
              </div>
              <div className="objective">
                <div className="objective-ring objective-ring--legitimacy" style={{ '--progress': `${resources.legitimacy}%` } as React.CSSProperties}>
                  <span>{resources.legitimacy}</span>
                </div>
                <div>
                  <strong>{playerFaction.kind === 'sovereign' ? 'Preserve council unity' : 'Answer to the government'}</strong>
                  <small>Keep {activeCampaign.legitimacyLabel.toLowerCase()} above 60</small>
                </div>
              </div>
            </div>

            <div className="map-zoom" aria-label="Map zoom controls">
              <button onClick={() => setZoom((value) => Math.min(1.16, value + 0.04))} aria-label="Zoom in"><Plus size={15} /></button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((value) => Math.max(1, value - 0.04))} aria-label="Zoom out"><Minus size={15} /></button>
            </div>

            <div className="map-scale-wrap" style={{ transform: `scale(${zoom})` }}>
              <WorldMap
                regions={regions}
                selectedId={selected.id}
                lens={lens}
                tradePartners={tradePartners}
                playerFactionId={playerFactionId}
                tradeOriginId={activeCampaign.homeRegionId}
                year={currentYear}
                onSelect={(region) => setSelectedId(region.id)}
              />
            </div>

            <div className="map-legend">
              {lens === 'political' && (
                <>
                  <span><i className="legend-dot legend-dot--player" style={{ background: playerFaction.color }} /> Your nation</span>
                  <span><i className="legend-dot legend-dot--rival" /> Rival power</span>
                  <span><i className="legend-dot legend-dot--sovereign" /> Sovereign polity</span>
                </>
              )}
              {lens === 'trade' && (
                <>
                  <span><i className="legend-square" style={{ background: '#c9a85c' }} /> High market demand</span>
                  <span><i className="legend-square" style={{ background: '#66877a' }} /> Raw-material colony</span>
                  <span><i className="route-key" /> Metropole industry routes</span>
                </>
              )}
              {lens === 'resistance' && (
                <>
                  <span><i className="legend-square" style={{ background: '#477b6b' }} /> Stable</span>
                  <span><i className="legend-square" style={{ background: '#b59a52' }} /> Contested</span>
                  <span><i className="legend-square" style={{ background: '#a84337' }} /> Resolute</span>
                </>
              )}
            </div>

            <div className="world-tension">
              <div className="tension-icon"><Globe2 size={17} /></div>
              <div>
                <small>WORLD TENSION</small>
                <strong>Rivalry is sharpening</strong>
              </div>
              <div className="tension-meter"><span style={{ width: `${Math.min(100, 36 + turn * 2)}%` }} /></div>
              <b>{Math.min(100, 36 + turn * 2)}%</b>
            </div>
          </section>
        </main>

        <aside className="region-panel">
          <div className="region-panel__hero" style={{ '--faction-color': selectedFaction.color } as React.CSSProperties}>
            <div className="region-panel__terrain-lines" />
            <div className="region-breadcrumb">
              <span>{selected.theater.toUpperCase()}</span>
              <ChevronRight size={12} />
              <span>{selected.isCoastal ? 'COASTAL THEATER' : 'INTERIOR THEATER'}</span>
            </div>
            <div className="region-heading">
              <div className="region-emblem" style={{ color: selectedFaction.accent }}>
                {selectedFaction.emblem}
              </div>
              <div>
                <h2>{selected.name}</h2>
                <span>{selected.people}</span>
              </div>
            </div>
            <div className="sovereignty-line">
              <span style={{ background: selectedFaction.color }} />
              <small>{selected.owner === playerFactionId ? 'YOUR CONTROL' : 'SOVEREIGNTY'}</small>
              <strong>{selectedFaction.name}</strong>
            </div>
          </div>

          <div className="region-panel__content">
            <div className="relation-row">
              <div>
                <small>RELATIONS</small>
                <strong className={selected.relation < 0 ? 'is-negative' : ''}>
                  {relationLabel(selected.relation)}
                </strong>
              </div>
              <div className="relation-value">
                <span>{selected.relation > 0 ? '+' : ''}{selected.relation}</span>
                <div><i style={{ width: `${(selected.relation + 100) / 2}%` }} /></div>
              </div>
            </div>

            <div className="region-stats">
              <div><Users size={15} /><span><small>POPULATION</small><strong>{formatPopulation(selected.population)}</strong></span></div>
              <div><TrendingUp size={15} /><span><small>PROSPERITY</small><strong>{selected.prosperity}/100</strong></span></div>
              <div><Shield size={15} /><span><small>RESISTANCE</small><strong>{selected.resistance}/100</strong></span></div>
            </div>

            <section className="region-section economy-section">
              <div className="region-section__title">
                <span><Wheat size={14} /> MERCANTILE ECONOMY</span>
                <small>{selected.isMetropolis ? 'METROPOLE' : selected.owner === playerFactionId ? 'COLONY' : 'MARKET'}</small>
              </div>
              <div className="economy-card">
                <div className="good-icon">{selected.good === 'Gold' || selected.good === 'Silver' ? <CircleDollarSign size={21} /> : <Leaf size={21} />}</div>
                <div>
                  <small>RAW MATERIAL</small>
                  <strong>{selected.rawMaterial || selected.good}</strong>
                  <span>{selected.economy}</span>
                </div>
                <div className="port-count">
                  <Anchor size={14} />
                  <span>{selected.ports}</span>
                </div>
              </div>
              <div className="economy-card economy-card--secondary">
                <div className="good-icon"><PackageOpen size={21} /></div>
                <div>
                  <small>{selected.isMetropolis ? 'INDUSTRIAL OUTPUT' : 'MARKET DEMAND'}</small>
                  <strong>
                    {selected.isMetropolis
                      ? manufactureLabel(selected.rawMaterial || selected.good)
                      : `${selected.marketDemand}/100 demand`}
                  </strong>
                  <span>
                    {selected.isMetropolis
                      ? 'Colonial raw goods feed these workshops'
                      : `Buys ${manufactureLabel(selected.rawMaterial || selected.good).toLowerCase()} from the mother country`}
                  </span>
                </div>
              </div>
            </section>

            <section className="region-section doctrine-section">
              <div className="region-section__title">
                <span><Swords size={14} /> WARFARE TRADITION</span>
                <small>INTELLIGENCE</small>
              </div>
              <div className="doctrine-card">
                <div className="doctrine-mark"><Shield size={20} /></div>
                <div>
                  <strong>{selected.doctrine}</strong>
                  <p>{selected.doctrineDetail}</p>
                </div>
              </div>
            </section>

            <section className="region-actions">
              {selected.owner === playerFactionId ? (
                <>
                  <button className="primary-action" onClick={handleInvest} disabled={resources.treasury < 240 || selected.prosperity >= 100}>
                    <Landmark size={16} />
                    <span><strong>Invest in infrastructure</strong><small>{formatTreasury(240)} · prosperity +5</small></span>
                    <ChevronRight size={16} />
                  </button>
                  <button className="secondary-action" onClick={handleReinforce} disabled={resources.supply < 8 || selected.garrison >= 100}>
                    <Shield size={15} /> Reinforce garrison
                  </button>
                </>
              ) : (
                <>
                  <button className="primary-action" onClick={handleTrade} disabled={hasTradeAccord || resources.influence < 8}>
                    <Ship size={16} />
                    <span>
                      <strong>{hasTradeAccord ? 'Trade accord active' : 'Propose trade accord'}</strong>
                      <small>{hasTradeAccord ? `+${formatTreasury(70)} each turn` : '8 influence · peaceful access'}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                  <div className="split-actions">
                    <button className="secondary-action" onClick={handleEnvoy} disabled={resources.influence < 12 || selected.relation >= 100}><Handshake size={15} /> Send envoy</button>
                    <button
                      className="secondary-action secondary-action--danger"
                      onClick={startCampaign}
                      disabled={!canProjectPower || (resources.supply < 16 && resources.influence < 12)}
                      title={!canProjectPower ? 'No campaign route' : undefined}
                    >
                      <Swords size={15} /> {canProjectPower ? activeCampaign.warActionLabel : 'No route'}
                    </button>
                  </div>
                  <button className="secondary-action lead-nation-action" onClick={leadSelectedNation}>
                    {selectedFaction.kind === 'sovereign' ? <Shield size={14} /> : <Crown size={14} />}
                    Lead {selectedFaction.shortName}
                  </button>
                </>
              )}
            </section>

            <div className="panel-note">
              <ScrollText size={14} />
              <span>Actions affect local prosperity, sovereignty, and {activeCampaign.legitimacyLabel.toLowerCase()} at home.</span>
            </div>
          </div>
        </aside>
      </div>

      {notificationsOpen && (
        <div className="dispatch-drawer">
          <div className="dispatch-header">
            <div><span className="section-eyebrow">{playerFaction.shortName.toUpperCase()} COUNCIL</span><h3>Recent dispatches</h3></div>
            <button className="icon-button" onClick={() => setNotificationsOpen(false)} aria-label="Close dispatches"><X size={16} /></button>
          </div>
          <div className="dispatch-list">
            {events.map((event) => {
              const Icon = eventIcons[event.type]
              return (
                <article key={event.id} className={`dispatch dispatch--${event.type}`}>
                  <span className="dispatch-icon"><Icon size={16} /></span>
                  <div>
                    <small>TURN {event.turn} · {event.type.toUpperCase()}</small>
                    <strong>{event.title}</strong>
                    <p>{event.body}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      )}

      {briefOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="brief-title">
          <div className="campaign-brief">
            <button className="icon-button modal-close" onClick={() => setBriefOpen(false)} aria-label="Close campaign brief" autoFocus><X size={18} /></button>
            <div className="brief-mark"><Compass size={31} /></div>
            <span className="section-eyebrow">COLONIAL SCRAMBLE · 1836–1846</span>
            <h2 id="brief-title">Choose a colonial power</h2>
            <p className="brief-lead">
              Lead Britain, France, Spain, Portugal, the Netherlands, or the United States in a race to claim colonies.
              Raw materials flow home to industrialize the metropole; finished goods flood back into colonial markets.
              Field battles pit musket-armed regulars against Indigenous nations fighting with spears, shields, bows, and scarce trade firearms.
            </p>
            <p className="campaign-picker-note">
              Authored scramble campaigns are shown below. Sovereign nations remain playable—select any territory and choose “Lead this nation.”
            </p>
            <div className="campaign-picker">
              {campaignPresets.map((campaign) => {
                const faction = factions[campaign.factionId]
                const isActive = campaign.id === activeCampaign.id
                return (
                  <button
                    key={campaign.id}
                    className={`campaign-card ${isActive ? 'is-active' : ''}`}
                    onClick={() => selectCampaign(campaign)}
                    aria-pressed={isActive}
                  >
                    <span className="campaign-card__emblem" style={{ color: faction.accent, borderColor: faction.color }}>
                      {faction.emblem}
                    </span>
                    <span className="campaign-card__copy">
                      <small>{campaign.subtitle.toUpperCase()}</small>
                      <strong>{campaign.title}</strong>
                      <span>{faction.name}</span>
                      <p>{campaign.campaignSummary}</p>
                      <em>{campaign.doctrine}</em>
                    </span>
                    <span className="campaign-card__action">{isActive ? 'CURRENT' : 'PLAY'}</span>
                  </button>
                )
              })}
            </div>
            <div className="historical-note">
              <BookOpen size={17} />
              <p>
                “Manifest Destiny” is presented as the documented 1845 expansionist ideology, not as neutral progress.
                Indigenous peoples are named as distinct sovereign nations. Uniform and equipment notes are dated,
                source-linked battlefield abstractions rather than generic cultural costumes.
              </p>
            </div>
            <button className="brief-continue" onClick={() => setBriefOpen(false)}>
              Continue as {playerFaction.shortName} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {battleRegion && (
        <Suspense fallback={<div className="battle-overlay"><div className="battle-loading">Mobilizing field armies…</div></div>}>
          <BattleModal
            region={battleRegion}
            playerFactionId={playerFactionId}
            resources={{ supply: resources.supply, influence: resources.influence }}
            onClose={() => setBattleRegion(null)}
            onResolve={resolveBattle}
          />
        </Suspense>
      )}

      {battleResult && (
        <div className="modal-backdrop result-backdrop" role="dialog" aria-modal="true">
          <div className={`result-card ${battleResult.victory ? 'is-victory' : ''}`}>
            <div className="result-seal">{battleResult.victory ? <Flag size={27} /> : <ScrollText size={27} />}</div>
            <span className="section-eyebrow">FIELD DISPATCH</span>
            <h2>{battleResult.title}</h2>
            <p>{battleResult.summary}</p>
            <div className="result-stat-row">
              <div><small>YOUR LOSSES</small><strong>{battleResult.casualties}%</strong></div>
              <div><small>DEFENDER LOSSES</small><strong>{battleResult.oppositionCasualties}%</strong></div>
              <div><small>{activeCampaign.legitimacyLabel}</small><strong className={battleResult.legitimacy < 0 ? 'is-negative' : ''}>{battleResult.legitimacy > 0 ? '+' : ''}{battleResult.legitimacy}</strong></div>
            </div>
            <button className="brief-continue" onClick={() => setBattleResult(null)} autoFocus>
              Return to campaign <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {toast && <div className="game-toast" role="status" aria-live="polite"><span><Sparkles size={15} /></span>{toast}</div>}
    </div>
  )
}

export default App
