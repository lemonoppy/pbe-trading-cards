import { NextApiRequest, NextApiResponse } from 'next'
import { GET } from '@constants/http-methods'
import { StatusCodes } from 'http-status-codes'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { portalApi } from '@pages/api/database/database'

const allowedMethods = [GET]
const cors = Cors({
  methods: allowedMethods,
})

export default async function playerAwardsProxy(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const { pid } = req.query

    if (!pid) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Player ID (pid) is required',
      })
      return
    }

    try {
      const playerId = parseInt(pid as string, 10)
      const awards = await portalApi.getPlayerAwards(playerId)
      res.status(StatusCodes.OK).json(awards)
    } catch (error) {
      console.error('Failed to fetch player awards from Portal:', error)
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch player awards',
      })
    }
    return
  }

  res.setHeader('Allowed', allowedMethods)
  res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
}
