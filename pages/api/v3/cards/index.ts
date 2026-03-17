import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse, ListResponse, ListTotal, SortDirection } from '..'
import middleware from '@pages/api/database/middleware'
import Cors from 'cors'
import { GET } from '@constants/http-methods'
import { cardsQuery } from '@pages/api/database/database'
import SQL, { SQLStatement } from 'sql-template-strings'
import { StatusCodes } from 'http-status-codes'
import methodNotAllowed from '../lib/methodNotAllowed'
import { parseQueryArray } from '@utils/parse-query-array'
import { portalApi } from 'services/portalApiService'
import logger from 'lib/logger'

const allowedMethods: string[] = [GET] as const
const cors = Cors({
  methods: allowedMethods,
})

// Username cache with TTL
const usernameCache = new Map<number, { username: string; timestamp: number }>()
const USERNAME_CACHE_TTL = 12 * 60 * 60 * 1000 // 12 hours in milliseconds

async function getCachedUsername(uid: number): Promise<string | null> {
  const cached = usernameCache.get(uid)
  const now = Date.now()

  // Return cached value if it exists and hasn't expired
  if (cached && now - cached.timestamp < USERNAME_CACHE_TTL) {
    return cached.username
  }

  // Fetch from Portal API
  try {
    const userInfo = await portalApi.getUserInfo(uid)
    if (userInfo && userInfo.username) {
      usernameCache.set(uid, { username: userInfo.username, timestamp: now })
      return userInfo.username
    }
  } catch (error) {
    logger.error({ err: error, uid }, 'Error fetching username')
  }

  // Fallback
  const fallback = `User ${uid}`
  usernameCache.set(uid, { username: fallback, timestamp: now })
  return fallback
}

