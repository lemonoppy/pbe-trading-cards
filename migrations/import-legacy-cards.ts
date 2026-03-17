import 'dotenv/config'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { pool } from '../pages/api/database/database'
import { findTeamByName, AllTeams } from '../lib/teams'
import { distance } from 'fastest-levenshtein'

// ============================================================================
// TYPES
// ============================================================================

interface LegacyCard {
  _id: string
  playerName: string
  playerTeam: string
  rarity: string
  imageUrl: string
  submissionUsername: string
  submissionDate: string
  approved: boolean
  currentRotation: boolean
  __v: number
}

interface Progress {
  processedCount: number
  failedCards: Array<{
    _id: string
    playerName: string
    error: string
  }>
  lastProcessedId: string | null
  startTime: string
  resumedAt?: string
}

interface PortalPlayer {
  pid: number
  firstName: string
  lastName: string
  name: string
}

interface PortalUser {
  uid: number
  username: string
}

interface MappedCardData {
  legacy_card_id: string
  player_name: string
  playerid: number | null
  teamid: number
  leagueid: number
  card_rarity: string
  image_url: string
  approved: boolean
  pullable: boolean
  season: number
  position: string
  author_userid: number | null
  author_paid: boolean
  date_approved: string | null
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const BATCH_SIZE = 50
const BATCH_DELAY_MS = 1000
const PROGRESS_FILE = join(__dirname, '.import-progress.json')
const TEST_MODE = process.argv.includes('--test-mode')
const TEST_LIMIT = 10

// Default values
const DEFAULT_AUTHOR_USER_ID = 1 // System/Legacy user
const DEFAULT_POSITION = 'X' // Logo/special cards

// ============================================================================
// MATCHER CLASSES
// ============================================================================

class PlayerMatcher {
  private playersByName: Map<string, PortalPlayer[]> = new Map()

  constructor(players: PortalPlayer[]) {
    for (const player of players) {
      const normalizedName = this.normalizeName(player.name)
      if (!this.playersByName.has(normalizedName)) {
        this.playersByName.set(normalizedName, [])
      }
      this.playersByName.get(normalizedName)!.push(player)
    }
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
  }

  findMatch(searchName: string, maxDistance: number = 3): PortalPlayer | null {
    const normalized = this.normalizeName(searchName)

    // Try exact match first
    const exactMatches = this.playersByName.get(normalized)
    if (exactMatches && exactMatches.length > 0) {
      return exactMatches[0]
    }

    // Fuzzy match using Levenshtein distance
    let bestMatch: PortalPlayer | null = null
    let bestDistance = Infinity

    for (const [playerName, players] of this.playersByName.entries()) {
      const dist = distance(normalized, playerName)

      if (dist < bestDistance && dist <= maxDistance) {
        bestDistance = dist
        bestMatch = players[0]
      }
    }

    if (bestMatch && bestDistance > 0) {
      console.log(
        `  🔗 Player fuzzy matched: "${searchName}" → "${bestMatch.name}" (distance: ${bestDistance})`
      )
    }

    return bestMatch
  }
}

class UserMatcher {
  private usersByUsername: Map<string, PortalUser> = new Map()

  constructor(users: PortalUser[]) {
    for (const user of users) {
      const normalizedUsername = this.normalizeUsername(user.username)
      this.usersByUsername.set(normalizedUsername, user)
    }
  }

  private normalizeUsername(username: string): string {
    return username
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, '') // Remove special characters except underscore
  }

