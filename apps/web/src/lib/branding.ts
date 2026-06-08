/**
 * Branding utilities for the booking page.
 * Handles color contrast, CSS variable injection, and fallbacks.
 */

export interface BrandConfig {
  primaryColor?: string | undefined
  logoUrl?: string | undefined
  bannerUrl?: string | undefined
  welcomeMessage?: string | undefined
}

/** Default MeetFlow brand color */
export const DEFAULT_PRIMARY = "#2563eb" // blue-600

/**
 * Validate that a foreground color meets WCAG AA contrast (≥4.5:1)
 * against a white background. Returns the original color if valid,
 * or a darkened version if insufficient contrast.
 */
export function ensureContrast(hex: string, bgHex = "#ffffff"): string {
  const fg = hexToRgb(hex)
  if (!fg) return DEFAULT_PRIMARY

  const bg = hexToRgb(bgHex)
  if (!bg) return DEFAULT_PRIMARY

  const ratio = contrastRatio(fg, bg)
  if (ratio >= 4.5) return hex

  // Darken the color until we reach adequate contrast
  return darkenToContrast(hex, bgHex, 4.5)
}

/** Relative luminance per WCAG 2.1 */
function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function contrastRatio(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  const l1 = luminance(a)
  const l2 = luminance(b)
  return l1 > l2 ? (l1 + 0.05) / (l2 + 0.05) : (l2 + 0.05) / (l1 + 0.05)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return null
  return {
    r: parseInt(m[1]!, 16),
    g: parseInt(m[2]!, 16),
    b: parseInt(m[3]!, 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((c) => Math.round(c).toString(16).padStart(2, "0"))
    .join("")}`
}

/** Darken a hex color until it meets the target contrast ratio against background */
function darkenToContrast(hex: string, bgHex: string, target: number): string {
  const rgb = hexToRgb(hex)
  const bg = hexToRgb(bgHex)
  if (!rgb || !bg) return DEFAULT_PRIMARY

  let { r, g, b } = rgb
  for (let i = 0; i < 50; i++) {
    if (contrastRatio({ r, g, b }, bg) >= target) break
    r = Math.max(0, r - 5)
    g = Math.max(0, g - 5)
    b = Math.max(0, b - 5)
  }
  return rgbToHex(r, g, b)
}

/** Build CSS custom properties string from brand config */
export function brandCssVars(brand: BrandConfig): string {
  const primary = ensureContrast(brand.primaryColor || DEFAULT_PRIMARY)
  const lines: string[] = [`--brand-primary: ${primary};`]
  if (brand.logoUrl) {
    lines.push(`--brand-logo-url: url(${brand.logoUrl});`)
  }
  if (brand.bannerUrl) {
    lines.push(`--brand-banner-url: url(${brand.bannerUrl});`)
  }
  return `:root { ${lines.join(" ")} }`
}
