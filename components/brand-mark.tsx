import Image, { type ImageProps } from "next/image"

import { cn } from "@/lib/utils"

const BRAND_MARK_SOURCES = {
  green: "/brand/svg/logo-mark.svg",
  black: "/brand/svg/logo-mark-black.svg",
  white: "/brand/svg/logo-mark-white.svg",
} as const

type BrandMarkVariant = keyof typeof BRAND_MARK_SOURCES

interface BrandMarkProps extends Omit<ImageProps, "src" | "alt"> {
  alt?: string
  variant?: BrandMarkVariant
}

export function BrandMark({
  alt = "",
  className,
  height = 128,
  variant = "green",
  width = 128,
  ...props
}: BrandMarkProps) {
  return (
    <Image
      src={BRAND_MARK_SOURCES[variant]}
      alt={alt}
      width={width}
      height={height}
      className={cn("block shrink-0 object-contain", className)}
      {...props}
    />
  )
}
