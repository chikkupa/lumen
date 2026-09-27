import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="font-display text-3xl">Page not found</p>
      <p className="text-sm text-muted-foreground">That route does not exist in Lumen.</p>
      <Link
        href="/"
        className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
      >
        Back to viewer
      </Link>
    </div>
  )
}
