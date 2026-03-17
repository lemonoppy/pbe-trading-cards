export type Rarity = {
  label: string
  rarity: number // Weight out of 10000 (100.00% with 2 decimal precision)
  emoji: string
  color?: string // Hex color code for special styling
}

// Rarity definitions with display properties
export const rarityDefinitions = {
  common: {
    label: 'Common',
    emoji: '⚪',
    color: '#9CA3AF', // Gray
  },
  uncommon: {
    label: 'Uncommon',
    emoji: '🔵',
    color: '#0C65EE', // Blue
  },
  rare: {
    label: 'Rare',
    emoji: '🔴',
    color: '#E0115F', // Ruby red
  },
  mythic: {
    label: 'Mythic',
    emoji: '🌟',
    color: '#BD8700', // Gold
  },
} as const

// Base Pack Weights - All rarities available, common-heavy distribution
const rarityMap = {
  common: { ...rarityDefinitions.common, rarity: 8000 },
  uncommon: { ...rarityDefinitions.uncommon, rarity: 1700 },
  rare: { ...rarityDefinitions.rare, rarity: 250 },
  mythic: { ...rarityDefinitions.mythic, rarity: 50 },
} as const satisfies Record<string, Rarity>

// Ultimus Pack Weights - All rarities available, better odds for rare cards
const rarityMapRuby = {
  common: { ...rarityDefinitions.common, rarity: 5700 },
  uncommon: { ...rarityDefinitions.uncommon, rarity: 2850 },
  rare: { ...rarityDefinitions.rare, rarity: 1250 },
  mythic: { ...rarityDefinitions.mythic, rarity: 200 },
} as const satisfies Record<string, Rarity>

// Sub-type display order (for UI sorting and filters)
export const subTypeOrder = [
  'Base',
  'Autograph Rookie',
  'Award',
  'Charity',
  'Honors',
  'Holograph Expansion',
  'Insert',
  'Team Logo',
  'Fantasy Kings',
  'Captains',
  'Least Valuable Player',
  'Ultimus Champion',
  'Hall of Fame',
  'Unique',
] as const

export { rarityMap, rarityMapRuby }
