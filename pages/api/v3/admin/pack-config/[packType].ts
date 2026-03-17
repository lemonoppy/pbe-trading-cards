import { NextApiRequest, NextApiResponse } from 'next'
import { PATCH } from '@constants/http-methods'
import { StatusCodes } from 'http-status-codes'
import { cardsQuery } from '@pages/api/database/database'
import { checkUserAuthorization } from '@pages/api/v3/lib/checkUserAuthorization'
import SQL from 'sql-template-strings'

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> => {
  if (req.method !== PATCH) {
    res.setHeader('Allow', [PATCH])
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

  const packType = req.query.packType as string
  const { enabled, daily_limit, subscription_enabled, price } = req.body as {
    enabled?: boolean
    daily_limit?: number
    subscription_enabled?: boolean
    price?: number
  }

  if (
    enabled === undefined &&
    daily_limit === undefined &&
    subscription_enabled === undefined &&
    price === undefined
  ) {
    res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: 'No fields to update' })
    return
  }

  const query = SQL`
    UPDATE pbe_pack_config
    SET updated_at = CURRENT_TIMESTAMP`

  if (enabled !== undefined) {
    query.append(SQL`, enabled = ${enabled}`)
  }
  if (daily_limit !== undefined) {
    query.append(SQL`, daily_limit = ${daily_limit}`)
  }
  if (subscription_enabled !== undefined) {
    query.append(SQL`, subscription_enabled = ${subscription_enabled}`)
  }
  if (price !== undefined) {
    query.append(SQL`, price = ${price}`)
  }

  query.append(SQL`
    WHERE packtype = ${packType}
    RETURNING packtype, enabled, daily_limit, subscription_enabled, price, updated_at`)

  const result = await cardsQuery(query)

  if ('error' in result) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: 'Failed to update pack config' })
    return
  }

  if (result.length === 0) {
    res
      .status(StatusCodes.NOT_FOUND)
      .json({ error: `Pack type '${packType}' not found` })
    return
  }

  res.status(StatusCodes.OK).json(result[0])
}

export default handler
