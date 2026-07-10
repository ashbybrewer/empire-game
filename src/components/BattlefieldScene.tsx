import { useEffect, useMemo, useRef } from 'react'
import { factions } from '../data'
import {
  battleMapDetails,
  getBattleMapKind,
  getMilitaryProfile,
  type HeadgearVisual,
  type MilitaryProfile,
  type WeaponVisual,
} from '../militaryData'
import type { BattlePlan, Region } from '../types'

type ScenePhase = 'planning' | 'engaging' | 'parley'

interface BattlefieldSceneProps {
  region: Region
  playerFactionId: string
  plan: BattlePlan
  phase: ScenePhase
  effectsEnabled: boolean
}

interface SoldierSeed {
  index: number
  row: number
  column: number
  variation: number
  mounted: boolean
  firearm: boolean
}

const SOLDIERS_PER_SIDE = 180
const FORMATION_COLUMNS = 30
const BASE_WIDTH = 1000
const BASE_HEIGHT = 500

function seeded(index: number, salt = 0) {
  const value = Math.sin(index * 91.173 + salt * 47.77) * 43758.5453
  return value - Math.floor(value)
}

function makeSoldiers(profile: MilitaryProfile, sideSalt: number): SoldierSeed[] {
  const mountedCount = Math.round(profile.mountedRatio * SOLDIERS_PER_SIDE * 0.48)
  return Array.from({ length: SOLDIERS_PER_SIDE }, (_, index) => {
    const row = Math.floor(index / FORMATION_COLUMNS)
    return {
      index,
      row,
      column: index % FORMATION_COLUMNS,
      variation: seeded(index, sideSalt),
      mounted: index < mountedCount,
      firearm: seeded(index, sideSalt + 8) <= profile.firearmRatio,
    }
  })
}

function artilleryCount(profile: MilitaryProfile) {
  if (['britain', 'unitedStates', 'france', 'russia', 'prussia', 'austria', 'egypt', 'sikh'].includes(profile.factionId)) return 4
  if (['spain', 'portugal', 'netherlands', 'mexico', 'brazil', 'ottoman', 'chile', 'peruBolivia', 'qing', 'japan'].includes(profile.factionId)) return 2
  if (['maratha', 'burma', 'vietnam', 'siam'].includes(profile.factionId)) return 1
  return 0
}

