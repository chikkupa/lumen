"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  ImageIcon,
  Loader2,
  Maximize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  GeneratorTriggerButton,
  ImageGenerator,
} from "@/components/image-generator"
import { cn } from "@/lib/utils"

type ViewerImage = {
  id: string
  name: string
  url: string
  size?: number
  revokeOnCleanup?: boolean
}

type ListResponse = {
  folder: string
  count: number
  images: Array<{
    name: string
    size: number
    mtimeMs: number
    url: string
  }>
  error?: string
}

const INTERVAL_PRESETS_SEC = [3, 5, 10, 15, 30, 60] as const
const DEFAULT_INTERVAL_MS = 10_000
const MIN_INTERVAL_SEC = 1
const MAX_INTERVAL_SEC = 600

const SAMPLE_FOLDER = "/workspace/sample-images"

function clampIntervalMs(ms: number): number {
  const sec = Math.round(ms / 1000)
  const clamped = Math.min(MAX_INTERVAL_SEC, Math.max(MIN_INTERVAL_SEC, sec))
  return clamped * 1000
}

function formatBytes(bytes?: number): string {
  if (bytes == null) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function IntervalControl({
  intervalMs,
  onChange,
  id = "interval",
  variant = "default",
}: {
  intervalMs: number
  onChange: (ms: number) => void
  id?: string
  variant?: "default" | "fullscreen"
}) {
  const seconds = Math.round(intervalMs / 1000)
  const isFullscreen = variant === "fullscreen"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label
        htmlFor={id}
        className={cn(isFullscreen ? "text-white/70" : "text-muted-foreground")}
      >
        Interval
      </Label>
      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          type="number"
          min={MIN_INTERVAL_SEC}
          max={MAX_INTERVAL_SEC}
          step={1}
          value={seconds}
          onChange={(e) => {
            const next = Number(e.target.value)
            if (!Number.isFinite(next)) return
            onChange(clampIntervalMs(next * 1000))
          }}
          className={cn(
            "h-8 w-16 text-center tabular-nums",
            isFullscreen &&
              "border-white/20 bg-white/10 text-white placeholder:text-white/40 focus-visible:border-white/40 focus-visible:ring-white/30"
          )}
          aria-label="Slideshow interval in seconds"
        />
        <span className={cn("text-xs", isFullscreen ? "text-white/60" : "text-muted-foreground")}>
          sec
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {INTERVAL_PRESETS_SEC.map((sec) => {
          const active = seconds === sec
          return (
            <button
              key={sec}
              type="button"
              onClick={() => onChange(sec * 1000)}
              className={cn(
                "h-7 rounded-md px-2 text-xs transition-colors",
                isFullscreen
                  ? active
                    ? "bg-white text-black"
                    : "bg-white/10 text-white/80 hover:bg-white/20"
                  : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
              aria-pressed={active}
            >
              {sec}s
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ImageViewerApp() {
  const [folderPath, setFolderPath] = useState(SAMPLE_FOLDER)
  const [images, setImages] = useState<ViewerImage[]>([])
  const [loadedFolder, setLoadedFolder] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [slideshowOpen, setSlideshowOpen] = useState(false)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [intervalMs, setIntervalMs] = useState(DEFAULT_INTERVAL_MS)
  const [transitionKey, setTransitionKey] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlsRef = useRef<string[]>([])
  const fullscreenRef = useRef<HTMLDivElement>(null)

  const current = images[index] ?? null
  const hasImages = images.length > 0

  const cleanupObjectUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url)
    }
    objectUrlsRef.current = []
  }, [])

  useEffect(() => () => cleanupObjectUrls(), [cleanupObjectUrls])

  const goTo = useCallback(
    (next: number) => {
      if (!images.length) return
      const wrapped = ((next % images.length) + images.length) % images.length
      setIndex(wrapped)
      setTransitionKey((k) => k + 1)
    },
    [images.length]
  )

  const goNext = useCallback(() => goTo(index + 1), [goTo, index])
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index])

  const closeSlideshow = useCallback(() => {
    setSlideshowOpen(false)
    setPlaying(false)
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    }
  }, [])

  const openFullscreen = useCallback(
    (opts?: { play?: boolean }) => {
      if (images.length < 1) return
      setSlideshowOpen(true)
      setPlaying(Boolean(opts?.play) && images.length > 1)
      requestAnimationFrame(() => {
        const el = fullscreenRef.current
        if (el && !document.fullscreenElement && el.requestFullscreen) {
          void el.requestFullscreen().catch(() => {
            // Overlay still covers the viewport if browser fullscreen is denied.
          })
        }
      })
    },
    [images.length]
  )

  useEffect(() => {
    if (!playing || !slideshowOpen || images.length < 2) return
    const timer = window.setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % images.length
        setTransitionKey((k) => k + 1)
        return next
      })
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [playing, slideshowOpen, intervalMs, images.length])

  useEffect(() => {
    function onFullscreenChange() {
      if (!document.fullscreenElement && slideshowOpen) {
        setSlideshowOpen(false)
        setPlaying(false)
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [slideshowOpen])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      if (slideshowOpen) {
        if (e.key === "Escape") {
          e.preventDefault()
          closeSlideshow()
          return
        }
        if (e.key === "ArrowRight") {
          e.preventDefault()
          goNext()
          return
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault()
          goPrev()
          return
        }
        if (e.key === " ") {
          e.preventDefault()
          setPlaying((p) => !p)
          return
        }
        return
      }

      if (e.key === "ArrowRight") {
        e.preventDefault()
        goNext()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        goPrev()
      } else if (e.key === " ") {
        e.preventDefault()
        if (hasImages) openFullscreen({ play: true })
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault()
        if (hasImages) openFullscreen({ play: false })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [slideshowOpen, goNext, goPrev, closeSlideshow, openFullscreen, hasImages])

  useEffect(() => {
    if (!slideshowOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [slideshowOpen])

  async function loadFromPath(pathOverride?: string, selectFile?: string) {
    const path = (pathOverride ?? folderPath).trim()
    if (!path) {
      setError("Enter a folder location on this machine.")
      return
    }

    setLoading(true)
    setError(null)
    setPlaying(false)
    setSlideshowOpen(false)

    try {
      const res = await fetch(`/api/images?path=${encodeURIComponent(path)}`)
      const data = (await res.json()) as ListResponse
      if (!res.ok) {
        throw new Error(data.error || "Could not load that folder.")
      }
      if (!data.images.length) {
        cleanupObjectUrls()
        setImages([])
        setLoadedFolder(data.folder)
        setIndex(0)
        setError("No images found in that folder.")
        return
      }

      cleanupObjectUrls()
      const nextImages = data.images.map((img) => ({
        id: img.url,
        name: img.name,
        url: img.url,
        size: img.size,
      }))
      const selected = selectFile
        ? nextImages.findIndex((img) => img.name === selectFile)
        : 0
      setImages(nextImages)
      setLoadedFolder(data.folder)
      setFolderPath(data.folder)
      setIndex(selected >= 0 ? selected : 0)
      setTransitionKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folder.")
    } finally {
      setLoading(false)
    }
  }

  function onBrowseFiles(files: FileList | null) {
    if (!files?.length) return
    setLoading(true)
    setError(null)
    setPlaying(false)
    setSlideshowOpen(false)

    const picked: ViewerImage[] = []
    const urls: string[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue
      const url = URL.createObjectURL(file)
      urls.push(url)
      picked.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        url,
        size: file.size,
        revokeOnCleanup: true,
      })
    }

    cleanupObjectUrls()
    objectUrlsRef.current = urls

    picked.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    )

    if (!picked.length) {
      setImages([])
      setLoadedFolder("Browser selection")
      setError("No image files in that selection.")
      setLoading(false)
      return
    }

    setImages(picked)
    setLoadedFolder("Browser selection")
    setIndex(0)
    setTransitionKey((k) => k + 1)
    setLoading(false)
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="atmosphere" />
        <div className="grain" />
      </div>

      <header className="relative z-10 border-b border-foreground/8 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
              Lumen
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Folder image viewer with slideshow
            </p>
          </div>
          {hasImages && (
            <p className="text-xs text-muted-foreground sm:text-sm">
              {index + 1} / {images.length}
              {current ? ` · ${current.name}` : ""}
            </p>
          )}
        </div>
      </header>

      <section className="relative z-10 border-b border-foreground/8 px-4 py-4 sm:px-6">
        <form
          className="mx-auto flex max-w-6xl flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void loadFromPath()
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="folder-path">Folder location</Label>
              <Input
                id="folder-path"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="/path/to/your/images"
                className="h-10 font-mono text-sm"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="lg" disabled={loading} className="h-10">
                {loading ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <FolderOpen data-icon="inline-start" />
                )}
                Load folder
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-10"
                disabled={loading}
                onClick={() => fileInputRef.current?.click()}
              >
                Browse…
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="h-10"
                disabled={loading}
                onClick={() => {
                  setFolderPath(SAMPLE_FOLDER)
                  void loadFromPath(SAMPLE_FOLDER)
                }}
              >
                Sample images
              </Button>
              <GeneratorTriggerButton
                className="h-10"
                onClick={() => setGeneratorOpen(true)}
              />
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onBrowseFiles(e.target.files)}
            {...({
              webkitdirectory: "",
              directory: "",
            } as React.InputHTMLAttributes<HTMLInputElement>)}
          />
          <p className="text-xs text-muted-foreground">
            Type an absolute path on this machine, or browse a local folder. Supported: JPG,
            PNG, GIF, WebP, BMP, AVIF, SVG.
          </p>
          {loadedFolder && !error && (
            <p className="text-xs text-foreground/70">
              Loaded from <span className="font-mono">{loadedFolder}</span>
              {hasImages ? ` · ${images.length} image${images.length === 1 ? "" : "s"}` : ""}
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </form>
      </section>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
        {!hasImages && !loading && (
          <EmptyState onLoadSample={() => void loadFromPath(SAMPLE_FOLDER)} />
        )}

        {loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm">Reading folder…</p>
          </div>
        )}

        {hasImages && current && !loading && (
          <>
            <div className="stage group relative flex min-h-[min(58vh,520px)] flex-1 items-center justify-center overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.28_0.02_240)_0%,oklch(0.18_0.015_240)_100%)]" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={transitionKey}
                src={current.url}
                alt={current.name}
                className="slide-in relative z-[1] h-full max-h-[min(58vh,520px)] w-full object-contain px-2 py-4 sm:px-8"
                draggable={false}
              />

              <Button
                type="button"
                variant="secondary"
                size="icon-lg"
                className="absolute top-1/2 left-3 z-[2] -translate-y-1/2 opacity-90 shadow-md sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                onClick={goPrev}
                aria-label="Previous image"
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-lg"
                className="absolute top-1/2 right-3 z-[2] -translate-y-1/2 opacity-90 shadow-md sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                onClick={goNext}
                aria-label="Next image"
              >
                <ChevronRight />
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-3 right-3 z-[2] opacity-90 shadow-md sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                onClick={() => openFullscreen({ play: false })}
                aria-label="Fullscreen"
                title="Fullscreen"
              >
                <Maximize2 />
              </Button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => goTo(0)}
                  aria-label="First image"
                >
                  <SkipBack />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={goPrev}
                  aria-label="Previous"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="min-w-28"
                  onClick={() => openFullscreen({ play: false })}
                  disabled={!hasImages}
                >
                  <Maximize2 data-icon="inline-start" /> Fullscreen
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="min-w-28"
                  onClick={() => openFullscreen({ play: true })}
                  disabled={!hasImages}
                >
                  <Play data-icon="inline-start" /> Slideshow
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={goNext}
                  aria-label="Next"
                >
                  <ChevronRight />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => goTo(images.length - 1)}
                  aria-label="Last image"
                >
                  <SkipForward />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <IntervalControl
                  intervalMs={intervalMs}
                  onChange={setIntervalMs}
                  id="interval"
                />
                {current.size != null && (
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(current.size)}
                  </span>
                )}
              </div>
            </div>

            <div className="thumb-rail -mx-1 overflow-x-auto pb-2">
              <div className="flex min-w-min gap-2 px-1">
                {images.map((image, i) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => goTo(i)}
                    className={cn(
                      "relative h-16 w-20 shrink-0 overflow-hidden rounded-md ring-offset-2 transition-[transform,box-shadow] duration-200 hover:scale-[1.03]",
                      i === index
                        ? "ring-2 ring-primary"
                        : "ring-1 ring-foreground/10 opacity-80 hover:opacity-100"
                    )}
                    aria-label={`Show ${image.name}`}
                    aria-current={i === index ? "true" : undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt=""
                      className="size-full object-cover"
                      draggable={false}
                    />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <ImageGenerator
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        folderPath={folderPath}
        onSaved={(saved) => {
          void loadFromPath(saved.folder, saved.name)
        }}
      />

      {slideshowOpen && current && (
        <div
          ref={fullscreenRef}
          className="slideshow-fullscreen group/fs fixed inset-0 z-50 bg-black text-white"
          role="dialog"
          aria-modal="true"
          aria-label="Slideshow"
        >
          {/* Full-bleed image: uses entire viewport, fits by width or height */}
          <div className="absolute inset-0 bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={`fs-${transitionKey}`}
              src={current.url}
              alt={current.name}
              className="slide-in absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />
          </div>

          {/* Overlay controls: hidden until hover / focus */}
          <div className="slideshow-fs-controls absolute inset-0 z-20">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/70 to-transparent" />

            <header className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium drop-shadow sm:text-base">
                  {current.name}
                </p>
                <p className="text-xs text-white/70 drop-shadow">
                  {index + 1} / {images.length}
                  {playing ? " · Playing" : " · Paused"}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <IntervalControl
                  intervalMs={intervalMs}
                  onChange={setIntervalMs}
                  id="interval-fullscreen"
                  variant="fullscreen"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="bg-black/45 text-white hover:bg-black/60"
                  onClick={closeSlideshow}
                  aria-label="Exit slideshow"
                >
                  <X />
                </Button>
              </div>
            </header>

            <button
              type="button"
              className="absolute top-1/2 left-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60 sm:left-4 sm:size-12"
              onClick={goPrev}
              aria-label="Previous slide"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              className="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60 sm:right-4 sm:size-12"
              onClick={goNext}
              aria-label="Next slide"
            >
              <ChevronRight className="size-6" />
            </button>

            <footer className="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-4 pt-2 pb-5 sm:px-6">
              {playing && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    key={`fs-progress-${transitionKey}-${intervalMs}`}
                    className="slideshow-progress h-full bg-accent-bar"
                    style={{ animationDuration: `${intervalMs}ms` }}
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="bg-black/45 text-white hover:bg-black/60"
                  onClick={() => goTo(0)}
                  aria-label="First image"
                >
                  <SkipBack />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="bg-black/45 text-white hover:bg-black/60"
                  onClick={goPrev}
                  aria-label="Previous"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="min-w-28"
                  onClick={() => setPlaying((p) => !p)}
                  disabled={images.length < 2}
                >
                  {playing ? (
                    <>
                      <Pause data-icon="inline-start" /> Pause
                    </>
                  ) : (
                    <>
                      <Play data-icon="inline-start" /> Play
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="bg-black/45 text-white hover:bg-black/60"
                  onClick={goNext}
                  aria-label="Next"
                >
                  <ChevronRight />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="bg-black/45 text-white hover:bg-black/60"
                  onClick={() => goTo(images.length - 1)}
                  aria-label="Last image"
                >
                  <SkipForward />
                </Button>
              </div>
              <p className="text-center text-xs text-white/55">
                Hover to show controls · ← → navigate · Space play/pause · Esc exit
              </p>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ onLoadSample }: { onLoadSample: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="empty-glow mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ImageIcon className="size-8" />
      </div>
      <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        Open a folder of photos
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
        Point Lumen at a folder path on this machine, then flip through images or start a
        slideshow.
      </p>
      <Button type="button" className="mt-6" size="lg" onClick={onLoadSample}>
        Try sample images
      </Button>
    </div>
  )
}
