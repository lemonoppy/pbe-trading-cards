import { NextApiRequest, NextApiResponse } from 'next'
import { GET } from '@constants/http-methods'
import { StatusCodes } from 'http-status-codes'
import { cardsQuery } from '@pages/api/database/database'
import { checkUserAuthorization } from '@pages/api/v3/lib/checkUserAuthorization'
import SQL from 'sql-template-strings'

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> => {
  if (req.method !== GET) {
    res.setHeader('Allow', [GET])
    res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
    return
  }

  if (
    !(await checkUserAuthorization(req, {
      validRoles: ['DOTTS_ADMIN', 'PORTAL_MANAGEMENT'],
    }))
  ) {
    res.status(StatusCodes.UNAUTHORIZED).end('Not authorized')
    return
  }

  const result = await cardsQuery(
    SQL`SELECT packtype, enabled, daily_limit, subscription_enabled, price, updated_at
        FROM pbe_pack_config
        ORDER BY CASE packtype
          WHEN 'base'      THEN 1
          WHEN 'ruby'      THEN 2
          WHEN 'throwback' THEN 3
          WHEN 'event'     THEN 4
          ELSE 5
        END`
  )

  if ('error' in result) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to fetch pack config' })
    return
  }

  res.status(StatusCodes.OK).json(result)
}

export default handler
