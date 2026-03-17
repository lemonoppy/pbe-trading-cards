import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  TableContainer,
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  Button,
  useColorMode,
  Box,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Spinner,
} from '@chakra-ui/react'
import { Link } from 'components/common/Link'
import { LEAGUE_LINK_MAP } from 'lib/constants'
import { generateIndexLink } from 'lib/constants'
import axios from 'axios'
import { GET } from '@constants/http-methods'
import { query } from '@pages/api/database/query'
import { UserCollection, Team } from '@pages/api/v3'
import Router from 'next/router'
import { useSession } from 'contexts/AuthContext'

type PlayerRanking = {
  pid: number
  name: string
  value: number
  rank: number
}

type PlayerRankings = {
  passYds: PlayerRanking[]
  passTD: PlayerRanking[]
  rushYds: PlayerRanking[]
  rushTD: PlayerRanking[]
  recYds: PlayerRanking[]
  recTD: PlayerRanking[]
  defTck: PlayerRanking[]
  defSack: PlayerRanking[]
  defTFL: PlayerRanking[]
  defInt: PlayerRanking[]
  defPD: PlayerRanking[]
  kFGM: PlayerRanking[]
  kXPM: PlayerRanking[]
}

type Award = {
  id: number
  season: number
  pid: number
  team: string | null
  type: string
  position?: string
  firstName?: string
  lastName?: string
  wfcRegion?: string | null
}

