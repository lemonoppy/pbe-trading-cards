import { NextApiRequest, NextApiResponse } from 'next'
import { cardsQuery } from '@pages/api/database/database'
import { GET } from '@constants/http-methods'
import { StatusCodes } from 'http-status-codes'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import SQL from 'sql-template-strings'
import { rateLimit } from 'lib/rateLimit'

const allowedMethods = [GET]
const cors = Cors({
  methods: allowedMethods,
})

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> => {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const { uid } = req.query

    if (!uid) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: 'Missing uid parameter',
      })
      return
    }

    // Query today's purchase counts and pack config in one go
    const [countsResult, configResult] = await Promise.all([
      cardsQuery<{ base: number; ruby: number; throwback: number; event: number }>(SQL`
        SELECT base, ruby, throwback, event
        FROM pbe_pack_today
        WHERE userid=${uid};
      `),
      cardsQuery<{ packtype: string; daily_limit: number; enabled: boolean; subscription_enabled: boolean; price: number }>(SQL`
        SELECT packtype, daily_limit, enabled, subscription_enabled, price
        FROM pbe_pack_config;
      `),
    ])

    if ('error' in countsResult || 'error' in configResult) {
      console.error('Error fetching pack limits')
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch pack limits',
      })
      return
    }

    const counts = countsResult[0] || { base: 0, ruby: 0, throwback: 0, event: 0 }

    const response: Record<string, { count: number; daily_limit: number; enabled: boolean; subscription_enabled: boolean; price: number }> = {}
    for (const cfg of configResult) {
      response[cfg.packtype] = {
        count: counts[cfg.packtype] || 0,
        daily_limit: cfg.daily_limit,
        enabled: cfg.enabled,
        subscription_enabled: cfg.subscription_enabled,
        price: cfg.price,
      }
    }

    res.status(StatusCodes.OK).json(response)
    return
  }

  res.setHeader('Allowed', allowedMethods)
  res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
}

export default rateLimit(handler)
