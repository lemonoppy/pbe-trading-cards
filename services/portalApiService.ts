import axios, { AxiosInstance } from 'axios'
import { AllTeams, findTeamsByLeague, Team } from 'lib/teams'
import logger from 'lib/logger'

// Type definitions for Portal API responses
// Using Team type from lib/teams.ts for now (Portal doesn't have teams endpoint yet)
export type PortalTeam = Team

export type PortalIndexRecord = {
  leagueID: number
  indexID: number
  startSeason: number
}

export type PortalPlayer = {
  pid: number
  uid: number
  username: string
  name: string
  render: string
  draftSeason: number
  currentLeague: 'PBE' | 'MiLPBE' | null
  pbeTeam: number | null
  milpbeTeam: number | null
  position: string
  archetype: string | null
  totalTPE: number
  appliedTPE: number
  bankedTPE: number
  status: 'active' | 'pending' | 'retired' | 'denied'
  indexRecords?: PortalIndexRecord[]
  // Add other player fields as needed
}

export type PortalUserInfo = {
  uid: number
  username: string
  avatar?: string
  // Add other user fields as needed
}

export type PortalBankBalance = {
  uid: number
  bankBalance: number
}

export type PortalBankTransaction = {
  uid: number
  type: 'other' | 'training' | 'contract' | 'job pay' | 'media' | 'graphics grading' | 'fantasy' | 'casino' | 'change' | 'seasonal equipment' | 'trading cards'
  description: string
  amount: number
  groupName?: string  // Optional - only required for multiple transactions
  submitByID?: number  // Not used by external-create API (set internally)
  status?: string      // Not used by external-create API (determined internally)
}

export type PortalSessionInfo = {
  uid: number
  username: string
  usergroup: number
  additionalgroups?: string
  displaygroup?: number
  valid: boolean
}

export type PortalLoginRequest = {
  username: string
  password: string
}

export type PortalLoginResponse = {
  status: 'success' | 'error'
  payload?: {
    userid: number
    usergroup: number
    accessToken: string
    refreshToken: string
  }
  errorMessage?: string
}

export type PortalTokenRefreshRequest = {
  refreshToken: string
}

export type PortalTokenRefreshResponse = {
  status: 'success' | 'error'
  payload?: {
    userid: number
    usergroup: number
    accessToken: string
    refreshToken: string
  }
  errorMessage?: string
}

// Simple in-memory cache for Portal API responses
type CacheEntry<T> = {
  data: T
  timestamp: number
}

class PortalCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes default TTL

  get<T>(key: string, ttl: number = this.defaultTTL): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const age = Date.now() - entry.timestamp
    if (age > ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    })
  }

  clear(): void {
    this.cache.clear()
  }
}

/**
 * Portal API Client Service
 *
 * Handles all communication with the PBE Portal APIs.
 * This replaces direct database queries to the portalDatabase.
 */
class PortalApiService {
  private client: AxiosInstance
  private baseUrl: string
  private apiKey: string
  private cache: PortalCache

