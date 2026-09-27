export type ImageModelTier = "free" | "advanced"
export type ImageModelProvider = "pollinations" | "openai"

export type ImageModelOption = {
  id: string
  label: string
  tier: ImageModelTier
  provider: ImageModelProvider
  /** Upstream API model id */
  apiModel: string
  description: string
}

/** Curated models shown in the generator UI. */
export const IMAGE_MODELS: ImageModelOption[] = [
  {
    id: "sana",
    label: "Sana",
    tier: "free",
    provider: "pollinations",
    apiModel: "sana",
    description: "Default free Pollinations model — no API key required",
  },
  {
    id: "openai-gpt-image-1",
    label: "GPT Image 1",
    tier: "advanced",
    provider: "openai",
    apiModel: "gpt-image-1",
    description: "OpenAI GPT Image — strong prompt following (needs OPENAI_API_KEY)",
  },
  {
    id: "openai-dall-e-3",
    label: "DALL·E 3",
    tier: "advanced",
    provider: "openai",
    apiModel: "dall-e-3",
    description: "OpenAI DALL·E 3 (needs OPENAI_API_KEY)",
  },
  {
    id: "zimage",
    label: "Z-Image Turbo",
    tier: "advanced",
    provider: "pollinations",
    apiModel: "zimage",
    description: "Fast Pollinations / Tongyi model (needs POLLINATIONS_API_KEY)",
  },
  {
    id: "flux",
    label: "FLUX",
    tier: "advanced",
    provider: "pollinations",
    apiModel: "flux",
    description: "Pollinations FLUX (needs POLLINATIONS_API_KEY)",
  },
  {
    id: "gptimage",
    label: "GPT Image (Pollinations)",
    tier: "advanced",
    provider: "pollinations",
    apiModel: "gptimage",
    description: "OpenAI-style model via Pollinations (needs POLLINATIONS_API_KEY)",
  },
  {
    id: "seedream",
    label: "Seedream",
    tier: "advanced",
    provider: "pollinations",
    apiModel: "seedream",
    description: "ByteDance Seedream via Pollinations (needs POLLINATIONS_API_KEY)",
  },
  {
    id: "kontext",
    label: "FLUX Kontext",
    tier: "advanced",
    provider: "pollinations",
    apiModel: "kontext",
    description: "FLUX Kontext via Pollinations (needs POLLINATIONS_API_KEY)",
  },
]

export const DEFAULT_IMAGE_MODEL = "sana"

export function getImageModel(id: string | undefined | null): ImageModelOption {
  return IMAGE_MODELS.find((m) => m.id === id) ?? IMAGE_MODELS[0]
}

export function hasPollinationsKey(): boolean {
  return Boolean(process.env.POLLINATIONS_API_KEY?.trim())
}

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}

/** @deprecated use hasPollinationsKey */
export function hasAdvancedImageKey(): boolean {
  return hasPollinationsKey()
}

export function isModelAvailable(model: ImageModelOption): boolean {
  if (model.tier === "free") return true
  if (model.provider === "openai") return hasOpenAIKey()
  if (model.provider === "pollinations") return hasPollinationsKey()
  return false
}

export function keyHintForModel(model: ImageModelOption): string | null {
  if (isModelAvailable(model)) return null
  if (model.provider === "openai") {
    return "Set OPENAI_API_KEY in .env.local (https://platform.openai.com/api-keys), then restart the app."
  }
  return "Set POLLINATIONS_API_KEY in .env.local (https://enter.pollinations.ai/keys), then restart the app."
}

/** Map requested dimensions to an OpenAI-supported size string. */
export function openAIImageSize(
  apiModel: string,
  width: number,
  height: number
): string {
  const ratio = width / Math.max(1, height)

  if (apiModel === "dall-e-3") {
    if (ratio > 1.25) return "1792x1024"
    if (ratio < 0.8) return "1024x1792"
    return "1024x1024"
  }

  // gpt-image-1 and similar
  if (ratio > 1.25) return "1536x1024"
  if (ratio < 0.8) return "1024x1536"
  return "1024x1024"
}
