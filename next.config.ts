import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    // Only the community-recipe image host. User-entered image URLs from
    // other hosts render via the CSS-background fallback (see RecipeImage).
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  experimental: {
    optimizePackageImports: [
      "@supabase/supabase-js",
      "date-fns",
      "lucide-react",
      "recharts",
    ],
  },
};

export default nextConfig;
