import { NextApiRequest, NextApiResponse } from 'next'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { GET } from '@constants/http-methods'
import SQL from 'sql-template-strings'
import { StatusCodes } from 'http-status-codes'
import { ApiResponse, UserCollection } from '..'
import { cardsQuery } from '@pages/api/database/database'
import methodNotAllowed from '../lib/methodNotAllowed'

const allowedMethods: string[] = [GET]
const cors = Cors({
  methods: allowedMethods,
})

export default async function userPacksEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<UserCollection[]>>
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const query = SQL`
  SELECT c.*, cr.image_url as imageURL
FROM pbe_collection c
JOIN (
    SELECT po.packid
    FROM pbe_packs_owned po
    WHERE po.opened = true
    ORDER BY po.openDate DESC
    LIMIT 5
) AS latestPacks ON c.packid = latestPacks.packid
JOIN pbe_cards cr ON c.cardid = cr.cardid
ORDER BY (
    SELECT po.openDate
    FROM pbe_packs_owned po
    WHERE po.packid = c.packid
    AND po.opened = true
) DESC`

    const queryResult = await cardsQuery<UserCollection>(query)

    if ('error' in queryResult) {
      console.error(queryResult.error)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Database connection failed')
      return
    }

    if (queryResult.length === 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'No opened packs found for this user',
      })
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
