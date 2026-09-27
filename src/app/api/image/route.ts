import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import { mimeForImage, resolveImageInFolder } from "@/lib/images"

export async function GET(request: NextRequest) {
  const folder = request.nextUrl.searchParams.get("path") ?? ""
  const file = request.nextUrl.searchParams.get("file") ?? ""

  try {
    const fullPath = await resolveImageInFolder(folder, file)
    const data = await fs.readFile(fullPath)
    return new NextResponse(data, {
      headers: {
        "Content-Type": mimeForImage(file),
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load image."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
