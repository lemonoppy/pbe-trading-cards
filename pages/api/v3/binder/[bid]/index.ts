import { NextApiRequest, NextApiResponse } from 'next'
import { cardsQuery } from '@pages/api/database/database'
import { GET } from '@constants/http-methods'
import { StatusCodes } from 'http-status-codes'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import SQL from 'sql-template-strings'
import { ApiResponse, binderCards, UserPacks } from '../..'
import { rateLimit } from 'lib/rateLimit'

const allowedMethods = [GET]
const cors = Cors({
  methods: allowedMethods,
})

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<binderCards[]>>
): Promise<void> => {
  await middleware(req, res, cors)

  if (req.method === GET) {
    if (req.method !== 'GET') {
      res.status(405).end(`Method ${req.method} Not Allowed`)
      return
    }

    const binderID = req.query.bid
    const result = await cardsQuery<binderCards>(
      SQL`
      SELECT
    binder_cards.binderid,
    binder_cards.ownedcardid,
    binder_cards.position,
    collection.cardid,
    collection.userid,
    cards.player_name,
    cards.teamid,
    cards.playerid,
    cards.card_rarity,
    cards.image_url,
    cards.season,
    cards.leagueid
FROM
    pbe_binder_cards AS binder_cards
JOIN
    pbe_collection AS collection ON binder_cards.ownedcardid = collection.ownedcardid
JOIN
    pbe_cards AS cards ON collection.cardid = cards.cardid
WHERE binder_cards.binderid =${binderID}`
    )
    if ('error' in result) {
      console.error(result.error)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Database connection failed')
      return
    }
    // Return empty array if no cards found (binder exists but is empty)
    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: result,
    })
    return
  }

  res.setHeader('Allowed', allowedMethods)
  res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
}

export default rateLimit(handler)