  findMatch(searchUsername: string, maxDistance: number = 3): PortalUser | null {
    const normalized = this.normalizeUsername(searchUsername)

    // Try exact match first
    const exactMatch = this.usersByUsername.get(normalized)
    if (exactMatch) {
      return exactMatch
    }

    // Fuzzy match using Levenshtein distance
    let bestMatch: PortalUser | null = null
    let bestDistance = Infinity

    for (const [username, user] of this.usersByUsername.entries()) {
      const dist = distance(normalized, username)

      if (dist < bestDistance && dist <= maxDistance) {
        bestDistance = dist
        bestMatch = user
      }
    }

    if (bestMatch && bestDistance > 0) {
      console.log(
        `  🔗 User fuzzy matched: "${searchUsername}" → "${bestMatch.username}" (distance: ${bestDistance})`
      )
    }

    return bestMatch
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchPortalPlayers(): Promise<PortalPlayer[]> {
  console.log('📡 Fetching Portal players...')

  const response = await fetch('https://portal.pbe.simflow.io/api/isfl/v1/player')

  if (!response.ok) {
    throw new Error(`Portal API error: ${response.status} ${response.statusText}`)
  }

  const players = await response.json()

  console.log(`✅ Cached ${players.length} Portal players`)

  return players.map((p: any) => ({
    pid: p.pid,
    firstName: p.firstName || '',
    lastName: p.lastName || '',
    name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
  }))
}

async function fetchPortalUsers(): Promise<PortalUser[]> {
  console.log('📡 Fetching Portal users...')

  const response = await fetch('https://portal.pbe.simflow.io/api/isfl/v1/userinfo')

  if (!response.ok) {
    throw new Error(`Portal API error: ${response.status} ${response.statusText}`)
  }

  const users = await response.json()

  console.log(`✅ Cached ${users.length} Portal users\n`)

  return users.map((u: any) => ({
    uid: u.uid,
    username: u.username,
  }))
}

function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'))
    data.resumedAt = new Date().toISOString()
    console.log(`\n♻️  Resuming from previous run (${data.processedCount} cards already processed)\n`)
    return data
  }

  return {
    processedCount: 0,
    failedCards: [],
    lastProcessedId: null,
    startTime: new Date().toISOString(),
  }
}

