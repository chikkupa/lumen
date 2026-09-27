import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Cloud Agent / browser testing often hits 127.0.0.1 while Next binds to localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
}

export default nextConfig
