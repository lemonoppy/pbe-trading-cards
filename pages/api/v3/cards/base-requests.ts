import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse } from '..'
import middleware from '@pages/api/database/middleware'
import { GET, POST } from '@constants/http-methods'
import Cors from 'cors'
import methodNotAllowed from '../lib/methodNotAllowed'
import { StatusCodes } from 'http-status-codes'
import { IndexPlayer, Position } from './card-requests'
import { PortalPlayer } from 'services/portalApiService'
import { rarityMap } from '@constants/rarity-map'
import { cardsQuery } from '@pages/api/database/database'
import SQL, { SQLStatement } from 'sql-template-strings'
import axios, { AxiosResponse } from 'axios'
import logger from 'lib/logger'

type DraftPick = {
  id: number
  league: string
  season: number
  round: number
  pick: number | null
  pid: number | null
  type?: string | null
  originalTeam: string
  owningTeam: string
  firstName?: string
  lastName?: string
  position?: string
  uid?: number
  username?: string
  isFirstPlayer?: number
}

export type BaseRequest = {
  playerID: string
  playerName: string
  teamID: string
  rarity: string
  season: number
  created: boolean
  needsSeason: boolean
  renderName: string | null
  error?: string
}

const allowedMethods: string[] = [POST]
const cors = Cors({
  methods: allowedMethods,
})

/**
 * Create draft class CSV for importing Base cards
 * Format: team, playerid, season, card_rarity, sub_type, player_name, render_name, position, image_url, author_userid
 */
function createDraftClassCsv(players: IndexPlayer[]): DraftClassCsvRow[] {
  const { AllTeams } = require('lib/teams')

  return players.map((player) => {
    // Find team abbreviation from team ID
    const team = Object.values(AllTeams).find((t: any) => t.id === parseInt(player.team)) as any
    const teamAbbr = team?.abbreviation || player.team

    const { position } = calculateAttributesAndPosition(player)

    return {
      team: teamAbbr,
      playerid: parseInt(player.id),
      season: player.season,
      card_rarity: calculateRarity(player.position as Position, player.appliedTPE || 0, player.sub_type),
      sub_type: player.sub_type || 'Base',
      player_name: player.name,
      render_name: player.renderName || '',
      position: position,
      image_url: '',
      author_userid: '',
    }
  })
}

type DraftClassCsvRow = {
  team: string
  playerid: number
  season: number
  card_rarity: string
  sub_type: string
  player_name: string
  render_name: string | null
  position: string
  image_url: string
  author_userid: string
}

