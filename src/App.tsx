import { useEffect, useMemo, useRef, useState } from 'react'
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
import { BattleModal } from './components/BattleModal'
import { WorldMap } from './components/WorldMap'
import { factions, initialEvents, regions as initialRegions } from './data'
import type {
  BattlePlan,
  BattleResult,
  CampaignEvent,
  MapLens,
  Region,
  Resources,
} from './types'
import './styles.css'

type View = 'campaign' | 'diplomacy' | 'ledger' | 'military'

const seasons = ['Spring', 'Summer', 'Autumn', 'Winter']

const navItems: Array<{ id: View; label: string; icon: typeof Globe2 }> = [
  { id: 'campaign', label: 'Campaign', icon: Globe2 },
  { id: 'diplomacy', label: 'Diplomacy', icon: Handshake },
  { id: 'ledger', label: 'Trade ledger', icon: Landmark },
  { id: 'military', label: 'War council', icon: Swords },
]

const lensOptions: Array<{ id: MapLens; label: string }> = [
  { id: 'political', label: 'Political' },
  { id: 'trade', label: 'Commerce' },
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

function App() {
  const [regions, setRegions] = useState<Region[]>(initialRegions)
  const [selectedId, setSelectedId] = useState('gold-coast')
  const [lens, setLens] = useState<MapLens>('political')
  const [view, setView] = useState<View>('campaign')
  const [turn, setTurn] = useState(1)
  const [resources, setResources] = useState<Resources>({
    treasury: 2860,
    supply: 74,
    influence: 61,
    legitimacy: 78,
  })
  const [events, setEvents] = useState<CampaignEvent[]>(initialEvents)
  const [battleRegion, setBattleRegion] = useState<Region | null>(null)
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [tradePartners, setTradePartners] = useState<string[]>(['south-china'])
  const toastTimerRef = useRef<number | null>(null)
  const eventIdRef = useRef(4)

  const selected = regions.find((region) => region.id === selectedId) ?? regions[0]
  const selectedFaction = factions[selected.owner]
  const controlledRegions = regions.filter((region) => region.owner === 'britain')
  const hasTradeAccord = tradePartners.includes(selected.id)
  const canProjectPower =
    selected.isCoastal || controlledRegions.some((region) => region.theater === selected.theater)

  const date = useMemo(() => {
    const seasonIndex = (turn - 1) % 4
    const year = 1836 + Math.floor((turn - 1) / 4)
    return `${seasons[seasonIndex]} ${year}`
  }, [turn])

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
      showToast('No viable expedition route reaches this interior territory.')
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
            owner: 'britain',
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
    const territorialIncome = Math.round(
      controlledRegions.reduce((sum, region) => sum + region.prosperity * 1.8 + region.ports * 20, 180),
    )
    const tradeIncome = tradePartners.length * 70
    const income = territorialIncome + tradeIncome
    const activeOccupations = controlledRegions.filter((region) => region.resistance >= 55).length
    const supplyDelta = Math.max(-12, 17 - controlledRegions.length * 2 - activeOccupations * 3)
    const nextTurn = turn + 1
    setTurn(nextTurn)
    setResources((current) => ({
      treasury: current.treasury + income,
      supply: Math.max(0, Math.min(100, current.supply + supplyDelta)),
      influence: Math.min(100, current.influence + 9),
      legitimacy: Math.max(0, current.legitimacy - (controlledRegions.length > 4 ? 2 : 0)),
    }))

    const worldEvents = [
      {
        title: 'French surveyors sighted on the Senegal',
        body: 'Paris appears ready to offer arms in exchange for a coastal concession.',
      },
      {
        title: 'A merchant convoy clears the Cape',
        body: 'Tea, cotton, and machinery are moving again after the winter storms.',
      },
      {
        title: 'Debate in the Commons',
        body: 'Opposition members demand clearer limits on the cost of overseas campaigns.',
      },
      {
        title: 'Qing customs officials issue new rules',
        body: 'Foreign merchants will be confined to licensed warehouses this season.',
      },
    ]
    const next = worldEvents[(nextTurn - 2) % worldEvents.length]
    setEvents((current) => [
      { ...next, id: eventIdRef.current++, turn: nextTurn, type: 'world' as const },
      ...current,
    ].slice(0, 8))
    showToast(`Turn advanced · +£${income}k revenue`)
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
          <span>THE GREAT GAME</span>
          <button onClick={() => setBriefOpen(true)}>
            {date} <ChevronDown size={13} />
          </button>
        </div>

        <div className="resource-bar" aria-label="National resources">
          <div className="resource-item">
            <span className="resource-icon resource-icon--treasury"><Coins size={16} /></span>
            <div><small>TREASURY</small><strong>£{resources.treasury.toLocaleString()}k</strong></div>
            <span className="resource-delta">+4.2%</span>
          </div>
          <div className="resource-item">
            <span className="resource-icon"><PackageOpen size={16} /></span>
            <div><small>SUPPLY</small><strong>{resources.supply}</strong></div>
            <span className="resource-cap">/100</span>
          </div>
          <div className="resource-item">
            <span className="resource-icon"><Sparkles size={16} /></span>
            <div><small>INFLUENCE</small><strong>{resources.influence}</strong></div>
            <span className="resource-cap">/100</span>
          </div>
          <div className="resource-item">
            <span className="resource-icon"><Scale size={16} /></span>
            <div><small>LEGITIMACY</small><strong>{resources.legitimacy}</strong></div>
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
            <div className="player-crest">
              <Crown size={15} />
              <span>BR</span>
            </div>
          </div>
        </aside>

        <main className="campaign-stage">
          <div className="stage-header">
            <div className="stage-title">
              <span className="section-eyebrow">
                {view === 'campaign' && 'WORLD CAMPAIGN'}
                {view === 'diplomacy' && 'FOREIGN OFFICE'}
                {view === 'ledger' && 'BOARD OF TRADE'}
                {view === 'military' && 'WAR COUNCIL'}
              </span>
              <h1>
                {view === 'campaign' && 'Theaters of influence'}
                {view === 'diplomacy' && 'Treaties & relations'}
                {view === 'ledger' && 'Global commerce'}
                {view === 'military' && 'Expeditionary command'}
              </h1>
            </div>

            <div className="rivalry-strip">
              <span>RIVAL INTEREST</span>
              {['france', 'portugal', 'netherlands'].map((factionId) => (
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
                <div className="objective-ring" style={{ '--progress': `${(Math.min(3, tradePartners.length) / 3) * 100}%` } as React.CSSProperties}>
                  <span>{Math.min(3, tradePartners.length)}/3</span>
                </div>
                <div>
                  <strong>Commercial footholds</strong>
                  <small>Sign three reciprocal trade accords</small>
                </div>
              </div>
              <div className="objective">
                <div className="objective-ring objective-ring--legitimacy" style={{ '--progress': `${resources.legitimacy}%` } as React.CSSProperties}>
                  <span>{resources.legitimacy}</span>
                </div>
                <div>
                  <strong>Answer to Parliament</strong>
                  <small>Keep legitimacy above 60</small>
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
                onSelect={(region) => setSelectedId(region.id)}
              />
            </div>

            <div className="map-legend">
              {lens === 'political' && (
                <>
                  <span><i className="legend-dot legend-dot--player" /> Your administration</span>
                  <span><i className="legend-dot legend-dot--rival" /> Rival power</span>
                  <span><i className="legend-dot legend-dot--sovereign" /> Sovereign polity</span>
                </>
              )}
              {lens === 'trade' && (
                <>
                  <span><i className="legend-square" style={{ background: '#c9a85c' }} /> Wealthy market</span>
                  <span><i className="legend-square" style={{ background: '#66877a' }} /> Local exchange</span>
                  <span><i className="route-key" /> Sea route</span>
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
              <small>{selected.owner === 'britain' ? 'ADMINISTERED BY' : 'SOVEREIGNTY'}</small>
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
                <span><Wheat size={14} /> ECONOMY</span>
                <small>{selected.prosperity >= 70 ? 'THRIVING' : selected.prosperity >= 55 ? 'STEADY' : 'LOCAL'}</small>
              </div>
              <div className="economy-card">
                <div className="good-icon">{selected.good === 'Gold' ? <CircleDollarSign size={21} /> : <Leaf size={21} />}</div>
                <div>
                  <small>PRIMARY EXCHANGE</small>
                  <strong>{selected.good}</strong>
                  <span>{selected.economy}</span>
                </div>
                <div className="port-count">
                  <Anchor size={14} />
                  <span>{selected.ports}</span>
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
              {selected.owner === 'britain' ? (
                <>
                  <button className="primary-action" onClick={handleInvest} disabled={resources.treasury < 240 || selected.prosperity >= 100}>
                    <Landmark size={16} />
                    <span><strong>Invest in infrastructure</strong><small>£240k · prosperity +5</small></span>
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
                      <small>{hasTradeAccord ? '+£70k each turn' : '8 influence · peaceful access'}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                  <div className="split-actions">
                    <button className="secondary-action" onClick={handleEnvoy} disabled={resources.influence < 12 || selected.relation >= 100}><Handshake size={15} /> Send envoy</button>
                    <button
                      className="secondary-action secondary-action--danger"
                      onClick={startCampaign}
                      disabled={!canProjectPower || (resources.supply < 16 && resources.influence < 12)}
                      title={!canProjectPower ? 'No expedition route' : undefined}
                    >
                      <Swords size={15} /> {canProjectPower ? 'Convene council' : 'No route'}
                    </button>
                  </div>
                </>
              )}
            </section>

            <div className="panel-note">
              <ScrollText size={14} />
              <span>Actions affect local prosperity, sovereignty, and your legitimacy at home.</span>
            </div>
          </div>
        </aside>
      </div>

      {notificationsOpen && (
        <div className="dispatch-drawer">
          <div className="dispatch-header">
            <div><span className="section-eyebrow">FOREIGN OFFICE</span><h3>Recent dispatches</h3></div>
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
            <span className="section-eyebrow">ALTERNATE-HISTORY CAMPAIGN · 1836</span>
            <h2 id="brief-title">An age of contest</h2>
            <p className="brief-lead">
              Industrial empires are reaching across oceans, but the world is not empty territory. Established nations,
              republics, kingdoms, and confederacies pursue their own diplomacy, commerce, and survival.
            </p>
            <div className="brief-principles">
              <div><Handshake size={20} /><strong>Diplomacy first</strong><span>Trade and treaties can achieve access without annexation.</span></div>
              <div><Scale size={20} /><strong>Power has a cost</strong><span>Occupation drains supply and erodes legitimacy.</span></div>
              <div><Shield size={20} /><strong>No generic armies</strong><span>Every polity fights through its terrain, institutions, and doctrine.</span></div>
            </div>
            <div className="historical-note">
              <BookOpen size={17} />
              <p>
                This scenario deliberately compresses history into an alternate 1836. It centers the agency and sovereignty
                of colonized peoples; descriptions are concise game abstractions, not exhaustive cultural portraits.
              </p>
            </div>
            <button className="brief-continue" onClick={() => setBriefOpen(false)}>
              Return to the cabinet <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {battleRegion && (
        <BattleModal
          region={battleRegion}
          resources={{ supply: resources.supply, influence: resources.influence }}
          onClose={() => setBattleRegion(null)}
          onResolve={resolveBattle}
        />
      )}

      {battleResult && (
        <div className="modal-backdrop result-backdrop" role="dialog" aria-modal="true">
          <div className={`result-card ${battleResult.victory ? 'is-victory' : ''}`}>
            <div className="result-seal">{battleResult.victory ? <Flag size={27} /> : <ScrollText size={27} />}</div>
            <span className="section-eyebrow">FIELD DISPATCH</span>
            <h2>{battleResult.title}</h2>
            <p>{battleResult.summary}</p>
            <div className="result-stat-row">
              <div><small>EXPEDITION LOSSES</small><strong>{battleResult.casualties}%</strong></div>
              <div><small>DEFENDER LOSSES</small><strong>{battleResult.oppositionCasualties}%</strong></div>
              <div><small>LEGITIMACY</small><strong className={battleResult.legitimacy < 0 ? 'is-negative' : ''}>{battleResult.legitimacy > 0 ? '+' : ''}{battleResult.legitimacy}</strong></div>
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