export default async function cardsEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ListResponse<Card>>>
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const playerName = (req.query.playerName ?? '') as string
    const userID = req.query.userID as string
    const limit = (req.query.limit ?? 10) as string
    const offset = (req.query.offset ?? 0) as string
    const sortColumn = (req.query.sortColumn ??
      'cardID') as keyof Readonly<Card>
    const sortDirection = (req.query.sortDirection ?? 'ASC') as SortDirection
    const viewSkaters = (req.query.viewSkaters ?? 'false') as 'true' | 'false'
    const viewMyCards = (req.query.viewMyCards ?? 'false') as 'true' | 'false'
    const viewNeedsAuthor = (req.query.viewNeedsAuthor ?? 'false') as
      | 'true'
      | 'false'
    const viewNeedsImage = (req.query.viewNeedsImage ?? 'false') as
      | 'true'
      | 'false'
    const viewNeedsApproval = (req.query.viewNeedsApproval ?? 'false') as
      | 'true'
      | 'false'
    const viewNeedsAuthorPaid = (req.query.viewNeedsAuthorPaid ?? 'false') as
      | 'true'
      | 'false'
    const viewDone = (req.query.viewDone ?? 'false') as 'true' | 'false'

    const leagues = parseQueryArray(req.query.leagueid)
    const teams = parseQueryArray(req.query.teams)
    const rarities = parseQueryArray(req.query.rarities)
    const subTypes = parseQueryArray(req.query.subTypes)

    const hasSortStatus: boolean = [
      viewNeedsAuthor,
      viewNeedsImage,
      viewNeedsApproval,
      viewNeedsAuthorPaid,
      viewDone,
    ].some((viewStatus) => viewStatus === 'true')

    const cardID = req.query.cardid as string
    const date_approved = req.query.date_approved as string

    const query: SQLStatement = SQL`
      SELECT cardid,
        teamid,
        playerid,
        author_userid,
        card_rarity,
        sub_type,
        player_name,
        render_name,
        pullable,
        event_pullable,
        approved,
        image_url,
        position,
        season,
        author_paid,
        date_approved,
        leagueid,
        COUNT(*) OVER() AS total
      FROM pbe_cards
    `

    // Always start with WHERE clause for subsequent AND filters
    if (date_approved === 'true') {
      query.append(SQL` WHERE date_approved IS NOT NULL`)
    } else {
      query.append(SQL` WHERE 1=1`)
    }

    if (viewMyCards === 'true') {
      query.append(SQL` AND (author_userid = ${userID})`)
    }

    if (cardID) {
      query.append(SQL` AND cardid = ${cardID}`)
    }

    if (leagues.length === 1) {
      query.append(SQL` AND leagueid = ${parseInt(leagues[0])}`)
    }

    const statusesToAppend: SQLStatement[] = []

    if (hasSortStatus) {
      if (viewNeedsAuthor === 'true') {
        statusesToAppend.push(SQL` (author_userid IS NULL)`)
      }

      if (viewNeedsImage === 'true') {
        statusesToAppend.push(
          SQL` (author_userid IS NOT NULL AND image_url IS NULL)`
        )
      }

      if (viewNeedsApproval === 'true') {
        statusesToAppend.push(
          SQL` (author_userid IS NOT NULL AND image_url IS NOT NULL AND approved = false)`
        )
      }

      if (viewNeedsAuthorPaid === 'true') {
        statusesToAppend.push(
          SQL` (author_userid IS NOT NULL AND image_url IS NOT NULL AND approved = true AND author_paid = false)`
        )
      }

      if (viewDone === 'true') {
        statusesToAppend.push(
          SQL` (author_userid IS NOT NULL AND image_url IS NOT NULL AND approved = true AND author_paid = true)`
        )
      }
    }

    if (hasSortStatus) {
      query.append(SQL` AND (`)

      statusesToAppend.forEach((statusToAppend, index) => {
        if (index === 0) {
          query.append(statusToAppend)
        } else {
          query.append(SQL` OR `)
          query.append(statusToAppend)
        }
      })
      query.append(SQL`)`)
    }

    if (playerName.length !== 0) {
      query.append(SQL` AND player_name ILIKE ${`%${playerName}%`}`)
    }

    if (teams.length !== 0) {
      query.append(SQL` AND (`)
      teams.forEach((team, index) => {
        const [teamLeagueID, teamID] = team.split('-')
        if (index === 0) {
          query.append(
            SQL`(teamid=${parseInt(teamID)} AND leagueid=${parseInt(
              teamLeagueID
            )})`
          )
        } else {
          query.append(
            SQL` OR (teamid=${parseInt(teamID)} AND leagueid=${parseInt(
              teamLeagueID
            )})`
          )
        }
      })
      query.append(SQL`)`)
    }

    if (rarities.length !== 0) {
      query.append(SQL` AND (`)
      rarities.forEach((rarity, index) =>
        index === 0
          ? query.append(SQL`card_rarity=${rarity}`)
          : query.append(SQL` OR card_rarity=${rarity}`)
      )
      query.append(SQL`)`)
    }

    if (subTypes.length !== 0) {
      query.append(SQL` AND (`)
      subTypes.forEach((subType, index) =>
        index === 0
          ? query.append(SQL`sub_type=${subType}`)
          : query.append(SQL` OR sub_type=${subType}`)
      )
      query.append(SQL`)`)
    }

    query.append(SQL` ORDER BY`)
    if (sortColumn === 'player_name') {
      query.append(SQL` player_name`)
    } else if (sortColumn === 'cardid') {
      query.append(SQL` cardid`)
    } else if (sortColumn === 'playerid') {
      query.append(SQL` playerid`)
    } else if (sortColumn === 'teamid') {
      query.append(SQL` teamid`)
    } else if (sortColumn === 'author_userid') {
      query.append(SQL` author_userid`)
    } else if (sortColumn === 'pullable') {
      query.append(SQL` pullable`)
    } else if (sortColumn === 'approved') {
      query.append(SQL` approved`)
    } else if (sortColumn === 'author_paid') {
      query.append(SQL` author_paid`)
    } else if (sortColumn === 'season') {
      query.append(SQL` season`)
    } else if (sortColumn === 'card_rarity') {
      query.append(SQL` card_rarity`)
    } else if (sortColumn === 'date_approved') {
      query.append(SQL` date_approved`)
    } else if (sortColumn === 'render_name') {
      query.append(SQL` render_name`)
    } else {
      // Default to cardid if no valid sort column specified
      query.append(SQL` cardid`)
    }
    sortDirection === 'ASC' ? query.append(SQL` ASC`) : query.append(SQL` DESC`)

    if (limit) {
      query.append(SQL` LIMIT ${parseInt(limit)}`)
    }

    if (offset) {
      query.append(SQL` OFFSET ${parseInt(offset)}`)
    }

    const queryResult = await cardsQuery<Card>(query)

    if ('error' in queryResult) {
      logger.error({ error: queryResult.error }, 'Database query failed')
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Server connection failed')
      return
    }

    // Log first card to see what data we're getting
    if (queryResult.length > 0) {
      logger.info({ firstCard: queryResult[0] }, 'Sample card data from database')
    }

    // Fetch usernames from Portal API (with caching) for all cards with authors
    const userIds = new Set<number>()
    queryResult.forEach((card: any) => {
      // PostgreSQL returns lowercase field names
      const authorId = card.author_userid
      logger.info({ cardID: card.cardid, author_userid: card.author_userid, authorId, hasAuthor: !!authorId }, 'Checking card for author')
      if (authorId) {
        userIds.add(authorId)
      }
    })

    logger.info({ userIdsCount: userIds.size, userIds: Array.from(userIds) }, 'Fetching usernames for cards')

    const userMap = new Map<number, string>()
    await Promise.all(
      Array.from(userIds).map(async (uid) => {
        const username = await getCachedUsername(uid)
        logger.info({ uid, username }, 'Got username for user')
        if (username) {
          userMap.set(uid, username)
        }
      })
    )

    // Add usernames to card objects
    const cardsWithUsernames = queryResult.map((card: any) => {
      const authorId = card.author_userID || card.author_userid
      return {
        ...card,
        author_userid: authorId, // Ensure lowercase for consistency
        author_username: authorId ? userMap.get(authorId) || null : null,
      }
    })

    const total = queryResult.length > 0 ? queryResult[0].total : 0

    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: { rows: cardsWithUsernames, total: total },
    })
    return
  }

  methodNotAllowed(req, res, allowedMethods)
}