export default async function baseRequestsEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<
    ApiResponse<{
      created: BaseRequest[]
      duplicates: BaseRequest[]
      errors: BaseRequest[]
      hasInvalidSeason: BaseRequest[]
      draftClassCsv: DraftClassCsvRow[]
    }>
  >
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === POST) {
    const seasonString = req.body.season as string
    if (!seasonString || isNaN(seasonString as any)) {
      res
        .status(StatusCodes.BAD_REQUEST)
        .end('Please provide a valid season number in your request')
      return
    }

    const season = parseInt(seasonString)

    try {
      // Fetch draft picks from Portal
      const draftPicks = await getDraftPicks(season)
      const portalPlayers: PortalPlayer[] = await getPortalPlayers()

      // First rounders get 'Autograph Rookie' cards → INSERT INTO DATABASE
      // ALL draft picks get 'Base' cards → RETURN AS CSV (don't insert)
      const round1Picks = draftPicks.filter((pick) => pick.round === 1)
      const allDraftPicks = draftPicks // All rounds for Base cards CSV

      const firstRounders = convertDraftPicksToIndexPlayers(
        round1Picks,
        'Autograph Rookie'
      )
      const allDraftPicksAsBaseCards = convertDraftPicksToIndexPlayers(
        allDraftPicks,
        'Base'
      )

      const {
        updatedPlayers: firstRoundersWithSeason,
        missingSeason: firstRoundersMissingSeason,
      } = addSeasonToPlayers(firstRounders, portalPlayers)
      const {
        updatedPlayers: allDraftPicksAsBaseCardsWithSeason,
        missingSeason: allDraftPicksAsBaseCardsMissingSeason,
      } = addSeasonToPlayers(allDraftPicksAsBaseCards, portalPlayers)

      // Only insert Autograph Rookie cards into database
      const { cardRequests, duplicates, errors } =
        await checkForDuplicatesAndCreateCardRequestData(firstRoundersWithSeason)

      logger.debug({ cardRequests: cardRequests.length, duplicates: duplicates.length, errors: errors.length }, 'Autograph Rookie cards processed')

      await requestCards(cardRequests)

      // Generate CSV data for ALL draft picks' Base cards (for manual import later)
      const draftClassCsv = createDraftClassCsv(allDraftPicksAsBaseCardsWithSeason)

      const created = cardRequests.map(
        (cardRequest): BaseRequest => ({
          playerID: cardRequest.playerid?.toString(),
          playerName: cardRequest.player_name,
          teamID: cardRequest.teamid?.toString(),
          rarity: cardRequest.card_rarity,
          season: cardRequest.season,
          created: true,
          needsSeason: firstRoundersMissingSeason.some(
            (playerMissingSeason) =>
              playerMissingSeason.id === cardRequest.playerid?.toString()
          ),
          renderName: cardRequest.renderName,
          error: null,
        })
      )

      //creating return if cardRequests season is -1
      const hasInvalidSeason = created.filter(
        (request) => request.season === -1
      )

      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: {
          created,
          duplicates,
          errors,
          hasInvalidSeason,
          draftClassCsv,
        },
      })
      return
    } catch (error) {
      logger.error({ err: error }, 'Error in base-requests endpoint')
      const errorMessage = error instanceof Error ? error.message : String(error)
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: errorMessage,
      })
      return
    }
  }

  methodNotAllowed(req, res, allowedMethods)
}

/**
 * Get draft picks from Portal API for a specific season
 */
async function getDraftPicks(season: number): Promise<DraftPick[]> {
  try {
    const url = `${process.env.PORTAL_API_URL}/api/isfl/v1/draft-picks` // TODO: update to PBE API path when available
    logger.debug({ url, season }, 'Fetching draft picks')

    const response: AxiosResponse<DraftPick[]> = await axios({
      method: GET,
      url,
      headers: {
        Authorization: `Bearer ${process.env.PORTAL_API_KEY}`,
      },
      params: {
        season,
      },
      timeout: 60000, // 60 second timeout for draft picks (can be large dataset)
    })

    logger.debug({ status: response.status, count: response.data?.length || 0 }, 'Draft picks response received')

    if (response.status !== 200) {
      throw new Error('Error fetching draft picks from Portal')
    }

    // Filter out picks with no player ID (undrafted slots)
    const validPicks = response.data.filter((pick) => pick.pid !== null)
    logger.debug({ count: validPicks.length }, 'Draft picks with players assigned')

    return validPicks
  } catch (error: any) {
    logger.error(
      {
        err: error,
        status: error.response?.status,
        responseData: error.response?.data,
      },
      'Error fetching draft picks'
    )
    throw new Error(`Failed to fetch draft picks from Portal API: ${error.message}`)
  }
}

/**
 * Convert draft picks to IndexPlayer format with sub_type
 */
function convertDraftPicksToIndexPlayers(
  draftPicks: DraftPick[],
  subType: 'Autograph Rookie' | 'Base'
): IndexPlayer[] {
  return draftPicks.map((pick) => {
    // owningTeam might be team ID or team name - convert to ID string
    const teamIdStr = /^\d+$/.test(pick.owningTeam)
      ? pick.owningTeam // Already a number string
      : getTeamIdFromName(pick.owningTeam).toString()

    return {
      id: pick.pid.toString(),
      league: pick.league === 'PBE' ? 0 : pick.league === 'MiLPBE' ? 1 : 2,
      season: pick.season,
      name: `${pick.firstName || ''} ${pick.lastName || ''}`.trim() || `Player ${pick.pid}`,
      team: teamIdStr, // Team ID that drafted the player
      position: normalizePosition(pick.position),
      appliedTPE: 0, // Draft picks start at 0 TPE
      sub_type: subType, // Set sub_type based on round
      // Placeholder attributes
      aggression: 0,
      bravery: 0,
      determination: 0,
      teamPlayer: 0,
      leadership: 0,
      temperament: 0,
      professionalism: 0,
      renderName: null, // Will be filled in by addSeasonToPlayers
    }
  })
}

