import React, { useEffect, useRef, useState, useCallback } from 'react'

export type CreatureType = 'jellyfish' | 'dragonfly'

interface AsciiCanvasProps {
  creatureType: CreatureType
  onCreatureChange?: (type: CreatureType) => void
  interactive?: boolean
  className?: string
  showControls?: boolean
}

interface Particle {
  ox: number
  oy: number
  char: string
  color: string
  glowColor: string
  curX: number
  curY: number
  vx: number
  vy: number
  alpha: number
  size: number
}

interface TentacleSegment {
  x: number
  y: number
  vx: number
  vy: number
  char: string
  alpha: number
}

interface Creature {
  id: number
  type: CreatureType
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  targetAngle: number
  targetX: number
  targetY: number
  phase: number
  hoverTimer: number
  speed: number
  scale: number
  colorTheme: {
    primary: string
    secondary: string
    highlight: string
    glow: string
  }
  particles: Particle[]
  tentacles?: TentacleSegment[][]
}

interface Star {
  x: number
  y: number
  char: string
  speed: number
  alpha: number
  baseAlpha: number
  phase: number
}

interface Ripple {
  x: number
  y: number
  radius: number
  maxRadius: number
  force: number
}

const STAR_GLYPHS = ['.', '·', '°', '+', '*', ':', '~', "'"]

