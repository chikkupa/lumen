import { NextResponse } from "next/server"
import {
  IMAGE_MODELS,
  hasOpenAIKey,
  hasPollinationsKey,
  isModelAvailable,
} from "@/lib/image-models"

export async function GET() {
  const openaiEnabled = hasOpenAIKey()
  const pollinationsEnabled = hasPollinationsKey()
  const advancedEnabled = openaiEnabled || pollinationsEnabled

  const hints: string[] = []
  if (!openaiEnabled) {
    hints.push(
      "Set OPENAI_API_KEY for GPT Image 1 / DALL·E 3 (https://platform.openai.com/api-keys)."
    )
  }
  if (!pollinationsEnabled) {
    hints.push(
      "Set POLLINATIONS_API_KEY for FLUX / Z-Image / Seedream (https://enter.pollinations.ai/keys)."
    )
  }

  return NextResponse.json({
    advancedEnabled,
    openaiEnabled,
    pollinationsEnabled,
    keyHint: hints.length ? hints.join(" ") : null,
    models: IMAGE_MODELS.map((model) => ({
      ...model,
      available: isModelAvailable(model),
    })),
  })
}
