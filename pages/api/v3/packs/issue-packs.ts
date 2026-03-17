import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse } from '..'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { POST } from '@constants/http-methods'
import { cardsQuery } from '@pages/api/database/database'
import SQL from 'sql-template-strings'
import { StatusCodes } from 'http-status-codes'
import methodNotAllowed from '../lib/methodNotAllowed'
import { checkUserAuthorization } from '../lib/checkUserAuthorization'

const allowedMethods: string[] = [POST] as const
const cors = Cors({
  methods: allowedMethods,
})

type IssuePacksRequest = {
  userId: number
  basePacks?: number
  rubyPacks?: number
  retroPacks?: number
  eventPacks?: number
}

export default async function issuePacksEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<{ packIds: number[] }>>
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === POST) {
    const { packsToIssue } = req.body as { packsToIssue: IssuePacksRequest[] }

    if (!packsToIssue || !Array.isArray(packsToIssue)) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Please provide packsToIssue array in your request',
      })
      return
    }

    if (!(await checkUserAuthorization(req, { validRoles: ['DOTTS_ADMIN', 'PORTAL_MANAGEMENT'] }))) {
      res.status(StatusCodes.UNAUTHORIZED).end('Not authorized')
      return
    }

    try {
      const allPackIds: number[] = []

      // Process each user's packs
      for (const packRequest of packsToIssue) {
        const { userId, basePacks = 0, rubyPacks = 0, retroPacks = 0, eventPacks = 0 } = packRequest

        if (!userId) {
          res.status(StatusCodes.BAD_REQUEST).json({
            status: 'error',
            message: 'Each pack request must include a userId',
          })
          return
        }

        // Insert base packs
        for (let i = 0; i < basePacks; i++) {
          const result = await cardsQuery<{ packid: number }>(SQL`
            INSERT INTO pbe_packs_owned (userID, packType, source)
            VALUES (${userId}, 'base', 'admin_issued')
            RETURNING packID
          `)

          if ('error' in result) {
            console.error(result)
            res
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json({
                status: 'error',
                message: 'Failed to insert base pack',
              })
            return
          }

          allPackIds.push(result[0].packid)
        }

        // Insert ruby packs
        for (let i = 0; i < rubyPacks; i++) {
          const result = await cardsQuery<{ packid: number }>(SQL`
            INSERT INTO pbe_packs_owned (userID, packType, source)
            VALUES (${userId}, 'ruby', 'admin_issued')
            RETURNING packID
          `)

          if ('error' in result) {
            console.error(result)
            res
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json({
                status: 'error',
                message: 'Failed to insert ruby pack',
              })
            return
          }

          allPackIds.push(result[0].packid)
        }
        // Insert retro packs
        for (let i = 0; i < retroPacks; i++) {
          const result = await cardsQuery<{ packid: number }>(SQL`
            INSERT INTO pbe_packs_owned (userID, packType, source)
            VALUES (${userId}, 'throwback', 'admin_issued')
            RETURNING packID
          `)

          if ('error' in result) {
            console.error(result)
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
              status: 'error',
              message: 'Failed to insert ruby pack',
            })
            return
          }

          allPackIds.push(result[0].packid)
        }
        // Insert event packs
        for (let i = 0; i < eventPacks; i++) {
          const result = await cardsQuery<{ packid: number }>(SQL`
            INSERT INTO pbe_packs_owned (userID, packType, source)
            VALUES (${userId}, 'event', 'admin_issued')
            RETURNING packID
          `)

          if ('error' in result) {
            console.error(result)
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
              status: 'error',
              message: 'Failed to insert ruby pack',
            })
            return
          }

          allPackIds.push(result[0].packid)
        }
      }

      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: { packIds: allPackIds },
      })
      return
    } catch (error) {
      console.error('Error issuing packs:', error)
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: 'Failed to issue packs',
      })
      return
    }
  }

  methodNotAllowed(req, res, allowedMethods)
}
