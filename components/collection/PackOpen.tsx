import axios from 'axios'
import Image from 'next/image'
import { Box, SimpleGrid, Spinner } from '@chakra-ui/react'
import { LatestCards } from '@pages/api/v3'
import { GET } from '@constants/http-methods'
import { query } from '@pages/api/database/query'
import { useCookie } from '@hooks/useCookie'
import config from 'lib/config'
import CardLightBoxModal from '@components/modals/CardLightBoxModal'
import { useState } from 'react'

interface PackOpenProps {
  packID: string
}

const PackOpen: React.FC<PackOpenProps> = ({ packID }) => {
  const [uid] = useCookie(config.userIDCookieName)
  const [lightBoxIsOpen, setLightBoxIsOpen] = useState<boolean>(false)
  const [selectedCard, setSelectedCard] = useState<LatestCards | null>(null)

  const { payload: cards, isLoading: isLoading } = query<LatestCards[]>({
    queryKey: ['latest-cards', packID],
    queryFn: () =>
      axios({
        method: GET,
        url: `/api/v3/collection/uid/latest-cards?packID=${packID}`,
      }),
    enabled: !!packID,
  })

  if (isLoading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}
      >
        <Spinner />
      </div>
    )
  }

  if (!cards) {
    return null
  }

  return (
    <>
      <SimpleGrid columns={3} spacing={4}>
        {cards.map((card: LatestCards) => (
          <Box
            onClick={() => {
              if (card) {
                setSelectedCard(card)
                setLightBoxIsOpen(true)
              }
            }}
          >
            <Image
              key={card.cardid}
              src={card.image_url}
              width={300}
              height={475}
              alt={`Card ${card.cardid}`}
              className={`rounded-sm hover:scale-105 hover:shadow-xl`}
              loading="lazy"
              unoptimized={true}
              style={{ height: 'auto' }}
            />
          </Box>
        ))}
      </SimpleGrid>
      {lightBoxIsOpen && selectedCard && (
        <CardLightBoxModal
          cardName={selectedCard.player_name}
          cardImage={selectedCard.image_url}
          owned={1}
          rarity={selectedCard.card_rarity}
          playerID={selectedCard.playerid}
          leagueID={selectedCard.leagueid}
          cardID={selectedCard.cardid}
          userID={uid}
          setShowModal={() => setLightBoxIsOpen(false)}
        />
      )}
    </>
  )
}

export default PackOpen
