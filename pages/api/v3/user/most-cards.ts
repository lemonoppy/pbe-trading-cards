import middleware from '@pages/api/database/middleware'
import { NextApiRequest, NextApiResponse } from 'next'
import { GET } from '@constants/http-methods'

import Cors from 'cors'
import { cardsQuery, portalApi } from '@pages/api/database/database'
import SQL, { SQLStatement } from 'sql-template-strings'
import { StatusCodes } from 'http-status-codes'
import { ApiResponse, UserMostCards } from '..'
import { rateLimit } from 'lib/rateLimit'

const allowedMethods = [GET]
const cors = Cors({
  methods: allowedMethods,
})

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<UserMostCards[] | null>>
): Promise<void> => {
  await middleware(req, res, cors)
  const { method } = req

  if (method === GET) {
    const limit = req.query.limit as string
    const queryString: SQLStatement = SQL`
      SELECT userid, count(*) AS "uniqueCards", sum(quantity) AS "totalCards"
      FROM pbe_owned_cards
      GROUP BY userid
      ORDER BY sum(quantity) DESC
       `
    if (limit) {
      queryString.append(SQL` LIMIT ${limit}`)
    }
    const queryResult = await cardsQuery<{
      userid: number
      uniqueCards: number
      totalCards: number
    }>(queryString)

    if ('error' in queryResult) {
      console.error(queryResult.error)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Database connection failed')
      return
    }

    if (queryResult.length === 0) {
      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: [],
      })
      return
    }

    // Fetch usernames from Portal API for all users with retry logic
    const fetchUserWithRetry = async (userid: number, retries = 2): Promise<any> => {
      for (let i = 0; i <= retries; i++) {
        try {
          return await portalApi.getUserInfo(userid)
        } catch (error) {
          if (i === retries) {
            console.error(`Failed to fetch user info for ${userid} after ${retries + 1} attempts`, error)
            throw error
          }
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)))
        }
      }
    }

    const usersWithInfo: UserMostCards[] = await Promise.all(
      queryResult.map(async (user) => {
        try {
          const userInfo = await fetchUserWithRetry(user.userid)
          return {
            userid: user.userid,
            uniqueCards: user.uniqueCards,
            totalCards: user.totalCards,
            username: userInfo.username,
            avatar: userInfo.avatar || '',
          }
        } catch (error) {
          return {
            userid: user.userid,
            uniqueCards: user.uniqueCards,
            totalCards: user.totalCards,
            username: `User ${user.userid}`,
            avatar: '',
          }
        }
      })
    )

    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: usersWithInfo,
    })
    return
  }

  res.setHeader('Allowed', allowedMethods)
  res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
}
export default rateLimit(handler)