  constructor() {
    this.baseUrl =
      process.env.PORTAL_API_URL || 'https://pbe.simflow.io'  // TODO: confirm API base URL when available
    this.apiKey = process.env.PORTAL_API_KEY || ''
    this.cache = new PortalCache()

    // Don't include API key in default headers
    // Only specific endpoints (like bank transaction creation) need it
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    })

    // Add request interceptor for logging (optional)
    this.client.interceptors.request.use(
      (config) => {
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error({ err: error, status: error.response?.status }, 'Portal API Error')
        return Promise.reject(error)
      }
    )
  }

  /**
   * Get all teams for a specific league
   * @param leagueId - 0=PBE, 1=MiLPBE (optional, returns all if not specified)
   * @param season - Season number (optional, currently unused)
   *
   * NOTE: Portal doesn't have a teams endpoint yet, so we use local team data
   * Teams are defined in lib/teams.ts (synced from Portal's team definitions)
   * Once Portal implements /api/isfl/v1/teams, update this to use the API
   */
  async getTeams(leagueId?: number, season?: number): Promise<PortalTeam[]> {
    // Use local team data since Portal doesn't have teams endpoint yet
    if (leagueId !== undefined) {
      const teams = findTeamsByLeague(leagueId)
      return teams.filter((t) => t !== undefined) as PortalTeam[]
    }

    return Object.values(AllTeams)
  }

  /**
   * Get a specific team by ID
   * @param teamId - Team ID
   * @param leagueId - League ID (0=PBE, 1=MiLPBE)
   * @param season - Season number (optional, currently unused)
   *
   * NOTE: Uses local team data since Portal doesn't have teams endpoint yet
   */
  async getTeam(
    teamId: number,
    leagueId: number,
    season?: number
  ): Promise<PortalTeam> {
    const teams = await this.getTeams(leagueId, season)
    const team = teams.find((t) => t.id === teamId)

    if (!team) {
      throw new Error(`Team with ID ${teamId} not found`)
    }

    return team
  }

  /**
   * Get player by ID
   * @param playerId - Player ID (pid)
   *
   * Uses Portal endpoint: /api/isfl/v1/player?pid={playerId}
   */
  async getPlayer(playerId: number): Promise<PortalPlayer> {
    const cacheKey = `player-${playerId}`
    const cached = this.cache.get<PortalPlayer>(cacheKey, 5 * 60 * 1000) // 5 min cache

    if (cached) {
      return cached
    }

    try {
      const response = await this.client.get('/api/isfl/v1/player', { // TODO: update to PBE API path when available
        params: { pid: playerId },
      })

      // Portal returns an array, we want the first result
      if (Array.isArray(response.data) && response.data.length > 0) {
        const player = response.data[0]
        this.cache.set(cacheKey, player)
        return player
      }

      throw new Error(`Player with ID ${playerId} not found`)
    } catch (error) {
      logger.error({ err: error, playerId }, 'Error fetching player')
      throw new Error('Failed to fetch player from Portal API')
    }
  }

  /**
   * Get player stats by ID
   * @param playerId - Player ID (pid)
   *
   * Uses Portal endpoint: /api/isfl/v1/player/stats?pid={playerId}
   */
  async getPlayerStats(playerId: number): Promise<any[]> {
    const cacheKey = `player-stats-${playerId}`
    const cached = this.cache.get<any[]>(cacheKey, 5 * 60 * 1000) // 5 min cache

    if (cached) {
      return cached
    }

    try {
      const response = await this.client.get('/api/isfl/v1/player/stats', { // TODO: update to PBE API path when available
        params: { pid: playerId },
      })

      const stats = response.data || []
      this.cache.set(cacheKey, stats)
      return stats
    } catch (error) {
      logger.error({ err: error, playerId }, 'Error fetching player stats')
      throw new Error('Failed to fetch player stats from Portal API')
    }
  }

  /**
   * Get player awards by ID
   * @param playerId - Player ID (pid)
   *
   * Uses Portal endpoint: /api/isfl/v1/awards?pid={playerId}
   */
  async getPlayerAwards(playerId: number): Promise<any[]> {
    const cacheKey = `player-awards-${playerId}`
    const cached = this.cache.get<any[]>(cacheKey, 10 * 60 * 1000) // 10 min cache (awards change less frequently)

    if (cached) {
      return cached
    }

    try {
      const response = await this.client.get('/api/isfl/v1/awards', { // TODO: update to PBE API path when available
        params: { pid: playerId },
      })

      const awards = response.data || []

      // Map awardPosition to position for consistency with frontend
      const mappedAwards = awards.map((award: any) => ({
        ...award,
        position: award.awardPosition || award.position,
      }))

      this.cache.set(cacheKey, mappedAwards)
      return mappedAwards
    } catch (error) {
      logger.error({ err: error, playerId }, 'Error fetching player awards')
      throw new Error('Failed to fetch player awards from Portal API')
    }
  }

  /**
   * Get player career rankings by ID
   * @param playerId - Player ID (pid)
   * @param seasonType - Optional season type filter (RegularSeason or PostSeason)
   *
   * Uses Portal endpoint: /api/isfl/v1/player/rankings?pid={playerId}&seasonType={seasonType}
   */
  async getPlayerRankings(
    playerId: number,
    seasonType: 'RegularSeason' | 'PostSeason' = 'RegularSeason'
  ): Promise<any> {
    const cacheKey = `player-rankings-${playerId}-${seasonType}`
    const cached = this.cache.get<any>(cacheKey, 5 * 60 * 1000) // 5 min cache

    if (cached) {
      return cached
    }

    try {
      const response = await this.client.get('/api/isfl/v1/player/rankings', { // TODO: update to PBE API path when available
        params: { pid: playerId, seasonType },
      })

      const rankings = response.data || {}
      this.cache.set(cacheKey, rankings)
      return rankings
    } catch (error) {
      logger.error({ err: error, playerId }, 'Error fetching player rankings')
      throw new Error('Failed to fetch player rankings from Portal API')
    }
  }

  /**
   * Get all users from Portal
   * Returns a map of uid -> user info for easy lookup
   * Cached for 24 hours (user info changes infrequently)
   *
   * Uses Portal endpoint: /api/isfl/v1/userinfo (no params = all users)
   */
  async getAllUsers(): Promise<Map<number, PortalUserInfo>> {
    // Check cache first
    const cacheKey = 'allusers'
    const cached = this.cache.get<Map<number, PortalUserInfo>>(cacheKey, 24 * 60 * 60 * 1000) // 24 hour TTL

    if (cached) {
      return cached
    }

    try {
      const response = await this.client.get('/api/isfl/v1/userinfo') // TODO: update to PBE API path when available

      // Portal returns array of all users
      if (Array.isArray(response.data)) {
        const userMap = new Map<number, PortalUserInfo>()
        response.data.forEach((user: PortalUserInfo) => {
          userMap.set(user.uid, user)
        })

        console.log(`Portal API: Fetched and cached ${userMap.size} users`)
        if (userMap.size > 0) {
          const sampleUsers = Array.from(userMap.values()).slice(0, 3)
          console.log('Sample usernames:', sampleUsers.map(u => u.username))
        }

        // Cache the result
        this.cache.set(cacheKey, userMap)
        return userMap
      }

      throw new Error('Failed to fetch users from Portal')
    } catch (error) {
      logger.error({ err: error }, 'Error fetching all users')
      throw new Error('Failed to fetch all users from Portal API')
    }
  }

  /**
   * Get user information by UID
   * @param userId - User ID (uid)
   *
   * First tries to use the all-users cache, then falls back to individual API call
   * Uses Portal endpoint: /api/isfl/v1/userinfo?uid={userId}
   * Cached for 1 week (user info changes infrequently)
   */
  async getUserInfo(userId: number): Promise<PortalUserInfo> {
    // Check if all-users cache is available (24 hour TTL)
    const allUsersCache = this.cache.get<Map<number, PortalUserInfo>>('allusers', 24 * 60 * 60 * 1000)
    if (allUsersCache) {
      const userFromCache = allUsersCache.get(userId)
      if (userFromCache) {
        return userFromCache
      }
    }

    // Check individual user cache
    const cacheKey = `userinfo:${userId}`
    const cached = this.cache.get<PortalUserInfo>(cacheKey, 7 * 24 * 60 * 60 * 1000) // 1 week TTL

    if (cached) {
      return cached
    }

    try {
      const response = await this.client.get('/api/isfl/v1/userinfo', { // TODO: update to PBE API path when available
        params: { uid: userId },
      })

      // Portal returns an array, we want the first result
      if (Array.isArray(response.data) && response.data.length > 0) {
        const userInfo = response.data[0]
        // Cache the result
        this.cache.set(cacheKey, userInfo)
        return userInfo
      }

      throw new Error(`User with ID ${userId} not found`)
    } catch (error) {
      logger.error({ err: error, userId }, 'Error fetching user')
      throw new Error('Failed to fetch user from Portal API')
    }
  }

  /**
   * Get user's permissions (usergroup and additionalgroups)
   * @param userId - User ID (uid)
   * @param userToken - Optional user JWT token for authentication
   * @param cookies - Optional cookies string to forward to Portal (required for auth)
   *
   * Uses Portal endpoint: /api/isfl/v1/user/permissions
   * Note: Portal requires both JWT token AND userid cookie for authentication
   * Cached for 5 minutes to reduce Portal load
   */
  async getUserPermissions(
    userId: number,
    userToken?: string,
    cookies?: string
  ): Promise<{
    uid: number
    usergroup: number
    additionalgroups: string
    groups: number[]
  }> {
    // Check cache first
    const cacheKey = `permissions:${userId}`
    const cached = this.cache.get<{
      uid: number
      usergroup: number
      additionalgroups: string
      groups: number[]
    }>(cacheKey)

    if (cached) {
      return cached
    }

    try {
      const headers: any = {}
      if (userToken) {
        headers.Authorization = `Bearer ${userToken}`
      }
      if (cookies) {
        headers.Cookie = cookies
      }

      const response = await this.client.get('/api/isfl/v1/user/permissions', { // TODO: update to PBE API path when available
        headers,
      })

      const data = response.data

      // Portal returns { uid, groups: [usergroup, ...additionalgroups] }
      // First element in groups array is the primary usergroup
      const groups = data.groups || []
      const usergroup = groups[0] || 0
      const additionalgroups = groups.slice(1).join(',')

      const result = {
        uid: data.uid,
        usergroup,
        additionalgroups,
        groups,
      }

      // Cache the result
      this.cache.set(cacheKey, result)

      return result
    } catch (error: any) {
      logger.error(
        {
          err: error,
          userId,
          status: error.response?.status,
          responseData: error.response?.data,
        },
        'Error fetching user permissions'
      )
      throw new Error('Failed to fetch user permissions from Portal API')
    }
  }

  /**
   * Get user's bank balance
   * @param userId - User ID (uid)
   *
   * Uses Portal endpoint: /api/isfl/v1/bank/header-info?uid={userId}
   */
  async getBankBalance(userId: number): Promise<PortalBankBalance> {
    try {
      const response = await this.client.get('/api/isfl/v1/bank/header-info', { // TODO: update to PBE API path when available
        params: { uid: userId },
      })

      // Portal returns a single object when uid is provided
      if (response.data && response.data.uid) {
        return {
          uid: response.data.uid,
          bankBalance: response.data.bankBalance || 0,
        }
      }

      throw new Error(`Bank balance for user ${userId} not found`)
    } catch (error: any) {
      logger.error(
        {
          err: error,
          userId,
          responseData: error.response?.data,
          responseStatus: error.response?.status,
        },
        'Error fetching bank balance'
      )
      throw new Error('Failed to fetch bank balance from Portal API')
    }
  }

  /**
   * Create a bank transaction
   * @param transaction - Transaction details
   *
   * Uses Portal endpoint: POST /api/isfl/v1/bank/transactions/external-create
   * Requires API token authentication (Bearer token in Authorization header)
   */
  async createBankTransaction(
    transaction: PortalBankTransaction
  ): Promise<void> {
    try {
      // Portal expects { transactions: [...] } format
      // This endpoint requires API token authentication
      const response = await this.client.post(
        '/api/isfl/v1/bank/transactions/external-create', // TODO: update to PBE API path when available
        {
          transactions: [transaction],
        },
        {
          headers: {
            Authorization: this.apiKey ? `Bearer ${this.apiKey}` : undefined,
          },
        }
      )

      if (response.data.status !== 'success') {
        logger.error(
          { response: response.data },
          'Portal API returned non-success status'
        )
        throw new Error('Transaction creation failed')
      }
    } catch (error: any) {
      logger.error(
        {
          err: error,
          transaction,
          responseData: error.response?.data,
          responseStatus: error.response?.status,
        },
        'Error creating bank transaction'
      )
      throw new Error(
        `Failed to create bank transaction via Portal API: ${error.response?.data?.message || error.message}`
      )
    }
  }

  /**
   * Validate user session token
   * @param token - Session token (JWT or session ID)
   *
   * WORKAROUND: Portal doesn't have a dedicated /api/isfl/v1/auth/validate endpoint
   * Instead, we call /api/isfl/v1/user which requires authentication
   * If the call succeeds (200), the token is valid. If it fails (401), it's invalid.
   */
  async validateSession(token: string): Promise<PortalSessionInfo> {
    try {
      const response = await this.client.get('/api/isfl/v1/user', { // TODO: update to PBE API path when available
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      // If we got here, the token is valid
      if (response.data && response.data.uid) {
        return {
          uid: response.data.uid,
          username: response.data.username,
          usergroup: 0, // Not returned by this endpoint
          valid: true,
        }
      }

      throw new Error('Invalid session response')
    } catch (error: any) {
      // If we get 401, the token is invalid
      if (error.response?.status === 401) {
        return {
          uid: 0,
          username: '',
          usergroup: 0,
          valid: false,
        }
      }

      logger.error({ err: error }, 'Error validating session')
      throw new Error('Failed to validate session via Portal API')
    }
  }

  /**
   * Get team data formatted for trading cards
   * This may be a custom endpoint that returns team data with logos, colors, etc.
   * @param leagueId - Optional league filter
   *
   * Currently uses the same endpoint as getTeams() since teams data includes all necessary info
   */
  async getTeamsForCards(leagueId?: number): Promise<PortalTeam[]> {
    // For now, teams data from /api/v3/teams already has all the info we need
    // (colors, logos, etc.), so we just use getTeams()
    return this.getTeams(leagueId)
  }

  /**
   * Login to Portal
   * @param username - Username
   * @param password - Password
   *
   * Uses Portal endpoint: POST /api/isfl/v1/auth/login
   */
  async login(
    username: string,
    password: string
  ): Promise<PortalLoginResponse> {
    try {
      // Login endpoint doesn't need API key - only username/password
      // Create a separate axios instance without the API key header
      const loginClient = axios.create({
        baseURL: this.baseUrl,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      })

      const response = await loginClient.post('/api/isfl/v1/auth/login', { // TODO: update to PBE API path when available
        username,
        password,
      })

      return response.data
    } catch (error: any) {
      logger.error({ err: error, username }, 'Error logging in')

      // Return error response format
      return {
        status: 'error',
        errorMessage:
          error.response?.data?.errorMessage ||
          'Failed to login via Portal API',
      }
    }
  }

  /**
   * Refresh access token
   * @param refreshToken - Refresh token
   *
   * Uses Portal endpoint: POST /api/isfl/v1/auth/token
   */
  async refreshToken(
    refreshToken: string
  ): Promise<PortalTokenRefreshResponse> {
    try {
      const response = await this.client.post('/api/isfl/v1/auth/token', { // TODO: update to PBE API path when available
        refreshToken,
      })

      return response.data
    } catch (error: any) {
      logger.error({ err: error }, 'Error refreshing token')

      // Return error response format
      return {
        status: 'error',
        errorMessage:
          error.response?.data?.errorMessage ||
          'Failed to refresh token via Portal API',
      }
    }
  }

  /**
   * Clear all cached Portal API responses
   * Useful when user logs out or permissions change
   */
  clearCache(): void {
    this.cache.clear()
    logger.info('Portal API cache cleared')
  }

  /**
   * Clear cached data for a specific user
   * @param userId - User ID to clear cache for
   *
   * Also clears the all-users cache since it contains this user's data
   */
  clearUserCache(userId: number): void {
    // When a specific user changes, we need to invalidate the all-users cache too
    // since it contains stale data for this user
    this.cache.clear() // Simple approach: clear everything

    logger.info({ userId }, 'Cleared cache for user (including all-users cache)')
  }
}

// Export singleton instance
const portalApiService = new PortalApiService()
export const portalApi = portalApiService
export default portalApiService
