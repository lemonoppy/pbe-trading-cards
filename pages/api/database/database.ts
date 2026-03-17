import { Pool } from 'pg'
import { SQLStatement } from 'sql-template-strings'
// Portal API Service - Use this for all user, team, player, bank data
import portalApiService from '../../../services/portalApiService'

type SelectQueryResult<T> = T[] | { error: unknown }

// PostgreSQL initialization for cards database
const initializePostgresPool = (): Pool => {
  return new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE || 'neondb',
    ssl: {
      rejectUnauthorized: false,
    },
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  })
}

console.log('process.env.NODE_ENV', process.env.NODE_ENV)

// Dotts Cards Database - PostgreSQL for card data
const cardsPool: Pool = initializePostgresPool()

// PostgreSQL query function (for cards database)
const getPostgresQueryFn =
  (pool: Pool) =>
  async <T extends unknown>(
    query: SQLStatement
  ): Promise<SelectQueryResult<T>> => {
    const client = await pool.connect()
    try {
      // Convert sql-template-strings format (? placeholders) to pg format ($1, $2, etc.)
      let paramIndex = 0
      const text = query.sql.replace(/\?/g, () => {
        paramIndex++
        return `$${paramIndex}`
      })

      const result = await client.query({
        text,
        values: query.values,
      })
      return result.rows as T[]
    } catch (error) {
      console.error('PostgreSQL query error:', error)
      return { error }
    } finally {
      client.release()
    }
  }

// Export only cards query - all other data comes from Portal API
export const cardsQuery = getPostgresQueryFn(cardsPool)

// Export the pool for migration scripts (direct database access)
export const pool = cardsPool

// Export Portal API Service for use in API routes
// Example usage:
//   import { portalApi } from './database'
//   const teams = await portalApi.getTeams(0) // Get PBE teams
//   const player = await portalApi.getPlayer(123)
//   const bankBalance = await portalApi.getBankBalance(userId)
export { portalApiService as portalApi }