function saveProgress(progress: Progress): void {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

function mapTeamName(teamName: string): { teamid: number; leagueid: number } {
  // Try finding team using existing fuzzy logic
  const team = findTeamByName(teamName)

  if (team) {
    const leagueid = team.league === 'PBE' ? 0 : team.league === 'MiLPBE' ? 1 : 2
    return { teamid: team.id, leagueid }
  }

  // Fallback for unmapped teams
  console.warn(`  ⚠️  Unknown team: "${teamName}" - using default teamID=0`)
  return { teamid: 0, leagueid: 0 }
}

function extractSeasonFromDate(dateString: string): number {
  try {
    const date = new Date(dateString)
    return date.getFullYear()
  } catch (error) {
    return new Date().getFullYear() // Default to current year
  }
}

async function mapCardData(
  card: LegacyCard,
  playerMatcher: PlayerMatcher,
  userMatcher: UserMatcher
): Promise<MappedCardData> {
  // Map player name to Portal player ID
  const portalPlayer = playerMatcher.findMatch(card.playerName)

  // Map submission username to Portal user ID
  const portalUser = userMatcher.findMatch(card.submissionUsername)

  // Map team name to team/league ID
  const teamData = mapTeamName(card.playerTeam)

  // Extract season from submission date
  const season = extractSeasonFromDate(card.submissionDate)

  return {
    legacy_card_id: card._id,
    player_name: card.playerName,
    playerid: portalPlayer ? portalPlayer.pid : null,
    teamid: teamData.teamid,
    leagueid: teamData.leagueid,
    card_rarity: card.rarity,
    image_url: card.imageUrl,
    approved: card.approved,
    pullable: card.approved, // Use approved status for pullable
    season,
    position: DEFAULT_POSITION,
    author_userid: portalUser ? portalUser.uid : DEFAULT_AUTHOR_USER_ID,
    author_paid: true, // Legacy cards already paid
    date_approved: card.approved ? card.submissionDate : null,
  }
}

async function insertCard(cardData: MappedCardData): Promise<void> {
  const query = `
    INSERT INTO pbe_cards (
      legacy_card_id,
      player_name,
      playerid,
      teamid,
      leagueid,
      card_rarity,
      image_url,
      approved,
      pullable,
      season,
      position,
      author_userid,
      author_paid,
      date_approved
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  `

  await pool.query(query, [
    cardData.legacy_card_id,
    cardData.player_name,
    cardData.playerid,
    cardData.teamid,
    cardData.leagueid,
    cardData.card_rarity,
    cardData.image_url,
    cardData.approved,
    cardData.pullable,
    cardData.season,
    cardData.position,
    cardData.author_userid,
    cardData.author_paid,
    cardData.date_approved,
  ])
}

async function processCard(
  card: LegacyCard,
  playerMatcher: PlayerMatcher,
  userMatcher: UserMatcher,
  progress: Progress
): Promise<boolean> {
  try {
    // Map legacy card data to new schema
    const cardData = await mapCardData(card, playerMatcher, userMatcher)

    // Insert into database
    await insertCard(cardData)

    return true
  } catch (error: any) {
    console.error(`  ❌ Failed to process card ${card._id}:`, error.message)

    progress.failedCards.push({
      _id: card._id,
      playerName: card.playerName,
      error: error.message,
    })

    return false
  }
}

async function processBatch(
  cards: LegacyCard[],
  startIdx: number,
  playerMatcher: PlayerMatcher,
  userMatcher: UserMatcher,
  progress: Progress
): Promise<void> {
  const endIdx = Math.min(startIdx + BATCH_SIZE, cards.length)
  const batch = cards.slice(startIdx, endIdx)

  console.log(`\n📦 Processing batch: cards ${startIdx + 1}-${endIdx} of ${cards.length}`)

  for (const card of batch) {
    // Skip if already processed
    if (progress.lastProcessedId === card._id) {
      console.log(`  ⏭️  Skipping already processed card: ${card.playerName}`)
      continue
    }

    const success = await processCard(card, playerMatcher, userMatcher, progress)

    if (success) {
      progress.processedCount++
      progress.lastProcessedId = card._id
    }
  }

  // Save progress after each batch
  saveProgress(progress)

  const percentage = ((endIdx / cards.length) * 100).toFixed(1)
  console.log(`\n✅ Batch complete: ${endIdx}/${cards.length} cards (${percentage}%)`)
  console.log(`   Success: ${progress.processedCount} | Failed: ${progress.failedCards.length}`)

  // Delay between batches to avoid rate limiting
  if (endIdx < cards.length) {
    await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main() {
  console.log('🎴 PBE Trading Cards - Legacy Card Migration')
  console.log('=' .repeat(60))

  if (TEST_MODE) {
    console.log(`\n🧪 TEST MODE: Processing first ${TEST_LIMIT} cards only\n`)
  }

  try {
    // Step 1: Fetch Portal data once (cache in memory)
    const portalPlayers = await fetchPortalPlayers()
    const playerMatcher = new PlayerMatcher(portalPlayers)

    const portalUsers = await fetchPortalUsers()
    const userMatcher = new UserMatcher(portalUsers)

    // Step 2: Load legacy cards
    console.log('📂 Loading legacy cards from all_cards.json...')
    const allCardsData = JSON.parse(
      readFileSync(join(__dirname, 'all_cards.json'), 'utf-8')
    )
    let legacyCards: LegacyCard[] = allCardsData.allCards

    if (TEST_MODE) {
      legacyCards = legacyCards.slice(0, TEST_LIMIT)
    }

    console.log(`✅ Loaded ${legacyCards.length} legacy cards\n`)

    // Step 3: Load or initialize progress
    const progress = loadProgress()

    // Step 4: Process cards in batches
    console.log(`\n🚀 Starting migration...`)
    console.log(`   Batch size: ${BATCH_SIZE} cards`)
    console.log(`   Batch delay: ${BATCH_DELAY_MS}ms\n`)

    for (let i = 0; i < legacyCards.length; i += BATCH_SIZE) {
      await processBatch(legacyCards, i, playerMatcher, userMatcher, progress)
    }

    // Step 5: Final summary
    console.log('\n' + '='.repeat(60))
    console.log('✅ MIGRATION COMPLETE!')
    console.log('='.repeat(60))
    console.log(`Total cards processed: ${progress.processedCount}`)
    console.log(`Failed cards: ${progress.failedCards.length}`)

    if (progress.failedCards.length > 0) {
      console.log(`\n⚠️  Failed cards saved to: ${PROGRESS_FILE}`)
      console.log('   Review the failedCards array for details')
    }

    console.log(`\nMigration started: ${progress.startTime}`)
    console.log(`Migration finished: ${new Date().toISOString()}`)

    process.exit(0)
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error)
    process.exit(1)
  }
}

// Run migration
main()
