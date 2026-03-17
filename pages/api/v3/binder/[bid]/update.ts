import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse, ListResponse } from '../../'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { PUT } from '@constants/http-methods'
import { cardsQuery } from '@pages/api/database/database'
import SQL from 'sql-template-strings'
import { StatusCodes } from 'http-status-codes'
import methodNotAllowed from '../../lib/methodNotAllowed'
import { checkUserAuthorization } from '../../lib/checkUserAuthorization'

const allowedMethods: string[] = [PUT] as const
const cors = Cors({
  methods: allowedMethods,
})

export default async function updateBinder(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ListResponse<null>>>
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method !== PUT) {
    methodNotAllowed(req, res, allowedMethods)
    return
  }

  // Check if user is authenticated
  if (!(await checkUserAuthorization(req))) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      status: 'error',
      message: 'Not authorized',
      payload: null,
    })
    return
  }

  const bid = req.query.bid as string
  const { cards, name, desc, removedPositions } = req.body

  if (!bid) {
    res.status(StatusCodes.BAD_REQUEST).json({
      status: 'error',
      message: 'Missing binder ID',
      payload: null,
    })
    return
  }

  try {
    // Check if the binder belongs to the authenticated user
    const binderCheck = await cardsQuery<{ uid: number }>(
      SQL`SELECT uid FROM pbe_binders WHERE binderid=${bid}`
    )

    if ('error' in binderCheck || binderCheck.length === 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'Binder not found',
        payload: null,
      })
      return
    }

    const binderOwner = binderCheck[0].uid
    const currentUserId = parseInt(req.cookies.userid)

    if (binderOwner !== currentUserId) {
      res.status(StatusCodes.FORBIDDEN).json({
        status: 'error',
        message: 'You do not have permission to update this binder',
        payload: null,
      })
      return
    }

    // Now proceed with the update
    if (bid && name && desc) {
      const sqlQuery = SQL`
        UPDATE pbe_binders 
        SET binder_name = ${name}, binder_desc = ${desc} 
        WHERE binderID = ${bid}
      `
      await cardsQuery(sqlQuery)

      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: null,
      })
      return
    }

    if (cards) {
      if (!Array.isArray(cards)) {
        res.status(StatusCodes.BAD_REQUEST).json({
          status: 'error',
          message: 'Cards must be an array',
          payload: null,
        })
        return
      }
      if (removedPositions && removedPositions.length > 0) {
        const deleteQuery = SQL`
          DELETE FROM pbe_binder_cards
          WHERE binderID = ${bid}
          AND position IN (`
        removedPositions.forEach((pos, index) => {
          if (index === 0) {
            deleteQuery.append(SQL`${pos}`)
          } else {
            deleteQuery.append(SQL`, ${pos}`)
          }
        })
        deleteQuery.append(SQL`)`)
        await cardsQuery(deleteQuery)
      }
      if (cards.length > 0) {
        // Use PostgreSQL syntax with ON CONFLICT instead of MySQL's ON DUPLICATE KEY
        for (const card of cards) {
          const sqlQuery = SQL`
            INSERT INTO pbe_binder_cards (binderID, ownedCardID, position)
            VALUES (${card.binderID}, ${card.ownedCardID}, ${card.position})
            ON CONFLICT (binderID, position)
            DO UPDATE SET ownedCardID = EXCLUDED.ownedCardID;`
          await cardsQuery(sqlQuery)
        }
      }

      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: null,
      })
      return
    }

    res.status(StatusCodes.BAD_REQUEST).json({
      status: 'error',
      message: 'No valid update parameters provided, womp womp',
      payload: null,
    })
    return
  } catch (error) {
    console.error('Error updating binder:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to update binder or binder name/desc',
      payload: null,
    })
    return
  }
}
