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

const SOLDIERS_PER_SIDE = 48
const BASE_WIDTH = 1000
const BASE_HEIGHT = 500

function seeded(index: number, salt = 0) {
  const value = Math.sin(index * 91.173 + salt * 47.77) * 43758.5453
  return value - Math.floor(value)
}

function makeSoldiers(profile: MilitaryProfile, sideSalt: number): SoldierSeed[] {
  return Array.from({ length: SOLDIERS_PER_SIDE }, (_, index) => {
    const row = Math.floor(index / 12)
    return {
      index,
      row,
      column: index % 12,
      variation: seeded(index, sideSalt),
      mounted: profile.mountedRatio > 0.22 && index % 3 === sideSalt % 3,
      firearm: seeded(index, sideSalt + 8) <= profile.firearmRatio,
    }
  })
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
  casualty: boolean,
) {
  const bob = moving ? Math.sin(elapsed / 100 + soldier.index * 1.7) * 1.4 : Math.sin(elapsed / 420 + soldier.index) * 0.5
  ctx.save()
  ctx.translate(x, groundY + bob)
  ctx.scale(scale * facing, scale)
  if (casualty) {
    ctx.rotate(facing * 1.35)
    ctx.translate(0, 13)
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
  drawHeadgear(ctx, profile.headgear, profile, soldier.variation)

  const weapon = soldier.firearm ? profile.primaryWeapon : profile.secondaryWeapon
  drawWeapon(ctx, weapon, 1, moving, profile)
  drawShield(ctx, profile, 1, soldier.variation)

  ctx.restore()
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
  drawInfantry(ctx, x, groundY - 15 * scale, scale * 0.83, facing, profile, soldier, elapsed, moving, false)
}

function drawSmoke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  life: number,
  facing: number,
  dense: boolean,
) {
  const radius = 3 + life * (dense ? 28 : 18)
  ctx.save()
  ctx.globalAlpha = (1 - life) * (dense ? 0.62 : 0.34)
  for (let puff = 0; puff < 4; puff += 1) {
    ctx.fillStyle = puff % 2 ? '#d8d5c4' : '#aeb4a9'
    ctx.beginPath()
    ctx.arc(x + facing * life * 24 + puff * facing * 5, y - life * 17 + Math.sin(puff * 3.1) * 4, radius * (0.55 + puff * 0.12), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawMuzzleFlash(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(facing, 1)
  ctx.fillStyle = '#ffd47b'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(16, -5)
  ctx.lineTo(10, 1)
  ctx.lineTo(17, 6)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#fff1b0'
  ctx.beginPath()
  ctx.arc(2, 0, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawBloodDecals(ctx: CanvasRenderingContext2D, count: number, intensity: number) {
  ctx.save()
  ctx.globalAlpha = 0.45 * intensity
  for (let i = 0; i < count; i += 1) {
    const x = 395 + seeded(i, 51) * 225
    const y = 360 + seeded(i, 52) * 120
    ctx.fillStyle = i % 2 ? '#5f1716' : '#741b18'
    ctx.beginPath()
    ctx.ellipse(x, y, 5 + seeded(i, 53) * 11, 2 + seeded(i, 54) * 5, seeded(i, 55) * Math.PI, 0, Math.PI * 2)
    ctx.fill()
    for (let drop = 0; drop < 3; drop += 1) {
      ctx.beginPath()
      ctx.arc(x + (seeded(i + drop, 57) - 0.5) * 26, y + (seeded(i + drop, 58) - 0.5) * 12, 1.2 + drop * 0.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
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
  const phaseProgress = phase === 'engaging' ? Math.min(1, elapsed / 3800) : 0
  const baseX = side === 'player' ? 92 : 908
  const direction = side === 'player' ? 1 : -1

  soldiers
    .slice()
    .sort((a, b) => a.row - b.row)
    .forEach((soldier) => {
      const rowSpread = plan === 'adapt' && soldier.row < 2 ? 18 : 0
      const columnDepth = soldier.column * 22
      const flank = plan === 'adapt' ? (soldier.row % 2 ? 1 : -1) * phaseProgress * 26 : 0
      const advance = phase === 'engaging'
        ? phaseProgress * (side === 'player' ? (plan === 'advance' ? 185 : 135) : 105)
        : 0
      const x = baseX + direction * columnDepth + direction * advance + flank
      const groundY = 305 + soldier.row * 43 + (soldier.column % 2) * 2 + rowSpread
      const scale = 0.64 + soldier.row * 0.095
      const casualty =
        phase === 'engaging' &&
        phaseProgress > 0.52 &&
        ((soldier.index + (side === 'player' ? 2 : 0)) % (side === 'player' ? 13 : 11) === 0)
      const moving = phase === 'engaging' && phaseProgress < 0.82

      ctx.fillStyle = 'rgba(5, 15, 13, .32)'
      ctx.beginPath()
      ctx.ellipse(x, groundY + 2, soldier.mounted ? 15 : 6, soldier.mounted ? 4 : 2.5, 0, 0, Math.PI * 2)
      ctx.fill()

      if (soldier.mounted && !casualty) {
        drawMounted(ctx, x, groundY, scale, facing, profile, soldier, elapsed, moving)
      } else {
        drawInfantry(ctx, x, groundY, scale, facing, profile, soldier, elapsed, moving, casualty)
      }

      if (effectsEnabled && soldier.firearm && !casualty) {
        const shotCycle = (elapsed / (phase === 'engaging' ? 1050 : 5200) + soldier.index * 0.173 + (side === 'player' ? 0 : 0.43)) % 1
        if (shotCycle < 0.38 && (phase === 'engaging' || soldier.index % 8 === 0)) {
          const muzzleX = x + facing * 18 * scale
          const muzzleY = groundY - 20 * scale
          drawSmoke(ctx, muzzleX, muzzleY, shotCycle / 0.38, facing, phase === 'engaging')
          if (shotCycle < 0.035 && phase === 'engaging') drawMuzzleFlash(ctx, muzzleX, muzzleY, facing)
        }
      }
    })
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
      const elapsed = reducedMotion ? 900 : time - sceneStart
      context.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT)
      drawMap(context, mapKind, elapsed)

      if (effectsEnabled) {
        drawBloodDecals(context, phase === 'engaging' ? 9 : 3, phase === 'engaging' ? Math.min(1, elapsed / 1700) : 0.35)
      }

      drawFormation(context, opponentSoldiers, opponentProfile, 'opponent', elapsed, phase, plan, effectsEnabled)
      drawFormation(context, playerSoldiers, playerProfile, 'player', elapsed, phase, plan, effectsEnabled)

      const vignette = context.createRadialGradient(500, 270, 170, 500, 270, 620)
      vignette.addColorStop(0, 'rgba(5, 13, 13, 0)')
      vignette.addColorStop(1, 'rgba(3, 10, 10, .52)')
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
  ])

  const sceneStatus =
    phase === 'engaging'
      ? 'Volleys exchanged · formations advancing'
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
        <span>{SOLDIERS_PER_SIDE * 2}</span> animated soldiers
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
