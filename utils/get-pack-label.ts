import { packService } from 'services/packService'

/**
 * Get the display label for a pack type ID
 * @param packTypeId - The pack type ID (e.g., 'ruby', 'base', 'throwback', 'event')
 * @returns The capitalized display label (e.g., 'Ultimus', 'Base', 'Throwback', 'Event')
 */
export const getPackLabel = (packTypeId: string): string => {
  if (!packTypeId) return ''
  const pack = packService.packs[packTypeId]
  return pack?.label || capitalizeFirstLetter(packTypeId)
}

/**
 * Capitalize the first letter of a string
 * @param str - The string to capitalize
 * @returns The capitalized string
 */
export const capitalizeFirstLetter = (str: string): string => {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}
