import React, { useMemo, ReactNode } from 'react'
import { Badge, SimpleGrid, Tooltip, Alert, AlertIcon, Flex } from '@chakra-ui/react'
import ImageWithFallback from '@components/images/ImageWithFallback'
import Link from 'next/link'

export interface BaseCard {
  cardid: number
  card_rarity: string
  sub_type: string
  image_url: string
  ownedcardid?: number
}

interface TradeCardSectionProps<T extends BaseCard> {
  title: string
  cards: T[]
  isInteractive?: boolean
  isMobile?: boolean
  cardQuantities?: Record<number, number>
  showLastCopyWarning?: boolean
  showAlreadyOwnWarning?: boolean
  alreadyOwnCards?: Set<number>
  isMyCardsSection?: boolean
  cardsInOtherTradesMap?: Map<number, Set<number>>
  isTradeComplete?: boolean
  renderCardOverlay?: (card: T) => ReactNode
}

export const TradeCardSection = <T extends BaseCard>({
  title,
  cards,
  isInteractive = false,
  isMobile = false,
  cardQuantities,
  showLastCopyWarning = false,
  showAlreadyOwnWarning = false,
  alreadyOwnCards,
  isMyCardsSection = false,
  cardsInOtherTradesMap,
  isTradeComplete = false,
  renderCardOverlay,
}: TradeCardSectionProps<T>) => {
  const lastCopyCards = useMemo(() => {
    if (!showLastCopyWarning || !cardQuantities) return new Set<number>()

    const lastCopies = new Set<number>()
    const cardCounts = new Map<number, number>()

    cards.forEach((card) => {
      cardCounts.set(card.cardid, (cardCounts.get(card.cardid) || 0) + 1)
    })

    cardCounts.forEach((tradingCount, cardID) => {
      const ownedCount = cardQuantities[cardID] || 0
      if (ownedCount > 0 && ownedCount === tradingCount) {
        lastCopies.add(cardID)
      }
    })

    return lastCopies
  }, [cards, cardQuantities, showLastCopyWarning])

  return (
    <div className="flex-1">
      <div className="flex-1 bg-primary rounded-xl shadow-lg overflow-hidden">
        <div className="bg-primary shadow-sm">
          <div className="text-xl text-secondary text-center py-2">{title}</div>
        </div>

        <SimpleGrid
          columns={{ base: 2, sm: 2, md: 3 }}
          spacing={4}
          className="p-6"
        >
          {cards.map((card) => {
            const cardKey = card.ownedcardid || card.ownedcardid || card.cardid
            const isLastCopy = lastCopyCards.has(card.cardid)
            const ownedQuantity = cardQuantities?.[card.cardid] || 0
            const alreadyOwn = alreadyOwnCards?.has(card.cardid)
            const isInOtherTrade =
              cardsInOtherTradesMap &&
              cardsInOtherTradesMap.has(card.cardid) &&
              (cardsInOtherTradesMap.get(card.cardid)?.size ?? 0) > 0

            return (
              <div
                key={cardKey}
                className="relative group flex flex-col items-center transition-all duration-200 max-w-xs sm:max-w-sm"
              >
                <div className="relative w-full aspect-[3/4]">
                  <ImageWithFallback
                    src={card.image_url}
                    alt={`Card`}
                    loading="lazy"
                    fill
                    sizes="(max-width: 768px) 100vw, 256px"
                    style={{
                      objectFit: 'contain',
                      cursor: isInteractive ? 'pointer' : 'default',
                    }}
                  />

                  {renderCardOverlay && renderCardOverlay(card)}

                  <Tooltip label="# of card(s) you own" placement="top">
                    <Badge
                      position="absolute"
                      top="-2"
                      right="-2"
                      zIndex="10"
                      borderRadius="full"
                      px="2"
                      py="1"
                      fontSize="xs"
                      fontWeight="bold"
                      bg="teal.700"
                      color="white"
                      border="1px solid white"
                      boxShadow="0 0 4px rgba(0,0,0,0.4)"
                    >
                      {ownedQuantity}
                    </Badge>
                  </Tooltip>
                </div>

                <Flex gap={2} mt={2} flexWrap="wrap" justifyContent="center">
                  <Badge
                    borderRadius="full"
                    px="2"
                    py="1"
                    fontSize="0.65rem"
                    fontWeight="bold"
                    bg="teal.700"
                    color="white"
                  >
                    {card.card_rarity}
                  </Badge>

                  <Badge
                    borderRadius="full"
                    px="2"
                    py="1"
                    fontSize="0.65rem"
                    fontWeight="bold"
                    bg="purple.700"
                    color="white"
                  >
                    {card.sub_type}
                  </Badge>
                </Flex>

                {!isTradeComplete && (
                  <>
                    {isInOtherTrade && (
                      <Alert
                        status="warning"
                        variant="subtle"
                        mt="2"
                        className="!bg-primary"
                      >
                        ⚠
                        <span className="text-xs">
                          {Array.from(
                            cardsInOtherTradesMap?.get(card.cardid) ?? []
                          ).map((tid, idx, arr) => (
                            <span key={tid}>
                              <Link
                                href={`/trade/${tid}`}
                                className="!hover:no-underline !text-link underline"
                              >
                                Also in Trade #{tid}
                              </Link>
                              {idx < arr.length - 1 && ', '}
                            </span>
                          ))}
                        </span>
                      </Alert>
                    )}

                    {isLastCopy && (
                      <Alert
                        status="warning"
                        variant="subtle"
                        mt="2"
                        className="!bg-primary"
                      >
                        <AlertIcon boxSize="12px" mr="1" />
                        <span className="text-xs">
                          {isMyCardsSection
                            ? 'You are trading away your last copy'
                            : 'Trade partner is trading away their last copy'}
                        </span>
                      </Alert>
                    )}

                    {showAlreadyOwnWarning && alreadyOwn && (
                      <Alert
                        status="info"
                        variant="subtle"
                        mt="2"
                        className="!bg-primary"
                      >
                        <AlertIcon boxSize="12px" mr="1" />
                        <span className="text-xs">
                          You already own this card
                        </span>
                      </Alert>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </SimpleGrid>
      </div>
    </div>
  )
}
export default TradeCardSection
