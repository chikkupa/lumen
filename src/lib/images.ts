import fs from "fs/promises"
import path from "path"

export const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".avif",
  ".svg",
])

export type ImageEntry = {
  name: string
  path: string
  size: number
  mtimeMs: number
}

export function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase())
}

export function mimeForImage(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase()
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".png":
      return "image/png"
    case ".gif":
      return "image/gif"
    case ".webp":
      return "image/webp"
    case ".bmp":
      return "image/bmp"
    case ".avif":
      return "image/avif"
    case ".svg":
      return "image/svg+xml"
    default:
      return "application/octet-stream"
  }
}

/** Resolve a user-supplied folder path and ensure it is a directory. */
export async function resolveFolder(folderPath: string): Promise<string> {
  const trimmed = folderPath.trim()
  if (!trimmed) {
    throw new Error("Folder path is required.")
  }

  const resolved = path.resolve(trimmed)
  let stats
  try {
    stats = await fs.stat(resolved)
  } catch {
    throw new Error(`Folder not found: ${resolved}`)
  }

  if (!stats.isDirectory()) {
    throw new Error(`Not a folder: ${resolved}`)
  }

  return resolved
}

/** Ensure filePath is an image file inside folderPath (no path escape). */
export async function resolveImageInFolder(
  folderPath: string,
  fileName: string
): Promise<string> {
  const folder = await resolveFolder(folderPath)
  const base = path.basename(fileName)
  if (!base || base !== fileName.replace(/\\/g, "/").split("/").pop()) {
    throw new Error("Invalid file name.")
  }
  if (!isImageFile(base)) {
    throw new Error("Not an image file.")
  }

  const full = path.resolve(folder, base)
  if (!full.startsWith(folder + path.sep) && full !== folder) {
    throw new Error("File is outside the selected folder.")
  }

  let stats
  try {
    stats = await fs.stat(full)
  } catch {
    throw new Error("Image not found.")
  }
  if (!stats.isFile()) {
    throw new Error("Not a file.")
  }

  return full
}

/** Sanitize a user filename to a safe basename ending in .png */
export function sanitizePngFileName(fileName: string): string {
  const base = path.basename(fileName).replace(/[^\w.\- ()[\]]+/g, "_").trim()
  if (!base || base === "." || base === "..") {
    throw new Error("Invalid file name.")
  }
  const withExt = base.toLowerCase().endsWith(".png") ? base : `${base}.png`
  if (!isImageFile(withExt) || path.extname(withExt).toLowerCase() !== ".png") {
    throw new Error("Only PNG files can be saved.")
  }
  return withExt
}

export async function savePngToFolder(
  folderPath: string,
  fileName: string,
  pngBuffer: Buffer
): Promise<{ folder: string; name: string; path: string; size: number }> {
  const folder = await resolveFolder(folderPath)
  let name = sanitizePngFileName(fileName)
  let full = path.resolve(folder, name)

  if (!full.startsWith(folder + path.sep)) {
    throw new Error("File is outside the selected folder.")
  }

  // Avoid overwriting: append -2, -3, ...
  const ext = path.extname(name)
  const stem = path.basename(name, ext)
  let attempt = 1
  while (true) {
    try {
      await fs.access(full)
      attempt += 1
      name = `${stem}-${attempt}${ext}`
      full = path.resolve(folder, name)
    } catch {
      break
    }
  }

  await fs.writeFile(full, pngBuffer)
  const stats = await fs.stat(full)
  return { folder, name, path: full, size: stats.size }
}

export async function listImagesInFolder(
  folderPath: string
): Promise<{ folder: string; images: ImageEntry[] }> {
  const folder = await resolveFolder(folderPath)
  const entries = await fs.readdir(folder, { withFileTypes: true })

  const images: ImageEntry[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !isImageFile(entry.name)) continue
    const full = path.join(folder, entry.name)
    const stats = await fs.stat(full)
    images.push({
      name: entry.name,
      path: full,
      size: stats.size,
      mtimeMs: stats.mtimeMs,
    })
  }

  images.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
  )

  return { folder, images }
}
