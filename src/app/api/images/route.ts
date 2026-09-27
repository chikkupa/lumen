import { NextRequest, NextResponse } from "next/server"
import { listImagesInFolder } from "@/lib/images"

export async function GET(request: NextRequest) {
  const folder = request.nextUrl.searchParams.get("path") ?? ""

  try {
    const result = await listImagesInFolder(folder)
    return NextResponse.json({
      folder: result.folder,
      count: result.images.length,
      images: result.images.map((image) => ({
        name: image.name,
        size: image.size,
        mtimeMs: image.mtimeMs,
        url: `/api/image?path=${encodeURIComponent(result.folder)}&file=${encodeURIComponent(image.name)}`,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list images."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
