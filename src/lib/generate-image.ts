export type GeneratorStyle =
  | "aurora"
  | "mesh"
  | "stripes"
  | "orbs"
  | "horizon"
  | "noise"

export type GeneratorOptions = {
  width: number
  height: number
  seed: number
  style: GeneratorStyle
  colorA: string
  colorB: string
  colorC: string
  caption: string
}

export const GENERATOR_STYLES: { id: GeneratorStyle; label: string }[] = [
  { id: "aurora", label: "Aurora" },
  { id: "mesh", label: "Mesh" },
  { id: "stripes", label: "Stripes" },
  { id: "orbs", label: "Orbs" },
  { id: "horizon", label: "Horizon" },
  { id: "noise", label: "Noise" },
]

export const SIZE_PRESETS = [
  { label: "1024×576", width: 1024, height: 576 },
  { label: "1280×720", width: 1280, height: 720 },
  { label: "960×640", width: 960, height: 640 },
  { label: "1024×1024", width: 1024, height: 1024 },
] as const

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function parseHex(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "").trim()
  const full =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned.padEnd(6, "0").slice(0, 6)
  const n = Number.parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function fillBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string
) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  caption: string
) {
  const text = caption.trim()
  if (!text) return
  const size = Math.max(18, Math.round(Math.min(width, height) * 0.045))
  ctx.save()
  ctx.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle = "rgba(255,255,255,0.92)"
  ctx.shadowColor = "rgba(0,0,0,0.45)"
  ctx.shadowBlur = size * 0.35
  ctx.fillText(text, width / 2, height * 0.88, width * 0.85)
  ctx.restore()
}

function drawAurora(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  a: string,
  b: string,
  c: string
) {
  fillBackground(ctx, w, h, "#0b1220")
  for (let i = 0; i < 6; i++) {
    const g = ctx.createRadialGradient(
      rand() * w,
      rand() * h,
      0,
      rand() * w,
      rand() * h,
      Math.max(w, h) * (0.35 + rand() * 0.45)
    )
    const color = i % 3 === 0 ? a : i % 3 === 1 ? b : c
    g.addColorStop(0, rgba(color, 0.55))
    g.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
}

function drawMesh(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  a: string,
  b: string,
  c: string
) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, a)
  g.addColorStop(0.5, b)
  g.addColorStop(1, c)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = "rgba(255,255,255,0.12)"
  ctx.lineWidth = 1
  const step = Math.max(24, Math.round(Math.min(w, h) / 18))
  const skew = (rand() - 0.5) * 40
  for (let x = -h; x < w + h; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + skew, h)
    ctx.stroke()
  }
  for (let y = -w; y < h + w; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y + skew * 0.4)
    ctx.stroke()
  }
}

function drawStripes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  a: string,
  b: string,
  c: string
) {
  fillBackground(ctx, w, h, a)
  const colors = [a, b, c]
  const band = Math.max(12, Math.round(h / (8 + rand() * 10)))
  for (let y = 0, i = 0; y < h; y += band, i++) {
    ctx.fillStyle = colors[i % colors.length]
    ctx.globalAlpha = 0.55 + (i % 3) * 0.12
    ctx.fillRect(0, y, w, band + 1)
  }
  ctx.globalAlpha = 1
  const overlay = ctx.createLinearGradient(0, 0, w, 0)
  overlay.addColorStop(0, rgba(c, 0.25))
  overlay.addColorStop(1, rgba(a, 0.05))
  ctx.fillStyle = overlay
  ctx.fillRect(0, 0, w, h)
}

function drawOrbs(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  a: string,
  b: string,
  c: string
) {
  fillBackground(ctx, w, h, "#111827")
  const colors = [a, b, c]
  for (let i = 0; i < 14; i++) {
    const x = rand() * w
    const y = rand() * h
    const r = Math.min(w, h) * (0.08 + rand() * 0.28)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const color = colors[i % colors.length]
    g.addColorStop(0, rgba(color, 0.75))
    g.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawHorizon(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  a: string,
  b: string,
  c: string
) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, a)
  sky.addColorStop(0.55, b)
  sky.addColorStop(1, c)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const sunY = h * (0.42 + rand() * 0.12)
  const sunR = Math.min(w, h) * (0.08 + rand() * 0.06)
  const sun = ctx.createRadialGradient(w * 0.5, sunY, 0, w * 0.5, sunY, sunR * 3)
  sun.addColorStop(0, "rgba(255,245,220,0.95)")
  sun.addColorStop(0.2, rgba(b, 0.55))
  sun.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = rgba(c, 0.85)
  ctx.beginPath()
  ctx.moveTo(0, h * 0.62)
  for (let x = 0; x <= w; x += 20) {
    const y = h * (0.58 + Math.sin(x * 0.01 + rand()) * 0.03 + (x / w) * 0.05)
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()
}

function drawNoise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rand: () => number,
  a: string,
  b: string,
  c: string
) {
  const base = ctx.createLinearGradient(0, 0, w, h)
  base.addColorStop(0, a)
  base.addColorStop(0.5, b)
  base.addColorStop(1, c)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  const image = ctx.getImageData(0, 0, w, h)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (rand() - 0.5) * 48
    data[i] = Math.max(0, Math.min(255, data[i] + n))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n))
  }
  ctx.putImageData(image, 0, 0)
}

