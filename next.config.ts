import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: true,
    optimizePackageImports: [
      "@supabase/supabase-js",
      "date-fns",
      "lucide-react",
      "recharts",
    ],
  },
};

export default nextConfig;
