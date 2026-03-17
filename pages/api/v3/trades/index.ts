import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse, ListResponse } from '..'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { GET, POST } from '@constants/http-methods'
import { cardsQuery, portalApi } from '@pages/api/database/database'
import SQL, { SQLStatement } from 'sql-template-strings'
import { StatusCodes } from 'http-status-codes'
import { UserData } from '../user'
import methodNotAllowed from '../lib/methodNotAllowed'
import { TradeAsset } from '@pages/api/mutations/use-create-trade'
import { checkUserAuthorization } from '../lib/checkUserAuthorization'

const allowedMethods: string[] = [GET, POST] as const
const cors = Cors({
  methods: allowedMethods,
})

export default async function tradesEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ListResponse<Trade | null>>>
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const username = (req.query.username ?? '') as string
    const status = (req.query.status ?? '') as string
    const userID = req.query.userid as string

    let tradePartners = []
    if (username.length !== 0) {
      // Search users via Portal API
      try {
        const userId = parseInt(username, 10)
        if (!isNaN(userId)) {
          const userInfo = await portalApi.getUserInfo(userId)
          if (userInfo) {
            tradePartners = [{ uid: userInfo.uid, username: userInfo.username }]
          }
        }
      } catch (error) {
        console.error('Error fetching user from Portal:', error)
        // Continue with empty tradePartners
      }
    }

    const tradesQuery = SQL`SELECT
    t.tradeid,
    t.initiatorid,
    t.recipientid,
    t.trade_status,
    t.create_date,
    t.update_date,
    t.declineuserid
  FROM pbe_trades AS t`

    if (tradePartners.length === 0) {
      tradesQuery.append(
        SQL` WHERE (t.initiatorid=${userID} OR t.recipientid=${userID})`
      )
    } else {
      const partnerIds = tradePartners.map((partner) => partner.uid)
      tradesQuery.append(
        SQL` WHERE ((t.initiatorid=${userID} AND t.recipientid IN (`
      )
      partnerIds.forEach((id, index) => {
        if (index === 0) {
          tradesQuery.append(SQL` ${id}`)
          return
        }

        tradesQuery.append(SQL`, ${id}`)
      })
      tradesQuery.append(
        SQL`)) OR (t.recipientid=${userID} AND t.initiatorid IN (`
      )
      partnerIds.forEach((id, index) => {
        if (index === 0) {
          tradesQuery.append(SQL` ${id}`)
          return
        }

        tradesQuery.append(SQL`, ${id}`)
      })
      tradesQuery.append(SQL`)))`)
    }

    if (status.length !== 0) {
      tradesQuery.append(
        SQL` AND t.trade_status=${status} ORDER BY t.create_date DESC`
      )
    }

    const queryResult = await cardsQuery<Trade>(tradesQuery)

    if ('error' in queryResult) {
      console.error(queryResult.error)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Datebase connection failed')
      return
    }

    // Fetch all users from Portal API (cached for 1 hour)
    // This is more efficient than making individual calls per user
    const allUsers = await portalApi.getAllUsers()

    // Add usernames to trades
    const tradesWithUsernames = queryResult.map((trade) => ({
      ...trade,
      initiatorUsername: allUsers.get(trade.initiatorid)?.username || `User ${trade.initiatorid}`,
      recipientUsername: allUsers.get(trade.recipientid)?.username || `User ${trade.recipientid}`,
    }))

    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: {
        rows: tradesWithUsernames,
        total: tradesWithUsernames.length,
      },
    })
  }

  if (req.method === POST) {
    if (!(await checkUserAuthorization(req))) {
      res.status(StatusCodes.UNAUTHORIZED).end('Not authorized')
      return
    }
    const initiatorId = req.body.initiatorId as string
    const recipientId = req.body.recipientId as string
    const tradeAssets = req.body.tradeAssets as TradeAsset[]

    if (
      !initiatorId ||
      !recipientId ||
      !tradeAssets ||
      tradeAssets.length === 0
    ) {
      res.status(StatusCodes.BAD_REQUEST).end('Malformed request')
      return
    }

    if (initiatorId === recipientId) {
      res.status(StatusCodes.BAD_REQUEST).end('You cannot trade with yourself')
      return
    }

    let tradeError: boolean = false
    await Promise.all(
      tradeAssets.map(async (asset: TradeAsset) => {
        const cardOwner = await cardsQuery<{ userid: number }>(
          SQL`SELECT userid FROM pbe_collection WHERE ownedcardid=${asset.ownedCardId} LIMIT 1`
        )
        if (cardOwner[0]?.userid != asset.fromId) {
          tradeError = true
        }
      })
    )

    if (tradeError) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).end('Trade contains errors')
      return
    }

    const createTradeResult = await cardsQuery(
      SQL`SELECT * FROM create_trade(${initiatorId},${recipientId})`
    )

    const newTrade = createTradeResult[0]

    await Promise.all(
      tradeAssets.map(
        async (asset: TradeAsset) =>
          await cardsQuery(
            SQL`SELECT add_trade_asset(${newTrade.tradeid}, ${asset.ownedCardId}, ${asset.toId}, ${asset.fromId})`
          )
      )
    )

    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: null,
    })
    return
  }

  methodNotAllowed(req, res, allowedMethods)
}
