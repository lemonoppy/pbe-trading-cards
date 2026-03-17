import { POST } from '@constants/http-methods'
import { NextApiRequest, NextApiResponse } from 'next'
import methodNotAllowed from '../lib/methodNotAllowed'
import { portalApi } from '@pages/api/database/database'
import { StatusCodes } from 'http-status-codes'
import { ApiResponse } from '..'
import Cors from 'cors'
import middleware from '@pages/api/database/middleware'

const allowedMethods: string[] = [POST]
const cors = Cors({
  methods: allowedMethods,
})

type LoginData = {
  userid: number
  usergroup: number
  accessToken: string
  refreshToken: string
}

export default async function loginEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<LoginData>>
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === POST) {
    try {
      // Proxy to Portal API for authentication
      const loginResponse = await portalApi.login(
        req.body.username,
        req.body.password
      )

      console.log('Portal API login response:', JSON.stringify(loginResponse, null, 2))

      // Portal API handles all authentication logic, password validation, user status checks, etc.
      if (loginResponse.status === 'error') {
        res.status(StatusCodes.OK).json({
          status: 'error',
          message: loginResponse.errorMessage || 'Login failed',
        })
        return
      }

      // Validate payload exists
      if (!loginResponse.payload) {
        console.error('Portal API returned success but no payload:', loginResponse)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          status: 'error',
          message: 'Invalid response from authentication service',
        })
        return
      }

      // Success - return the tokens from Portal
      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: loginResponse.payload,
      })
      return
    } catch (error) {
      console.error('Error during login:', error)
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: 'Server connection failed',
      })
      return
    }
  }

  methodNotAllowed(req, res, allowedMethods)
}
