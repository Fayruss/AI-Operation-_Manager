/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ai-ops/types", "@ai-ops/database"],
  experimental: {
    typedRoutes: true
  },
  // lib/ai/prompt-loader.ts reads ../../prompts/*.md at runtime (SAD §10) —
  // Vercel's serverless bundler only includes files it can trace from
  // imports, and a runtime fs.readFileSync of a path outside apps/web
  // needs to be declared explicitly or it's missing in production.
  // (Next.js 15 promoted this out of `experimental` to the top level.)
  outputFileTracingIncludes: {
    "app/api/v1/**/*": ["../../prompts/**/*"]
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }]
  }
};

export default nextConfig;
