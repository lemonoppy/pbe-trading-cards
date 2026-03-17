import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse } from '..'
import middleware from '@pages/api/database/middleware'
import { GET, POST } from '@constants/http-methods'
import Cors from 'cors'
import methodNotAllowed from '../lib/methodNotAllowed'
import { cardsQuery } from '@pages/api/database/database'
import SQL, { SQLStatement } from 'sql-template-strings'
import axios, { AxiosResponse, HttpStatusCode } from 'axios'
import logger from 'lib/logger'
import { PortalPlayer } from 'services/portalApiService'

const allowedMethods: string[] = [POST]
const cors = Cors({
  methods: allowedMethods,
})

type SimplifiedCardRequest = {
  team: string // Team abbreviation
  playerid: number | null
  season: number
  card_rarity: string
  sub_type: string | null
  // Optional enrichment fields from CSV
  player_name?: string
  render_name?: string | null
  position?: string
  image_url?: string | null
  author_userid?: number | null
  pullable?: boolean
}

type EnrichedCardRequest = {
  player_name: string
  render_name: string | null
  teamID: number
  playerID: number | null
  card_rarity: string
  sub_type: string | null
  position: string
  season: number
  leagueID: number
  image_url: string | null
  author_userid: number | null
  pullable: boolean
}

type CustomCardResult = {
  playerID: number | null
  playerName: string
  team: string
  rarity: string
  subType: string | null
  season: number
  success: boolean
  error?: string
}

