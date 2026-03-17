import React, { useEffect, useState } from 'react'
import { Link } from 'components/common/Link'
import { GET } from '@constants/http-methods'
import { query } from '@pages/api/database/query'
import { UserCollection } from '@pages/api/v3'
import axios from 'axios'
import { Box, Stack, Skeleton, SkeletonText, Image } from '@chakra-ui/react'

interface BackOfCardProps {
  cardID: string
  userID: string
  isOwned: boolean
  playerID?: number
  cardName?: string
  rarity?: string
}

type CardInfo = {
  userid: number
  username: string
  date_approved: string
}

type CardData = {
  sub_type?: string
  author_userid?: number
}

type PlayerStat = {
  season: number
  seasonState: string
  passCmp: number
  passAtt: number
  passYds: number
  passTD: number
  rushAtt: number
  rushYds: number
  rushTD: number
  recRec: number
  recYds: number
  recTD: number
  defTck: number
  defSack: number
  defTFL: number
  defInt: number
  defPD: number
  otherPancakes: number
  otherSacksAllowed: number
}

type Award = {
  id: number
  season: number
  type: string
  team?: string
  position?: string
}

export const BackOfCard: React.FC<BackOfCardProps> = ({
  cardID,
  userID,
  isOwned,
  playerID,
  cardName,
  rarity,
}) => {
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([])
  const [playerAwards, setPlayerAwards] = useState<Award[]>([])
  const [loadingPlayerData, setLoadingPlayerData] = useState(false)
  const [cardType, setCardType] = useState<string>('')
  const [artist, setArtist] = useState<string>('')
  const [position, setPosition] = useState<string>('')

  const { payload: packs, isLoading: packsLoading } = query<UserCollection[]>({
    queryKey: ['packs-from-cards', cardID, userID, String(isOwned)],
    queryFn: () =>
      axios({
        method: GET,
        url: `/api/v3/cards/packs-from-cards?userID=${userID}&cardID=${cardID}&isOwned=${isOwned}`,
      }),
    enabled: !!cardID && !!userID && isOwned,
  })

  useEffect(() => {
    const fetchCardInfo = async () => {
      try {
        // Fetch card metadata (author info)
        const cardInfoResponse = await axios.get(
          `/api/v3/cards/${cardID}/info`
        )
        if (cardInfoResponse.data?.payload?.[0]) {
          setArtist(cardInfoResponse.data.payload[0].username || 'Unknown')
        }

        // Fetch full card data (for sub_type and position)
        const cardResponse = await axios.get(`/api/v3/cards?cardid=${cardID}`)
        if (cardResponse.data?.payload?.rows?.[0]) {
          const cardData = cardResponse.data.payload.rows[0]
          setCardType(cardData.sub_type || 'Unknown')
          setPosition(cardData.position || '')
        }
      } catch (error) {
        console.error('[BackOfCard] Failed to fetch card info:', error)
      }
    }

    fetchCardInfo()
  }, [cardID])

  useEffect(() => {
    const fetchPlayerData = async () => {
      if (!playerID || playerID === -1) {
        console.log('[BackOfCard] Skipping player data fetch - invalid playerID:', playerID)
        return
      }

      console.log('[BackOfCard] Fetching player data for playerID:', playerID)
      setLoadingPlayerData(true)
      try {
        // Fetch stats and awards via proxy endpoints
        const [statsResponse, awardsResponse] = await Promise.all([
          axios.get(`/api/v3/portal/player-stats?pid=${playerID}`),
          axios.get(`/api/v3/portal/player-awards?pid=${playerID}`),
        ])

        console.log('[BackOfCard] Stats response:', statsResponse.data)
        console.log('[BackOfCard] Awards response:', awardsResponse.data)
        setPlayerStats(statsResponse.data || [])
        setPlayerAwards(awardsResponse.data || [])
      } catch (error) {
        console.error('[BackOfCard] Failed to fetch player data:', error)
      } finally {
        setLoadingPlayerData(false)
      }
    }

    fetchPlayerData()
  }, [playerID])

  if (packsLoading || loadingPlayerData) {
    return (
      <Stack spacing={4} mt={5}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Box
            key={index}
            p={5}
            shadow="md"
            borderWidth="1px"
            borderRadius="md"
          >
            <Skeleton height="20px" mb="4" />
            <SkeletonText mt="4" noOfLines={2} spacing="4" />
          </Box>
        ))}
      </Stack>
    )
  }

  // Calculate career totals
  const careerTotals = playerStats.reduce(
    (acc, stat) => ({
      passYds: acc.passYds + (stat.passYds || 0),
      passTD: acc.passTD + (stat.passTD || 0),
      rushYds: acc.rushYds + (stat.rushYds || 0),
      rushTD: acc.rushTD + (stat.rushTD || 0),
      recYds: acc.recYds + (stat.recYds || 0),
      recTD: acc.recTD + (stat.recTD || 0),
      defTck: acc.defTck + (stat.defTck || 0),
      defSack: acc.defSack + (stat.defSack || 0),
      defTFL: acc.defTFL + (stat.defTFL || 0),
      defInt: acc.defInt + (stat.defInt || 0),
      defPD: acc.defPD + (stat.defPD || 0),
      pancakes: acc.pancakes + (stat.otherPancakes || 0),
      sacksAllowed: acc.sacksAllowed + (stat.otherSacksAllowed || 0),
    }),
    {
      passYds: 0,
      passTD: 0,
      rushYds: 0,
      rushTD: 0,
      recYds: 0,
      recTD: 0,
      defTck: 0,
      defSack: 0,
      defTFL: 0,
      defInt: 0,
      defPD: 0,
      pancakes: 0,
      sacksAllowed: 0,
    }
  )

  return (
    <Stack spacing={4} className="p-4 overflow-y-auto h-full bg-gray-800">
      {/* Card Header */}
      <Box className="text-center border-b pb-2">
        <div className="text-xl font-bold">{cardName}</div>
        <div className="text-sm text-gray-600">
          {rarity && <div>Rarity: {rarity}</div>}
          {cardType && <div>Type: {cardType}</div>}
          {artist && <div>Artist: {artist}</div>}
        </div>
      </Box>

      {/* Portal Link */}
      {playerID && playerID !== -1 && (
        <Box p={3} borderWidth="1px" rounded="md" className="bg-primary text-center">
          <Link
            href={`https://portal.pbe.simflow.io/player/${playerID}`}
            className="text-link font-bold"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Portal →
          </Link>
        </Box>
      )}

      {/* Career Stats Summary */}
      {playerStats.length > 0 && (
        <Box p={3} borderWidth="1px" rounded="md" className="bg-primary">
          <div className="font-bold mb-2">Career Totals</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {careerTotals.passYds > 0 && (
              <>
                <div>Pass Yds: {careerTotals.passYds}</div>
                <div>Pass TD: {careerTotals.passTD}</div>
              </>
            )}
            {careerTotals.rushYds > 0 && (
              <>
                <div>Rush Yds: {careerTotals.rushYds}</div>
                <div>Rush TD: {careerTotals.rushTD}</div>
              </>
            )}
            {careerTotals.recYds > 0 && (
              <>
                <div>Rec Yds: {careerTotals.recYds}</div>
                <div>Rec TD: {careerTotals.recTD}</div>
              </>
            )}
            {(position === 'TE' || position === 'OL') && careerTotals.pancakes > 0 && (
              <div>Pancakes: {careerTotals.pancakes}</div>
            )}
            {(position === 'TE' || position === 'OL') && careerTotals.sacksAllowed > 0 && (
              <div>Sacks Allowed: {careerTotals.sacksAllowed}</div>
            )}
            {careerTotals.defTck > 0 && (
              <>
                <div>Tackles: {careerTotals.defTck}</div>
                <div>Sacks: {careerTotals.defSack}</div>
                <div>TFL: {careerTotals.defTFL}</div>
                <div>INT: {careerTotals.defInt}</div>
                <div>PD: {careerTotals.defPD}</div>
              </>
            )}
          </div>
        </Box>
      )}

      {/* Awards */}
      {playerAwards.length > 0 && (
        <Box p={3} borderWidth="1px" rounded="md" className="bg-primary">
          <div className="font-bold mb-2">Awards ({playerAwards.length})</div>
          <div className="space-y-1 text-sm max-h-40 overflow-y-auto">
            {playerAwards.slice(0, 5).map((award) => (
              <div key={award.id}>
                <div className="font-semibold">
                  S{award.season} - {award.type}
                </div>
                {(award.team || award.position) && (
                  <div className="text-xs text-gray-600">
                    {award.team && `Team: ${award.team}`}
                    {award.team && award.position && ' • '}
                    {award.position && `Pos: ${award.position}`}
                  </div>
                )}
              </div>
            ))}
            {playerAwards.length > 5 && (
              <div className="text-gray-600 italic">
                +{playerAwards.length - 5} more...
              </div>
            )}
          </div>
        </Box>
      )}

      {/* Packs (if owned) */}
      {isOwned && packs && packs.length > 0 && (
        <Box p={3} borderWidth="1px" rounded="md" className="bg-primary">
          <div className="font-bold mb-2">Found in Packs</div>
          <div className="space-y-1 text-sm">
            {packs.slice(0, 3).map((pack) => (
              <Link
                key={pack.packid}
                href={`/packs/${pack.packid}`}
                className="text-link block"
                as="a"
                target="_blank"
              >
                Pack #{pack.packid}
              </Link>
            ))}
            {packs.length > 3 && (
              <div className="text-gray-600 italic">
                +{packs.length - 3} more packs...
              </div>
            )}
          </div>
        </Box>
      )}

      {/* Show message if no data */}
      {playerStats.length === 0 &&
        playerAwards.length === 0 &&
        (!isOwned || !packs || packs.length === 0) && (
          <Box textAlign="center" py={8}>
            <div className="text-gray-600">
              No player information available for this card.
            </div>
          </Box>
        )}
    </Stack>
  )
}
