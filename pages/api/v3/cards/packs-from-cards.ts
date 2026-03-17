import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse, UserCollection } from '..'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { GET } from '@constants/http-methods'
import { cardsQuery, portalApi } from '@pages/api/database/database'
import SQL from 'sql-template-strings'
import { StatusCodes } from 'http-status-codes'
import methodNotAllowed from '../lib/methodNotAllowed'

const allowedMethods: string[] = [GET]
const cors = Cors({
  methods: allowedMethods,
})

export default async function userUniqueCardsEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<UserCollection[] | null>>
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const userID = (req.query.userID || req.query.userid) as string
    const cardID = (req.query.cardID || req.query.cardid) as string
    const isOwned = req.query.isOwned as string
    if (!userID || !cardID) {
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ status: 'error', message: 'Missing userID or cardID' })
      return
    }
    let query
    if (isOwned === 'true') {
      query = SQL`
            SELECT ownedCardID, userID, cardID, packID
            FROM pbe_collection
            WHERE userID = ${userID} AND cardID = ${cardID}
        `
    } else {
      query = SQL`
            SELECT c.cardid, c.userid, COUNT(c.cardid) AS total
FROM pbe_collection AS c
WHERE c.cardid = ${cardID}
GROUP BY c.userid, c.cardid
ORDER BY total DESC
        `
    }

    const queryResult = await cardsQuery<{
      cardid: number
      userid: number
      total?: number
    }>(query)

    if ('error' in queryResult) {
      console.error(queryResult.error)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Database connection failed')
      return
    }

    // Fetch usernames from Portal API if needed
    let result = queryResult
    if (isOwned !== 'true' && queryResult.length > 0) {
      result = await Promise.all(
        queryResult.map(async (row) => {
          try {
            const userInfo = await portalApi.getUserInfo(row.userid)
            return {
              ...row,
              username: userInfo.username,
            }
          } catch (error) {
            console.error(
              `Failed to fetch username for user ${row.userid}`,
              error
            )
            return {
              ...row,
              username: `User ${row.userid}`,
            }
          }
        })
      )
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: result as UserCollection[],
    })
    return
  }

  methodNotAllowed(req, res, allowedMethods)
}
