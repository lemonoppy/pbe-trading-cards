import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse } from '../..'
import middleware from '@pages/api/database/middleware'
import { POST } from '@constants/http-methods'
import Cors from 'cors'
import methodNotAllowed from '../../lib/methodNotAllowed'
import { StatusCodes } from 'http-status-codes'
import { cardsQuery } from '@pages/api/database/database'
import SQL from 'sql-template-strings'
import { portalApi } from 'services/portalApiService'
import logger from 'lib/logger'

const allowedMethods: string[] = [POST] as const
const cors = Cors({
  methods: allowedMethods,
})

// Payment amount for all cards (in bank dollars)
const CARD_PAYMENT_AMOUNT = 1000000 // $1 million

export default async function approveImageEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<null | string>>
): Promise<void> {
  await middleware(req, res, cors)
  if (req.method === POST) {
    const cardID = req.query.cardID as string

    if (!cardID) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Please provide a cardID in your request',
      })
      return
    }

    // Get card details including author, rarity, and sub_type
    const cardResult = await cardsQuery<{
      cardid: number
      author_userid: number
      card_rarity: string
      player_name: string
      sub_type: string | null
    }>(SQL`
      SELECT cardid, author_userid, card_rarity, player_name, sub_type
      FROM pbe_cards
      WHERE cardid=${cardID}
    `)

    if ('error' in cardResult) {
      logger.error({ err: cardResult.error }, 'Database query failed')
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ status: 'error', message: 'Server connection failed' })
      return
    }

    if (cardResult.length === 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'Card not found',
      })
      return
    }

    if (cardResult.length > 1) {
      logger.error({ cardID }, 'Multiple cards with same id')
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: 'Multiple cards with same id',
      })
      return
    }

    const card = cardResult[0]

    // Send bank transaction to Portal API if card has an author
    // BUT NOT for Base cards which should not be paid
    const shouldPayAuthor = card.author_userid && card.sub_type !== 'Base'

    if (shouldPayAuthor) {
      try {
        await portalApi.createBankTransaction({
          uid: card.author_userid,
          type: 'job pay',
          groupName: 'Dotts Card Payment',
          description: `Payment for card: ${card.player_name} (Card #${card.cardid})`,
          amount: CARD_PAYMENT_AMOUNT,
          status: 'completed', // Mark as completed immediately
        })
        logger.info(
          { cardID, authorID: card.author_userid, amount: CARD_PAYMENT_AMOUNT },
          'Bank transaction sent for card approval'
        )
      } catch (error) {
        logger.error(
          { err: error, cardID, authorID: card.author_userid },
          'Failed to send bank transaction'
        )
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
          status: 'error',
          message: 'Failed to process payment to author',
        })
        return
      }
    } else if (card.author_userid && card.sub_type === 'Base') {
      logger.info(
        { cardID, authorID: card.author_userid, subType: card.sub_type },
        'Skipping payment for Base cards'
      )
    }

    // Update card as approved, pullable, and author_paid
    const updateResult = await cardsQuery(SQL`
      UPDATE pbe_cards
      SET approved=true, pullable=true, author_paid=true, date_approved=NOW()
      WHERE cardid=${cardID};
    `)

    if ('error' in updateResult) {
      logger.error({ err: updateResult.error }, 'Failed to update card')
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ status: 'error', message: 'Server connection failed' })
      return
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: null,
    })
    return
  }

  methodNotAllowed(req, res, allowedMethods)
}
