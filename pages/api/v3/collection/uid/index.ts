import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse, ListResponse, ListTotal, SortDirection } from '../..'
import middleware from '@pages/api/database/middleware'
import { GET } from '@constants/http-methods'
import Cors from 'cors'
import SQL, { SQLStatement } from 'sql-template-strings'
import { cardsQuery } from '@pages/api/database/database'
import { StatusCodes } from 'http-status-codes'
import methodNotAllowed from '../../lib/methodNotAllowed'
import { rateLimit } from 'lib/rateLimit'
import { parseQueryArray } from '@utils/parse-query-array'

export type OwnedCard = {
  quantity: number
  cardid: number
  teamid: number
  teamName: string
  teamNickName: string
  player_name: string
  position: string
  season: number
  card_rarity: string
  sub_type: string
  image_url: string
  render_name: string
  playerid: number
  leagueid: number
}

export type OwnedCardSortValue = keyof OwnedCard
export type OwnedCardSortOption = {
  value: keyof OwnedCard
  label: string
  sortLabel: (direction: SortDirection) => string
}

const allowedMethods: string[] = [GET] as const
const cors = Cors({
  methods: allowedMethods,
})

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<ListResponse<OwnedCard>>>
) => {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const uid = req.query.uid as string
    const playerName = req.query.playerName as string
    const limit = (req.query.limit ?? 10) as string
    const offset = (req.query.offset ?? 0) as string
    const sortColumn = (req.query.sortColumn ??
      'player_name') as keyof Readonly<OwnedCard>
    const sortDirection = (req.query.sortDirection ?? 'DESC') as SortDirection
    const showNotOwnedCards = (req.query.showNotOwnedCards ?? 'false') as
      | 'true'
      | 'false'
    const otherUID = req.query.otherUID as string

    const leagues = parseQueryArray(req.query.leagueid)
    const teams = parseQueryArray(req.query.teams)
    const rarities = parseQueryArray(req.query.rarities)
    const subType = parseQueryArray(req.query.subType)

    if (!uid) {
      res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Please provide a uid in your request',
      })
      return
    }

    const countQuery: SQLStatement =
      showNotOwnedCards === 'true'
        ? SQL`
        WITH usercollection AS (
          SELECT * FROM pbe_owned_cards WHERE userid=${parseInt(uid)}
        )
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN ownedCard.quantity > 0 THEN 1 ELSE 0 END), 0) AS "totalOwned"
        FROM pbe_cards card
        LEFT JOIN usercollection ownedCard
          ON card.cardid=ownedCard.cardid
        WHERE approved=true
      `
        : SQL`
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN ownedCard.quantity > 0 THEN 1 ELSE 0 END), 0) AS "totalOwned"
        FROM pbe_cards card
        LEFT JOIN pbe_owned_cards ownedCard
          ON card.cardid=ownedCard.cardid
        WHERE ownedCard.userid=${parseInt(uid)}
      `

    const query: SQLStatement =
      showNotOwnedCards === 'true'
        ? SQL`
        WITH usercollection AS (
          select * from pbe_owned_cards where userid=${parseInt(uid)}
        )

        SELECT
          COALESCE(ownedCard.quantity, 0) as quantity,
          card.cardid,
          (SELECT name FROM pbe_team_data WHERE teamid = card.teamid AND leagueid = card.leagueid ORDER BY season DESC LIMIT 1) as teamName,
          (SELECT nickname FROM pbe_team_data WHERE teamid = card.teamid AND leagueid = card.leagueid ORDER BY season DESC LIMIT 1) as teamNickName,
          card.teamid,
          card.player_name,
          card.position,
          card.card_rarity,
          card.sub_type,
          card.season,
          card.image_url,
          card.render_name,
          card.playerid,
          card.leagueid
        FROM pbe_cards card
        LEFT JOIN usercollection ownedCard
          ON card.cardid=ownedCard.cardid
        WHERE approved=true
      `
        : SQL`
        SELECT
          ownedCard.quantity,
          ownedCard.cardid,
          (SELECT name FROM pbe_team_data WHERE teamid = card.teamid AND leagueid = card.leagueid ORDER BY season DESC LIMIT 1) as teamName,
          (SELECT nickname FROM pbe_team_data WHERE teamid = card.teamid AND leagueid = card.leagueid ORDER BY season DESC LIMIT 1) as teamNickName,
          card.teamid,
          card.player_name,
          card.position,
          card.card_rarity,
          card.sub_type,
          card.season,
          card.image_url,
          card.render_name,
          card.playerid,
          card.leagueid
        FROM pbe_cards card
        LEFT JOIN pbe_owned_cards ownedCard
          ON card.cardid=ownedCard.cardid
        WHERE ownedCard.userid=${parseInt(uid)}
      `

    if (leagues.length > 0 && leagues.length < 3) {
      if (leagues.length === 1) {
        countQuery.append(SQL` AND card.leagueid = ${parseInt(leagues[0])}`)
        query.append(SQL` AND card.leagueid = ${parseInt(leagues[0])}`)
      } else {
        countQuery.append(SQL` AND card.leagueid IN (`)
        leagues.forEach((league, index) => {
          if (index > 0) countQuery.append(SQL`, `)
          countQuery.append(SQL`${parseInt(league)}`)
        })
        countQuery.append(SQL`)`)

        query.append(SQL` AND card.leagueid IN (`)
        leagues.forEach((league, index) => {
          if (index > 0) query.append(SQL`, `)
          query.append(SQL`${parseInt(league)}`)
        })
        query.append(SQL`)`)
      }
    }
    if (playerName.length !== 0) {
      countQuery.append(SQL` AND LOWER(card.player_name) LIKE ${`%${playerName.toLowerCase()}%`}`)
      query.append(SQL` AND LOWER(card.player_name) LIKE ${`%${playerName.toLowerCase()}%`}`)
    }

    if (teams.length !== 0) {
      countQuery.append(SQL` AND (`)
      teams.forEach((team, index) => {
        const [teamLeagueID, teamID] = team.split('-')
        index === 0
          ? countQuery.append(
              SQL`(card.teamid=${parseInt(teamID)} AND card.leagueid=${parseInt(
                teamLeagueID
              )})`
            )
          : countQuery.append(
              SQL` OR (card.teamid=${parseInt(
                teamID
              )} AND card.leagueid=${parseInt(teamLeagueID)})`
            )
      })
      countQuery.append(SQL`)`)

      query.append(SQL` AND (`)
      teams.forEach((team, index) => {
        const [teamLeagueID, teamID] = team.split('-')
        index === 0
          ? query.append(
              SQL`(card.teamid=${parseInt(teamID)} AND card.leagueid=${parseInt(
                teamLeagueID
              )})`
            )
          : query.append(
              SQL` OR (card.teamid=${parseInt(
                teamID
              )} AND card.leagueid=${parseInt(teamLeagueID)})`
            )
      })
      query.append(SQL`)`)
    }

    if (otherUID) {
      countQuery.append(
        SQL` AND card.cardid NOT IN (
        SELECT cardid
        FROM pbe_owned_cards
        WHERE userid =${parseInt(otherUID)} )`
      )
      query.append(
        SQL` AND card.cardid NOT IN (
        SELECT cardid
        FROM pbe_owned_cards
        WHERE userid =${parseInt(otherUID)} )`
      )
    }
    if (rarities.length !== 0) {
      countQuery.append(SQL` AND (`)
      rarities.forEach((rarity, index) =>
        index === 0
          ? countQuery.append(SQL`card.card_rarity=${rarity}`)
          : countQuery.append(SQL` OR card.card_rarity=${rarity}`)
      )
      countQuery.append(SQL`)`)

      query.append(SQL` AND (`)
      rarities.forEach((rarity, index) =>
        index === 0
          ? query.append(SQL`card.card_rarity=${rarity}`)
          : query.append(SQL` OR card.card_rarity=${rarity}`)
      )
      query.append(SQL`)`)
    }
    if (subType.length !== 0) {
      countQuery.append(SQL` AND (`)
      subType.forEach((sub_type, index) =>
        index === 0
          ? countQuery.append(SQL`card.sub_type=${sub_type}`)
          : countQuery.append(SQL` OR card.sub_type=${sub_type}`)
      )
      countQuery.append(SQL`)`)
      query.append(SQL` AND (`)
      subType.forEach((sub_type, index) =>
        index === 0
          ? query.append(SQL`card.sub_type=${sub_type}`)
          : query.append(SQL` OR card.sub_type=${sub_type}`)
      )
      query.append(SQL`)`)
    }

    query.append(SQL` ORDER BY`)

    if (sortColumn === 'quantity') {
      query.append(SQL` ownedCard.quantity`)
      sortDirection === 'ASC'
        ? query.append(SQL` ASC`)
        : query.append(SQL` DESC`)
      query.append(SQL`, card.cardid DESC`)
    }

    if (sortColumn === 'player_name') {
      query.append(SQL` card.player_name`)
      sortDirection === 'DESC'
        ? query.append(SQL` ASC`)
        : query.append(SQL` DESC`)
      query.append(SQL`, card.cardid DESC`)
    }

    if (sortColumn === 'teamid') {
      if (leagues.length === 0 || leagues[0] === '2') {
        query.append(SQL` team.nickname`)
      } else {
        query.append(SQL` team.name`)
      }
      sortDirection === 'DESC'
        ? query.append(SQL` ASC`)
        : query.append(SQL` DESC`)
      query.append(SQL`, card.cardid DESC`)
    }
    if (sortColumn === 'season') {
      query.append(SQL` card.season`)
      sortDirection === 'DESC'
        ? query.append(SQL` ASC`)
        : query.append(SQL` DESC`)
      query.append(SQL`, card.cardid DESC`)
    }

    if (sortColumn === 'card_rarity') {
      query.append(SQL` CASE card.card_rarity
        WHEN 'Common' THEN 1
        WHEN 'Uncommon' THEN 2
        WHEN 'Rare' THEN 3
        WHEN 'Mythic' THEN 4
        ELSE 5
      END`)
      sortDirection === 'DESC'
        ? query.append(SQL` ASC`)
        : query.append(SQL` DESC`)
      query.append(SQL`, card.cardid DESC`)
    }

    if (limit) {
      query.append(SQL` LIMIT ${parseInt(limit)}`)
    }

    if (offset) {
      query.append(SQL` OFFSET ${parseInt(offset)}`)
    }
    const countResult = await cardsQuery<ListTotal>(countQuery)
    if ('error' in countResult) {
      console.error(countResult.error)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Server connection failed')
      return
    }

    const queryResult = await cardsQuery<OwnedCard>(query)

    if ('error' in queryResult) {
      console.error(queryResult.error)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Server connection failed')
      return
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: {
        rows: queryResult,
        total: countResult[0].total,
        totalOwned: countResult[0].totalOwned ?? 0,
      },
    })
    return
  }

  methodNotAllowed(req, res, allowedMethods)
}
export default rateLimit(handler)
