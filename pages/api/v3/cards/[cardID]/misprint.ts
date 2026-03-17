import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse } from '../..'
import middleware from '@pages/api/database/middleware'
import { POST } from '@constants/http-methods'
import methodNotAllowed from '../../lib/methodNotAllowed'
import Cors from 'cors'
import { StatusCodes } from 'http-status-codes'
import { checkUserAuthorization } from '../../lib/checkUserAuthorization'
import { cardsQuery } from '@pages/api/database/database'
import SQL from 'sql-template-strings'
import { rarityMap } from '@constants/rarity-map'

const allowedMethods = [POST]
const cors = Cors({
  methods: allowedMethods,
})

export default async function misprintEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<null>>
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

    if (!(await checkUserAuthorization(req))) {
      res.status(StatusCodes.UNAUTHORIZED).end('Not authorized')
      return
    }

    const cardResult = await cardsQuery<Card>(
      SQL`SELECT * FROM pbe_cards WHERE cardid=${cardID};`
    )

    if ('error' in cardResult) {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Server connection failed on select')
      return
    }

    const card: Card = cardResult[0]
    console.log('card', card)

    const insertResult = await cardsQuery(SQL`
        INSERT INTO pbe_cards
          (player_name, teamid, playerid, card_rarity, sub_type, pullable, approved, position, season, author_paid, leagueid, render_name)
        VALUES
          (${card.player_name}, ${card.teamid}, ${card.playerid}, ${card.card_rarity}, ${card.sub_type}, false, false, ${card.position}, ${card.season}, false, ${card.leagueid}, ${card.render_name});
    `)
    console.log('insertResult', insertResult)

    if ('error' in insertResult) {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Server connection failed on insert')
      return
    }

    const updateResult = await cardsQuery(SQL`
      UPDATE pbe_cards
      SET card_rarity='Misprint', pullable = false
      WHERE cardid=${card.cardid};
    `)

    if ('error' in updateResult) {
      console.log('updateResult', updateResult)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Server connection failed on update')
      return
    }

    res.status(StatusCodes.OK).json({ status: 'success', payload: null })
    return
  }

  methodNotAllowed(req, res, allowedMethods)
}