function drawMap(
  ctx: CanvasRenderingContext2D,
  mapKind: ReturnType<typeof getBattleMapKind>,
  elapsed: number,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT)
  sky.addColorStop(0, '#61736a')
  sky.addColorStop(0.38, '#899083')
  sky.addColorStop(1, '#243a34')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT)

  const haze = ctx.createLinearGradient(0, 95, 0, 300)
  haze.addColorStop(0, 'rgba(221, 214, 185, .18)')
  haze.addColorStop(1, 'rgba(221, 214, 185, 0)')
  ctx.fillStyle = haze
  ctx.fillRect(0, 80, BASE_WIDTH, 250)

  if (mapKind === 'woodland') {
    ctx.fillStyle = '#314c3d'
    ctx.fillRect(0, 170, BASE_WIDTH, 330)
    for (let i = 0; i < 28; i += 1) {
      const x = seeded(i, 4) * BASE_WIDTH
      const y = 95 + seeded(i, 5) * 205
      const size = 24 + seeded(i, 6) * 42
      ctx.fillStyle = i % 3 === 0 ? '#1c342d' : '#294638'
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#493d2f'
      ctx.fillRect(x - 4, y + size * 0.4, 8, 150)
    }
    ctx.fillStyle = '#6c654d'
    ctx.beginPath()
    ctx.moveTo(390, 500)
    ctx.quadraticCurveTo(500, 325, 550, 185)
    ctx.lineTo(650, 185)
    ctx.quadraticCurveTo(600, 345, 610, 500)
    ctx.closePath()
    ctx.fill()
  } else if (mapKind === 'prairie') {
    ctx.fillStyle = '#687256'
    ctx.beginPath()
    ctx.moveTo(0, 220)
    ctx.quadraticCurveTo(180, 135, 390, 215)
    ctx.quadraticCurveTo(720, 120, 1000, 205)
    ctx.lineTo(1000, 500)
    ctx.lineTo(0, 500)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#8c8152'
    ctx.fillRect(0, 265, BASE_WIDTH, 235)
    for (let i = 0; i < 150; i += 1) {
      const x = seeded(i, 11) * BASE_WIDTH
      const y = 275 + seeded(i, 12) * 220
      ctx.strokeStyle = i % 4 === 0 ? '#c4a75d' : '#786b40'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.sin(elapsed / 900 + i) * 3, y - 5 - seeded(i, 13) * 8)
      ctx.stroke()
    }
  } else if (mapKind === 'highlands') {
    ctx.fillStyle = '#56645b'
    ctx.beginPath()
    ctx.moveTo(0, 245)
    ctx.lineTo(170, 75)
    ctx.lineTo(330, 235)
    ctx.lineTo(520, 55)
    ctx.lineTo(705, 232)
    ctx.lineTo(850, 95)
    ctx.lineTo(1000, 220)
    ctx.lineTo(1000, 500)
    ctx.lineTo(0, 500)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#6f6b56'
    ctx.beginPath()
    ctx.moveTo(0, 360)
    ctx.quadraticCurveTo(470, 280, 1000, 345)
    ctx.lineTo(1000, 500)
    ctx.lineTo(0, 500)
    ctx.closePath()
    ctx.fill()
    for (let i = 0; i < 30; i += 1) {
      const x = seeded(i, 15) * BASE_WIDTH
      const y = 315 + seeded(i, 16) * 175
      ctx.fillStyle = 'rgba(52, 49, 42, .48)'
      ctx.beginPath()
      ctx.ellipse(x, y, 4 + seeded(i, 17) * 12, 2 + seeded(i, 18) * 6, seeded(i, 19), 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (mapKind === 'river') {
    ctx.fillStyle = '#4b5e49'
    ctx.fillRect(0, 185, BASE_WIDTH, 315)
    ctx.fillStyle = '#526f6c'
    ctx.beginPath()
    ctx.moveTo(410, 170)
    ctx.bezierCurveTo(330, 265, 600, 315, 430, 500)
    ctx.lineTo(655, 500)
    ctx.bezierCurveTo(760, 315, 510, 250, 630, 170)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(202, 219, 202, .22)'
    for (let i = 0; i < 18; i += 1) {
      const y = 200 + i * 17
      ctx.beginPath()
      ctx.moveTo(430 + Math.sin(i) * 25, y)
      ctx.quadraticCurveTo(515, y - 7, 620 + Math.cos(i) * 22, y)
      ctx.stroke()
    }
    for (let i = 0; i < 55; i += 1) {
      const x = i % 2 === 0 ? 365 + seeded(i, 21) * 65 : 650 + seeded(i, 21) * 65
      const y = 245 + seeded(i, 22) * 250
      ctx.strokeStyle = '#82915e'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 3, y - 16)
      ctx.stroke()
    }
  } else if (mapKind === 'savanna') {
    ctx.fillStyle = '#756e49'
    ctx.fillRect(0, 205, BASE_WIDTH, 295)
    ctx.fillStyle = '#545f40'
    ctx.beginPath()
    ctx.moveTo(0, 230)
    ctx.quadraticCurveTo(250, 140, 500, 220)
    ctx.quadraticCurveTo(720, 135, 1000, 225)
    ctx.lineTo(1000, 330)
    ctx.lineTo(0, 330)
    ctx.closePath()
    ctx.fill()
    for (let i = 0; i < 7; i += 1) {
      const x = 90 + i * 150 + seeded(i, 24) * 45
      const y = 205 + seeded(i, 25) * 80
      ctx.strokeStyle = '#393d2d'
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(x, y + 60)
      ctx.lineTo(x, y)
      ctx.stroke()
      ctx.fillStyle = '#33402f'
      ctx.beginPath()
      ctx.ellipse(x, y, 42, 13, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    ctx.fillStyle = '#5e6759'
    ctx.fillRect(0, 210, BASE_WIDTH, 290)
    ctx.fillStyle = '#77735d'
    ctx.fillRect(620, 128, 310, 122)
    for (let x = 620; x < 930; x += 32) {
      ctx.fillStyle = x % 64 === 0 ? '#686550' : '#7d7862'
      ctx.fillRect(x, 112, 24, 24)
    }
    ctx.fillStyle = '#242f2c'
    ctx.fillRect(740, 187, 67, 63)
    ctx.strokeStyle = 'rgba(232, 217, 176, .22)'
    ctx.lineWidth = 2
    for (let y = 142; y < 245; y += 18) {
      ctx.beginPath()
      ctx.moveTo(620, y)
      ctx.lineTo(930, y)
      ctx.stroke()
    }
  }

  const groundShade = ctx.createLinearGradient(0, 280, 0, BASE_HEIGHT)
  groundShade.addColorStop(0, 'rgba(10, 25, 22, 0)')
  groundShade.addColorStop(1, 'rgba(7, 18, 17, .38)')
  ctx.fillStyle = groundShade
  ctx.fillRect(0, 250, BASE_WIDTH, 250)
}

function drawHeadgear(
  ctx: CanvasRenderingContext2D,
  type: HeadgearVisual,
  profile: MilitaryProfile,
  variation: number,
) {
  ctx.fillStyle = profile.coatSecondary
  ctx.strokeStyle = profile.trim
  ctx.lineWidth = 0.75
  if (type === 'bell-shako') {
    ctx.beginPath()
    ctx.moveTo(-4.5, -27)
    ctx.lineTo(-6, -38)
    ctx.lineTo(6, -38)
    ctx.lineTo(4.5, -27)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = profile.trim
    ctx.fillRect(-1, -36, 2, 3)
  } else if (type === 'shako') {
    ctx.fillRect(-5, -36, 10, 9)
    ctx.strokeRect(-5, -36, 10, 9)
  } else if (type === 'forage-cap') {
    ctx.beginPath()
    ctx.ellipse(-1, -30, 6, 3, -0.1, Math.PI, Math.PI * 2)
    ctx.lineTo(5, -27)
    ctx.lineTo(-5, -27)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#161c20'
    ctx.fillRect(2, -28, 5, 1)
  } else if (type === 'turban') {
    ctx.beginPath()
    ctx.ellipse(0, -30, 6.5, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = 'rgba(239, 222, 175, .5)'
    ctx.beginPath()
    ctx.moveTo(-5, -31)
    ctx.quadraticCurveTo(0, -27, 5, -31)
    ctx.stroke()
  } else if (type === 'conical-hat') {
    ctx.beginPath()
    ctx.moveTo(-8, -28)
    ctx.lineTo(0, -39)
    ctx.lineTo(8, -28)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = profile.trim
    ctx.fillRect(-0.6, -43, 1.2, 5)
  } else if (type === 'war-cap') {
    ctx.beginPath()
    ctx.arc(0, -30, 5.5, Math.PI, Math.PI * 2)
    ctx.lineTo(5, -27)
    ctx.lineTo(-5, -27)
    ctx.closePath()
    ctx.fill()
    if (variation > 0.74) {
      ctx.strokeStyle = profile.trim
      ctx.beginPath()
      ctx.moveTo(2, -35)
      ctx.lineTo(6, -42)
      ctx.stroke()
    }
  } else if (type === 'headring') {
    ctx.strokeStyle = '#211a16'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(0, -30, 5.8, Math.PI * 1.05, Math.PI * 1.95)
    ctx.stroke()
  } else if (type === 'headband') {
    ctx.fillStyle = profile.trim
    ctx.fillRect(-5, -31, 10, 2)
    if (variation > 0.86) {
      ctx.strokeStyle = '#d5c8a0'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(3, -31)
      ctx.lineTo(6, -39)
      ctx.stroke()
    }
  } else if (type === 'knit-cap') {
    ctx.beginPath()
    ctx.arc(0, -30, 5.5, Math.PI, Math.PI * 2)
    ctx.lineTo(5, -28)
    ctx.lineTo(-5, -28)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = profile.trim
    ctx.fillRect(-5.5, -29, 11, 1.5)
  } else if (type === 'fez') {
    ctx.fillStyle = '#8d3031'
    ctx.beginPath()
    ctx.moveTo(-4.8, -28)
    ctx.lineTo(-3.5, -36)
    ctx.lineTo(3.5, -36)
    ctx.lineTo(4.8, -28)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#201b19'
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(2.5, -35)
    ctx.quadraticCurveTo(7, -34, 7, -29)
    ctx.stroke()
  } else if (type === 'fur-hat') {
    ctx.fillStyle = '#272421'
    ctx.fillRect(-5.2, -38, 10.4, 11)
    ctx.strokeStyle = '#171513'
    ctx.strokeRect(-5.2, -38, 10.4, 11)
  } else if (type === 'jingasa') {
    ctx.fillStyle = profile.coatSecondary
    ctx.beginPath()
    ctx.moveTo(-8, -28)
    ctx.lineTo(0, -34)
    ctx.lineTo(8, -28)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = profile.trim
    ctx.beginPath()
    ctx.arc(0, -30, 1.4, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(0, -30, 5.7, Math.PI, Math.PI * 2)
    ctx.lineTo(5, -27)
    ctx.lineTo(-5, -27)
    ctx.closePath()
    ctx.fill()
  }
}

function drawWeapon(
  ctx: CanvasRenderingContext2D,
  weapon: WeaponVisual,
  facing: number,
  aiming: boolean,
  profile: MilitaryProfile,
) {
  ctx.save()
  ctx.translate(facing * 4, -16)
  ctx.scale(facing, 1)
  if (['flintlock', 'rifle', 'trade-musket', 'long-dane', 'matchlock'].includes(weapon)) {
    const length = weapon === 'long-dane' ? 29 : 24
    ctx.rotate(aiming ? -0.15 : -0.62)
    ctx.strokeStyle = '#4b3020'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(-4, 3)
    ctx.lineTo(length - 5, 0)
    ctx.stroke()
    ctx.strokeStyle = '#b6aea0'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(5, 1)
    ctx.lineTo(length, -1)
    ctx.stroke()
    ctx.fillStyle = profile.trim
    ctx.fillRect(1, 0, 2, 2)
    if (weapon === 'flintlock' || weapon === 'rifle') {
      ctx.strokeStyle = '#d9d6c6'
      ctx.beginPath()
      ctx.moveTo(length, -1)
      ctx.lineTo(length + 5, -3)
      ctx.stroke()
    }
  } else if (weapon === 'lance') {
    ctx.rotate(-0.18)
    ctx.strokeStyle = '#5d3c25'
    ctx.lineWidth = 1.7
    ctx.beginPath()
    ctx.moveTo(-8, 6)
    ctx.lineTo(34, -4)
    ctx.stroke()
    ctx.fillStyle = '#d8d2bd'
    ctx.beginPath()
    ctx.moveTo(34, -4)
    ctx.lineTo(28, -7)
    ctx.lineTo(29, -1)
    ctx.closePath()
    ctx.fill()
  } else if (weapon === 'iklwa') {
    ctx.strokeStyle = '#5b3924'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(-2, 4)
    ctx.lineTo(15, -4)
    ctx.stroke()
    ctx.fillStyle = '#d8d2bd'
    ctx.beginPath()
    ctx.moveTo(18, -6)
    ctx.lineTo(11, -7)
    ctx.lineTo(14, -1)
    ctx.closePath()
    ctx.fill()
  } else if (weapon === 'bow') {
    ctx.strokeStyle = '#744a2c'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.arc(6, 0, 10, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
    ctx.strokeStyle = '#d8cfb5'
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.moveTo(6, -10)
    ctx.lineTo(6, 10)
    ctx.stroke()
  } else {
    ctx.strokeStyle = '#c9c6b7'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(-3, 6)
    ctx.lineTo(16, -8)
    ctx.stroke()
    ctx.strokeStyle = '#5d3824'
    ctx.beginPath()
    ctx.moveTo(-5, 8)
    ctx.lineTo(0, 3)
    ctx.stroke()
  }
  ctx.restore()
}

function drawShield(ctx: CanvasRenderingContext2D, profile: MilitaryProfile, facing: number, variation: number) {
  if (!profile.shield) return
  ctx.save()
  ctx.translate(facing * 7, -15)
  ctx.fillStyle = variation > 0.55 ? '#d5c9a7' : '#43352b'
  ctx.strokeStyle = '#231d18'
  ctx.lineWidth = 1
  ctx.beginPath()
  if (profile.shield === 'zulu') {
    ctx.ellipse(0, 0, 5.5, 15, 0, 0, Math.PI * 2)
  } else if (profile.shield === 'oval') {
    ctx.ellipse(0, 0, 7, 10, 0, 0, Math.PI * 2)
  } else {
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2)
  }
  ctx.fill()
  ctx.stroke()
  if (profile.shield === 'zulu') {
    ctx.strokeStyle = variation > 0.55 ? '#5a4032' : '#d5c9a7'
    ctx.beginPath()
    ctx.moveTo(0, -13)
    ctx.lineTo(0, 13)
    ctx.stroke()
  }
  ctx.restore()
}

function drawInfantry(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number,
  facing: number,
  profile: MilitaryProfile,
  soldier: SoldierSeed,
  elapsed: number,
  moving: boolean,
  aiming: boolean,
  casualty: boolean,
  effectsEnabled: boolean,
) {
  const bob = moving ? Math.sin(elapsed / 100 + soldier.index * 1.7) * 1.4 : Math.sin(elapsed / 420 + soldier.index) * 0.5
  const deathTwist = casualty ? 1.55 + seeded(soldier.index, 2) * 0.5 : 0
  ctx.save()
  ctx.translate(x, groundY + bob)
  ctx.scale(scale * facing, scale)
  if (casualty) {
    ctx.rotate(facing * deathTwist)
    ctx.translate(seeded(soldier.index, 5) * 8, 16 + seeded(soldier.index, 6) * 6)
  }

  if (casualty && effectsEnabled) {
    drawBloodPool(ctx, 0, 4, soldier.index, 1.2 + seeded(soldier.index, 7) * 0.8)
  }

  ctx.strokeStyle = '#202825'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-2, -10)
  ctx.lineTo(-4, 0)
  ctx.moveTo(2, -10)
  ctx.lineTo(4, 0)
  ctx.stroke()

  ctx.strokeStyle = profile.trousers
  ctx.lineWidth = 2.1
  ctx.beginPath()
  ctx.moveTo(-2, -12)
  ctx.lineTo(-4, -2)
  ctx.moveTo(2, -12)
  ctx.lineTo(4, -2)
  ctx.stroke()

  ctx.fillStyle = soldier.variation > 0.72 ? profile.coatSecondary : profile.coat
  ctx.beginPath()
  ctx.moveTo(-5, -25)
  ctx.lineTo(5, -25)
  ctx.lineTo(6, -11)
  ctx.lineTo(-6, -11)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(15, 25, 23, .55)'
  ctx.lineWidth = 0.8
  ctx.stroke()

  if (casualty || (effectsEnabled && soldier.variation > 0.82)) {
    drawWoundMarks(ctx, facing, soldier.index)
  }

  ctx.strokeStyle = profile.trim
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.moveTo(-4, -24)
  ctx.lineTo(4, -12)
  if (soldier.index % 2 === 0) {
    ctx.moveTo(4, -24)
    ctx.lineTo(-3, -13)
  }
  ctx.stroke()

  ctx.strokeStyle = profile.coat
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-4, -22)
  ctx.lineTo(-8, -14)
  ctx.moveTo(4, -22)
  ctx.lineTo(8, -16)
  ctx.stroke()

  const skin = profile.skinTones[soldier.index % profile.skinTones.length]
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.arc(0, -29, 4.8, 0, Math.PI * 2)
  ctx.fill()
  if (casualty) {
    ctx.fillStyle = 'rgba(140, 20, 16, 0.75)'
    ctx.beginPath()
    ctx.arc(facing * 1.5, -28, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
  drawHeadgear(ctx, profile.headgear, profile, soldier.variation)

  if (!casualty) {
    const weapon = soldier.firearm ? profile.primaryWeapon : profile.secondaryWeapon
    drawWeapon(ctx, weapon, 1, aiming, profile)
    drawShield(ctx, profile, 1, soldier.variation)
  } else {
    // dropped weapon in the mud
    ctx.save()
    ctx.rotate(-0.9)
    ctx.translate(8, 6)
    drawWeapon(ctx, soldier.firearm ? profile.primaryWeapon : profile.secondaryWeapon, 0.85, false, profile)
    ctx.restore()
  }

  ctx.restore()

  if (casualty && effectsEnabled) {
    const sprayPulse = (elapsed / 220 + soldier.index * 0.13) % 1
    if (sprayPulse < 0.35) {
      drawBloodSpray(ctx, x, groundY - 8 * scale, facing, soldier.index, 0.85 + (1 - sprayPulse) * 0.6)
    }
  }
}

function drawMounted(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number,
  facing: number,
  profile: MilitaryProfile,
  soldier: SoldierSeed,
  elapsed: number,
  moving: boolean,
) {
  const gallop = moving ? Math.sin(elapsed / 78 + soldier.index) * 2 : 0
  ctx.save()
  ctx.translate(x, groundY + gallop)
  ctx.scale(scale * facing, scale)
  ctx.fillStyle = soldier.index % 2 ? '#5b4030' : '#332b26'
  ctx.beginPath()
  ctx.ellipse(0, -10, 16, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(11, -14)
  ctx.lineTo(17, -24)
  ctx.lineTo(22, -21)
  ctx.lineTo(17, -10)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#2a2421'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(-9, -5)
  ctx.lineTo(-11 + (moving ? gallop : 0), 4)
  ctx.moveTo(-2, -5)
  ctx.lineTo(0 - (moving ? gallop : 0), 4)
  ctx.moveTo(6, -5)
  ctx.lineTo(9 + (moving ? gallop : 0), 4)
  ctx.moveTo(11, -5)
  ctx.lineTo(14 - (moving ? gallop : 0), 4)
  ctx.stroke()
  ctx.strokeStyle = '#241f1c'
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.moveTo(-15, -12)
  ctx.lineTo(-23, -17)
  ctx.stroke()
  ctx.restore()
  drawInfantry(ctx, x, groundY - 15 * scale, scale * 0.83, facing, profile, soldier, elapsed, moving, false, false, true)
}

function drawSmoke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  life: number,
  facing: number,
  dense: boolean,
) {
  const radius = 5 + life * (dense ? 42 : 24)
  ctx.save()
  ctx.globalAlpha = (1 - life * 0.85) * (dense ? 0.88 : 0.55)
  for (let puff = 0; puff < 7; puff += 1) {
    ctx.fillStyle = puff % 3 === 0 ? '#f0ebe0' : puff % 2 ? '#c5c2b4' : '#8f958c'
    ctx.beginPath()
    ctx.arc(
      x + facing * life * 36 + puff * facing * 7,
      y - life * 22 + Math.sin(puff * 2.4) * 7,
      radius * (0.45 + puff * 0.11),
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
  ctx.restore()
}

function drawMuzzleFlash(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(facing, 1)
  ctx.globalAlpha = 0.95
  ctx.fillStyle = '#ff9a3c'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(22, -8)
  ctx.lineTo(12, 1)
  ctx.lineTo(24, 9)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#fff6c8'
  ctx.beginPath()
  ctx.arc(3, 0, 4.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawBloodSpray(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  seed: number,
  intensity: number,
) {
  ctx.save()
  ctx.globalAlpha = Math.min(1, 0.55 + intensity * 0.45)
  const jets = 5 + Math.floor(seeded(seed, 3) * 5)
  for (let j = 0; j < jets; j += 1) {
    const angle = -1.1 + seeded(seed, j + 4) * 2.2
    const length = 14 + seeded(seed, j + 11) * 38 * intensity
    const ox = Math.cos(angle) * length * facing
    const oy = Math.sin(angle) * length * 0.7 - 4
    ctx.strokeStyle = j % 2 ? '#8b1512' : '#c41e18'
    ctx.lineWidth = 1.4 + seeded(seed, j + 20) * 2.8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + ox * 0.45, y + oy * 0.3 - 8, x + ox, y + oy)
    ctx.stroke()
    ctx.fillStyle = '#a01814'
    ctx.beginPath()
    ctx.arc(x + ox, y + oy, 1.5 + seeded(seed, j + 30) * 3.5, 0, Math.PI * 2)
    ctx.fill()
    for (let d = 0; d < 3; d += 1) {
      ctx.beginPath()
      ctx.arc(
        x + ox * (0.4 + d * 0.2) + (seeded(seed, j + d + 40) - 0.5) * 10,
        y + oy * (0.4 + d * 0.2) + seeded(seed, j + d + 50) * 6,
        1 + d * 0.4,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawBloodPool(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number, size: number) {
  ctx.save()
  ctx.globalAlpha = 0.92
  ctx.fillStyle = '#5a0c0c'
  ctx.beginPath()
  ctx.ellipse(x, y + 3, 10 * size + seeded(seed, 1) * 14, 4 * size + seeded(seed, 2) * 5, seeded(seed, 3) * 0.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#8f1410'
  ctx.beginPath()
  ctx.ellipse(x - 2, y + 2, 6 * size + seeded(seed, 4) * 8, 2.5 * size, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#c21a14'
  ctx.beginPath()
  ctx.ellipse(x + 3, y + 1, 3.5 * size, 1.6 * size, 0.4, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 6; i += 1) {
    ctx.fillStyle = i % 2 ? '#7a1210' : '#a81612'
    ctx.beginPath()
    ctx.arc(
      x + (seeded(seed, i + 10) - 0.5) * 28 * size,
      y + 2 + (seeded(seed, i + 20) - 0.5) * 10,
      1.2 + seeded(seed, i + 30) * 2.8,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
  ctx.restore()
}

function drawWoundMarks(ctx: CanvasRenderingContext2D, facing: number, seed: number) {
  ctx.save()
  ctx.globalAlpha = 0.95
  ctx.fillStyle = '#9c1510'
  ctx.beginPath()
  ctx.ellipse(facing * 2, -18, 2.2, 3.5, 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#6a0e0c'
  ctx.beginPath()
  ctx.ellipse(facing * -1, -14, 1.6, 2.4, -0.3, 0, Math.PI * 2)
  ctx.fill()
  if (seeded(seed, 9) > 0.45) {
    ctx.strokeStyle = '#b81814'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(facing * 3, -22)
    ctx.lineTo(facing * 8, -8)
    ctx.stroke()
  }
  ctx.restore()
}

function drawMeleeClash(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  intensity: number,
) {
  if (intensity <= 0.05) return
  const centerX = 500
  ctx.save()
  // churned mud / blood strip where lines meet
  ctx.globalAlpha = 0.75 * intensity
  const strip = ctx.createLinearGradient(centerX - 120, 0, centerX + 120, 0)
  strip.addColorStop(0, 'rgba(90, 12, 12, 0)')
  strip.addColorStop(0.35, 'rgba(110, 14, 12, 0.55)')
  strip.addColorStop(0.5, 'rgba(140, 18, 14, 0.7)')
  strip.addColorStop(0.65, 'rgba(110, 14, 12, 0.55)')
  strip.addColorStop(1, 'rgba(90, 12, 12, 0)')
  ctx.fillStyle = strip
  ctx.fillRect(centerX - 130, 300, 260, 160)

  for (let i = 0; i < Math.floor(28 * intensity); i += 1) {
    const x = centerX - 110 + seeded(i, 70) * 220
    const y = 320 + seeded(i, 71) * 130
    drawBloodPool(ctx, x, y, i + 200, 0.7 + seeded(i, 72) * 1.1)
    if (seeded(i, 73) > 0.55) {
      const pulse = (elapsed / 180 + i * 0.7) % 1
      if (pulse < 0.45) {
        drawBloodSpray(ctx, x, y - 18, seeded(i, 74) > 0.5 ? 1 : -1, i, 0.7 + pulse)
      }
    }
  }

  // impact flashes / steel sparks in the scrum
  for (let i = 0; i < 10; i += 1) {
    const flash = (elapsed / 140 + i * 1.3) % 1
    if (flash > 0.12) continue
    const x = centerX - 80 + seeded(i, 80) * 160
    const y = 310 + seeded(i, 81) * 100
    ctx.globalAlpha = (1 - flash / 0.12) * 0.85
    ctx.fillStyle = '#ffe6a0'
    ctx.beginPath()
    ctx.arc(x, y, 3 + seeded(i, 82) * 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#c41e18'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x - 8, y)
    ctx.lineTo(x + 8, y - 4)
    ctx.stroke()
  }
  ctx.restore()
}

function drawBattleSmokeBank(ctx: CanvasRenderingContext2D, elapsed: number, intensity: number) {
  if (intensity <= 0) return
  ctx.save()
  for (let i = 0; i < 18; i += 1) {
    const drift = ((elapsed / 40 + i * 37) % 280) - 40
    const x = 280 + (i % 6) * 75 + Math.sin(elapsed / 600 + i) * 12
    const y = 250 + Math.floor(i / 6) * 45 + Math.cos(elapsed / 500 + i) * 8
    ctx.globalAlpha = 0.28 * intensity + seeded(i, 90) * 0.22
    ctx.fillStyle = i % 2 ? '#d9d4c6' : '#9ea49a'
    ctx.beginPath()
    ctx.ellipse(x + drift * 0.15, y, 38 + seeded(i, 91) * 40, 18 + seeded(i, 92) * 16, 0.2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawBloodDecals(ctx: CanvasRenderingContext2D, count: number, intensity: number) {
  ctx.save()
  for (let i = 0; i < count; i += 1) {
    const x = 260 + seeded(i, 51) * 480
    const y = 300 + seeded(i, 52) * 170
    drawBloodPool(ctx, x, y, i, 0.85 + intensity * seeded(i, 53) * 1.4)
    if (intensity > 0.4 && seeded(i, 56) > 0.4) {
      drawBloodSpray(ctx, x, y - 10, seeded(i, 57) > 0.5 ? 1 : -1, i + 50, intensity * 0.8)
    }
  }
  ctx.restore()
}

function drawGunCrew(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  profile: MilitaryProfile,
  index: number,
  working: boolean,
) {
  const bend = working ? Math.sin(index * 2.4) * 2 : 0
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = profile.trousers
  ctx.fillRect(-2, -8, 2, 9)
  ctx.fillRect(2, -8, 2, 9)
  ctx.fillStyle = index % 2 ? profile.coatSecondary : profile.coat
  ctx.beginPath()
  ctx.moveTo(-5, -21 + bend)
  ctx.lineTo(5, -21 + bend)
  ctx.lineTo(6, -8)
  ctx.lineTo(-6, -8)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = profile.trim
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-4, -19 + bend)
  ctx.lineTo(4, -10)
  ctx.stroke()
  ctx.fillStyle = profile.skinTones[index % profile.skinTones.length]
  ctx.beginPath()
  ctx.arc(0, -25 + bend, 4.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.scale(0.82, 0.82)
  drawHeadgear(ctx, profile.headgear, profile, seeded(index, 77))
  ctx.restore()
}

function drawCannon(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  facing: number,
  profile: MilitaryProfile,
  index: number,
  elapsed: number,
  phase: ScenePhase,
  effectsEnabled: boolean,
) {
  const fireCycle = (elapsed / 2300 + index * 0.23 + (facing > 0 ? 0 : 0.4)) % 1
  const firing = phase === 'engaging' && fireCycle < 0.06
  const recoil = firing ? 8 * (1 - fireCycle / 0.06) : 0

  ctx.save()
  ctx.translate(x - facing * recoil, groundY)
  ctx.scale(facing, 1)

  ctx.strokeStyle = '#332b24'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(-14, -5)
  ctx.lineTo(-25, 5)
  ctx.moveTo(-8, -5)
  ctx.lineTo(-16, 8)
  ctx.stroke()

  ctx.fillStyle = '#5b3a23'
  ctx.beginPath()
  ctx.moveTo(-17, -9)
  ctx.lineTo(10, -8)
  ctx.lineTo(13, 0)
  ctx.lineTo(-20, 0)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#2b211b'
  ctx.lineWidth = 1.2
  ctx.stroke()

  for (const wheelX of [-11, 7]) {
    ctx.fillStyle = '#4a3121'
    ctx.strokeStyle = '#231c18'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(wheelX, 0, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = '#8b6a42'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(wheelX - 7, 0)
    ctx.lineTo(wheelX + 7, 0)
    ctx.moveTo(wheelX, -7)
    ctx.lineTo(wheelX, 7)
    ctx.stroke()
  }

  ctx.strokeStyle = '#20282a'
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(3, -12)
  ctx.lineTo(35, -15)
  ctx.stroke()
  ctx.strokeStyle = '#687171'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(4, -15)
  ctx.lineTo(35, -18)
  ctx.stroke()
  ctx.fillStyle = '#161d1e'
  ctx.beginPath()
  ctx.ellipse(36, -15, 3.5, 5.4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  drawGunCrew(ctx, x - facing * 21, groundY - 2, profile, index * 3, phase === 'engaging')
  drawGunCrew(ctx, x - facing * 5, groundY - 12, profile, index * 3 + 1, phase === 'engaging')
  drawGunCrew(ctx, x + facing * 13, groundY - 1, profile, index * 3 + 2, phase === 'engaging')

  if (effectsEnabled && phase === 'engaging') {
    const muzzleX = x + facing * (36 - recoil)
    const muzzleY = groundY - 15
    if (fireCycle < 0.44) {
      drawSmoke(ctx, muzzleX, muzzleY, fireCycle / 0.44, facing, true)
      if (fireCycle < 0.035) drawMuzzleFlash(ctx, muzzleX, muzzleY, facing)
    }
    if (fireCycle > 0.06 && fireCycle < 0.32) {
      const travel = (fireCycle - 0.06) / 0.26
      const ballX = muzzleX + facing * travel * 330
      const ballY = muzzleY - Math.sin(travel * Math.PI) * 34
      ctx.fillStyle = '#171b1b'
      ctx.beginPath()
      ctx.arc(ballX, ballY, 2.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(221, 211, 185, .25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(ballX - facing * 15, ballY + 2)
      ctx.lineTo(ballX, ballY)
      ctx.stroke()
    }
  }
}

function drawArtilleryBattery(
  ctx: CanvasRenderingContext2D,
  profile: MilitaryProfile,
  side: 'player' | 'opponent',
  elapsed: number,
  phase: ScenePhase,
  effectsEnabled: boolean,
) {
  const count = artilleryCount(profile)
  if (!count) return
  const facing = side === 'player' ? 1 : -1
  const baseX = side === 'player' ? 384 : 616
  for (let gun = 0; gun < count; gun += 1) {
    const y = 245 + gun * (count >= 4 ? 43 : 65)
    drawCannon(ctx, baseX, y, facing, profile, gun, elapsed, phase, effectsEnabled)
  }
}

function drawRegimentalStandard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: number,
  profile: MilitaryProfile,
  elapsed: number,
) {
  const wave = Math.sin(elapsed / 280) * 2
  ctx.strokeStyle = '#3d2e20'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y - 54)
  ctx.stroke()
  ctx.fillStyle = profile.coat
  ctx.strokeStyle = profile.trim
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y - 52)
  ctx.quadraticCurveTo(x + facing * 15, y - 58 + wave, x + facing * 29, y - 50)
  ctx.lineTo(x + facing * 28, y - 32)
  ctx.quadraticCurveTo(x + facing * 14, y - 38 + wave, x, y - 34)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawFormation(
  ctx: CanvasRenderingContext2D,
  soldiers: SoldierSeed[],
  profile: MilitaryProfile,
  side: 'player' | 'opponent',
  elapsed: number,
  phase: ScenePhase,
  plan: BattlePlan,
  effectsEnabled: boolean,
) {
  const facing = side === 'player' ? 1 : -1
  const phaseProgress = phase === 'engaging' ? Math.min(1, elapsed / 4800) : 0
  const baseX = side === 'player' ? 62 : 938
  const direction = side === 'player' ? 1 : -1
  const isZulu = profile.factionId === 'zulu'
  const mountedCount = soldiers.filter((soldier) => soldier.mounted).length
  const meleeRush = profile.firearmRatio < 0.45
  // Fall often — this is a meat grinder, not a parade
  const casualtyMod =
    side === 'opponent' && meleeRush ? 5 : side === 'player' && meleeRush ? 7 : side === 'player' ? 9 : 6

  const positioned = soldiers.map((soldier) => {
    let columnDepth = 0
    let groundY = 0
    let scale = 0.6

    if (isZulu && soldier.index >= 120) {
      const hornIndex = soldier.index - 120
      const wing = hornIndex < 30 ? -1 : 1
      const indexInWing = hornIndex % 30
      const hornRank = Math.floor(indexInWing / 10)
      const hornColumn = indexInWing % 10
      columnDepth = 250 + hornColumn * 10 + hornRank * 12
      groundY = 350 + wing * (64 + hornRank * 28 + hornColumn * 2.1)
      scale = 0.55 + hornRank * 0.05
    } else if (isZulu) {
      const centerRow = Math.floor(soldier.index / 24)
      const centerColumn = soldier.index % 24
      columnDepth = centerColumn * 12
      groundY = 296 + centerRow * 31
      scale = 0.52 + centerRow * 0.055
    } else if (soldier.mounted) {
      const wing = soldier.index % 2 === 0 ? -1 : 1
      const wingIndex = Math.floor(soldier.index / 2)
      const wingRow = Math.floor(wingIndex / 20)
      const wingColumn = wingIndex % 20
      columnDepth = wingColumn * 13
      groundY = 352 + wing * (70 + wingRow * 31)
      scale = 0.56 + wingRow * 0.05
    } else {
      const footIndex = soldier.index - mountedCount
      const footRow = Math.max(0, Math.floor(footIndex / FORMATION_COLUMNS))
      const footColumn = ((footIndex % FORMATION_COLUMNS) + FORMATION_COLUMNS) % FORMATION_COLUMNS
      columnDepth = footColumn * 9.6
      groundY = 292 + footRow * 28
      scale = 0.48 + footRow * 0.052
    }

    // Drive both sides into a brutal midfield scrum
    const rowAdvance = isZulu
      ? phaseProgress * (plan === 'advance' ? 310 : 265)
      : meleeRush
        ? phaseProgress * (plan === 'advance' ? 290 : 250)
        : phaseProgress * (side === 'player' ? (plan === 'advance' ? 250 : 210) : 230)
    const wingSurge = isZulu && soldier.index >= 120 ? phaseProgress * 64 : 0
    const x = baseX + direction * (columnDepth + rowAdvance + wingSurge)

    return { soldier, x, groundY, scale }
  })

  positioned
    .sort((left, right) => left.groundY - right.groundY)
    .forEach(({ soldier, x, groundY, scale }) => {
      const hitWave = phase === 'engaging' && phaseProgress > 0.22
      const earlyHits = hitWave && ((soldier.index + side.length) % (casualtyMod + 4) === 0) && phaseProgress > 0.28
      const lateHits = hitWave && ((soldier.index + (side === 'player' ? 3 : 1)) % casualtyMod === 0) && phaseProgress > 0.4
      const meleeKill =
        hitWave &&
        phaseProgress > 0.55 &&
        Math.abs(x - 500) < 130 &&
        ((soldier.index * 7) % 4 === 0)
      const casualty = earlyHits || lateHits || meleeKill
      const volleyCycle =
        (elapsed / 1450 + soldier.row * 0.1 + soldier.column * 0.002 + (side === 'player' ? 0 : 0.48)) % 1
      const aiming = phase === 'engaging' && soldier.firearm && !casualty && (volleyCycle < 0.18 || volleyCycle > 0.72)
      const moving =
        phase === 'engaging' &&
        phaseProgress < 0.92 &&
        !casualty &&
        (isZulu || meleeRush || soldier.mounted || elapsed > 900) &&
        !aiming

      if (casualty && effectsEnabled) {
        drawBloodPool(ctx, x, groundY + 2, soldier.index, 1.1 + seeded(soldier.index, 12) * 0.9)
      }

      ctx.fillStyle = 'rgba(5, 15, 13, .32)'
      ctx.beginPath()
      ctx.ellipse(x, groundY + 2, soldier.mounted ? 15 : 6, soldier.mounted ? 4 : 2.5, 0, 0, Math.PI * 2)
      ctx.fill()

      if (soldier.mounted && !casualty) {
        drawMounted(ctx, x, groundY, scale, facing, profile, soldier, elapsed, moving)
      } else {
        drawInfantry(ctx, x, groundY, scale, facing, profile, soldier, elapsed, moving, aiming, casualty, effectsEnabled)
      }

      if (effectsEnabled && !casualty && phase === 'engaging' && phaseProgress > 0.5 && Math.abs(x - 500) < 90) {
        // bayonet / spear impact spurts in the scrum
        const clashPulse = (elapsed / 160 + soldier.index * 0.19) % 1
        if (clashPulse < 0.2) {
          drawBloodSpray(ctx, x + facing * 6, groundY - 16 * scale, facing, soldier.index + 99, 1)
        }
      }

      if (effectsEnabled && soldier.firearm && !casualty) {
        const shotCycle =
          phase === 'engaging'
            ? volleyCycle
            : (elapsed / 6200 + soldier.index * 0.071 + (side === 'player' ? 0 : 0.43)) % 1
        if (shotCycle < 0.4 && (phase === 'engaging' || soldier.index % 12 === 0)) {
          const muzzleX = x + facing * 18 * scale
          const muzzleY = groundY - 20 * scale
          drawSmoke(ctx, muzzleX, muzzleY, shotCycle / 0.4, facing, true)
          if (shotCycle < 0.05 && phase === 'engaging') drawMuzzleFlash(ctx, muzzleX, muzzleY, facing)
          // ball impact blood on the opposite direction occasionally
          if (phase === 'engaging' && shotCycle < 0.08 && soldier.index % 5 === 0) {
            drawBloodSpray(ctx, x + facing * 40, groundY - 18, facing, soldier.index + 3, 0.7)
          }
        }
      }
    })

  const standardY = isZulu ? 366 : 316
  const standardX = baseX + direction * (isZulu ? 145 : 135) + direction * phaseProgress * 160
  drawRegimentalStandard(ctx, standardX, standardY, facing, profile, elapsed)
}

export function BattlefieldScene({
  region,
  playerFactionId,
  plan,
  phase,
  effectsEnabled,
}: BattlefieldSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapKind = useMemo(() => getBattleMapKind(region), [region])
  const playerProfile = useMemo(() => getMilitaryProfile(playerFactionId), [playerFactionId])
  const opponentProfile = useMemo(() => getMilitaryProfile(region.owner), [region.owner])
  const playerSoldiers = useMemo(() => makeSoldiers(playerProfile, 1), [playerProfile])
  const opponentSoldiers = useMemo(() => makeSoldiers(opponentProfile, 2), [opponentProfile])
  const savageClash = playerProfile.firearmRatio > 0.85 && opponentProfile.firearmRatio < 0.55

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let animationFrame = 0
    let sceneStart = performance.now()
    let width = 0
    let height = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform((width / BASE_WIDTH) * ratio, 0, 0, (height / BASE_HEIGHT) * ratio, 0, 0)
      sceneStart = performance.now()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const draw = (time: number) => {
      const elapsed = reducedMotion ? 2200 : time - sceneStart
      const engageProgress = phase === 'engaging' ? Math.min(1, elapsed / 4800) : 0
      context.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT)
      drawMap(context, mapKind, elapsed)

      if (effectsEnabled) {
        const goreBoost = savageClash ? 1.35 : 1
        const bloodCount = Math.floor(
          (phase === 'engaging' ? 70 + Math.floor(engageProgress * 55) : 14) * goreBoost,
        )
        drawBloodDecals(context, bloodCount, phase === 'engaging' ? Math.min(1, 0.5 + engageProgress) : 0.6)
        drawBattleSmokeBank(context, elapsed, phase === 'engaging' ? 0.6 + engageProgress * 0.5 : 0.18)
      }

      drawFormation(context, opponentSoldiers, opponentProfile, 'opponent', elapsed, phase, plan, effectsEnabled)
      drawArtilleryBattery(context, opponentProfile, 'opponent', elapsed, phase, effectsEnabled)
      drawFormation(context, playerSoldiers, playerProfile, 'player', elapsed, phase, plan, effectsEnabled)
      drawArtilleryBattery(context, playerProfile, 'player', elapsed, phase, effectsEnabled)

      if (effectsEnabled && phase === 'engaging') {
        drawMeleeClash(context, elapsed, Math.max(0, (engageProgress - 0.35) / 0.65))
        // lingering powder fog over the kill zone
        drawBattleSmokeBank(context, elapsed + 400, 0.35 + engageProgress * 0.5)
      }

      const vignette = context.createRadialGradient(500, 270, 140, 500, 270, 620)
      vignette.addColorStop(0, 'rgba(5, 13, 13, 0)')
      vignette.addColorStop(0.7, 'rgba(20, 4, 4, .18)')
      vignette.addColorStop(1, 'rgba(3, 8, 8, .62)')
      context.fillStyle = vignette
      context.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT)

      if (!reducedMotion) animationFrame = requestAnimationFrame(draw)
    }

    animationFrame = requestAnimationFrame(draw)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(animationFrame)
    }
  }, [
    effectsEnabled,
    mapKind,
    opponentProfile,
    opponentSoldiers,
    phase,
    plan,
    playerProfile,
    playerSoldiers,
    savageClash,
  ])

  const sceneStatus =
    phase === 'engaging'
      ? 'Powder smoke · bayonet scrum · the field runs red'
      : phase === 'parley'
        ? 'Delegations moving to neutral ground'
        : 'Forces deployed · awaiting orders'

  return (
    <div className={`battle-scene battle-scene--${mapKind} battle-scene--${phase}`}>
      <canvas ref={canvasRef} className="battle-scene__canvas" aria-hidden="true" />
      <div className="battle-scene__topline">
        <span>{battleMapDetails[mapKind].name}</span>
        <small>{battleMapDetails[mapKind].condition}</small>
      </div>
      <div className="battle-scene__status" role="status" aria-live="polite">
        <i className={phase === 'engaging' ? 'is-live' : ''} />
        {sceneStatus}
      </div>
      <div className="battle-scene__count">
        <span>{SOLDIERS_PER_SIDE * 2}</span> rendered soldiers
        <b> · {artilleryCount(playerProfile) + artilleryCount(opponentProfile)} field guns</b>
      </div>
      <div className={`battle-scene__phases ${phase === 'engaging' ? 'is-live' : ''}`} aria-hidden="true">
        <span>DEPLOY</span>
        <span>ARTILLERY</span>
        <span>VOLLEYS</span>
        <span>CHARGE</span>
        <i />
      </div>
      <div className="battle-scene__formation battle-scene__formation--player">
        {playerProfile.factionId === 'zulu'
          ? '6 amabutho · horns formation'
          : `${artilleryCount(playerProfile) || 'No'} guns · ${Math.round(playerProfile.firearmRatio * 100)}% firearms`}
      </div>
      <div className="battle-scene__formation battle-scene__formation--opponent">
        {opponentProfile.factionId === 'zulu'
          ? '6 amabutho · shield & iklwa'
          : `${artilleryCount(opponentProfile) || 'No'} guns · ${Math.round(opponentProfile.firearmRatio * 100)}% firearms`}
      </div>
      <div className="battle-scene__faction battle-scene__faction--player">
        <i style={{ background: factions[playerFactionId]?.color }} />
        {factions[playerFactionId]?.shortName}
      </div>
      <div className="battle-scene__faction battle-scene__faction--opponent">
        {factions[region.owner]?.shortName}
        <i style={{ background: factions[region.owner]?.color }} />
      </div>
    </div>
  )
}