export default async function customRequestsEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ created: CustomCardResult[]; failed: CustomCardResult[] }>>
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === POST) {
    const simplifiedCards = (req.body.cards ?? []) as SimplifiedCardRequest[]
    const errors: string[] = []
    const enrichedCards: EnrichedCardRequest[] = []
    const results: CustomCardResult[] = []

    // Process each card
    for (let i = 0; i < simplifiedCards.length; i++) {
      const card = simplifiedCards[i]

      try {
        let playerData: PortalPlayer | null = null

        // Only fetch from Portal if enrichment data not provided in CSV
        const needsPortalLookup = !card.player_name || !card.position

        if (card.playerid !== null && needsPortalLookup) {
          playerData = await fetchPlayerFromPortal(card.playerid)

          if (!playerData) {
            const errorMsg = `Player ${card.playerid} not found in Portal`
            errors.push(`Row ${i + 1}: ${errorMsg}`)
            results.push({
              playerID: card.playerid,
              playerName: `Player ${card.playerid}`,
              team: card.team,
              rarity: card.card_rarity,
              subType: card.sub_type,
              season: card.season,
              success: false,
              error: errorMsg,
            })
            continue
          }
        }
        // For custom cards without playerid, we'll use team name as player_name and 'X' as position

        // Look up team ID and league from abbreviation
        const teamData = await lookupTeamID(card.team)

        if (!teamData) {
          const errorMsg = `Team abbreviation "${card.team}" not found`
          errors.push(`Row ${i + 1}: ${errorMsg}`)
          results.push({
            playerID: card.playerid,
            playerName: playerData?.name || `Player ${card.playerid}`,
            team: card.team,
            rarity: card.card_rarity,
            subType: card.sub_type,
            season: card.season,
            success: false,
            error: errorMsg,
          })
          continue
        }

        // Validate teamID is not null
        if (!teamData.teamID) {
          const errorMsg = `Team "${card.team}" has invalid teamID`
          errors.push(`Row ${i + 1}: ${errorMsg}`)
          results.push({
            playerID: card.playerid,
            playerName: playerData?.name || `Player ${card.playerid}`,
            team: card.team,
            rarity: card.card_rarity,
            subType: card.sub_type,
            season: card.season,
            success: false,
            error: errorMsg,
          })
          continue
        }

        // Validate required fields from player data (only when playerid is provided and Portal lookup was needed)
        if (playerData && needsPortalLookup) {
          if (!playerData.name) {
            const errorMsg = `Player ${card.playerid} has no name`
            errors.push(`Row ${i + 1}: ${errorMsg}`)
            results.push({
              playerID: card.playerid,
              playerName: `Player ${card.playerid}`,
              team: card.team,
              rarity: card.card_rarity,
              subType: card.sub_type,
              season: card.season,
              success: false,
              error: errorMsg,
            })
            continue
          }

          if (!playerData.position) {
            const errorMsg = `Player ${card.playerid} has no position`
            errors.push(`Row ${i + 1}: ${errorMsg}`)
            results.push({
              playerID: card.playerid,
              playerName: playerData.name,
              team: card.team,
              rarity: card.card_rarity,
              subType: card.sub_type,
              season: card.season,
              success: false,
              error: errorMsg,
            })
            continue
          }
        }

        // Use CSV data if provided, otherwise fall back to Portal
        const finalPlayerName = card.player_name || playerData?.name || teamData.teamName
        const finalRenderName = card.render_name !== undefined
          ? card.render_name
          : (playerData?.render || null)
        const finalPosition = card.position || playerData?.position || 'X'

        // Build enriched card with CSV priority
        const enrichedCard = {
          player_name: finalPlayerName,
          render_name: finalRenderName,
          teamID: teamData.teamID,
          playerID: card.playerid,
          card_rarity: card.card_rarity,
          sub_type: card.sub_type,
          position: finalPosition,
          season: card.season,
          leagueID: teamData.leagueID,
          image_url: card.image_url || null,
          author_userid: card.author_userid || null,
          pullable: card.pullable !== undefined ? card.pullable : true, // Default to true if not specified
        }

        logger.info({
          row: i + 1,
          csvTeam: card.team,
          resolvedTeamID: teamData.teamID,
          resolvedLeagueID: teamData.leagueID,
          resolvedTeamName: teamData.teamName,
          playerID: card.playerid,
          playerName: playerData ? playerData.name : teamData.teamName,
          playerCurrentTeam: playerData ? (playerData.isflTeam || playerData.dsflTeam) : null,
          playerCurrentLeague: playerData?.currentLeague || null,
          isCustomCard: card.playerid === null,
        }, 'Processing card - CSV team vs Portal player team')

        enrichedCards.push(enrichedCard)
        results.push({
          playerID: card.playerid,
          playerName: finalPlayerName,
          team: card.team,
          rarity: card.card_rarity,
          subType: card.sub_type,
          season: card.season,
          success: true,
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        logger.error({ err: error, card }, 'Error processing card')
        errors.push(`Row ${i + 1}: ${errorMsg}`)
        results.push({
          playerID: card.playerid,
          playerName: `Player ${card.playerid}`,
          team: card.team,
          rarity: card.card_rarity,
          subType: card.sub_type,
          season: card.season,
          success: false,
          error: errorMsg,
        })
        // Explicitly continue to skip this card
        continue
      }
    }

    // Insert all enriched cards one by one
    for (const card of enrichedCards) {
      try {
        const insertQuery: SQLStatement = SQL`
          INSERT INTO pbe_cards
            (player_name, render_name, teamID, playerID, card_rarity, sub_type, pullable, approved, position, season, author_paid, leagueID, author_userid, image_url, date_approved)
          VALUES (${card.player_name}, ${card.render_name}, ${card.teamID}, ${card.playerID}, ${card.card_rarity}, ${card.sub_type}, ${card.pullable}, true, ${card.position}, ${card.season}, true, ${card.leagueID}, ${card.author_userid}, ${card.image_url}, NOW())
        `

        await cardsQuery(insertQuery)
        logger.info({ playerID: card.playerID, playerName: card.player_name }, 'Custom card inserted')
      } catch (insertError) {
        // Mark this card as failed in results
        const resultIndex = results.findIndex(r => r.playerID === card.playerID && r.success === true)
        if (resultIndex !== -1) {
          results[resultIndex].success = false
          results[resultIndex].error = insertError instanceof Error ? insertError.message : 'Database insert failed'
        }
        logger.error({ err: insertError, card }, 'Failed to insert card')
      }
    }

    // Separate successful and failed results
    const created = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    res.status(HttpStatusCode.Ok).json({
      status: 'success',
      payload: {
        created,
        failed,
      }
    })
    return
  }

  methodNotAllowed(req, res, allowedMethods)
}

/**
 * Fetch player data from Portal API
 */
async function fetchPlayerFromPortal(playerID: number): Promise<PortalPlayer | null> {
  try {
    const url = `${process.env.PORTAL_API_URL}/api/isfl/v1/player`

    if (!process.env.PORTAL_API_URL || !process.env.PORTAL_API_KEY) {
      throw new Error('Portal API configuration missing (PORTAL_API_URL or PORTAL_API_KEY)')
    }

    logger.debug({ url, playerID }, 'Fetching player from Portal')

    const response: AxiosResponse<PortalPlayer[]> = await axios({
      method: GET,
      url,
      headers: {
        Authorization: `Bearer ${process.env.PORTAL_API_KEY}`,
      },
      params: {
        pid: playerID,
      },
      timeout: 10000,
    })

    if (response.status !== 200 || !response.data || response.data.length === 0) {
      logger.warn({ playerID, status: response.status }, 'Player not found in Portal')
      return null
    }

    logger.debug({ playerID, playerName: response.data[0].name }, 'Player found in Portal')
    return response.data[0]
  } catch (error: any) {
    if (error.response?.status === 401) {
      logger.error('Portal API authentication failed - check PORTAL_API_KEY')
      throw new Error('Portal API authentication failed (401 Unauthorized)')
    }
    logger.error({ err: error, playerID, status: error.response?.status }, 'Error fetching player from Portal')
    throw new Error(`Failed to fetch player ${playerID} from Portal: ${error.message}`)
  }
}

/**
 * Look up team ID, league, and team name from team abbreviation (case-insensitive)
 */
async function lookupTeamID(abbreviation: string): Promise<{ teamID: number; leagueID: number; teamName: string } | null> {
  try {
    const query = SQL`
      SELECT teamid, leagueid, location, nickname
      FROM pbe_team_data
      WHERE UPPER(abbreviation) = UPPER(${abbreviation})
      ORDER BY season DESC
      LIMIT 1
    `

    const result = await cardsQuery<{ teamid: number; leagueid: number; location: string; nickname: string }>(query)

    if ('error' in result || result.length === 0) {
      logger.warn({ abbreviation }, 'Team abbreviation not found')
      return null
    }

    const teamName = `${result[0].location} ${result[0].nickname}`
    logger.debug({ abbreviation, teamid: result[0].teamid, leagueid: result[0].leagueid, teamName }, 'Team found')
    return { teamID: result[0].teamid, leagueID: result[0].leagueid, teamName }
  } catch (error) {
    logger.error({ err: error, abbreviation }, 'Error looking up team ID')
    return null
  }
}
