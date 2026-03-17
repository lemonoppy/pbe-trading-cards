import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse } from '..'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { POST } from '@constants/http-methods'
import { cardsQuery } from '@pages/api/database/database'
import SQL from 'sql-template-strings'
import { StatusCodes } from 'http-status-codes'
import methodNotAllowed from '../lib/methodNotAllowed'

const allowedMethods: string[] = [POST] as const
const cors = Cors({
  methods: allowedMethods,
})

type PackType = 'base' | 'ruby' | 'throwback' | 'event'

type GrantFreePacksRequest = {
  userIds: number[]
  packType: PackType
  packsPerUser?: number
}

export default async function grantFreePacksEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ packIds: number[]; usersGranted: number }>>
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === POST) {
    const authHeader = req.headers.authorization
    if (authHeader !== `Bearer ${process.env.EXTERNAL_API_KEY}`) {
      res.status(StatusCodes.UNAUTHORIZED).json({
        status: 'error',
        message: 'Unauthorized',
      })
      return
    }

    const { userIds, packType, packsPerUser = 1 } =
      req.body as GrantFreePacksRequest

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Please provide a non-empty userIds array',
      })
      return
    }

    const validPackTypes: PackType[] = ['base', 'ruby', 'throwback', 'event']
    if (!packType || !validPackTypes.includes(packType)) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: `packType must be one of: ${validPackTypes.join(', ')}`,
      })
      return
    }

    try {
      const allPackIds: number[] = []

      for (const userId of userIds) {
        for (let i = 0; i < packsPerUser; i++) {
          const result = await cardsQuery<{ packid: number }>(SQL`
            INSERT INTO pbe_packs_owned (userID, packType, source)
            VALUES (${userId}, ${packType}, 'free_pack')
            RETURNING packID
          `)

          if ('error' in result) {
            console.error(result)
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
              status: 'error',
              message: 'Failed to insert free pack',
            })
            return
          }

          allPackIds.push(result[0].packid)
        }
      }

      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: { packIds: allPackIds, usersGranted: userIds.length },
      })
      return
    } catch (error) {
      console.error('Error granting free packs:', error)
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: 'Failed to grant free packs',
      })
      return
    }
  }

  methodNotAllowed(req, res, allowedMethods)
}
