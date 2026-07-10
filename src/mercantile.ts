import type { Faction, Region, Resources } from './types'

/** What the mother country manufactures from a colonial raw good. */
export const manufacturedFromRaw: Record<string, string> = {
  Cotton: 'Mill cloth',
  Sugar: 'Rum & refined sugar',
  Gold: 'Coin & plate',
  Silver: 'Coin & plate',
  Timber: 'Ships & furniture',
  Teak: 'Naval timber',
  Furs: 'Felt & coats',
  Spices: 'Processed spices',
  Tea: 'Packaged tea',
  Copper: 'Brass fittings',
  Indigo: 'Dyed cloth',
  Tobacco: 'Processed leaf',
  Coffee: 'Roasted coffee',
  'Palm oil': 'Soap & lubricants',
  Rubber: 'Industrial goods',
  Hides: 'Leather goods',
  Wool: 'Woolens',
  Rice: 'Milled rice',
  Cattle: 'Salted provisions',
  Horses: 'Cavalry remounts',
  Quinine: 'Medicinals',
  Ivory: 'Luxury goods',
  Maize: 'Milled grain',
  Leather: 'Harness & boots',
  Wine: 'Bottled wine',
  Arms: 'Ordnance',
  Machinery: 'Machine tools',
  Textiles: 'Finished cloth',
  Porcelain: 'Fine ceramics',
  Lacquerware: 'Luxury goods',
  Silk: 'Finished silk',
  Iron: 'Rails & tools',
  Coal: 'Steam power',
  'Gum arabic': 'Inks & adhesives',
}

export function manufactureLabel(rawGood: string): string {
  return manufacturedFromRaw[rawGood] ?? `Finished ${rawGood.toLowerCase()}`
}

export interface MercantileTick {
  resources: Resources
  rawExtracted: number
  goodsProduced: number
  goodsSold: number
  marketIncome: number
  industryGain: number
  colonyCount: number
  uniqueRaws: number
  summary: string
}

export function isColonialHolding(region: Region, playerFactionId: string, homeRegionId: string): boolean {
  return region.owner === playerFactionId && region.id !== homeRegionId && !region.isMetropolis
}

export function runMercantileTick(
  regions: Region[],
  resources: Resources,
  playerFaction: Faction,
  homeRegionId: string,
): MercantileTick {
  const holdings = regions.filter((region) => region.owner === playerFaction.id)
  const colonies = holdings.filter((region) => isColonialHolding(region, playerFaction.id, homeRegionId))
  const metropoles = holdings.filter((region) => region.isMetropolis)
  const isImperial = playerFaction.kind === 'imperial' || playerFaction.kind === 'commercial'

  let rawExtracted = 0
  for (const colony of colonies) {
    const yieldRate = 4 + colony.prosperity * 0.12 + colony.ports * 2.5
    rawExtracted += Math.round(yieldRate * (colony.resistance > 70 ? 0.72 : 1))
  }

  // Sovereign powers still draw from their own lands, but without the colonial pipeline bonus.
  if (!isImperial && colonies.length === 0) {
    for (const land of holdings) {
      rawExtracted += Math.round(2 + land.prosperity * 0.06)
    }
  }

  const uniqueRaws = new Set(colonies.map((region) => region.rawMaterial || region.good)).size
  const industryBase = resources.industry
  const industryGain = isImperial
    ? Math.min(8, Math.floor(colonies.length * 0.55 + uniqueRaws * 0.85))
    : Math.min(3, Math.floor(holdings.length * 0.25))
  const nextIndustry = Math.min(100, industryBase + industryGain)

  const conversionRate = 0.35 + nextIndustry * 0.006 + metropoles.length * 0.08
  const availableRaw = resources.rawStock + rawExtracted
  const goodsProduced = Math.min(availableRaw, Math.round(availableRaw * conversionRate + nextIndustry * 0.4))
  const remainingRaw = Math.max(0, availableRaw - goodsProduced)

  const marketCapacity = colonies.reduce((sum, region) => sum + region.marketDemand * 0.35 + region.population * 0.8, 0)
  const homeDemand = metropoles.reduce((sum, region) => sum + region.marketDemand * 0.2, 18)
  const demand = isImperial ? marketCapacity + homeDemand : holdings.reduce((sum, r) => sum + r.marketDemand * 0.25, 12)
  const stockForSale = resources.manufactures + goodsProduced
  const goodsSold = Math.min(stockForSale, Math.round(demand))
  const pricePerUnit = isImperial ? 9 + nextIndustry * 0.12 + uniqueRaws : 6
  const marketIncome = Math.round(goodsSold * pricePerUnit)
  const leftoverGoods = Math.max(0, stockForSale - goodsSold)

  const territorialIncome = Math.round(
    holdings.reduce((sum, region) => sum + region.prosperity * 1.1 + region.ports * 14, isImperial ? 90 : 140),
  )

  const summary = isImperial
    ? `Colonies shipped ${rawExtracted} raw · mills produced ${goodsProduced} · sold ${goodsSold} into colonial markets (+${marketIncome + territorialIncome} treasury)`
    : `Homelands yielded ${rawExtracted} stores · workshops produced ${goodsProduced} · markets cleared ${goodsSold}`

  return {
    resources: {
      ...resources,
      treasury: resources.treasury + territorialIncome + marketIncome,
      rawStock: Math.min(999, remainingRaw),
      manufactures: Math.min(999, leftoverGoods),
      industry: nextIndustry,
    },
    rawExtracted,
    goodsProduced,
    goodsSold,
    marketIncome: marketIncome + territorialIncome,
    industryGain,
    colonyCount: colonies.length,
    uniqueRaws,
    summary,
  }
}

/** Rival empires race to plant flags on weakly held coastal Indigenous lands. */
export function rivalColonialClaims(
  regions: Region[],
  playerFactionId: string,
  rivalIds: string[],
  turn: number,
): { regions: Region[]; claim: { rivalId: string; regionName: string } | null } {
  const rivals = rivalIds.filter((id) => id !== playerFactionId)
  if (rivals.length === 0) return { regions, claim: null }

  const rivalIndex = (turn + rivals.length) % rivals.length
  const rivalId = rivals[rivalIndex]
  const targets = regions.filter(
    (region) =>
      region.owner !== playerFactionId &&
      region.owner !== rivalId &&
      !region.isMetropolis &&
      region.isCoastal &&
      region.resistance < 78 &&
      region.garrison < 68,
  )
  if (targets.length === 0) return { regions, claim: null }

  const pick = targets[(turn * 3 + rivalIndex) % targets.length]
  // Only claim if currently held by a sovereign (colonial scramble), not another empire's metropole colony with high garrison
  const ownerKind = pick.owner
  const isAlreadyImperialColony = rivals.includes(ownerKind) || ownerKind === playerFactionId
  if (isAlreadyImperialColony && pick.garrison >= 50) return { regions, claim: null }

  return {
    regions: regions.map((region) =>
      region.id === pick.id
        ? {
            ...region,
            owner: rivalId,
            resistance: Math.min(100, region.resistance + 12),
            relation: -40,
            garrison: Math.max(region.garrison, 48),
          }
        : region,
    ),
    claim: { rivalId, regionName: pick.name },
  }
}
