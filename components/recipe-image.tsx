import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Only hosts listed in next.config.ts `images.remotePatterns` may go through
 * the Next.js image optimizer; user-entered URLs from other hosts fall back
 * to an unoptimized CSS background.
 */
function isOptimizableImageUrl(url: string): boolean {
  try {
    return new URL(url).hostname === "images.unsplash.com";
  } catch {
    return false;
  }
}

interface RecipeImageProps {
  imageUrl?: string;
  alt: string;
  /** `sizes` hint for the optimizer, e.g. "(max-width: 768px) 100vw, 33vw". */
  sizes: string;
  className?: string;
}

export function RecipeImage({ imageUrl, alt, sizes, className }: RecipeImageProps) {
  if (imageUrl && isOptimizableImageUrl(imageUrl)) {
    return (
      <div className={cn("bg-muted relative w-full overflow-hidden", className)}>
        <Image src={imageUrl} alt={alt} fill sizes={sizes} className="object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn("bg-muted relative w-full overflow-hidden", className)}
      style={
        imageUrl
          ? {
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    />
  );
}
