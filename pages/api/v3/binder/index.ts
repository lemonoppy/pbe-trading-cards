import { NextApiRequest, NextApiResponse } from 'next'
import { cardsQuery, portalApi } from '@pages/api/database/database'
import { GET } from '@constants/http-methods'
import { StatusCodes } from 'http-status-codes'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import SQL from 'sql-template-strings'
import { ApiResponse, binders } from '..'
import { rateLimit } from 'lib/rateLimit'

const allowedMethods = [GET]
const cors = Cors({
  methods: allowedMethods,
})

interface BinderQueryResult {
  binderid: number
  uid: number
  binder_name: string
  binder_desc: string | null
}

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<binders[]>>
): Promise<void> => {
  await middleware(req, res, cors)
  const bid = req.query.bid as string
  const userID = req.query.userid as string

  if (req.method === GET) {
    if (req.method !== 'GET') {
      res.status(405).end(`Method ${req.method} Not Allowed`)
      return
    }
    const binderQuery = SQL`
      SELECT
    b.binderid,
    b.uid,
    b.binder_name,
    b.binder_desc
FROM
    pbe_binders b
WHERE 1=1`
    if (bid) {
      binderQuery.append(SQL` AND b.binderid=${bid}`)
    }
    if (userID) {
      binderQuery.append(SQL` AND b.uid=${userID}`)
    }

    const binderResult = await cardsQuery<BinderQueryResult>(binderQuery)

    if ('error' in binderResult) {
      console.error(binderResult.error)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Database connection failed')
      return
    }
    if (binderResult.length === 0) {
      res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'No binder found',
      })
      return
    }

    // Fetch usernames from Portal API
    const allUsers = await portalApi.getAllUsers()
    const result: binders[] = binderResult.map((binder) => ({
      binderid: binder.binderid,
      userid: binder.uid,
      binder_name: binder.binder_name,
      binder_desc: binder.binder_desc,
      username: allUsers.get(binder.uid)?.username || 'Unknown',
    }))

    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: result,
    })
    return
  }

  res.setHeader('Allowed', allowedMethods)
  res.status(StatusCodes.METHOD_NOT_ALLOWED).end()
}

export default rateLimit(handler)
