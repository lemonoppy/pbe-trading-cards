import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse } from '../..'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { GET, POST } from '@constants/http-methods'
import methodNotAllowed from '../../lib/methodNotAllowed'
import { cardsQuery } from '@pages/api/database/database'
import SQL from 'sql-template-strings'
import { StatusCodes } from 'http-status-codes'
import { checkUserAuthorization } from '../../lib/checkUserAuthorization'
import { rateLimit } from 'lib/rateLimit'

const allowedMethods = [POST]
const cors = Cors({
  methods: allowedMethods,
})

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) => {
  await middleware(req, res, cors)

  const { uid } = req.query

  if (req.method === POST) {
    if (!(await checkUserAuthorization(req))) {
      res.status(StatusCodes.UNAUTHORIZED).end('Not authorized')
      return
    }
    const { subscription, rubySubscription } = req.body

    // At least one subscription field must be provided
    if (subscription === undefined && rubySubscription === undefined) {
      console.error('Missing subscription fields')
      res
        .status(StatusCodes.BAD_REQUEST)
        .end('Please provide a subscription amount in your request')
      return
    }

    // Validate base subscription (0-3)
    if (subscription !== undefined && (subscription < 0 || subscription > 3)) {
      res
        .status(StatusCodes.BAD_REQUEST)
        .end('Base subscription must be between 0 and 3')
      return
    }

    // Validate ruby subscription (0-1)
    if (rubySubscription !== undefined && (rubySubscription < 0 || rubySubscription > 1)) {
      res
        .status(StatusCodes.BAD_REQUEST)
        .end('Ultimus subscription must be between 0 and 1')
      return
    }

    // Update the appropriate field(s)
    if (subscription !== undefined && rubySubscription === undefined) {
      // Update base subscription only
      await cardsQuery(SQL`
        INSERT INTO pbe_settings
          (userID, subscription)
        VALUES
          (${uid}, ${subscription})
        ON CONFLICT (userID)
        DO UPDATE SET subscription = ${subscription}, updated_at = CURRENT_TIMESTAMP;
      `)
    } else if (rubySubscription !== undefined && subscription === undefined) {
      // Update ruby subscription only
      await cardsQuery(SQL`
        INSERT INTO pbe_settings
          (userID, rubySubscription)
        VALUES
          (${uid}, ${rubySubscription})
        ON CONFLICT (userID)
        DO UPDATE SET rubySubscription = ${rubySubscription}, updated_at = CURRENT_TIMESTAMP;
      `)
    } else {
      // Update both
      await cardsQuery(SQL`
        INSERT INTO pbe_settings
          (userID, subscription, rubySubscription)
        VALUES
          (${uid}, ${subscription}, ${rubySubscription})
        ON CONFLICT (userID)
        DO UPDATE SET
          subscription = ${subscription},
          rubySubscription = ${rubySubscription},
          updated_at = CURRENT_TIMESTAMP;
      `)
    }

    res
      .status(StatusCodes.OK)
      .json({ status: 'success', payload: { subscription, rubySubscription } })
  } else {
    methodNotAllowed(req, res, allowedMethods)
  }
}

export default rateLimit(handler)