/**
 * Helper function to convert full position names to abbreviations
 */
function normalizePosition(position: string): string {
  if (!position) return 'X'

  const positionMap: { [key: string]: string } = {
    'quarterback': 'QB',
    'qb': 'QB',
    'running back': 'RB',
    'runningback': 'RB',
    'rb': 'RB',
    'wide receiver': 'WR',
    'widereceiver': 'WR',
    'wr': 'WR',
    'tight end': 'TE',
    'tightend': 'TE',
    'te': 'TE',
    'offensive lineman': 'OL',
    'offensive line': 'OL',
    'offensiveline': 'OL',
    'ol': 'OL',
    'defensive end': 'DE',
    'defensiveend': 'DE',
    'de': 'DE',
    'defensive tackle': 'DT',
    'defensivetackle': 'DT',
    'dt': 'DT',
    'linebacker': 'LB',
    'lb': 'LB',
    'cornerback': 'CB',
    'cb': 'CB',
    'safety': 'S',
    's': 'S',
    'kicker': 'K',
    'k': 'K',
  }

  const normalized = positionMap[position.toLowerCase()]
  return normalized || position.toUpperCase()
}

/**
 * Helper function to get team ID from team name or abbreviation
 */
function getTeamIdFromName(teamName: string): number {
  // Import team data
  const { AllTeams } = require('lib/teams')

  // Try to find team by abbreviation or name
  const team = Object.values(AllTeams).find((t: any) =>
    t.abbreviation?.toLowerCase() === teamName?.toLowerCase() ||
    t.name?.toLowerCase() === teamName?.toLowerCase() ||
    `${t.location} ${t.name}`.toLowerCase() === teamName?.toLowerCase()
  ) as any

  return team?.id || 0
}

/**
 * Convert Portal players to IndexPlayer format for PBE
 * Since PBE doesn't have a separate Index API, we convert Portal data
 */
function convertPortalPlayersToIndexPlayers(
  portalPlayers: PortalPlayer[],
  positionFilter: 'offense-defense' | 'kicker'
): IndexPlayer[] {
  return portalPlayers
    .filter((player) => {
      if (positionFilter === 'kicker') {
        return player.position === 'K'
      } else {
        return player.position !== 'K' && player.status === 'active'
      }
    })
    .map((player) => ({
      id: player.pid.toString(),
      league: player.currentLeague === 'PBE' ? 0 : player.currentLeague === 'MiLPBE' ? 1 : 2, // 0=PBE, 1=MiLPBE
      season: -1, // Will be set by addSeasonToPlayers based on player creation date
      name: `Player ${player.pid}`, // Portal API doesn't return player name in this endpoint
      team: (player.currentLeague === 'PBE' ? player.pbeTeam : player.milpbeTeam)?.toString() || '0',
      position: player.position,
      appliedTPE: player.appliedTPE || 0,
      // Placeholder attributes - these don't matter for card creation
      aggression: 0,
      bravery: 0,
      determination: 0,
      teamPlayer: 0,
      leadership: 0,
      temperament: 0,
      professionalism: 0,
    }))
}

/**
 * get skaters (offensive/defensive players) from the Portal API
 * PBE doesn't have a separate Index API, so we use Portal as source
 */
async function getIndexSkaters(season: number): Promise<IndexPlayer[]> {
  const portalPlayers = await getPortalPlayers()
  return convertPortalPlayersToIndexPlayers(portalPlayers, 'offense-defense')
}

/**
 * get goalies (kickers) from the Portal API
 * PBE doesn't have a separate Index API, so we use Portal as source
 */
