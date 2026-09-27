import { NextRequest, NextResponse } from "next/server"
import { savePngToFolder } from "@/lib/images"

type SaveBody = {
  path?: string
  fileName?: string
  dataUrl?: string
}

function parsePngDataUrl(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim())
  if (!match) {
    throw new Error("Expected a PNG data URL.")
  }
  const buffer = Buffer.from(match[1], "base64")
  if (buffer.length < 8 || buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Invalid PNG data.")
  }
  if (buffer.length > 12 * 1024 * 1024) {
    throw new Error("Image is too large (max 12MB).")
  }
  return buffer
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SaveBody
    const folder = body.path ?? ""
    const fileName = body.fileName ?? "lumen-generated.png"
    const dataUrl = body.dataUrl ?? ""

    if (!folder.trim()) {
      return NextResponse.json({ error: "Folder path is required." }, { status: 400 })
    }
    if (!dataUrl) {
      return NextResponse.json({ error: "Image data is required." }, { status: 400 })
    }

    const png = parsePngDataUrl(dataUrl)
    const saved = await savePngToFolder(folder, fileName, png)

    return NextResponse.json({
      folder: saved.folder,
      name: saved.name,
      size: saved.size,
      url: `/api/image?path=${encodeURIComponent(saved.folder)}&file=${encodeURIComponent(saved.name)}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save image."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