export function renderGeneratedImage(
  canvas: HTMLCanvasElement,
  options: GeneratorOptions
) {
  const width = Math.max(64, Math.min(4096, Math.round(options.width)))
  const height = Math.max(64, Math.min(4096, Math.round(options.height)))
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas is not available.")

  const rand = mulberry32(options.seed || 1)
  const { colorA, colorB, colorC, style, caption } = options

  switch (style) {
    case "mesh":
      drawMesh(ctx, width, height, rand, colorA, colorB, colorC)
      break
    case "stripes":
      drawStripes(ctx, width, height, rand, colorA, colorB, colorC)
      break
    case "orbs":
      drawOrbs(ctx, width, height, rand, colorA, colorB, colorC)
      break
    case "horizon":
      drawHorizon(ctx, width, height, rand, colorA, colorB, colorC)
      break
    case "noise":
      drawNoise(ctx, width, height, rand, colorA, colorB, colorC)
      break
    case "aurora":
    default:
      drawAurora(ctx, width, height, rand, colorA, colorB, colorC)
      break
  }

  drawCaption(ctx, width, height, caption)
}

export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png")
}

export function suggestFileName(style: GeneratorStyle, seed: number): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  return `lumen-${style}-${seed}-${stamp}.png`
}

export function suggestPromptFileName(prompt: string, seed: number): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "prompt"
  return `lumen-${slug}-${seed}-${stamp}.png`
}

/** Map a text prompt onto procedural style/colors when the AI service is offline. */
export function optionsFromPrompt(
  prompt: string,
  base: Pick<GeneratorOptions, "width" | "height" | "seed">
): GeneratorOptions {
  const text = prompt.toLowerCase()
  let style: GeneratorStyle = "aurora"
  if (/(stripe|band|line)/.test(text)) style = "stripes"
  else if (/(orb|circle|bubble|planet)/.test(text)) style = "orbs"
  else if (/(mesh|grid|wire)/.test(text)) style = "mesh"
  else if (/(horizon|sunset|sunrise|dusk|dawn|sky)/.test(text)) style = "horizon"
  else if (/(noise|grain|static|film)/.test(text)) style = "noise"
  else if (/(aurora|neon|glow|mist)/.test(text)) style = "aurora"

  let colorA = "#1f6f7a"
  let colorB = "#d4a574"
  let colorC = "#1a2744"
  if (/(ocean|sea|teal|cyan|blue)/.test(text)) {
    colorA = "#0b3d4a"
    colorB = "#2a9d8f"
    colorC = "#e9c46a"
  } else if (/(forest|green|moss|jungle)/.test(text)) {
    colorA = "#1b4332"
    colorB = "#74c69d"
    colorC = "#081c15"
  } else if (/(sunset|orange|amber|warm)/.test(text)) {
    colorA = "#9b2226"
    colorB = "#ee9b00"
    colorC = "#001219"
  } else if (/(night|dark|noir|black)/.test(text)) {
    colorA = "#0d1b2a"
    colorB = "#415a77"
    colorC = "#1b263b"
  } else if (/(pink|magenta|violet|purple)/.test(text)) {
    colorA = "#5a189a"
    colorB = "#ff6d00"
    colorC = "#240046"
  }

  return {
    ...base,
    style,
    colorA,
    colorB,
    colorC,
    caption: prompt.trim().slice(0, 80),
  }
}

export async function dataUrlToPngDataUrl(dataUrl: string): Promise<string> {
  if (dataUrl.startsWith("data:image/png")) return dataUrl

  // Browser path
  if (typeof window !== "undefined" && typeof createImageBitmap === "function") {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas is not available.")
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    return canvas.toDataURL("image/png")
  }

  throw new Error("PNG conversion is only available in the browser.")
}
