import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Crosshair,
  Flag,
  Handshake,
  Mountain,
  Shield,
  Swords,
  Users,
  X,
} from 'lucide-react'
import { factions } from '../data'
import type { BattlePlan, BattleResult, Region } from '../types'

interface BattleModalProps {
  region: Region
  onClose: () => void
  onResolve: (result: BattleResult, plan: BattlePlan) => void
}

const plans: Array<{
  id: BattlePlan
  name: string
  eyebrow: string
  description: string
  icon: typeof Swords
  casualty: string
}> = [
  {
    id: 'advance',
    name: 'Concentrated advance',
    eyebrow: 'Decisive action',
    description: 'Mass the guns, secure the main road, and force a field engagement.',
    icon: Crosshair,
    casualty: 'High loss risk',
  },
  {
    id: 'adapt',
    name: 'Adaptive columns',
    eyebrow: 'Measured action',
    description: 'Split the force, screen the supply line, and adapt to local terrain.',
    icon: Shield,
    casualty: 'Moderate loss risk',
  },
  {
    id: 'parley',
    name: 'Parley & guarantees',
    eyebrow: 'Diplomatic action',
    description: 'Suspend the advance and negotiate trade access without annexation.',
    icon: Handshake,
    casualty: 'No battle losses',
  },
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function oppositionUnits(region: Region) {
  const doctrine = region.doctrine.toLowerCase()
  if (doctrine.includes('mounted') || doctrine.includes('cavalry')) {
    return ['Mounted vanguard', 'Main horse', 'Scouting screen', 'Reserve']
  }
  if (doctrine.includes('forest') || doctrine.includes('woodland') || doctrine.includes('dispersed')) {
    return ['Forward screen', 'Left wing', 'Central body', 'Right wing']
  }
  if (doctrine.includes('stockade') || doctrine.includes('fortified')) {
    return ['Outer works', 'Main stockade', 'Mobile reserve', 'River guard']
  }
  if (doctrine.includes('highland') || doctrine.includes('mountain')) {
    return ['Pass guard', 'Highland host', 'Valley reserve', 'Supply guard']
  }
  return ['Vanguard', 'Left formation', 'Center formation', 'Right formation']
}

export function BattleModal({ region, onClose, onResolve }: BattleModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<BattlePlan>('adapt')
  const opponent = factions[region.owner]

  const odds = useMemo(() => {
    const advance = clamp(Math.round(79 - region.resistance * 0.24 - region.garrison * 0.08 + 8), 26, 74)
    const adapt = clamp(
      Math.round(88 - region.resistance * 0.13 - region.garrison * 0.08 + (region.isCoastal ? 3 : -1)),
      38,
      79,
    )
    const parley = clamp(Math.round(48 + region.relation * 0.35 + region.prosperity * 0.08), 18, 83)
    return { advance, adapt, parley }
  }, [region])

  const resolve = () => {
    const chance = odds[selectedPlan]
    const success = Math.random() * 100 <= chance

    if (selectedPlan === 'parley') {
      const result: BattleResult = success
        ? {
            victory: false,
            title: 'Accord reached',
            summary: `${opponent.name} accepts a limited commercial mission. Sovereignty remains intact and both delegations withdraw their forces.`,
            casualties: 0,
            oppositionCasualties: 0,
            legitimacy: 6,
          }
        : {
            victory: false,
            title: 'Talks adjourned',
            summary: `The guarantees were judged insufficient. Both forces remain in position, but the ceasefire holds.`,
            casualties: 0,
            oppositionCasualties: 0,
            legitimacy: 2,
          }
      onResolve(result, selectedPlan)
      return
    }

    const aggressive = selectedPlan === 'advance'
    const result: BattleResult = success
      ? {
          victory: true,
          title: aggressive ? 'The field is held' : 'The approaches are secured',
          summary: aggressive
            ? `The main formation broke through, but ${opponent.shortName} units withdrew in good order and resistance remains active beyond the road.`
            : `Careful screens protected the column from ${region.doctrine.toLowerCase()}. The regional capital now lies within reach.`,
          casualties: aggressive ? 18 : 9,
          oppositionCasualties: aggressive ? 14 : 8,
          legitimacy: aggressive ? -7 : -3,
        }
      : {
          victory: false,
          title: aggressive ? 'The column is repulsed' : 'The advance is suspended',
          summary: `${opponent.shortName} forces used ${region.terrain.toLowerCase()} and ${region.doctrine.toLowerCase()} to isolate the expedition from its supplies.`,
          casualties: aggressive ? 27 : 14,
          oppositionCasualties: aggressive ? 11 : 6,
          legitimacy: aggressive ? -10 : -4,
        }
    onResolve(result, selectedPlan)
  }

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true" aria-labelledby="battle-title">
      <div className="battle-modal">
        <header className="battle-header">
          <button className="icon-button battle-back" onClick={onClose} aria-label="Return to campaign map">
            <ArrowLeft size={18} />
          </button>
          <div>
            <span className="battle-kicker">FIELD COMMAND · {region.theater.toUpperCase()}</span>
            <h2 id="battle-title">Confrontation in {region.name}</h2>
          </div>
          <div className="battle-date">
            <span>LOCAL CONDITIONS</span>
            <strong>{region.terrain}</strong>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close battle view">
            <X size={18} />
          </button>
        </header>

        <div className="battle-matchup">
          <div className="army-heading army-heading--player">
            <span className="army-emblem">BR</span>
            <div>
              <small>Expeditionary force</small>
              <strong>Royal Field Column</strong>
            </div>
            <span className="army-strength"><Users size={14} /> 8,400</span>
          </div>
          <div className="battle-versus">
            <Swords size={17} />
            <span>ENGAGED</span>
          </div>
          <div className="army-heading army-heading--opponent">
            <span className="army-strength"><Users size={14} /> {Math.round(region.garrison * 105).toLocaleString()}</span>
            <div>
              <small>Sovereign defender</small>
              <strong>{opponent.name}</strong>
            </div>
            <span className="army-emblem" style={{ borderColor: opponent.accent, color: opponent.accent }}>
              {opponent.emblem}
            </span>
          </div>
        </div>

        <div className="battle-content">
          <section className="battlefield-panel">
            <div className="battlefield-toolbar">
              <div>
                <span className="section-eyebrow">TACTICAL ESTIMATE</span>
                <strong>Ground before {region.name}</strong>
              </div>
              <div className="weather-chip"><Mountain size={13} /> Broken visibility</div>
            </div>

            <div className={`battlefield battlefield--${selectedPlan}`}>
              <div className="battlefield-contours" />
              <div className="battlefield-river" />
              <div className="terrain-label terrain-label--ridge">RIDGELINE</div>
              <div className="terrain-label terrain-label--road">MAIN ROAD</div>
              <div className="terrain-label terrain-label--woods">{region.terrain.toUpperCase()}</div>

              <div className="unit-line unit-line--player">
                {['Rifles', '1st Line', 'Field Guns', '2nd Line'].map((unit, index) => (
                  <div key={unit} className={`unit-token unit-token--player unit-token--${index + 1}`}>
                    <span className="unit-token__symbol">{index === 2 ? '•••' : '×'}</span>
                    <small>{unit}</small>
                  </div>
                ))}
              </div>

              <div className="unit-line unit-line--opponent">
                {oppositionUnits(region).map((unit, index) => (
                  <div
                    key={unit}
                    className={`unit-token unit-token--opponent unit-token--${index + 1}`}
                    style={{ '--opponent-color': opponent.color } as React.CSSProperties}
                  >
                    <span className="unit-token__symbol">{index % 2 === 0 ? '◆' : '▲'}</span>
                    <small>{unit}</small>
                  </div>
                ))}
              </div>

              <svg className="battle-arrows" viewBox="0 0 700 330" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <marker id="arrowPlayer" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                    <path d="M0 0 L9 4.5 L0 9 Z" />
                  </marker>
                  <marker id="arrowParley" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                    <path d="M0 0 L9 4.5 L0 9 Z" />
                  </marker>
                </defs>
                {selectedPlan === 'advance' && (
                  <>
                    <path className="plan-arrow" d="M260 270 Q280 195 300 132" />
                    <path className="plan-arrow" d="M390 270 Q385 195 380 125" />
                    <path className="plan-arrow" d="M510 270 Q490 195 475 140" />
                  </>
                )}
                {selectedPlan === 'adapt' && (
                  <>
                    <path className="plan-arrow" d="M205 270 Q110 205 160 120" />
                    <path className="plan-arrow" d="M350 270 Q350 192 360 128" />
                    <path className="plan-arrow" d="M535 270 Q625 205 555 120" />
                  </>
                )}
                {selectedPlan === 'parley' && (
                  <path className="plan-arrow plan-arrow--parley" d="M350 270 Q350 205 350 170" />
                )}
              </svg>

              {selectedPlan === 'parley' && (
                <div className="parley-marker">
                  <Flag size={17} />
                  <span>Neutral ground</span>
                </div>
              )}
            </div>

            <div className="doctrine-warning">
              <AlertTriangle size={18} />
              <div>
                <strong>Intelligence: {region.doctrine}</strong>
                <p>{region.doctrineDetail}</p>
              </div>
            </div>
          </section>

          <aside className="battle-plans">
            <div className="battle-plans__header">
              <span className="section-eyebrow">ORDERS</span>
              <h3>Choose an approach</h3>
              <p>Outcomes depend on terrain, preparation, and the defender’s doctrine.</p>
            </div>

            <div className="plan-options">
              {plans.map((plan) => {
                const Icon = plan.icon
                const isActive = selectedPlan === plan.id
                return (
                  <button
                    key={plan.id}
                    className={`plan-card ${isActive ? 'is-active' : ''}`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    <span className="plan-card__icon"><Icon size={19} /></span>
                    <span className="plan-card__copy">
                      <small>{plan.eyebrow}</small>
                      <strong>{plan.name}</strong>
                      <span>{plan.description}</span>
                    </span>
                    <span className="plan-card__odds">
                      <strong>{odds[plan.id]}%</strong>
                      <small>{plan.id === 'parley' ? 'accord' : 'success'}</small>
                    </span>
                    {isActive && <Check className="plan-check" size={14} />}
                  </button>
                )
              })}
            </div>

            <div className="battle-cost">
              <div>
                <span>Expected commitment</span>
                <strong>{selectedPlan === 'parley' ? '12 Influence' : '18 Supply'}</strong>
              </div>
              <div>
                <span>Exposure</span>
                <strong>{plans.find((plan) => plan.id === selectedPlan)?.casualty}</strong>
              </div>
            </div>

            <button className="commit-button" onClick={resolve}>
              {selectedPlan === 'parley' ? 'Send the delegation' : 'Issue field orders'}
              <Swords size={16} />
            </button>
            <p className="battle-footnote">
              Military control does not end local resistance. Occupation requires supply and political legitimacy.
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}
