import { NextApiRequest, NextApiResponse } from 'next'
import { ApiResponse, Team } from '.'
import middleware from '@pages/api/database/middleware'
import { GET } from '@constants/http-methods'
import Cors from 'cors'
import methodNotAllowed from './lib/methodNotAllowed'
import { StatusCodes } from 'http-status-codes'
import { cardsQuery } from '@pages/api/database/database'
import SQL, { SQLStatement } from 'sql-template-strings'

const allowedMethods: string[] = [GET] as const
const cors = Cors({
  methods: allowedMethods,
})

type DbTeam = {
  id: number
  league: number
  name: string
  abbreviation: string
  location: string
  colors: { primary: string; secondary: string; text: string }
}

// In-memory cache for team data
// Cache duration: 8 weeks (in milliseconds)
const CACHE_DURATION = 8 * 7 * 24 * 60 * 60 * 1000
let teamCache: { data: Team[]; timestamp: number } | null = null

function getCachedTeams(): Team[] | null {
  if (!teamCache) return null

  const now = Date.now()
  if (now - teamCache.timestamp > CACHE_DURATION) {
    teamCache = null
    return null
  }

  return teamCache.data
}

function setCachedTeams(teams: Team[]): void {
  teamCache = {
    data: teams,
    timestamp: Date.now(),
  }
}

export default async function teamsEndpoint(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<Team[]>>
): Promise<void> {
  await middleware(req, res, cors)

  if (req.method === GET) {
    const league = req.query.league as string

    // Set cache headers (cache for 8 weeks)
    // s-maxage: CDN cache duration
    // max-age: Browser cache duration
    // stale-while-revalidate: Serve stale content while fetching fresh data
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=4838400, max-age=4838400, stale-while-revalidate=86400'
    )

    // Try to get from in-memory cache first
    const cachedTeams = getCachedTeams()
    if (cachedTeams) {
      // Filter cached teams by league if needed
      const teams = league
        ? cachedTeams.filter((team) => {
            const leagueIDs = league
              .split(',')
              .map((id) => parseInt(id.trim()))
            return leagueIDs.includes(team.league)
          })
        : cachedTeams

      res.status(StatusCodes.OK).json({
        status: 'success',
        payload: teams,
      })
      return
    }

    // Cache miss - fetch from database
    const query: SQLStatement = SQL`
      SELECT DISTINCT teamid as id, leagueid as league, name, abbreviation, location, colors
      FROM pbe_team_data
      ORDER BY leagueid, teamid
    `

    const queryResult = await cardsQuery<DbTeam>(query)

    if ('error' in queryResult) {
      console.error(queryResult.error)
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .end('Database connection failed')
      return
    }

    // Map database results to API Team format
    const allTeams: Team[] = queryResult.map((team) => ({
      id: team.id,
      league: team.league,
      name: team.name,
      abbreviation: team.abbreviation,
      location: team.location,
      colors: team.colors,
    }))

    // Cache all teams
    setCachedTeams(allTeams)

    // Filter by league if needed
    const teams = league
      ? allTeams.filter((team) => {
          const leagueIDs = league.split(',').map((id) => parseInt(id.trim()))
          return leagueIDs.includes(team.league)
        })
      : allTeams

    res.status(StatusCodes.OK).json({
      status: 'success',
      payload: teams,
    })
    return
  }

  methodNotAllowed(req, res, allowedMethods)
}
