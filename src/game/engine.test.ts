import { describe, it, expect } from 'vitest'
import {
  createInitialState,
  buildingCost,
  canAfford,
  buyBuilding,
  manualGather,
  populationCap,
  tick,
} from './engine'

describe('empire engine', () => {
  it('starts with sensible defaults', () => {
    const state = createInitialState()
    expect(state.gold).toBe(20)
    expect(state.food).toBe(10)
    expect(state.population).toBe(1)
    expect(state.buildings).toEqual({ farm: 0, mine: 0, house: 0 })
  })

  it('scales building cost with the number owned', () => {
    const state = createInitialState()
    const first = buildingCost(state, 'farm')
    const owned = { ...state, buildings: { ...state.buildings, farm: 1 } }
    expect(buildingCost(owned, 'farm')).toBeGreaterThan(first)
  })

  it('reports affordability correctly', () => {
    const poor = { ...createInitialState(), gold: 0 }
    expect(canAfford(poor, 'farm')).toBe(false)
    expect(canAfford(createInitialState(), 'farm')).toBe(true)
  })

  it('buys a building and deducts gold', () => {
    const state = createInitialState()
    const cost = buildingCost(state, 'farm')
    const next = buyBuilding(state, 'farm')
    expect(next.buildings.farm).toBe(1)
    expect(next.gold).toBe(state.gold - cost)
  })

  it('does not buy when gold is insufficient', () => {
    const state = { ...createInitialState(), gold: 0 }
    const next = buyBuilding(state, 'mine')
    expect(next).toBe(state)
  })

  it('manual gather adds gold', () => {
    const state = createInitialState()
    expect(manualGather(state).gold).toBe(state.gold + 1)
  })

  it('mines produce gold each tick', () => {
    const state = { ...createInitialState(), buildings: { farm: 0, mine: 2, house: 0 } }
    expect(tick(state).gold).toBe(state.gold + 6)
  })

  it('population grows when food is in surplus', () => {
    const state = { ...createInitialState(), food: 5, buildings: { farm: 3, mine: 0, house: 1 } }
    const next = tick(state)
    expect(next.population).toBe(2)
    expect(next.food).toBeGreaterThan(0)
  })

  it('population shrinks and food floors at zero under starvation', () => {
    const state = { ...createInitialState(), food: 0, population: 3, buildings: { farm: 0, mine: 0, house: 0 } }
    const next = tick(state)
    expect(next.population).toBe(2)
    expect(next.food).toBe(0)
  })

  it('houses raise the population cap', () => {
    const base = populationCap(createInitialState())
    const withHouses = populationCap({
      ...createInitialState(),
      buildings: { farm: 0, mine: 0, house: 2 },
    })
    expect(withHouses).toBeGreaterThan(base)
  })
})
