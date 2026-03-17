import { NextApiRequest, NextApiResponse } from 'next'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { GET } from '@constants/http-methods'
import SQL, { SQLStatement } from 'sql-template-strings'
import { StatusCodes } from 'http-status-codes'
import methodNotAllowed from '../lib/methodNotAllowed'
import { ApiResponse, UserUniqueCollection } from '..'
import { cardsQuery, portalApi } from '@pages/api/database/database'
import { rateLimit } from 'lib/rateLimit'

const allowedMethods: string[] = [GET]
const cors = Cors({
  methods: allowedMethods,
})

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<UserUniqueCollection[] | null>>
) => {
  await middleware(req, res, cors)
  const card_rarity = req.query.card_rarity as string
  const userID = req.query.userid as string
  if (req.method === GET) {
    const queryString: SQLStatement = SQL`
      SELECT
    userid,
    card_rarity,
    owned_count,
    rarity_rank
FROM
    user_unique_cards
WHERE 1=1 `
    if (card_rarity) {
      queryString.append(SQL` AND card_rarity = ${card_rarity}`)
    }
    if (userID) {
      queryString.append(SQL` AND userid = ${userID}`)
    }

    const queryResult = await cardsQuery<
      Omit<UserUniqueCollection, 'username'>
    >(queryString)
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
        .json({ status: 'error', message: 'Something happened' })
      return
    }

    // Fetch usernames from Portal API for all users
    const usersWithInfo: UserUniqueCollection[] = await Promise.all(
      queryResult.map(async (user) => {
        try {
          const userInfo = await portalApi.getUserInfo(user.userid)
          return {
            ...user,
            username: userInfo.username,
          }
        } catch (error) {
          console.error(`Failed to fetch user info for ${user.userid}`, error)
          return {
            ...user,
            username: `User ${user.userid}`,
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

  methodNotAllowed(req, res, allowedMethods)
}
export default rateLimit(handler)
