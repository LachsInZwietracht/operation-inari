import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
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
