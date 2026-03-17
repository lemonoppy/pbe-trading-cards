import { NextApiRequest, NextApiResponse } from 'next'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { GET } from '@constants/http-methods'
import SQL from 'sql-template-strings'
import { StatusCodes } from 'http-status-codes'
import methodNotAllowed from '../../lib/methodNotAllowed'
import { ApiResponse, LatestCards } from '../..'
import { cardsQuery } from '@pages/api/database/database'
import { rateLimit } from 'lib/rateLimit'

const allowedMethods: string[] = [GET]
const cors = Cors({
  methods: allowedMethods,
})

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<LatestCards[] | null>>
) => {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const packID = req.query.packID as string

    if (!packID) {
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ status: 'error', message: 'Missing packID' })
      return
    }

    const queryResult = await cardsQuery<LatestCards>(SQL`
            SELECT col.ownedcardid, col.userid, col.cardid, col.packid, c.player_name, c.playerid, c.leagueid, c.card_rarity, c.image_url
FROM pbe_collection col
JOIN pbe_cards c ON col.cardid = c.cardid
WHERE col.packid =  ${packID}
        `)

    if ('error' in queryResult) {
      console.error(queryResult.error)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Database connection failed')
      return
    }

    if (queryResult.length === 0) {
      res
        .status(StatusCodes.NOT_FOUND)
        .json({ status: 'error', message: 'No cards found for this pack' })
      return
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: queryResult,
    })
    return
  }

  methodNotAllowed(req, res, allowedMethods)
}
export default rateLimit(handler)
