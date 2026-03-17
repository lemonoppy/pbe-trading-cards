import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse } from '..'
import middleware from '@pages/api/database/middleware'
import { GET } from '@constants/http-methods'
import Cors from 'cors'
import { checkUserAuthorization } from '../lib/checkUserAuthorization'
import { StatusCodes } from 'http-status-codes'
import { portalApi } from '@pages/api/database/database'
import methodNotAllowed from '../lib/methodNotAllowed'
import { rateLimit } from 'lib/rateLimit'
import logger from 'lib/logger'

const allowedMethods: string[] = [GET] as const
const cors = Cors({
  methods: allowedMethods,
})

export type PermissionsData = {
  uid: number
  groups: number[]
}

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<PermissionsData>>
) => {
  await middleware(req, res, cors)

  if (req.method === GET) {
    if (!(await checkUserAuthorization(req))) {
      res.status(StatusCodes.UNAUTHORIZED).end('Not authorized')
      return
    }

    try {
      const userId = parseInt(req.cookies.userid, 10)
      const authToken = req.headers.authorization?.replace('Bearer ', '')

      // Build cookies string to forward to Portal
      const cookiesString = Object.entries(req.cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')

      // Fetch user permissions from Portal API using the user's token and cookies
      const userPermissions = await portalApi.getUserPermissions(userId, authToken, cookiesString)

      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: {
          uid: userPermissions.uid,
          groups: [
            userPermissions.usergroup,
            ...userPermissions.additionalgroups
              .split(',')
              .filter(Boolean)
              .map((group: string) => parseInt(group)),
          ],
        },
      })
      return
    } catch (error) {
      logger.error({ err: error }, 'Error fetching user permissions')
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Failed to fetch user permissions')
      return
    }
  }

  methodNotAllowed(req, res, allowedMethods)
}

export default rateLimit(handler)
