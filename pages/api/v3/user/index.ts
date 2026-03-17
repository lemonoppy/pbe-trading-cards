import { GET } from '@constants/http-methods'
import { NextApiRequest, NextApiResponse } from 'next'
import methodNotAllowed from '../lib/methodNotAllowed'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { StatusCodes } from 'http-status-codes'
import { checkUserAuthorization } from '../lib/checkUserAuthorization'
import { portalApi } from '@pages/api/database/database'
import { ApiResponse } from '..'
import { rateLimit } from 'lib/rateLimit'

const allowedMethods: string[] = [GET] as const
const cors = Cors({
  methods: allowedMethods,
})

export type UserData = {
  uid: number
  username: string
  avatar: string
}

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<UserData>>
) => {
  await middleware(req, res, cors)

  if (req.method === GET) {
    if (!(await checkUserAuthorization(req))) {
      res.status(StatusCodes.UNAUTHORIZED).end('Not authorized')
      return
    }

    try {
      // Proxy to Portal API for user info
      const userId = parseInt(req.cookies.userid, 10)
      const user = await portalApi.getUserInfo(userId)

      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: {
          uid: user.uid,
          username: user.username,
          avatar: user.avatar || '',
        },
      })
      return
    } catch (error) {
      console.error('Error fetching user from Portal API:', error)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Failed to fetch user info from Portal')
      return
    }
  }

  methodNotAllowed(req, res, allowedMethods)
}

export default rateLimit(handler)
