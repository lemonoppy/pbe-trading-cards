import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse, Rarities, SubType } from '..'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { GET } from '@constants/http-methods'
import { cardsQuery } from '@pages/api/database/database'
import SQL from 'sql-template-strings'
import { StatusCodes } from 'http-status-codes'
import methodNotAllowed from '../lib/methodNotAllowed'
import { parseQueryArray } from '@utils/parse-query-array'

const allowedMethods: string[] = [GET]
const cors = Cors({
  methods: allowedMethods,
})

export default async function getSubRarityMap(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<SubType[]>>
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const leagues = parseQueryArray(req.query.leagueid)

    if (!leagues) {
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ status: 'error', message: 'Missing leagueID' })
      return
    }

    const rarities = parseQueryArray(req.query.rarities)

    const query = SQL`
    SELECT DISTINCT sub_type
    FROM pbe_cards
    WHERE leagueid IN (`
    leagues.forEach((league, index) => {
      if (index === 0) {
        query.append(SQL`${parseInt(league)}`)
      } else {
        query.append(SQL`, ${parseInt(league)}`)
      }
    })
    query.append(SQL`)`)

    // Only filter by rarity if rarities are selected
    if (rarities && rarities.length > 0) {
      query.append(SQL` AND card_rarity IN (`)
      rarities.forEach((rarity, index) => {
        if (index === 0) {
          query.append(SQL`${rarity}`)
        } else {
          query.append(SQL`, ${rarity}`)
        }
      })
      query.append(SQL`)`)
    }

    query.append(SQL`
        AND sub_type IS NOT NULL
        AND sub_type != ''
        ORDER BY sub_type
    `)
    const queryResult = await cardsQuery<SubType>(query)

    if ('error' in queryResult) {
      console.error(queryResult.error)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Database connection failed')
      return
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: queryResult,
    })
    return
  }

  methodNotAllowed(req, res, allowedMethods)
}
