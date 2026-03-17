import { NextApiRequest, NextApiResponse } from 'next'
import { GET } from '@constants/http-methods'
import { StatusCodes } from 'http-status-codes'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { cardsQuery } from '@pages/api/database/database'
import SQL from 'sql-template-strings'
import methodNotAllowed from '../lib/methodNotAllowed'

type PlayerCard = {
  cardid: number
  playerid: number | null
  player_name: string
  render_name: string | null
  teamid: number
  leagueid: number
  card_rarity: string
  sub_type: string
  position: string
  season: number
  image_url: string | null
  date_approved: string | null
}

type PlayerCardsResponse = {
  cards: PlayerCard[]
  total: number
  playerId: number
}

const allowedMethods = [GET]
const cors = Cors({
  methods: allowedMethods,
})

export default async function playerCardsEndpoint(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const { pid } = req.query

    // Validate required parameter
    if (!pid) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Player ID (pid) is required',
      })
      return
    }

    try {
      const playerId = parseInt(pid as string, 10)

      // Query approved cards for the player
      const query = SQL`
        SELECT
          cardid,
          playerid,
          player_name,
          render_name,
          teamid,
          leagueid,
          card_rarity,
          sub_type,
          position,
          season,
          image_url,
          date_approved
        FROM pbe_cards
        WHERE playerid = ${playerId}
          AND approved = true
        ORDER BY season DESC, cardid DESC
      `

      const queryResult = await cardsQuery<PlayerCard>(query)

      // Handle database errors
      if ('error' in queryResult) {
        console.error('Failed to fetch player cards:', queryResult.error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          status: 'error',
          message: 'Failed to fetch player cards',
        })
        return
      }

      // Return cards with metadata
      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: {
          cards: queryResult,
          total: queryResult.length,
          playerId: playerId,
        },
      })
    } catch (error) {
      console.error('Error processing player cards request:', error)
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: 'Failed to process request',
      })
    }
    return
  }

  methodNotAllowed(req, res, allowedMethods)
}
