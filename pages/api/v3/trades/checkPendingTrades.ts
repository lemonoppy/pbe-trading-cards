import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse } from '..'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { GET } from '@constants/http-methods'
import methodNotAllowed from '../lib/methodNotAllowed'
import { StatusCodes } from 'http-status-codes'
import SQL, { SQLStatement } from 'sql-template-strings'
import { cardsQuery } from '@pages/api/database/database'
import { rateLimit } from 'lib/rateLimit'
import { parseQueryArray } from '@utils/parse-query-array'

const allowedMethods: string[] = [GET] as const
const cors = Cors({
  methods: allowedMethods,
})

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<DuplicateCardsIntrades[]>>
) => {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const tradeID = req.query.id as string
    const cardsString = req.query.cards as string
    const userID = req.query.userid as string
    const cards = cardsString.split(',')

    if (
      !tradeID ||
      !userID ||
      Number.isNaN(Number(userID)) ||
      cards.length === 0
    ) {
      res
        .status(StatusCodes.BAD_REQUEST)
        .end('Please provide a valid tradeID, userID and cardIDs')
      return
    }
    const query: SQLStatement = SQL`
    SELECT 
    ta.tradeid,
    t.initiatorid,
    t.recipientid,
    c.cardid
    FROM pbe_trade_assets ta
    JOIN pbe_collection c 
    ON c.ownedcardid = ta.ownedcardid
    JOIN pbe_trades t 
    ON t.tradeid = ta.tradeid
    WHERE 
    t.trade_status = 'PENDING'
    AND (
    `
    cards.forEach((card, index) => {
      index === 0
        ? query.append(SQL`c.cardid = ${parseInt(card)}`)
        : query.append(SQL` OR c.cardid = ${parseInt(card)}`)
    })

    query.append(SQL`)
    AND c.userid = ${parseInt(userID)}      
    AND (t.initiatorid = c.userid OR t.recipientid = c.userid) 
    AND ta.tradeid != ${parseInt(tradeID)}      
    GROUP BY ta.tradeid, t.initiatorid, t.recipientid, c.cardid
    `)

    const queryResult = await cardsQuery<TradeDetails>(query)

    if ('error' in queryResult) {
      console.error(queryResult)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Server connection failed')
      return
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: queryResult,
    })
  }

  methodNotAllowed(req, res, allowedMethods)
}
export default rateLimit(handler)