export const CardInformation = ({
  owned,
  playerID,
  cardID,
  userID,
  leagueID,
}: {
  owned: boolean
  playerID: number
  cardID: number
  userID: string
  leagueID: number
}) => {
  const [indexSrc, setIndexSrc] = useState<string | undefined>(undefined)
  const iFrameRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState('0px')
  const { colorMode } = useColorMode()
  const [playerRankings, setPlayerRankings] = useState<PlayerRankings | null>(
    null
  )
  const [playerAwards, setPlayerAwards] = useState<Award[]>([])
  const [loadingRankings, setLoadingRankings] = useState(false)
  const [loadingAwards, setLoadingAwards] = useState(false)
  const { session, loggedIn } = useSession()

  // Fetch all teams (PBE, MiLPBE) for award team colors
  const { payload: allTeamsData } = query<Team[]>({
    queryKey: ['allTeamsData'],
    queryFn: () =>
      axios({
        method: GET,
        url: `/api/v3/teams`,
      }),
  })
  const setIFrameHeight = useCallback((event: MessageEvent<any>) => {
    if (event.origin.includes('index.simulationhockey.com')) {
      if (event.data !== 0 && typeof event.data === 'number')
        setHeight(event.data + 'px')
    }
  }, [])

  useEffect(() => {
    window.addEventListener('message', setIFrameHeight)

    return () => window.removeEventListener('message', setIFrameHeight)
  }, [setIFrameHeight])

  useEffect(() => {
    const fetchPlayerData = async () => {
      if (!playerID || playerID === -1) {
        console.log('[CardInformation] Skipping player data fetch - invalid playerID:', playerID)
        return
      }

      console.log('[CardInformation] Fetching player data for playerID:', playerID)

      // Fetch player rankings
      setLoadingRankings(true)
      try {
        const rankingsUrl = `/api/v3/portal/player-rankings?pid=${playerID}&seasonType=RegularSeason`
        console.log('[CardInformation] Fetching rankings from:', rankingsUrl)
        const rankingsResponse = await axios.get(rankingsUrl)
        console.log('[CardInformation] Rankings response:', rankingsResponse.data)
        setPlayerRankings(rankingsResponse.data || null)
      } catch (error) {
        console.error('[CardInformation] Failed to fetch player rankings:', error)
        setPlayerRankings(null)
      } finally {
        setLoadingRankings(false)
      }

      // Fetch player awards
      setLoadingAwards(true)
      try {
        const awardsUrl = `/api/v3/portal/player-awards?pid=${playerID}`
        console.log('[CardInformation] Fetching awards from:', awardsUrl)
        const awardsResponse = await axios.get(awardsUrl)
        console.log('[CardInformation] Awards response:', awardsResponse.data)
        setPlayerAwards(awardsResponse.data || [])
      } catch (error) {
        console.error('[CardInformation] Failed to fetch player awards:', error)
        setPlayerAwards([])
      } finally {
        setLoadingAwards(false)
      }
    }

    fetchPlayerData()
  }, [playerID, leagueID])

  const { payload: packs, isLoading } = query<UserCollection[]>({
    queryKey: ['packs-from-cards', String(cardID), String(userID), 'false'],
    queryFn: () =>
      axios({
        method: GET,
        url: `/api/v3/cards/packs-from-cards?userID=${userID}&cardID=${cardID}&isOwned=false`,
      }),
    enabled: !!cardID && !!userID,
  })

  if (!playerID) return null

  return (
    <Accordion allowMultiple>
      <AccordionItem>
        <h2>
          <AccordionButton>
            <Box flex="1" textAlign="left">
              Player Stats
            </Box>
            <AccordionIcon />
          </AccordionButton>
        </h2>
        <AccordionPanel pb={4}>
          {playerID === -1 ? (
            <div>Player stats not available at this time</div>
          ) : loadingRankings ? (
            <Box textAlign="center" py={4}>
              <Spinner />
            </Box>
          ) : playerRankings ? (
            <Box>
              <div className="space-y-2">
                <div className="font-bold mb-2">Career Rankings (Regular Season)</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {playerRankings.passYds?.[0] && (
                    <div>
                      Pass Yds: #{playerRankings.passYds[0].rank} (
                      {playerRankings.passYds[0].value.toLocaleString()})
                    </div>
                  )}
                  {playerRankings.passTD?.[0] && (
                    <div>
                      Pass TD: #{playerRankings.passTD[0].rank} (
                      {playerRankings.passTD[0].value})
                    </div>
                  )}
                  {playerRankings.rushYds?.[0] && (
                    <div>
                      Rush Yds: #{playerRankings.rushYds[0].rank} (
                      {playerRankings.rushYds[0].value.toLocaleString()})
                    </div>
                  )}
                  {playerRankings.rushTD?.[0] && (
                    <div>
                      Rush TD: #{playerRankings.rushTD[0].rank} (
                      {playerRankings.rushTD[0].value})
                    </div>
                  )}
                  {playerRankings.recYds?.[0] && (
                    <div>
                      Rec Yds: #{playerRankings.recYds[0].rank} (
                      {playerRankings.recYds[0].value.toLocaleString()})
                    </div>
                  )}
                  {playerRankings.recTD?.[0] && (
                    <div>
                      Rec TD: #{playerRankings.recTD[0].rank} (
                      {playerRankings.recTD[0].value})
                    </div>
                  )}
                  {playerRankings.defTck?.[0] && (
                    <div>
                      Tackles: #{playerRankings.defTck[0].rank} (
                      {playerRankings.defTck[0].value.toLocaleString()})
                    </div>
                  )}
                  {playerRankings.defSack?.[0] && (
                    <div>
                      Sacks: #{playerRankings.defSack[0].rank} (
                      {playerRankings.defSack[0].value})
                    </div>
                  )}
                  {playerRankings.defTFL?.[0] && (
                    <div>
                      TFL: #{playerRankings.defTFL[0].rank} (
                      {playerRankings.defTFL[0].value})
                    </div>
                  )}
                  {playerRankings.defInt?.[0] && (
                    <div>
                      Int: #{playerRankings.defInt[0].rank} (
                      {playerRankings.defInt[0].value})
                    </div>
                  )}
                  {playerRankings.defPD?.[0] && (
                    <div>
                      PD: #{playerRankings.defPD[0].rank} (
                      {playerRankings.defPD[0].value})
                    </div>
                  )}
                  {playerRankings.kFGM?.[0] && (
                    <div>
                      FG Made: #{playerRankings.kFGM[0].rank} (
                      {playerRankings.kFGM[0].value})
                    </div>
                  )}
                  {playerRankings.kXPM?.[0] && (
                    <div>
                      XP Made: #{playerRankings.kXPM[0].rank} (
                      {playerRankings.kXPM[0].value})
                    </div>
                  )}
                </div>
              </div>
              <Box mt={4}>
                <Link
                  href={`https://portal.pbe.simflow.io/player/${playerID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button className="!hover:no-underline mr-2 bg-primary font-mont hover:text-link focus:text-blue700 ">
                    View Player Page
                  </Button>
                </Link>
              </Box>
            </Box>
          ) : (
            <div>No rankings found for this player.</div>
          )}
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem>
        <h2>
          <AccordionButton>
            <Box flex="1" textAlign="left">
              Player Awards
            </Box>
            <AccordionIcon />
          </AccordionButton>
        </h2>
        <AccordionPanel pb={4}>
          {loadingAwards ? (
            <Box textAlign="center" py={4}>
              <Spinner />
            </Box>
          ) : playerAwards && playerAwards.length > 0 ? (
            <div className="space-y-2">
              {playerAwards.map((award) => {
                // Find team by abbreviation across all leagues
                const team = allTeamsData?.find(
                  (t) => t.abbreviation === award.team
                )
                const teamColors = team?.colors || {
                  primary: '#1a202c',
                  text: '#ffffff',
                }
                // Determine league from team
                const league = team?.league === 0
                  ? 'PBE'
                  : team?.league === 1
                  ? 'MiLPBE'
                  : 'Unknown'

                return (
                  <Box
                    key={award.id}
                    p={2}
                    borderWidth="1px"
                    rounded="md"
                    style={{
                      backgroundColor: teamColors.primary,
                      color: teamColors.text,
                    }}
                  >
                    <div className="font-bold">
                      S{award.season} - {award.type}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>
                        {award.team || award.wfcRegion || 'No Team'} ({league})
                      </span>
                      {award.position && <span>{award.position}</span>}
                    </div>
                  </Box>
                )
              })}
            </div>
          ) : (
            <div>No awards found for this player.</div>
          )}
        </AccordionPanel>
      </AccordionItem>
      <AccordionItem>
        <h2>
          <AccordionButton>
            <Box flex="1" textAlign="left">
              Users who own the card
            </Box>
            <AccordionIcon />
          </AccordionButton>
        </h2>
        <AccordionPanel pb={4}>
          <div className="w-full text-center">
            {isLoading ? (
              <Box textAlign="center" py={4}>
                <Spinner />
              </Box>
            ) : packs && packs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packs.map((pack) => (
                  <Box
                    key={pack.packid}
                    p={2}
                    borderWidth="1px"
                    rounded="md"
                    mb={2}
                  >
                    <div>
                      {pack.username} : {pack.total}
                    </div>
                    <Button
                      className="mt-2"
                      colorScheme="blue"
                      isDisabled={
                        session?.userId == String(pack.userid) || !loggedIn
                      }
                      onClick={() =>
                        Router.push(
                          `/trade?partnerId=${pack.userid}&cardID=${pack.cardid}`
                        )
                      }
                    >
                      Trade
                    </Button>
                  </Box>
                ))}
              </div>
            ) : (
              <div>No users own this card yet.</div>
            )}
          </div>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  )
}
