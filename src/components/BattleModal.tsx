import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Cloudy,
  Crosshair,
  Droplets,
  Handshake,
  Shield,
  SkipForward,
  Swords,
  Users,
  X,
} from 'lucide-react'
import { factions } from '../data'
import { getMilitaryProfile } from '../militaryData'
import type { BattlePlan, BattleResult, Region } from '../types'
import { BattlefieldScene } from './BattlefieldScene'

interface BattleModalProps {
  region: Region
  playerFactionId: string
  resources: {
    supply: number
    influence: number
  }
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

const planCosts = {
  advance: { value: 16, resource: 'supply' },
  adapt: { value: 22, resource: 'supply' },
  parley: { value: 12, resource: 'influence' },
} as const

function localPlanModifiers(region: Region) {
  const context = `${region.doctrine} ${region.terrain}`.toLowerCase()
  let advance = region.isCoastal ? 2 : 0
  let adapt = 0

  if (/(forest|woodland|jungle|riverine|rainforest|dispersed)/.test(context)) {
    advance -= 10
    adapt += 7
  }
  if (/(mounted|cavalry|mobile|open prairie|steppe)/.test(context)) {
    advance -= 5
    adapt += 2
  }
  if (/(highland|mountain|plateau|escarpment|andes)/.test(context)) {
    advance -= 9
    adapt += 5
  }
  if (/(stockade|fortified|fortress)/.test(context)) {
    advance -= 8
    adapt += 4
  }
  if (/(combined arms|massed artillery|field army)/.test(context)) {
    advance -= 2
    adapt -= 5
  }

  return {
    advance,
    adapt,
    parley: region.relation >= 0 ? 4 : -4,
  }
}

export function BattleModal({ region, playerFactionId, resources, onClose, onResolve }: BattleModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<BattlePlan>(
    resources.supply >= 22 ? 'adapt' : resources.supply >= 16 ? 'advance' : 'parley',
  )
  const [effectsEnabled, setEffectsEnabled] = useState(true)
  const [battlePhase, setBattlePhase] = useState<'planning' | 'engaging' | 'parley'>('planning')
  const resolutionRef = useRef<{ result: BattleResult; plan: BattlePlan } | null>(null)
  const resolutionTimerRef = useRef<number | null>(null)
  const opponent = factions[region.owner]
  const playerFaction = factions[playerFactionId]
  const playerProfile = getMilitaryProfile(playerFactionId)
  const opponentProfile = getMilitaryProfile(region.owner)
  const modifiers = useMemo(() => localPlanModifiers(region), [region])

  const odds = useMemo(() => {
    const defensivePower = region.resistance * 0.13 + region.garrison * 0.09
    const advance = clamp(Math.round(88 - defensivePower + modifiers.advance), 24, 82)
    const adapt = clamp(Math.round(80 - defensivePower + modifiers.adapt), 30, 82)
    const parley = clamp(
      Math.round(48 + region.relation * 0.35 + region.prosperity * 0.08 + modifiers.parley),
      18,
      83,
    )
    return { advance, adapt, parley }
  }, [modifiers, region])

  const canAffordPlan = (plan: BattlePlan) => {
    const cost = planCosts[plan]
    return resources[cost.resource] >= cost.value
  }

  useEffect(
    () => () => {
      if (resolutionTimerRef.current) window.clearTimeout(resolutionTimerRef.current)
    },
    [],
  )

  const completeResolution = () => {
    const pending = resolutionRef.current
    if (!pending) return
    if (resolutionTimerRef.current) window.clearTimeout(resolutionTimerRef.current)
    resolutionTimerRef.current = null
    resolutionRef.current = null
    onResolve(pending.result, pending.plan)
  }

  const resolve = () => {
    if (!canAffordPlan(selectedPlan) || battlePhase !== 'planning') return
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
      resolutionRef.current = { result, plan: selectedPlan }
      setBattlePhase('parley')
      resolutionTimerRef.current = window.setTimeout(completeResolution, 1900)
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
          summary: `${opponent.shortName} forces used ${region.terrain.toLowerCase()} and ${region.doctrine.toLowerCase()} to isolate the field force from its supplies.`,
          casualties: aggressive ? 27 : 14,
          oppositionCasualties: aggressive ? 11 : 6,
          legitimacy: aggressive ? -10 : -4,
        }
    resolutionRef.current = { result, plan: selectedPlan }
    setBattlePhase('engaging')
    resolutionTimerRef.current = window.setTimeout(completeResolution, 5600)
  }

