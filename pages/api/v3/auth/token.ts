import { POST } from '@constants/http-methods'
import methodNotAllowed from '../lib/methodNotAllowed'
import { NextApiRequest, NextApiResponse } from 'next'
import { portalApi } from '@pages/api/database/database'
import { StatusCodes } from 'http-status-codes'
import { ApiResponse } from '..'
import Cors from 'cors'
import middleware from '@pages/api/database/middleware'

type TokenData = {
  userid: number
  usergroup: number
  accessToken: string
  refreshToken: string
}

const allowedMethods: string[] = [POST]
const cors = Cors({
  methods: allowedMethods,
})

export default async function tokenEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<TokenData>>
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === POST) {
    try {
      // Proxy to Portal API for token refresh
      const tokenResponse = await portalApi.refreshToken(req.body.refreshToken)

      // Portal API handles token validation, expiration checks, etc.
      if (tokenResponse.status === 'error') {
        res.status(StatusCodes.OK).json({
          status: 'logout',
          message: tokenResponse.errorMessage || 'Token refresh failed',
        })
        return
      }

      // Success - return the new tokens from Portal
      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: tokenResponse.payload!,
      })
      return
    } catch (error) {
      console.error('Error during token refresh:', error)
      res.status(StatusCodes.OK).json({
        status: 'logout',
        message: 'Server connection failed',
      })
      return
    }
  }

  methodNotAllowed(req, res, allowedMethods)
}
