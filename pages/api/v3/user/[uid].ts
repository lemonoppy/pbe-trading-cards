import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse } from '..'
import { UserData } from '.'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { GET } from '@constants/http-methods'
import { portalApi } from '@pages/api/database/database'
import { StatusCodes } from 'http-status-codes'
import methodNotAllowed from '../lib/methodNotAllowed'
import { rateLimit } from 'lib/rateLimit'

const allowedMethods: string[] = [GET] as const
const cors = Cors({
  methods: allowedMethods,
})

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<UserData>>
) => {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const uid = req.query.uid as string

    try {
      // Fetch user info from Portal API
      const userInfo = await portalApi.getUserInfo(parseInt(uid, 10))

      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: {
          uid: userInfo.uid,
          username: userInfo.username,
          avatar: userInfo.avatar,
        },
      })
      return
    } catch (error) {
      console.error('Error fetching user from Portal:', error)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Failed to fetch user data')
      return
    }
  }

  methodNotAllowed(req, res, allowedMethods)
}

export default rateLimit(handler)
