import { NextRequest, NextResponse } from "next/server"
import {
  DEFAULT_IMAGE_MODEL,
  getImageModel,
  hasPollinationsKey,
  isModelAvailable,
  keyHintForModel,
  openAIImageSize,
} from "@/lib/image-models"

type GenerateBody = {
  prompt?: string
  width?: number
  height?: number
  seed?: number
  model?: string
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(n)))
}

async function fetchBinaryImage(url: string, headers?: HeadersInit) {
  return fetch(url, {
    headers: { Accept: "image/*", ...headers },
    cache: "no-store",
  })
}

async function generateWithOpenAI(opts: {
  prompt: string
  apiModel: string
  width: number
  height: number
}): Promise<{ dataUrl: string; mimeType: string; width: number; height: number }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw Object.assign(new Error("OPENAI_API_KEY is not set."), { needsKey: true })
  }

  const size = openAIImageSize(opts.apiModel, opts.width, opts.height)
  const body: Record<string, unknown> = {
    model: opts.apiModel,
    prompt: opts.prompt,
    n: 1,
    size,
  }

  // gpt-image-1 defaults to b64; dall-e-3 needs response_format
  if (opts.apiModel === "dall-e-3") {
    body.response_format = "b64_json"
    body.quality = "standard"
  } else if (opts.apiModel === "gpt-image-1") {
    body.quality = "high"
  }

  const upstream = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  const payload = (await upstream.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>
    error?: { message?: string }
  }

  if (!upstream.ok) {
    throw new Error(payload.error?.message || `OpenAI returned ${upstream.status}.`)
  }

  const item = payload.data?.[0]
  if (!item) {
    throw new Error("OpenAI returned no image data.")
  }

  let dataUrl: string
  let mimeType = "image/png"

  if (item.b64_json) {
    dataUrl = `data:image/png;base64,${item.b64_json}`
  } else if (item.url) {
    const imgRes = await fetch(item.url, { cache: "no-store" })
    if (!imgRes.ok) {
      throw new Error("Failed to download image from OpenAI URL.")
    }
    mimeType = imgRes.headers.get("content-type")?.split(";")[0] || "image/png"
    const buffer = Buffer.from(await imgRes.arrayBuffer())
    dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`
  } else {
    throw new Error("OpenAI response missing image bytes.")
  }

  const [sw, sh] = size.split("x").map(Number)
  return { dataUrl, mimeType, width: sw, height: sh }
}

async function generateWithPollinations(opts: {
  prompt: string
  apiModel: string
  width: number
  height: number
  seed: number
  useAdvanced: boolean
}): Promise<{ dataUrl: string; mimeType: string; provider: string }> {
  let upstream: Response
  let provider: string

  if (!opts.useAdvanced || opts.apiModel === "sana") {
    const url = new URL(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(opts.prompt)}`
    )
    url.searchParams.set("width", String(opts.width))
    url.searchParams.set("height", String(opts.height))
    url.searchParams.set("seed", String(opts.seed))
    url.searchParams.set("model", "sana")
    url.searchParams.set("nologo", "true")
    url.searchParams.set("enhance", "true")
    upstream = await fetchBinaryImage(url.toString())
    provider = "pollinations-free"
  } else {
    const apiKey = process.env.POLLINATIONS_API_KEY?.trim()
    if (!apiKey) {
      throw Object.assign(new Error("POLLINATIONS_API_KEY is not set."), {
        needsKey: true,
      })
    }
    const url = new URL(
      `https://gen.pollinations.ai/image/${encodeURIComponent(opts.prompt)}`
    )
    url.searchParams.set("width", String(opts.width))
    url.searchParams.set("height", String(opts.height))
    url.searchParams.set("seed", String(opts.seed))
    url.searchParams.set("model", opts.apiModel)
    url.searchParams.set("nologo", "true")
    url.searchParams.set("enhance", "true")
    upstream = await fetchBinaryImage(url.toString(), {
      Authorization: `Bearer ${apiKey}`,
    })
    provider = "pollinations-advanced"
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "")
    let message = `Image service returned ${upstream.status}.`
    try {
      const parsed = JSON.parse(detail) as { error?: { message?: string } }
      if (parsed.error?.message) message = parsed.error.message
    } catch {
      // keep status message
    }
    throw new Error(message)
  }

  const contentType = upstream.headers.get("content-type") || "image/jpeg"
  if (!contentType.startsWith("image/")) {
    throw new Error("Image service returned a non-image response.")
  }

  const buffer = Buffer.from(await upstream.arrayBuffer())
  if (buffer.length < 100) {
    throw new Error("Image service returned an empty image.")
  }
  if (buffer.length > 12 * 1024 * 1024) {
    throw new Error("Generated image is too large.")
  }

  const mimeType = contentType.split(";")[0]
  return {
    provider,
    mimeType,
    dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateBody
    const prompt = (body.prompt ?? "").trim()
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 })
    }
    if (prompt.length > 500) {
      return NextResponse.json(
        { error: "Prompt is too long (max 500 characters)." },
        { status: 400 }
      )
    }

    const width = clamp(body.width ?? 1024, 256, 1440)
    const height = clamp(body.height ?? 576, 256, 1440)
    const seed = Number.isFinite(body.seed)
      ? Math.abs(Math.round(body.seed as number))
      : Math.floor(Math.random() * 100_000)

    const model = getImageModel(body.model || DEFAULT_IMAGE_MODEL)

    if (!isModelAvailable(model)) {
      return NextResponse.json(
        {
          error: `${model.label} is unavailable. ${keyHintForModel(model)}`,
          needsKey: true,
          provider: model.provider,
        },
        { status: 401 }
      )
    }

    if (model.provider === "openai") {
      const result = await generateWithOpenAI({
        prompt,
        apiModel: model.apiModel,
        width,
        height,
      })
      return NextResponse.json({
        provider: "openai",
        model: model.id,
        modelLabel: model.label,
        prompt,
        width: result.width,
        height: result.height,
        seed,
        mimeType: result.mimeType,
        dataUrl: result.dataUrl,
      })
    }

    const result = await generateWithPollinations({
      prompt,
      apiModel: model.apiModel,
      width,
      height,
      seed,
      useAdvanced: hasPollinationsKey() && model.apiModel !== "sana",
    })

    return NextResponse.json({
      provider: result.provider,
      model: model.id,
      modelLabel: model.label,
      prompt,
      width,
      height,
      seed,
      mimeType: result.mimeType,
      dataUrl: result.dataUrl,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate image."
    const needsKey = Boolean(
      error && typeof error === "object" && "needsKey" in error && error.needsKey
    )
    return NextResponse.json(
      { error: message, needsKey },
      { status: needsKey ? 401 : 500 }
    )
  }
}
