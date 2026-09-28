const isShopify = (url: string) => url.startsWith("https://cdn.shopify.com/")

/**
 * A smaller copy of a store image where the CDN can resize it (Shopify, which also
 * picks WebP/AVIF for browsers that accept them); other stores serve one size.
 */
export function thumb(url: string, width: number): string {
  if (!isShopify(url)) return url
  const u = new URL(url)
  u.searchParams.set("width", String(width))
  return u.toString()
}

const WIDTHS = [200, 300, 400, 600, 800]

/** `srcset` of resized copies for the browser to choose from, or undefined when the store serves one size. */
export function coverSrcSet(url: string): string | undefined {
  if (!isShopify(url)) return undefined
  return WIDTHS.map((w) => `${thumb(url, w)} ${w}w`).join(", ")
}
