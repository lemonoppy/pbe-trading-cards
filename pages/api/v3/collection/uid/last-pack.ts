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

// Define a type for the quantity result
type QuantityResult = {
  cardid: number
  quantity: number
}

// Define a type for the possible return value of cardsQuery
type CardsQueryResult = QuantityResult[] | { error: unknown } // Adjust based on your actual error type

const handler = async (request: NextApiRequest, response: NextApiResponse) => {
  await middleware(request, response, cors)
  const { method, query } = request

  if (method === GET) {
    const { uid } = query

    // First query to get the cards from most recently opened pack
    const cardsResult = await cardsQuery<Card>(SQL`
      SELECT collection.userid,
        card.cardid,
        pack.packid,
        card.player_name,
        card.teamid,
        card.playerid,
        card.card_rarity,
        card.sub_type,
        card.image_url,
        card.pullable,
        card.approved,
        card.position,
        card.render_name,
        card.author_userid,
        card.season,
        card.author_paid,
        card.date_approved,
        collection.packid,
        card.leagueid
      FROM
        pbe_cards as card
      INNER JOIN pbe_collection AS collection
        ON card.cardid=collection.cardid
      INNER JOIN pbe_packs_owned AS pack
        ON collection.packid=pack.packid
      WHERE pack.packid=(
        SELECT packid
        FROM pbe_packs_owned
        WHERE userid=${uid} AND opened=true
        ORDER BY opendate DESC
        LIMIT 1
      );
    `)

    // Check if there's an error in the result
    if ('error' in cardsResult) {
      response
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: 'Failed to retrieve cards' })
      return
    }

    // Extract cardIDs from the result
    const cardIDs = cardsResult.map((card) => card.cardid)

    // If there are cardIDs, proceed with the second query
    let quantitiesResult: CardsQueryResult = []
    let totalQuantitiesResult: CardsQueryResult = []
    if (cardIDs.length > 0) {
      quantitiesResult = await cardsQuery<QuantityResult>(
        SQL`
        SELECT cardID, COUNT(*) as quantity
        FROM pbe_collection
        WHERE userID=${uid} AND cardID = ANY(${cardIDs}::int[])
        GROUP BY cardID;
        `
      )
      totalQuantitiesResult = await cardsQuery<QuantityResult>(
        SQL`
        SELECT cardID, COUNT(*) as quantity
        FROM pbe_collection
        WHERE cardID = ANY(${cardIDs}::int[])
        GROUP BY cardID;
        `
      )
      // Check for error in quantitiesResult
      if ('error' in quantitiesResult || 'error' in totalQuantitiesResult) {
        response
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ error: 'Failed to retrieve quantities' })
        return
      }
    }

    // Combine the card data with their quantities
    const combinedResult = cardsResult.map((card) => {
      const quantityEntry = (quantitiesResult as QuantityResult[]).find(
        (q) => q.cardid === card.cardid
      )
      const totalQuantityEntry = (
        totalQuantitiesResult as QuantityResult[]
      ).find((q) => q.cardid === card.cardid)

      return {
        ...card,
        quantity: quantityEntry ? quantityEntry.quantity : 0, // Quantity in recent pack
        totalCardQuantity: totalQuantityEntry ? totalQuantityEntry.quantity : 0, // Total quantity in collection
      }
    })

    response.status(StatusCodes.OK).json(combinedResult)
    return
  }

  response.setHeader('Allowed', allowedMethods)
  response.status(StatusCodes.METHOD_NOT_ALLOWED).end()
}

export default rateLimit(handler)
