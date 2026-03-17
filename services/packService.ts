export type PackInfo = {
  id: string
  label: string
  description: string
  imageUrl: string
  price: number
  priceLabel: string
}

class PackService {
  readonly packs = {
    base: {
      id: 'base',
      label: 'Base',
      description:
        'The base trading card pack. Contains 6 cards ranging from Common to Mythic rarity.',
      purchaseText: 'Base Pack Purchase',
      imageUrl: '/images/base-pack-base.png',
      price: 100_000,
      priceLabel: '100k',
      covers: [
        //{ name: 'old', url: '/base-pack-cover.png' },
        { name: 'base', url: '/base-pack-base.png' },
        { name: 'meme', url: '/base-pack-meme.png' },
      ],
    },
    ruby: {
      id: 'ruby',
      label: 'Ultimus',
      description:
        'The premium trading card pack. Contains 6 cards with 5x better odds for Rare and Mythic cards.',
      purchaseText: 'Ultimus Pack Purchase',
      imageUrl: '/images/ruby-pack-cover.png',
      price: 250_000,
      priceLabel: '250k',
      covers: [{ name: 'old', url: '/ruby-pack-cover.png' }],
    },
    throwback: {
      id: 'throwback',
      label: 'Throwback',
      description:
        'Rare vintage pack containing retired legacy cards. Contains 6 non-pullable legacy cards from past seasons.',
      purchaseText: 'Retro Pack Purchase',
      imageUrl: '/images/retro-pack-2026.png',
      price: 1_000_000,
      priceLabel: '1M',
      covers: [{ name: 'old', url: '/retro-pack-2026.png' }],
    },
    event: {
      id: 'event',
      label: 'Event',
      description:
        'Special event pack. Contains 6 cards with premium odds for Rare and Mythic cards.',
      purchaseText: 'Event Pack Purchase',
      imageUrl: '/images/event-pack-cover.png',
      price: 1_000_000,
      priceLabel: '1M',
      covers: [{ name: 'old', url: '/event-pack-cover.png' }],
    },
  } as const

  basePackCover(): string {
    const minimum: number = 0
    const maximum: number = 100000
    const memeCoverChance: number =
      Math.floor(Math.random() * maximum - minimum + 1) + minimum
    if (memeCoverChance === 10) {
      return this.packs.base.covers.find(
        (packCover) => packCover.name === 'meme'
      ).url
    }

    const coverIndex: number = Math.floor(
      Math.random() * (Object.values(this.packs.base.covers).length - 1)
    )
    return this.packs.base.covers.at(coverIndex).url
  }
  rubyPackCover(): string {
    return this.packs.ruby.covers.at(0).url
  }
  throwbackPackCover(): string {
    return this.packs.throwback.covers.at(0).url
  }
  eventPackCover(): string {
    return this.packs.event.covers.at(0).url
  }
}
export const packService = new PackService()
