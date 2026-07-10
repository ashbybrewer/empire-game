export type FactionKind = 'imperial' | 'sovereign' | 'commercial'

export interface Faction {
  id: string
  name: string
  shortName: string
  color: string
  accent: string
  kind: FactionKind
  emblem: string
}

export interface Region {
  id: string
  name: string
  theater: string
  path: string
  label: [number, number]
  owner: string
  people: string
  economy: string
  /** Display good / primary colonial raw material. */
  good: string
  /** Raw material extracted for the mercantile pipeline. */
  rawMaterial: string
  /** Colonial appetite for manufactured imports (0–100). */
  marketDemand: number
  /** Industrial mother-country heartland. */
  isMetropolis: boolean
  doctrine: string
  doctrineDetail: string
  terrain: string
  population: number
  prosperity: number
  resistance: number
  relation: number
  garrison: number
  ports: number
  isCoastal: boolean
}

export interface Resources {
  treasury: number
  supply: number
  influence: number
  legitimacy: number
  /** Industrial capacity of the mother country (0–100). */
  industry: number
  /** Stockpiled colonial raw materials. */
  rawStock: number
  /** Finished goods awaiting colonial markets. */
  manufactures: number
}

export interface CampaignPreset {
  id: string
  factionId: string
  title: string
  subtitle: string
  startYear: number
  homeRegionId: string
  treasuryLabel: string
  treasuryPrefix: string
  legitimacyLabel: string
  resources: Resources
  tradePartners: string[]
  rivalIds: string[]
  objectiveTitle: string
  objectiveBody: string
  objectiveTarget: number
  objectiveMetric: 'accords' | 'regions' | 'colonies'
  doctrine: string
  campaignSummary: string
  warActionLabel: string
}

export interface CampaignEvent {
  id: number
  type: 'diplomacy' | 'trade' | 'conflict' | 'world'
  title: string
  body: string
  turn: number
}

export type MapLens = 'political' | 'trade' | 'resistance'

export type BattlePlan = 'advance' | 'adapt' | 'parley'

export interface BattleResult {
  victory: boolean
  title: string
  summary: string
  casualties: number
  oppositionCasualties: number
  legitimacy: number
}
