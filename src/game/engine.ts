export type BuildingType = 'farm' | 'mine' | 'house'

export interface GameState {
  gold: number
  food: number
  population: number
  buildings: Record<BuildingType, number>
}

export interface BuildingDef {
  type: BuildingType
  name: string
  description: string
  baseCost: number
  costGrowth: number
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  farm: {
    type: 'farm',
    name: 'Farm',
    description: 'Produces food each turn to feed your empire.',
    baseCost: 10,
    costGrowth: 1.15,
  },
  mine: {
    type: 'mine',
    name: 'Mine',
    description: 'Produces gold each turn to fund expansion.',
    baseCost: 25,
    costGrowth: 1.2,
  },
  house: {
    type: 'house',
    name: 'House',
    description: 'Raises your population capacity.',
    baseCost: 40,
    costGrowth: 1.25,
  },
}

const FARM_FOOD_PER_TICK = 2
const MINE_GOLD_PER_TICK = 3
const POP_CAP_PER_HOUSE = 5
const BASE_POP_CAP = 5
const FOOD_PER_POP = 1
const MANUAL_GATHER_GOLD = 1

export function createInitialState(): GameState {
  return {
    gold: 20,
    food: 10,
    population: 1,
    buildings: { farm: 0, mine: 0, house: 0 },
  }
}

export function buildingCost(state: GameState, type: BuildingType): number {
  const def = BUILDINGS[type]
  const owned = state.buildings[type]
  return Math.floor(def.baseCost * def.costGrowth ** owned)
}

export function canAfford(state: GameState, type: BuildingType): boolean {
  return state.gold >= buildingCost(state, type)
}

export function populationCap(state: GameState): number {
  return BASE_POP_CAP + state.buildings.house * POP_CAP_PER_HOUSE
}

export function buyBuilding(state: GameState, type: BuildingType): GameState {
  if (!canAfford(state, type)) {
    return state
  }
  const cost = buildingCost(state, type)
  return {
    ...state,
    gold: state.gold - cost,
    buildings: {
      ...state.buildings,
      [type]: state.buildings[type] + 1,
    },
  }
}

export function manualGather(state: GameState): GameState {
  return { ...state, gold: state.gold + MANUAL_GATHER_GOLD }
}

export function tick(state: GameState): GameState {
  const foodProduced = state.buildings.farm * FARM_FOOD_PER_TICK
  const goldProduced = state.buildings.mine * MINE_GOLD_PER_TICK
  const foodConsumed = state.population * FOOD_PER_POP

  let food = state.food + foodProduced - foodConsumed
  let population = state.population

  const cap = populationCap(state)
  if (food > 0 && population < cap) {
    // Surplus food grows the empire toward its capacity.
    population = Math.min(cap, population + 1)
  } else if (food < 0) {
    // Starvation shrinks the population and food cannot go negative.
    population = Math.max(1, population - 1)
    food = 0
  }

  return {
    ...state,
    gold: state.gold + goldProduced,
    food,
    population,
  }
}
