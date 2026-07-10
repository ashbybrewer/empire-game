import { useEffect, useState } from 'react'
import './App.css'
import {
  BUILDINGS,
  buildingCost,
  buyBuilding,
  canAfford,
  createInitialState,
  manualGather,
  populationCap,
  tick,
  type BuildingType,
  type GameState,
} from './game/engine'

const STORAGE_KEY = 'empire-game-save'
const TICK_MS = 1000

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as GameState
    }
  } catch {
    // Ignore corrupt saves and start fresh.
  }
  return createInitialState()
}

function App() {
  const [state, setState] = useState<GameState>(loadState)

  useEffect(() => {
    const id = setInterval(() => setState((s) => tick(s)), TICK_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const cap = populationCap(state)

  return (
    <div className="app">
      <header className="header">
        <h1>Empire Game</h1>
        <p className="tagline">Gather gold, build structures, and grow your empire.</p>
      </header>

      <section className="resources" aria-label="resources">
        <div className="resource">
          <span className="resource-label">Gold</span>
          <span className="resource-value" data-testid="gold">
            {Math.floor(state.gold)}
          </span>
        </div>
        <div className="resource">
          <span className="resource-label">Food</span>
          <span className="resource-value" data-testid="food">
            {Math.floor(state.food)}
          </span>
        </div>
        <div className="resource">
          <span className="resource-label">Population</span>
          <span className="resource-value" data-testid="population">
            {state.population} / {cap}
          </span>
        </div>
      </section>

      <button
        className="gather"
        onClick={() => setState((s) => manualGather(s))}
      >
        Gather Gold (+1)
      </button>

      <section className="buildings" aria-label="buildings">
        {(Object.keys(BUILDINGS) as BuildingType[]).map((type) => {
          const def = BUILDINGS[type]
          const cost = buildingCost(state, type)
          const affordable = canAfford(state, type)
          return (
            <div className="building" key={type}>
              <div className="building-info">
                <span className="building-name">
                  {def.name}
                  <span className="building-count">× {state.buildings[type]}</span>
                </span>
                <span className="building-desc">{def.description}</span>
              </div>
              <button
                className="buy"
                disabled={!affordable}
                onClick={() => setState((s) => buyBuilding(s, type))}
              >
                Build ({cost} gold)
              </button>
            </div>
          )
        })}
      </section>

      <footer className="footer">
        <button
          className="reset"
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY)
            setState(createInitialState())
          }}
        >
          Reset Empire
        </button>
      </footer>
    </div>
  )
}

export default App
