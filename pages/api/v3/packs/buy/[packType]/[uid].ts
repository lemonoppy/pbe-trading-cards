import { NextApiRequest, NextApiResponse } from 'next'
import { POST } from '@constants/http-methods'
import { StatusCodes } from 'http-status-codes'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import SQL from 'sql-template-strings'
import assertBoom from '@pages/api/lib/assertBoom'
import { cardsQuery } from '@pages/api/database/database'
import { packService } from 'services/packService'
import { checkUserAuthorization } from '@pages/api/v3/lib/checkUserAuthorization'
import { rateLimit } from 'lib/rateLimit'
import { portalApi } from 'services/portalApiService'
import logger from 'lib/logger'

const allowedMethods = [POST]
const cors = Cors({
  methods: allowedMethods,
})

interface PackPurchaseRequest extends NextApiRequest {
  query: {
    uid: string
    packType: string
  }
}

const handler = async (
  req: PackPurchaseRequest,
  res: NextApiResponse
): Promise<void> => {
  await middleware(req, res, cors)
  const { method, query } = req

  if (method === POST) {
    if (!(await checkUserAuthorization(req))) {
      res.status(StatusCodes.UNAUTHORIZED).end('Not authorized')
      return
    }

    try {
      const uid = req.query.uid as string
      const packType = req.query.packType as string

      const isMissingUserId: boolean = assertBoom(
        !!uid,
        res,
        'Missing User ID',
        StatusCodes.BAD_REQUEST
      )
      if (isMissingUserId) return

      const isMissingPackType: boolean = assertBoom(
        !!packType,
        res,
        'Missing Pack Type',
        StatusCodes.BAD_REQUEST
      )
      if (isMissingPackType) return

      // Check if pack type exists in static config
      const packInfo = packService.packs[packType]
      if (!packInfo) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: `Invalid pack type: ${packType}`,
        })
        return
      }

      // Check pack availability and daily limit from DB config
      const packConfigResult = await cardsQuery<{
        enabled: boolean
        daily_limit: number
        price: number
      }>(
        SQL`SELECT enabled, daily_limit, price FROM pbe_pack_config WHERE packtype = ${packType}`
      )

      if ('error' in packConfigResult || packConfigResult.length === 0) {
        res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ error: 'Error fetching pack config' })
        return
      }

      const packConfig = packConfigResult[0]

      if (!packConfig.enabled) {
        res.status(StatusCodes.FORBIDDEN).json({
          error: `${packInfo.label} packs are not currently available for purchase`,
        })
        return
      }

      const hasReachedLimit = await cardsQuery<{ PackCount }>(
        SQL`
            SELECT base, ruby, throwback, event
            FROM pbe_pack_today
            WHERE userid=${uid};`
      )

      if ('error' in hasReachedLimit) {
        res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ error: 'Error fetching pack limit data' })
        return
      }

      const currentCount = hasReachedLimit[0]?.[packType] || 0
      const dailyLimit = packConfig.daily_limit
      const remaining = dailyLimit - currentCount

      const hasReachedPackLimit: boolean = assertBoom(
        remaining > 0,
        res,
        `Daily Pack Limit of ${dailyLimit} Reached for ${packType} pack`,
        StatusCodes.BAD_REQUEST
      )
      if (hasReachedPackLimit) return

      // Cap requested quantity to remaining allowance
      const requestedQty = Math.max(1, parseInt(req.body?.quantity) || 1)
      const quantity = Math.min(requestedQty, remaining)
      const unitPrice = packConfig.price
      const totalPrice = unitPrice * quantity

      // Get bank balance from Portal API
      const bankBalance = await portalApi.getBankBalance(parseInt(uid))

      const hasInsufficientFunds: boolean = assertBoom(
        bankBalance.bankBalance >= totalPrice,
        res,
        'Insufficient Funds',
        StatusCodes.BAD_REQUEST
      )
      if (hasInsufficientFunds) return

      // Create single bank transaction for all packs
      if (totalPrice !== 0) {
        try {
          await portalApi.createBankTransaction({
            uid: parseInt(uid),
            type: 'trading cards',
            groupName: 'Dotts Pack Purchase',
            description: quantity === 1
              ? packService.packs[packType].purchaseText
              : `${packService.packs[packType].purchaseText} x${quantity}`,
            amount: -totalPrice,
            status: 'completed',
          })
          logger.info(
            { uid, packType, quantity, totalPrice },
            'Bank transaction created for pack purchase'
          )
        } catch (error) {
          logger.error(
            { err: error, uid, packType },
            'Failed to create bank transaction for pack purchase'
          )
          res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            error: 'Failed to process payment',
          })
          return
        }
      }

      // Insert packs into Dotts database
      const insertPromises = Array.from({ length: quantity }, () =>
        cardsQuery(
          SQL`INSERT INTO pbe_packs_owned (userID, packType, source) VALUES (${uid}, ${packType}, 'Pack Shop');`
        )
      )
      const insertResults = await Promise.all(insertPromises)
      const insertError = insertResults.find((r) => 'error' in r)

      if (insertError) {
        logger.error(
          { uid, packType, quantity },
          'Failed to insert pack(s) into database'
        )
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          error: 'Failed to add pack(s) to inventory',
        })
        return
      }

      logger.info(
        { uid, packType, quantity, source: 'Pack Shop' },
        'Pack(s) successfully purchased and added to inventory'
      )

      res.status(StatusCodes.OK).json({ purchaseSuccessful: true, quantity })
      return
    } catch (error) {
      res
        .status(500)
        .end(
          error instanceof Error ? error.message : 'Server connection failed'
        )
      return
    }
  }

  res.setHeader('Allowed', allowedMethods)
  res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
}

export default rateLimit(handler)
