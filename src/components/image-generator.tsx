"use client"

import { useEffect, useRef, useState } from "react"
import { Download, Loader2, RefreshCw, Save, Sparkles, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  GENERATOR_STYLES,
  SIZE_PRESETS,
  canvasToPngDataUrl,
  dataUrlToPngDataUrl,
  optionsFromPrompt,
  renderGeneratedImage,
  suggestFileName,
  suggestPromptFileName,
  type GeneratorStyle,
} from "@/lib/generate-image"
import { DEFAULT_IMAGE_MODEL, type ImageModelOption } from "@/lib/image-models"
import { cn } from "@/lib/utils"

type ModelListItem = ImageModelOption & { available: boolean }

export type GeneratedSaveResult = {
  folder: string
  name: string
  size: number
  url: string
}

type ImageGeneratorProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderPath: string
  onSaved?: (result: GeneratedSaveResult) => void
}

type Mode = "prompt" | "procedural"

const PROMPT_EXAMPLES = [
  "Misty teal mountains at sunrise, soft fog",
  "Abstract coral and indigo orbs on dark water",
  "Quiet forest path in golden hour light",
  "Geometric neon grid over a night skyline",
]

export function ImageGenerator({
  open,
  onOpenChange,
  folderPath,
  onSaved,
}: ImageGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<Mode>("prompt")
  const [prompt, setPrompt] = useState(PROMPT_EXAMPLES[0])
  const [style, setStyle] = useState<GeneratorStyle>("aurora")
  const [width, setWidth] = useState(1024)
  const [height, setHeight] = useState(576)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100_000))
  const [colorA, setColorA] = useState("#1f6f7a")
  const [colorB, setColorB] = useState("#d4a574")
  const [colorC, setColorC] = useState("#1a2744")
  const [caption, setCaption] = useState("")
  const [fileName, setFileName] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [providerNote, setProviderNote] = useState<string | null>(null)
  const [model, setModel] = useState(DEFAULT_IMAGE_MODEL)
  const [models, setModels] = useState<ModelListItem[]>([])
  const [keyHint, setKeyHint] = useState<string | null>(null)
  const [advancedEnabled, setAdvancedEnabled] = useState(false)

  useEffect(() => {
    if (!open) return
    void fetch("/api/images/models")
      .then((res) => res.json())
      .then(
        (data: {
          models?: ModelListItem[]
          keyHint?: string | null
          advancedEnabled?: boolean
        }) => {
          setModels(data.models ?? [])
          setKeyHint(data.keyHint ?? null)
          setAdvancedEnabled(Boolean(data.advancedEnabled))
          if (
            data.models?.length &&
            !data.models.some((m) => m.id === model && m.available)
          ) {
            setModel(DEFAULT_IMAGE_MODEL)
          }
        }
      )
      .catch(() => {
        setKeyHint("Could not load model list.")
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh catalog when dialog opens
  }, [open])

  function renderProcedural(nextSeed = seed, fromPrompt?: string) {
    const canvas = canvasRef.current
    if (!canvas) throw new Error("Canvas is not available.")

    const options = fromPrompt
      ? optionsFromPrompt(fromPrompt, { width, height, seed: nextSeed })
      : {
          width,
          height,
          seed: nextSeed,
          style,
          colorA,
          colorB,
          colorC,
          caption,
        }

    if (fromPrompt) {
      setStyle(options.style)
      setColorA(options.colorA)
      setColorB(options.colorB)
      setColorC(options.colorC)
      setCaption(options.caption)
    }

    renderGeneratedImage(canvas, options)
    const dataUrl = canvasToPngDataUrl(canvas)
    setPreviewUrl(dataUrl)
    setFileName(
      fromPrompt
        ? suggestPromptFileName(fromPrompt, nextSeed)
        : suggestFileName(options.style, nextSeed)
    )
    return dataUrl
  }

  async function generateFromPrompt(nextSeed = seed) {
    const text = prompt.trim()
    if (!text) {
      setError("Enter a prompt describing the image you want.")
      return
    }

    setGenerating(true)
    setError(null)
    setStatus(null)
    setProviderNote(null)

    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          width,
          height,
          seed: nextSeed,
          model,
        }),
      })
      const data = (await res.json()) as {
        dataUrl?: string
        seed?: number
        error?: string
        provider?: string
        modelLabel?: string
        needsKey?: boolean
      }

      if (!res.ok || !data.dataUrl) {
        // Don't silently fall back when the user asked for an advanced model
        // that simply needs a key — surface that clearly.
        if (data.needsKey) {
          throw new Error(data.error || "This model needs an API key.")
        }
        throw new Error(data.error || "Prompt generation failed.")
      }

      const png = await dataUrlToPngDataUrl(data.dataUrl)
      setPreviewUrl(png)
      setSeed(data.seed ?? nextSeed)
      setFileName(suggestPromptFileName(text, data.seed ?? nextSeed))
      setProviderNote(
        data.modelLabel
          ? `Generated with ${data.modelLabel}`
          : "Generated from your prompt"
      )
      setStatus("Ready to save or download")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not generate image."
      const needsKey = /POLLINATIONS_API_KEY|API key/i.test(message)
      if (needsKey || model !== DEFAULT_IMAGE_MODEL) {
        setError(message)
        setGenerating(false)
        return
      }
      try {
        renderProcedural(nextSeed, text)
        setProviderNote(
          "AI service unavailable — used local prompt-styled fallback"
        )
        setStatus("Ready to save or download")
        setError(null)
      } catch (fallbackErr) {
        setError(
          fallbackErr instanceof Error ? fallbackErr.message : message
        )
      }
    } finally {
      setGenerating(false)
    }
  }

  function generateProcedural(nextSeed = seed) {
    setGenerating(true)
    setError(null)
    setStatus(null)
    try {
      renderProcedural(nextSeed)
      setProviderNote("Procedural local generate")
      setStatus("Ready to save or download")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate image.")
    } finally {
      setGenerating(false)
    }
  }

  async function generate(nextSeed = seed) {
    if (mode === "prompt") {
      await generateFromPrompt(nextSeed)
    } else {
      generateProcedural(nextSeed)
    }
  }

  useEffect(() => {
    if (!open) return
    // Fresh preview when dialog opens
    void generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open
  }, [open])

  function randomize() {
    const next = Math.floor(Math.random() * 100_000)
    setSeed(next)
    void generate(next)
  }

  async function saveToFolder() {
    if (!previewUrl) return
    const path = folderPath.trim()
    if (!path) {
      setError("Set a folder location first, then save.")
      return
    }
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const png =
        previewUrl.startsWith("data:image/png")
          ? previewUrl
          : await dataUrlToPngDataUrl(previewUrl)
      const res = await fetch("/api/images/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path,
          fileName:
            fileName ||
            (mode === "prompt"
              ? suggestPromptFileName(prompt, seed)
              : suggestFileName(style, seed)),
          dataUrl: png,
        }),
      })
      const data = (await res.json()) as GeneratedSaveResult & { error?: string }
      if (!res.ok) throw new Error(data.error || "Save failed.")
      setStatus(`Saved ${data.name}`)
      setFileName(data.name)
      onSaved?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  function downloadPng() {
    if (!previewUrl) return
    const link = document.createElement("a")
    link.href = previewUrl
    link.download =
      fileName ||
      (mode === "prompt"
        ? suggestPromptFileName(prompt, seed)
        : suggestFileName(style, seed))
    link.click()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(92vh,920px)] overflow-y-auto sm:max-w-3xl"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Image generator</DialogTitle>
          <DialogDescription>
            Describe an image with a prompt, or switch to procedural styles. Save into your
            folder or download a PNG.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          <ModeChip
            active={mode === "prompt"}
            onClick={() => setMode("prompt")}
            label="From prompt"
          />
          <ModeChip
            active={mode === "procedural"}
            onClick={() => setMode("procedural")}
            label="Procedural"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl bg-[oklch(0.18_0.015_240)] ring-1 ring-foreground/10">
              <div className="relative flex aspect-video items-center justify-center p-2">
                {generating && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 text-sm text-white">
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Generating…
                  </div>
                )}
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Generated preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <p className="text-sm text-white/50">Preview appears here</p>
                )}
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            {providerNote && (
              <p className="text-xs text-muted-foreground">{providerNote}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void generate()}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Wand2 data-icon="inline-start" />
                )}
                Generate
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={randomize}
                disabled={generating}
              >
                <RefreshCw data-icon="inline-start" /> New seed
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={downloadPng}
                disabled={!previewUrl || generating}
              >
                <Download data-icon="inline-start" /> Download
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {mode === "prompt" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="gen-prompt">Prompt</Label>
                  <Textarea
                    id="gen-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="A quiet harbor at dusk, teal water, warm lantern light…"
                    rows={4}
                    maxLength={500}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_EXAMPLES.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => setPrompt(example)}
                        className="rounded-md bg-muted px-2 py-1 text-left text-[11px] text-muted-foreground transition hover:text-foreground"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gen-model">Model</Label>
                  <select
                    id="gen-model"
                    className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    {(models.length
                      ? models
                      : [
                          {
                            id: DEFAULT_IMAGE_MODEL,
                            label: "Sana",
                            tier: "free" as const,
                            provider: "pollinations" as const,
                            apiModel: "sana",
                            description: "",
                            available: true,
                          },
                        ]
                    ).map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={!item.available}
                      >
                        {item.label}
                        {item.provider === "openai"
                          ? " · OpenAI"
                          : item.tier === "free"
                            ? " · free"
                            : " · Pollinations"}
                        {!item.available ? " (needs API key)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {models.find((m) => m.id === model)?.description ||
                      "Choose a generation model."}
                  </p>
                  {keyHint && !advancedEnabled && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {keyHint}
                    </p>
                  )}
                  {keyHint &&
                    advancedEnabled &&
                    models.find((m) => m.id === model && !m.available) && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {models.find((m) => m.id === model)?.provider === "openai"
                          ? "Set OPENAI_API_KEY for this model."
                          : "Set POLLINATIONS_API_KEY for this model."}
                      </p>
                    )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Style</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {GENERATOR_STYLES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setStyle(item.id)
                          setFileName(suggestFileName(item.id, seed))
                        }}
                        className={cn(
                          "h-8 rounded-md px-2.5 text-xs transition-colors",
                          style === item.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <ColorField id="color-a" label="A" value={colorA} onChange={setColorA} />
                  <ColorField id="color-b" label="B" value={colorB} onChange={setColorB} />
                  <ColorField id="color-c" label="C" value={colorC} onChange={setColorC} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gen-caption">Caption (optional)</Label>
                  <Input
                    id="gen-caption"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add text on the image"
                    maxLength={80}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label>Size</Label>
              <div className="flex flex-wrap gap-1.5">
                {SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setWidth(preset.width)
                      setHeight(preset.height)
                    }}
                    className={cn(
                      "h-8 rounded-md px-2.5 text-xs transition-colors",
                      width === preset.width && height === preset.height
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="gen-width" className="text-muted-foreground">
                    Width
                  </Label>
                  <Input
                    id="gen-width"
                    type="number"
                    min={256}
                    max={1440}
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value) || 256)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gen-height" className="text-muted-foreground">
                    Height
                  </Label>
                  <Input
                    id="gen-height"
                    type="number"
                    min={256}
                    max={1440}
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value) || 256)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gen-seed">Seed</Label>
              <Input
                id="gen-seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gen-filename">File name</Label>
              <Input
                id="gen-filename"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Saves into{" "}
                <span className="font-mono">
                  {folderPath.trim() || "(set a folder path first)"}
                </span>
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {status && !error && (
              <p className="text-sm text-foreground/80" role="status">
                {status}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => void saveToFolder()}
            disabled={saving || !previewUrl || generating}
          >
            {saving ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            Save to folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModeChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-md px-3 text-xs transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 font-mono text-xs"
        />
      </div>
    </div>
  )
}

export function GeneratorTriggerButton({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <Button type="button" size="lg" variant="outline" className={className} onClick={onClick}>
      <Sparkles data-icon="inline-start" /> Generate
    </Button>
  )
}
