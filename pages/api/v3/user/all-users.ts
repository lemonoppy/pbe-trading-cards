import { GET } from '@constants/http-methods'
import { NextApiRequest, NextApiResponse } from 'next'
import methodNotAllowed from '../lib/methodNotAllowed'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { StatusCodes } from 'http-status-codes'
import { checkUserAuthorization } from '../lib/checkUserAuthorization'
import { portalApi } from '@pages/api/database/database'
import { ApiResponse } from '..'

const allowedMethods: string[] = [GET] as const
const cors = Cors({
  methods: allowedMethods,
})

export type SimpleUserData = {
  uid: number
  username: string
}

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SimpleUserData[]>>
) => {
  await middleware(req, res, cors)

  if (req.method === GET) {
    // Check if user is authorized (admin roles only)
    if (!(await checkUserAuthorization(req, { validRoles: ['DOTTS_ADMIN', 'PORTAL_MANAGEMENT'] }))) {
      res.status(StatusCodes.UNAUTHORIZED).end('Not authorized')
      return
    }

    try {
      // Get all users from Portal API (cached for 24 hours)
      const allUsersMap = await portalApi.getAllUsers()

      // Convert map to array of simple user objects
      const users: SimpleUserData[] = Array.from(allUsersMap.values()).map(user => ({
        uid: user.uid,
        username: user.username,
      }))

      console.log(`Returning ${users.length} users from all-users endpoint`)
      if (users.length > 0) {
        console.log('Sample users:', users.slice(0, 3).map(u => u.username))
      }

      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: users,
      })
      return
    } catch (error) {
      console.error('Error fetching all users from Portal API:', error)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Failed to fetch users from Portal')
      return
    }
  }

  methodNotAllowed(req, res, allowedMethods)
}

export default handler
