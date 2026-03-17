import { NextApiRequest, NextApiResponse } from 'next'
import { GET } from '@constants/http-methods'
import { StatusCodes } from 'http-status-codes'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import SQL from 'sql-template-strings'
import { ApiResponse, CardMakerInfo } from '../..'
import methodNotAllowed from '../../lib/methodNotAllowed'
import { cardsQuery, portalApi } from '@pages/api/database/database'

const allowedMethods = [GET]
const cors = Cors({
  methods: allowedMethods,
})

export default async function cardInfo(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<CardMakerInfo[]>>
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const cardID = (req.query.cardID || req.query.cardid) as string

    if (!cardID) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Please provide a cardID in your request',
      })
      return
    }

    const queryResult = await cardsQuery<{
      userid: number
      date_approved: string
    }>(SQL`
      SELECT c.author_userid as userid, c.date_approved
      FROM pbe_cards as c
      WHERE c.cardid=${cardID};
    `)

    if ('error' in queryResult) {
      console.error(queryResult)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Server connection failed')
      return
    }

    if (queryResult.length === 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'Card not found',
      })
      return
    }

    // Fetch username from Portal API
    const cardData = queryResult[0]
    let username = 'Unknown'

    if (cardData.userid) {
      try {
        const userInfo = await portalApi.getUserInfo(cardData.userid)
        username = userInfo.username
      } catch (error) {
        console.error(`Failed to fetch user info for ${cardData.userid}`, error)
      }
    }

    const result: CardMakerInfo[] = [{
      userid: cardData.userid,
      username,
      date_approved: cardData.date_approved,
    }]

    res
      .status(StatusCodes.OK)
      .json({ status: 'success', payload: result })
    return
  }

  methodNotAllowed(req, res, allowedMethods)
}