async function getIndexGoalies(season: number): Promise<IndexPlayer[]> {
  const portalPlayers = await getPortalPlayers()
  return convertPortalPlayersToIndexPlayers(portalPlayers, 'kicker')
}

/**
 * get player data from the portal API
 */
async function getPortalPlayers(): Promise<PortalPlayer[]> {
  const players: AxiosResponse<PortalPlayer[], any> = await axios({
    method: GET,
    url: `${process.env.PORTAL_API_URL}/api/isfl/v1/player`, // TODO: update to PBE API path when available
    headers: {
      Authorization: `Bearer ${process.env.PORTAL_API_KEY}`,
    },
  })
  if (players.status !== 200) {
    throw new Error('Error fetching players from portal')
  }
  return players.data
}

/**
 * add player season to index players from their matching portal name
 * if a match is not found the index player will be used as is in the import and the
 * correct season will have to be added to the player manually
 */
function addSeasonToPlayers(
  indexPlayers: IndexPlayer[],
  portalPlayers: PortalPlayer[]
): {
  updatedPlayers: IndexPlayer[]
  missingSeason: IndexPlayer[]
} {
  const missingSeason: IndexPlayer[] = []

  const updatedPlayers = indexPlayers.map((indexPlayer) => {
    // For draft picks, indexPlayer.id is the Portal player's pid
    // So we match by pid directly instead of indexRecords
    const matchingPortalPlayer = portalPlayers.find(
      (portalPlayer) => portalPlayer.pid === Number(indexPlayer.id)
    )

    if (matchingPortalPlayer) {
      indexPlayer.name = matchingPortalPlayer.name // Use the portal name for the fancy letters
      return {
        ...indexPlayer,
        season: matchingPortalPlayer.draftSeason,
        renderName: matchingPortalPlayer.render,
      }
    } else {
      missingSeason.push(indexPlayer)
      return { ...indexPlayer, season: -1, renderName: null }
    }
  })

  return { updatedPlayers, missingSeason }
}

/**
 * check if cards already exist with the same playerId, teamId, player_name and card_rarity
 */
async function checkForDuplicatesAndCreateCardRequestData(
  players: IndexPlayer[]
): Promise<{
  cardRequests: CardRequest[]
  duplicates: BaseRequest[]
  errors: BaseRequest[]
}> {
  const cardRequests: CardRequest[] = []
  const duplicates: BaseRequest[] = []
  const errors: BaseRequest[] = []
  await Promise.all(
    players.map(async (player: IndexPlayer, index) => {
      try {
        const { position } = calculateAttributesAndPosition(player)
        const rarity = calculateRarity(position, player.appliedTPE || 0, player.sub_type)
        const teamId = teamNameToId(player.team)
        const raritiesToCheck = getSameAndHigherRaritiesQueryFragment(rarity)

        const query = SQL`
        SELECT count(*) as amount
        FROM pbe_cards
        WHERE player_name=${player.name}
          AND teamID=${teamId} 
          AND playerID=${player.id} 
          AND position=${position}
          
      `
        raritiesToCheck.forEach((rarity, index) => {
          if (index === 0) {
            query.append(SQL` AND (card_rarity=${rarity}`)
          } else {
            query.append(SQL` OR card_rarity=${rarity}`)
          }
        })
        query.append(SQL`)`)

        const playerResult = await cardsQuery<{ amount: number }>(query)

        if (playerResult[0] && playerResult[0].amount > 0) {
          const duplicate = {
            cardID: null,
            playerID: player.id,
            playerName: player.name,
            teamID: player.team,
            rarity: rarity,
            season: player.season,
            created: false,
            needsSeason: false,
            error: 'Duplicate',
            renderName: null,
          } as BaseRequest
          duplicates.push(duplicate)
          return
        } else {
          const cardRequest = {
            teamid: teamId,
            playerid: Number(player.id),
            player_name: player.name,
            season: player.season,
            card_rarity: rarity,
            sub_type: player.sub_type || null,
            position,
            renderName: player.renderName,
          } as CardRequest
          cardRequests.push(cardRequest)
          return
        }
      } catch (e) {
        errors.push({
          playerID: player.id,
          playerName: player.name,
          teamID: player.team,
          rarity: null,
          season: player.season,
          created: false,
          needsSeason: false,
          error: e,
          renderName: player.renderName || null,
        })
        return
      }
    })
  )

  return {
    cardRequests,
    duplicates,
    errors,
  }
}

