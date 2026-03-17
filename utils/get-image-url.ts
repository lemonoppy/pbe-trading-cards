/**
 * Get the full image URL for a card
 * Handles both legacy filename-only URLs and new full Vercel Blob URLs
 *
 * @param imageUrl - The image_url from the database (can be filename or full URL)
 * @returns Full image URL
 */
export function getImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null

  // If it's already a full URL (starts with http:// or https://), return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl
  }

  // Legacy behavior: If it's just a filename, use the old SHL domain
  // (For backwards compatibility with any old cards that might exist)
  return `https://simulationhockey.com/tradingcards/${imageUrl}`
}
