import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse, ListResponse } from '..'
import { UserData } from '.'
import middleware from '@pages/api/database/middleware'
import { GET } from '@constants/http-methods'
import Cors from 'cors'
import SQL from 'sql-template-strings'
import { cardsQuery, portalApi } from '@pages/api/database/database'
import methodNotAllowed from '../lib/methodNotAllowed'
import { StatusCodes } from 'http-status-codes'
import { checkUserAuthorization } from '../lib/checkUserAuthorization'
import { rateLimit } from 'lib/rateLimit'

const allowedMethods = [GET]
const cors = Cors({
  methods: allowedMethods,
})

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ListResponse<UserData>>>
) => {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const username = req.query.username as string
    const limit = parseInt(req.query.limit as string, 10) || 10
    const offset = parseInt(req.query.offset as string, 10) || 0

    const isAuthenticated: boolean = await checkUserAuthorization(req)
    const currentUserId = isAuthenticated ? parseInt(req.cookies.userid, 10) : null

    try {
      // Get all distinct userIDs from the collection
      const userIdsQuery = SQL`
        SELECT DISTINCT userID
        FROM pbe_collection
        ORDER BY userID ASC
      `

      const userIdsResult = await cardsQuery<{ userid: number }>(userIdsQuery)

      if ('error' in userIdsResult) {
        console.error(userIdsResult.error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).end('Database connection failed')
        return
      }

      // Fetch user info from Portal API for each userID (uses cache)
      const usersWithInfo: UserData[] = []

      for (const { userid } of userIdsResult) {
        try {
          const userInfo = await portalApi.getUserInfo(userid)

          // Filter out current user if authenticated
          if (currentUserId && userid === currentUserId) {
            continue
          }

          // Filter by username if provided
          if (username && !userInfo.username.toLowerCase().includes(username.toLowerCase())) {
            continue
          }

          usersWithInfo.push({
            uid: userInfo.uid,
            username: userInfo.username,
            avatar: userInfo.avatar || '',
          })
        } catch (error) {
          // Skip users that can't be fetched from Portal API
          console.warn(`Failed to fetch user info for uid ${userid}:`, error)
          continue
        }
      }

      // Sort by username
      usersWithInfo.sort((a, b) => a.username.localeCompare(b.username))

      // Apply pagination
      const total = usersWithInfo.length
      const paginatedUsers = usersWithInfo.slice(offset, offset + limit)

      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: { rows: paginatedUsers, total },
      })
      return
    } catch (error) {
      console.error('Error fetching users with cards:', error)
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).end('Failed to fetch users')
      return
    }
  }
  methodNotAllowed(req, res, allowedMethods)
}
export default rateLimit(handler)