export async function requestCards(cardRequests: CardRequest[]): Promise<void> {
  logger.debug({ count: cardRequests.length }, 'Starting card inserts')

  const results = await Promise.all(
    cardRequests.map(async (cardRequest, index) => {
      try {
        // For PBE Trading Cards, we only insert core card data
        // Stats are added manually by card creators later
        // author_userid is NULL until the card is claimed
        const insertQuery: SQLStatement = SQL`
          INSERT INTO pbe_cards
            (player_name, teamID, playerID, card_rarity, sub_type, pullable, approved, position, season, author_paid, date_approved, render_name, leagueID, author_userid)
          VALUES (${cardRequest.player_name.trim()}, ${cardRequest.teamid}, ${
            cardRequest.playerid
          }, ${cardRequest.card_rarity}, ${cardRequest.sub_type}, false, false, ${
            cardRequest.position
          }, ${cardRequest.season}, false, NULL, ${cardRequest.renderName}, 0, NULL);
        `
        logger.debug({ index: index + 1, total: cardRequests.length, playerName: cardRequest.player_name }, 'Inserting card')
        const result = await cardsQuery(insertQuery)
        logger.debug({ playerName: cardRequest.player_name, result }, 'Card inserted')
        return result
      } catch (error) {
        logger.error({ err: error, playerName: cardRequest.player_name }, 'Error inserting card')
        throw error
      }
    })
  )

  logger.debug({ count: results.length }, 'Card inserts completed')
  return
}

/**
 * Get the card position type from an index player
 */
export const calculateAttributesAndPosition = (
  player: IndexPlayer
): {
  position: Position
} => {
  // PBE Trading Cards doesn't use attribute stats - they're set manually by card creators on images
  // This function only determines the position category for the card

  const isKicker = player.position === 'K'

  // Map PBE position to card position type
  let cardPosition: Position
  if (isKicker) {
    cardPosition = 'K' as Position
  } else {
    // All other positions are treated as general players ('X' or player position)
    cardPosition = player.position as Position
  }

  return {
    position: cardPosition,
  }
}

/**
 * Get same and higher rarities for duplicate checking
 * Common < Uncommon < Rare < Mythic
 */
export const getSameAndHigherRaritiesQueryFragment = (
  rarity: string
): string[] => {
  if (rarity === rarityMap.common.label) {
    return [
      rarityMap.common.label,
      rarityMap.uncommon.label,
      rarityMap.rare.label,
      rarityMap.mythic.label,
    ]
  }
  if (rarity === rarityMap.uncommon.label) {
    return [
      rarityMap.uncommon.label,
      rarityMap.rare.label,
      rarityMap.mythic.label,
    ]
  }
  if (rarity === rarityMap.rare.label) {
    return [rarityMap.rare.label, rarityMap.mythic.label]
  }
  if (rarity === rarityMap.mythic.label) {
    return [rarityMap.mythic.label]
  }
}

/**
 * Calculate card rarity based on sub_type
 * Rarity is determined by card type, not TPE
 */
const calculateRarity = (position: Position, appliedTPE: number, subType?: string): string => {
  // Autograph Rookies always get Rare tier
  if (subType === 'Autograph Rookie') return rarityMap.rare.label
  // Base cards use Common rarity
  if (subType === 'Base') return rarityMap.common.label

  // Default to Common for any other case
  return rarityMap.common.label
}

/**
 * Transform a team ID from Portal to team ID in our database
 * Portal returns currentTeamID which we use directly
 */
const teamNameToId = (teamIdString: string): number => {
  // Portal gives us team ID directly, just parse it
  return parseInt(teamIdString) || 0
}