export const AsciiCanvas: React.FC<AsciiCanvasProps> = ({
  creatureType,
  onCreatureChange,
  interactive = true,
  className = '',
  showControls = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const creaturesRef = useRef<Creature[]>([])
  const starsRef = useRef<Star[]>([])
  const ripplesRef = useRef<Ripple[]>([])
  const mouseRef = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 })

  const [tweakMenuOpen, setTweakMenuOpen] = useState(false)
  const [creatureCount, setCreatureCount] = useState(4)
  // Serene, slow speed by default
  const [speedMultiplier, setSpeedMultiplier] = useState(0.55)
  const [isPaused, setIsPaused] = useState(false)

  // Creature Themes
  const getTheme = (type: CreatureType) => {
    if (type === 'jellyfish') {
      return {
        primary: '#e879f9', // Pink / Fuchsia
        secondary: '#c084fc', // Purple
        highlight: '#fdf2f8', // Soft white / pink apex
        glow: 'rgba(232, 121, 249, 0.65)',
      }
    } else {
      return {
        primary: '#10b981', // Emerald green
        secondary: '#34d399', // Mint / lime
        highlight: '#ecfdf5', // Bright eye highlight
        glow: 'rgba(16, 185, 129, 0.65)',
      }
    }
  }

  // ==========================================
  // 1. REALISTIC JELLYFISH GEOMETRY
  // Forward along +X (bell apex), tentacles trail at -X
  // ==========================================
  const buildJellyfish = (scale: number, theme: ReturnType<typeof getTheme>) => {
    const particles: Particle[] = []
    const bellRadius = 26 * scale
    const bellHeight = 22 * scale

    // Realistic Umbrella Dome (semi-elliptical cap)
    const rows = 12
    for (let r = 0; r <= rows; r++) {
      // x from apex (bellHeight) to margin (0)
      const x = (1 - r / rows) * bellHeight
      const normalizedHeight = r / rows
      // Elliptical width
      const halfWidth = Math.sqrt(Math.max(0, 1 - Math.pow(1 - normalizedHeight, 2.2))) * bellRadius
      const cols = Math.max(1, Math.floor(halfWidth / (3.2 * scale)))

      for (let c = -cols; c <= cols; c++) {
        const y = (c / cols) * halfWidth
        const normDistFromCenter = Math.abs(c / cols)

        let char = '#'
        let color = theme.primary
        let alpha = 0.88 - normDistFromCenter * 0.2

        if (r === 0) {
          // Apex curve
          char = normDistFromCenter < 0.3 ? '^' : '.'
          color = theme.highlight
          alpha = 0.95
        } else if (r <= 3) {
          // Top dome highlight
          char = normDistFromCenter < 0.4 ? '@' : normDistFromCenter < 0.8 ? '8' : '*'
          color = normDistFromCenter < 0.3 ? theme.highlight : theme.primary
        } else if (r >= rows - 1) {
          // Scalloped bottom rim
          char = Math.abs(c) % 2 === 0 ? 'v' : '~'
          color = theme.secondary
          alpha = 0.92
        } else {
          // Bell body
          char = normDistFromCenter < 0.5 ? '8' : normDistFromCenter < 0.8 ? '%' : '+'
          color = normDistFromCenter < 0.4 ? theme.primary : theme.secondary
        }

        particles.push({
          ox: x,
          oy: y,
          char,
          color,
          glowColor: theme.glow,
          curX: x,
          curY: y,
          vx: 0,
          vy: 0,
          alpha,
          size: 11 * scale,
        })
      }
    }

    // Oral Arms (Frilled central feeding ribbons under the bell)
    for (let arm = -1; arm <= 1; arm++) {
      const armY = arm * 4 * scale
      for (let s = 1; s <= 7; s++) {
        const x = -s * 2.8 * scale
        const char = s % 2 === 0 ? '&' : 'S'
        particles.push({
          ox: x,
          oy: armY + Math.sin(s * 0.8) * 2 * scale,
          char,
          color: theme.secondary,
          glowColor: theme.glow,
          curX: x,
          curY: armY,
          vx: 0,
          vy: 0,
          alpha: 0.75 - (s / 7) * 0.3,
          size: 10 * scale,
        })
      }
    }

    // Peripheral Tentacles (Flowing long trails from bell margin)
    const numTentacles = 8
    const tentacles: TentacleSegment[][] = []
    const spacing = (bellRadius * 1.8) / (numTentacles - 1)

    for (let t = 0; t < numTentacles; t++) {
      const strand: TentacleSegment[] = []
      const startY = -bellRadius * 0.9 + t * spacing
      const length = 18 + Math.floor(Math.random() * 8)

      for (let seg = 0; seg < length; seg++) {
        const char = seg === 0 ? '~' : seg % 2 === 0 ? '|' : (seg % 3 === 0 ? 's' : '.')
        strand.push({
          x: -seg * 4.8 * scale,
          y: startY,
          vx: 0,
          vy: 0,
          char,
          alpha: Math.max(0.15, 0.85 - (seg / length) * 0.65),
        })
      }
      tentacles.push(strand)
    }

    return { particles, tentacles }
  }

  // ==========================================
  // 2. REALISTIC DRAGONFLY GEOMETRY
  // Forward along +X (head & compound eyes), tail trails at -X
  // ==========================================
  const buildDragonfly = (scale: number, theme: ReturnType<typeof getTheme>) => {
    const particles: Particle[] = []

    // A. Head & Big Compound Eyes
    // Left Compound Eye
    particles.push(
      { ox: 14 * scale, oy: -4.5 * scale, char: '[', color: theme.highlight, glowColor: theme.glow, curX: 14 * scale, curY: -4.5 * scale, vx: 0, vy: 0, alpha: 0.95, size: 11 * scale },
      { ox: 14 * scale, oy: -3.0 * scale, char: 'O', color: theme.highlight, glowColor: theme.glow, curX: 14 * scale, curY: -3.0 * scale, vx: 0, vy: 0, alpha: 1.0, size: 12 * scale },
      { ox: 14 * scale, oy: -1.5 * scale, char: ']', color: theme.highlight, glowColor: theme.glow, curX: 14 * scale, curY: -1.5 * scale, vx: 0, vy: 0, alpha: 0.95, size: 11 * scale }
    )
    // Right Compound Eye
    particles.push(
      { ox: 14 * scale, oy: 1.5 * scale, char: '[', color: theme.highlight, glowColor: theme.glow, curX: 14 * scale, curY: 1.5 * scale, vx: 0, vy: 0, alpha: 0.95, size: 11 * scale },
      { ox: 14 * scale, oy: 3.0 * scale, char: 'O', color: theme.highlight, glowColor: theme.glow, curX: 14 * scale, curY: 3.0 * scale, vx: 0, vy: 0, alpha: 1.0, size: 12 * scale },
      { ox: 14 * scale, oy: 4.5 * scale, char: ']', color: theme.highlight, glowColor: theme.glow, curX: 14 * scale, curY: 4.5 * scale, vx: 0, vy: 0, alpha: 0.95, size: 11 * scale }
    )
    // Face center
    particles.push({ ox: 15.5 * scale, oy: 0, char: 'v', color: theme.primary, glowColor: theme.glow, curX: 15.5 * scale, curY: 0, vx: 0, vy: 0, alpha: 0.9, size: 10 * scale })

    // B. Thorax (Muscular flight center)
    for (let tx = 11; tx >= 2; tx -= 2.2) {
      for (let ty of [-2, 0, 2]) {
        particles.push({
          ox: tx * scale,
          oy: ty * scale,
          char: ty === 0 ? '8' : '#',
          color: theme.primary,
          glowColor: theme.glow,
          curX: tx * scale,
          curY: ty * scale,
          vx: 0,
          vy: 0,
          alpha: 0.95,
          size: 11 * scale,
        })
      }
    }

    // C. Wings (Two distinct pairs: Forewings and Hindwings with lace venation)
    for (let side of [-1, 1]) {
      // 1. Forewings (Longer, angled slightly forward/outward)
      const foreSpan = 42 * scale
      const foreSteps = Math.floor(foreSpan / (3.2 * scale))
      for (let s = 1; s <= foreSteps; s++) {
        const norm = s / foreSteps
        const y = side * s * 3.2 * scale
        const x = 7 * scale - norm * 4 * scale // Leading edge
        const char = s === foreSteps ? 'X' : (s % 2 === 0 ? '=' : '-')
        particles.push({
          ox: x,
          oy: y,
          char,
          color: s === foreSteps ? theme.highlight : theme.secondary,
          glowColor: theme.glow,
          curX: x,
          curY: y,
          vx: 0,
          vy: 0,
          alpha: 0.85 - norm * 0.25,
          size: 10 * scale,
        })

        // Wing membrane vein row behind leading edge
        if (s > 2 && s < foreSteps - 1) {
          particles.push({
            ox: x - 2.8 * scale,
            oy: y,
            char: s % 3 === 0 ? '/' : (s % 2 === 0 ? '\\' : '.'),
            color: theme.secondary,
            glowColor: theme.glow,
            curX: x - 2.8 * scale,
            curY: y,
            vx: 0,
            vy: 0,
            alpha: 0.65 - norm * 0.25,
            size: 9 * scale,
          })
        }
      }

      // 2. Hindwings (Slightly broader, attached slightly behind)
      const hindSpan = 36 * scale
      const hindSteps = Math.floor(hindSpan / (3.2 * scale))
      for (let s = 1; s <= hindSteps; s++) {
        const norm = s / hindSteps
        const y = side * s * 3.2 * scale
        const x = 1.5 * scale - norm * 6 * scale // Angle slightly back
        const char = s === hindSteps ? '>' : (s % 2 === 0 ? '-' : '~')
        particles.push({
          ox: x,
          oy: y,
          char,
          color: theme.secondary,
          glowColor: theme.glow,
          curX: x,
          curY: y,
          vx: 0,
          vy: 0,
          alpha: 0.78 - norm * 0.25,
          size: 10 * scale,
        })

        if (s > 2 && s < hindSteps - 2) {
          particles.push({
            ox: x - 2.8 * scale,
            oy: y,
            char: '+',
            color: theme.secondary,
            glowColor: theme.glow,
            curX: x - 2.8 * scale,
            curY: y,
            vx: 0,
            vy: 0,
            alpha: 0.55 - norm * 0.2,
            size: 9 * scale,
          })
        }
      }
    }

    // D. Abdomen / Long Slender Segmented Tail (12 distinct segments)
    const tailSegments = 12
    for (let seg = 1; seg <= tailSegments; seg++) {
      const x = -seg * 3.8 * scale
      const norm = seg / tailSegments
      let char = '|'
      if (seg === tailSegments) {
        char = '<' // Claspers / cerci at tail tip
      } else if (seg % 3 === 0) {
        char = '0'
      } else if (seg % 2 === 0) {
        char = 'o'
      }

      particles.push({
        ox: x,
        oy: 0,
        char,
        color: seg % 2 === 0 ? theme.primary : theme.secondary,
        glowColor: theme.glow,
        curX: x,
        curY: 0,
        vx: 0,
        vy: 0,
        alpha: 0.92 - norm * 0.35,
        size: 11 * scale,
      })
    }

    return { particles, tentacles: undefined }
  }

  // Initialize creatures
  const initCreatures = useCallback(
    (width: number, height: number, type: CreatureType, count: number) => {
      const theme = getTheme(type)
      const list: Creature[] = []

      for (let i = 0; i < count; i++) {
        const scale = 0.9 + Math.random() * 0.35
        const { particles, tentacles } =
          type === 'jellyfish' ? buildJellyfish(scale, theme) : buildDragonfly(scale, theme)

        const x = Math.random() * width
        const y = Math.random() * height

        // Initial serene direction
        const initialAngle =
          type === 'jellyfish'
            ? -Math.PI / 2 + (Math.random() - 0.5) * 0.6 // Swimming calmly upwards
            : Math.random() * Math.PI * 2 // Dragonfly heading

        list.push({
          id: i,
          type,
          x,
          y,
          vx: Math.cos(initialAngle) * (type === 'jellyfish' ? 0.4 : 0.6),
          vy: Math.sin(initialAngle) * (type === 'jellyfish' ? 0.4 : 0.6),
          angle: initialAngle,
          targetAngle: initialAngle,
          targetX: 60 + Math.random() * (width - 120),
          targetY: 60 + Math.random() * (height - 120),
          phase: Math.random() * Math.PI * 2,
          hoverTimer: 2 + Math.random() * 3,
          speed: type === 'jellyfish' ? 0.45 + Math.random() * 0.3 : 0.55 + Math.random() * 0.3,
          scale,
          colorTheme: theme,
          particles,
          tentacles,
        })
      }
      creaturesRef.current = list
    },
    []
  )

  // Initialize background star field
  const initStars = (width: number, height: number) => {
    const stars: Star[] = []
    const count = Math.min(75, Math.floor((width * height) / 15000))
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        char: STAR_GLYPHS[Math.floor(Math.random() * STAR_GLYPHS.length)],
        speed: 0.15 + Math.random() * 0.3,
        alpha: 0.1 + Math.random() * 0.35,
        baseAlpha: 0.1 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
      })
    }
    starsRef.current = stars
  }

  // Resize handler
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleResize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`

      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)

      initCreatures(rect.width, rect.height, creatureType, creatureCount)
      initStars(rect.width, rect.height)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [creatureType, creatureCount, initCreatures])

  // Mouse & Click Interaction
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    mouseRef.current.x = e.clientX - rect.left
    mouseRef.current.y = e.clientY - rect.top
  }

  const handleMouseLeave = () => {
    mouseRef.current.x = -9999
    mouseRef.current.y = -9999
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    ripplesRef.current.push({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      radius: 0,
      maxRadius: 280,
      force: 20,
    })
  }

  // Animation Loop with Serene Speed and True-to-Life Motion
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let lastTime = performance.now()

    const render = (time: number) => {
      animFrameRef.current = requestAnimationFrame(render)
      if (isPaused) return

      const dt = Math.min((time - lastTime) / 1000, 0.1)
      lastTime = time

      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height

      // Clear with soft motion blur
      ctx.fillStyle = 'rgba(7, 9, 14, 0.4)'
      ctx.fillRect(0, 0, width, height)

      // 1. Render Ambient Background Drifting Glyphs
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      starsRef.current.forEach((star) => {
        star.y -= star.speed * speedMultiplier
        if (star.y < 0) {
          star.y = height
          star.x = Math.random() * width
        }
        star.phase += 0.02
        const flicker = Math.sin(star.phase) * 0.12
        ctx.fillStyle = `rgba(148, 163, 184, ${Math.max(0.04, star.baseAlpha + flicker)})`
        ctx.font = '10px ui-monospace, SFMono-Regular, monospace'
        ctx.fillText(star.char, star.x, star.y)
      })

      // 2. Update Shockwave Ripples
      for (let r = ripplesRef.current.length - 1; r >= 0; r--) {
        const rip = ripplesRef.current[r]
        rip.radius += 320 * dt * speedMultiplier
        if (rip.radius >= rip.maxRadius) {
          ripplesRef.current.splice(r, 1)
        }
      }

      // 3. Render Creatures
      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      creaturesRef.current.forEach((creature) => {
        // Reduced, majestic simulation pacing
        creature.phase += dt * 1.8 * creature.speed * speedMultiplier

        if (creature.type === 'jellyfish') {
          // Slow, graceful pulsing: contraction stroke pushes bell forward
          const pulse = Math.sin(creature.phase)
          const isContracting = pulse > 0.65

          // Forward thrust during contraction
          const thrust = isContracting ? 0.35 * speedMultiplier : 0.06 * speedMultiplier
          creature.vx += Math.cos(creature.angle) * thrust
          creature.vy += Math.sin(creature.angle) * thrust

          // Gentle drag / terminal velocity
          creature.vx *= 0.97
          creature.vy *= 0.97

          // Subtle steering sway
          creature.angle += Math.sin(creature.phase * 0.5) * 0.008

          creature.x += creature.vx
          creature.y += creature.vy

          // Wrap boundaries with buffer
          if (creature.y < -120) {
            creature.y = height + 100
            creature.x = Math.random() * width
            creature.angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6
          }
          if (creature.x < -100) creature.x = width + 80
          if (creature.x > width + 100) creature.x = -80
        } else {
          // Dragonfly: Peaceful hovering, gentle gliding, realistic heading rotation
          creature.hoverTimer -= dt * speedMultiplier
          if (creature.hoverTimer <= 0) {
            // Pick a new serene waypoint
            creature.targetX = 60 + Math.random() * (width - 120)
            creature.targetY = 60 + Math.random() * (height - 120)
            creature.hoverTimer = 3.5 + Math.random() * 4.0
          }

          const dx = creature.targetX - creature.x
          const dy = creature.targetY - creature.y
          const distToTarget = Math.hypot(dx, dy)

          if (distToTarget > 25) {
            // Smoothly steer towards target
            creature.targetAngle = Math.atan2(dy, dx)
            let angleDiff = creature.targetAngle - creature.angle
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
            creature.angle += angleDiff * 0.04

            // Serene forward glide
            const speed = 0.65 * speedMultiplier
            creature.vx = Math.cos(creature.angle) * speed
            creature.vy = Math.sin(creature.angle) * speed
          } else {
            // Gentle hovering bob
            creature.vx *= 0.94
            creature.vy *= 0.94
            creature.y += Math.sin(creature.phase * 2) * 0.25 * speedMultiplier
          }

          creature.x += creature.vx
          creature.y += creature.vy
        }

        // Bell pulse scaling for jellyfish, wing flutter for dragonfly
        const bellSqueeze =
          creature.type === 'jellyfish' ? 1 + Math.sin(creature.phase) * 0.14 : 1
        const wingFlutter =
          creature.type === 'dragonfly' ? Math.sin(creature.phase * 12) * 0.15 : 0

        // Draw rotated creature in local coordinate frame
        ctx.save()
        ctx.translate(creature.x, creature.y)
        ctx.rotate(creature.angle)

        ctx.shadowBlur = 8
        ctx.shadowColor = creature.colorTheme.glow

        // Draw Creature Body Particles
        creature.particles.forEach((p) => {
          let targetX = p.ox
          let targetY = p.oy

          if (creature.type === 'jellyfish') {
            // Cap narrows on width and lengthens on height during stroke
            targetX = p.ox * (2 - bellSqueeze)
            targetY = p.oy * bellSqueeze
          } else if (creature.type === 'dragonfly' && Math.abs(p.oy) > 4) {
            // Wing high-frequency flutter
            targetX = p.ox + wingFlutter * (p.oy > 0 ? 1 : -1) * 2.5
          }

          // Calculate world position for mouse and shockwave physics
          const cosA = Math.cos(creature.angle)
          const sinA = Math.sin(creature.angle)
          const worldCurX = creature.x + (p.curX * cosA - p.curY * sinA)
          const worldCurY = creature.y + (p.curX * sinA + p.curY * cosA)

          // 1. Mouse Repulsion
          const distToMouse = Math.hypot(worldCurX - mx, worldCurY - my)
          if (distToMouse < 85) {
            const angle = Math.atan2(worldCurY - my, worldCurX - mx) - creature.angle
            const repForce = (1 - distToMouse / 85) * 6
            p.vx += Math.cos(angle) * repForce
            p.vy += Math.sin(angle) * repForce
          }

          // 2. Shockwave Ripples (Click to Scatter)
          ripplesRef.current.forEach((rip) => {
            const distToRip = Math.hypot(worldCurX - rip.x, worldCurY - rip.y)
            if (Math.abs(distToRip - rip.radius) < 35) {
              const angle = Math.atan2(worldCurY - rip.y, worldCurX - rip.x) - creature.angle
              const impact = (1 - rip.radius / rip.maxRadius) * rip.force
              p.vx += Math.cos(angle) * impact
              p.vy += Math.sin(angle) * impact
            }
          })

          // Spring dampening back to body
          const springK = 0.08
          const damp = 0.88
          p.vx += (targetX - p.curX) * springK
          p.vy += (targetY - p.curY) * springK
          p.vx *= damp
          p.vy *= damp

          p.curX += p.vx
          p.curY += p.vy

          ctx.font = `${p.size}px ui-monospace, SFMono-Regular, Consolas, monospace`
          ctx.fillStyle = p.color
          ctx.globalAlpha = p.alpha
          ctx.fillText(p.char, p.curX, p.curY)
        })

        // Draw Jellyfish Tentacles with Inverse Kinematics trailing
        if (creature.tentacles) {
          creature.tentacles.forEach((strand, strandIdx) => {
            const originX = 0
            const originY = strand[0].y * bellSqueeze

            let prevX = originX
            let prevY = originY

            strand.forEach((seg, sIdx) => {
              // Fluid sinusoidal wave lagging behind
              const wave = Math.sin(creature.phase * 1.4 + strandIdx * 0.7 + sIdx * 0.35) * (sIdx * 1.5)
              const targetSegX = -sIdx * 4.8 * creature.scale
              const targetSegY = originY + wave

              seg.x += (targetSegX - seg.x) * 0.15
              seg.y += (targetSegY - seg.y) * 0.15

              ctx.font = '10px ui-monospace, monospace'
              ctx.fillStyle = creature.colorTheme.secondary
              ctx.globalAlpha = seg.alpha
              ctx.fillText(seg.char, seg.x, seg.y)

              prevX = seg.x
              prevY = seg.y
            })
          })
        }

        ctx.restore()
      })
    }

    animFrameRef.current = requestAnimationFrame(render)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isPaused, speedMultiplier])

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${className}`}>
      {/* HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="absolute inset-0 w-full h-full cursor-crosshair"
      />

      {/* Top Selector Bar (Only Jellyfish and Dragonfly) */}
      {showControls && (
        <div className="absolute top-4 inset-x-0 z-20 flex items-center justify-between px-6 pointer-events-none">
          {/* Creature Type Pills: Jellyfish & Dragonfly */}
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-xl pointer-events-auto">
            {(
              [
                { id: 'jellyfish', label: 'Jellyfish', color: 'bg-fuchsia-500' },
                { id: 'dragonfly', label: 'Dragonfly', color: 'bg-emerald-400' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => onCreatureChange?.(item.id)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${creatureType === item.id
                    ? 'glass-surface-active'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
              >
                <span className={`w-2 h-2 rounded-full ${item.color} ${creatureType === item.id ? 'animate-pulse' : 'opacity-60'}`} />
                {item.label}
              </button>
            ))}
          </div>

          {/* Tweaks Menu Button */}
          <div className="relative pointer-events-auto">
            <button
              onClick={() => setTweakMenuOpen(!tweakMenuOpen)}
              className="btn-pill-dark !py-1.5 !px-3.5 !text-xs"
            >
              <span>⚙ Tweaks</span>
            </button>

            {/* Tweaks Popover */}
            {tweakMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 p-4 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl text-xs space-y-4 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-semibold text-slate-200">Simulation Controls</span>
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="btn-pill-light !py-1 !px-2.5 !text-[10px]"
                  >
                    {isPaused ? ' Resume' : ' Pause'}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Creature Count</span>
                    <span className="text-slate-200 font-mono">{creatureCount}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={creatureCount}
                    onChange={(e) => setCreatureCount(Number(e.target.value))}
                    className="w-full accent-blue-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Simulation Speed</span>
                    <span className="text-slate-200 font-mono">{speedMultiplier.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1.5"
                    step="0.05"
                    value={speedMultiplier}
                    onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
                    className="w-full accent-blue-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="pt-1 border-t border-slate-800 text-[11px] text-slate-500">
                  Tip: Click anywhere to scatter characters with fluid shockwave physics.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Subtle Interaction Hint */}
      <div className="absolute bottom-3 left-4 z-10 pointer-events-none text-[10px] text-slate-500/70 font-mono tracking-wider">
        click to scatter • keyboard character physics
      </div>
    </div>
  )
}