  return (
    <div className="battle-overlay" role="dialog" aria-modal="true" aria-labelledby="battle-title">
      <div className="battle-modal">
        <header className="battle-header">
          <button className="icon-button battle-back" onClick={onClose} aria-label="Return to campaign map" autoFocus>
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
            <span className="army-emblem" style={{ borderColor: playerFaction.accent, color: playerFaction.accent }}>
              {playerFaction.emblem}
            </span>
            <div>
              <small>{playerFaction.kind === 'sovereign' ? 'Sovereign field force' : 'Campaign force'}</small>
              <strong>{playerProfile.forceName}</strong>
            </div>
            <span className="army-strength"><Users size={14} /> {Math.round(12000 + resources.supply * 90).toLocaleString()}</span>
          </div>
          <div className="battle-versus">
            <Swords size={17} />
            <span>ENGAGED</span>
          </div>
          <div className="army-heading army-heading--opponent">
            <span className="army-strength"><Users size={14} /> {Math.round(region.garrison * 180).toLocaleString()}</span>
            <div>
              <small>Defending field force</small>
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
                <span className="section-eyebrow">LIVE BATTLEFIELD · {region.terrain.toUpperCase()}</span>
                <strong>{playerProfile.forceName} faces {opponentProfile.forceName}</strong>
              </div>
              <button
                className={`effects-toggle ${effectsEnabled ? 'is-active' : ''}`}
                onClick={() => setEffectsEnabled((current) => !current)}
                aria-pressed={effectsEnabled}
              >
                <Cloudy size={13} />
                <Droplets size={12} />
                Smoke & blood
                <b>{effectsEnabled ? 'ON' : 'OFF'}</b>
              </button>
            </div>

            <BattlefieldScene
              region={region}
              playerFactionId={playerFactionId}
              plan={selectedPlan}
              phase={battlePhase}
              effectsEnabled={effectsEnabled}
            />

            <div className="kit-comparison">
              <a href={playerProfile.sourceUrl} target="_blank" rel="noreferrer" className="kit-card">
                <span style={{ background: playerFaction.color }} />
                <div>
                  <small>{playerProfile.dateRange}</small>
                  <strong>{playerProfile.weapons}</strong>
                  <p>{playerProfile.attire}</p>
                  <em>{playerProfile.sourceLabel} ↗</em>
                </div>
              </a>
              <a href={opponentProfile.sourceUrl} target="_blank" rel="noreferrer" className="kit-card">
                <span style={{ background: opponent.color }} />
                <div>
                  <small>{opponentProfile.dateRange}</small>
                  <strong>{opponentProfile.weapons}</strong>
                  <p>{opponentProfile.attire}</p>
                  <em>{opponentProfile.sourceLabel} ↗</em>
                </div>
              </a>
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
                const isAffordable = canAffordPlan(plan.id)
                return (
                  <button
                    key={plan.id}
                    className={`plan-card ${isActive ? 'is-active' : ''}`}
                    onClick={() => setSelectedPlan(plan.id)}
                    disabled={!isAffordable || battlePhase !== 'planning'}
                    aria-pressed={isActive}
                  >
                    <span className="plan-card__icon"><Icon size={19} /></span>
                    <span className="plan-card__copy">
                      <small>{plan.eyebrow}</small>
                      <strong>
                        {plan.id === 'advance'
                          ? playerFactionId === 'zulu'
                            ? 'Horns of the buffalo'
                            : playerProfile.firearmRatio >= 0.75
                              ? 'Bombard & line advance'
                              : plan.name
                          : plan.name}
                      </strong>
                      <span>
                        {plan.id === 'advance' && playerFactionId === 'zulu'
                          ? 'Fix the center, sweep both horns around the flanks, and close behind the shields.'
                          : plan.id === 'advance' && playerProfile.firearmRatio >= 0.75
                            ? 'Open with the main guns, advance in dressed lines, and fire controlled volleys.'
                            : plan.description}
                      </span>
                      <em className={modifiers[plan.id] >= 0 ? 'is-positive' : 'is-negative'}>
                        {modifiers[plan.id] >= 0 ? '+' : ''}{modifiers[plan.id]} local modifier
                      </em>
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
                <strong>
                  {planCosts[selectedPlan].value} {planCosts[selectedPlan].resource === 'supply' ? 'Supply' : 'Influence'}
                </strong>
              </div>
              <div>
                <span>Exposure</span>
                <strong>{plans.find((plan) => plan.id === selectedPlan)?.casualty}</strong>
              </div>
            </div>

            {battlePhase === 'planning' ? (
              <button className="commit-button" onClick={resolve} disabled={!canAffordPlan(selectedPlan)}>
                {selectedPlan === 'parley' ? 'Send the delegation' : 'Issue field orders'}
                <Swords size={16} />
              </button>
            ) : (
              <button className="commit-button commit-button--live" onClick={completeResolution}>
                Skip to field dispatch
                <SkipForward size={16} />
              </button>
            )}
            <p className="battle-footnote">
              Battlefield dress and arms are curated to the selected campaign year. Military control never erases local sovereignty.
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}
