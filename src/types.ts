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
  good: string
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
  objectiveMetric: 'accords' | 'regions'
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
