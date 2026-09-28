/** A smaller copy of a store image where the CDN can resize it (Shopify); other stores serve one size. */
export function thumb(url: string, width: number): string {
  if (!url.startsWith("https://cdn.shopify.com/")) return url
  const u = new URL(url)
  u.searchParams.set("width", String(width))
  return u.toString()
}
