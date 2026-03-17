import 'dotenv/config'
import { readFileSync } from 'fs'
import { join } from 'path'
import { pool } from '../pages/api/database/database'

interface LegacyCard {
  _id: string
  currentRotation: boolean
}

interface PortalPlayer {
  pid: number
  render: string
  position: string
}

async function fetchPortalPlayers(): Promise<Map<number, PortalPlayer>> {
  console.log('📡 Fetching Portal players...')

  const response = await fetch('https://portal.pbe.simflow.io/api/isfl/v1/player')
  const players = await response.json()

  const playerMap = new Map<number, PortalPlayer>()
  for (const p of players) {
    playerMap.set(p.pid, {
      pid: p.pid,
      render: p.render || '',
      position: p.position || '',
    })
  }

  console.log(`✅ Cached ${playerMap.size} Portal players\n`)
  return playerMap
}

async function main() {
  console.log('🔧 Updating Legacy Cards - Fix pullable, render_name, position')
  console.log('='.repeat(60))

  try {
    // Step 1: Load legacy cards to get currentRotation values
    console.log('📂 Loading legacy cards JSON...')
    const allCardsData = JSON.parse(
      readFileSync(join(__dirname, 'all_cards.json'), 'utf-8')
    )
    const legacyCards: LegacyCard[] = allCardsData.allCards

    console.log(`✅ Loaded ${legacyCards.length} legacy cards\n`)

    // Step 2: Fetch Portal players for render_name and position
    const portalPlayers = await fetchPortalPlayers()

    // Step 3: Update pullable field based on currentRotation
    console.log('🔄 Updating pullable field from currentRotation...')
    let pullableUpdated = 0

    for (const card of legacyCards) {
      await pool.query(
        `UPDATE pbe_cards
         SET pullable = $1
         WHERE legacy_card_id = $2`,
        [card.currentRotation, card._id]
      )
      pullableUpdated++

      if (pullableUpdated % 500 === 0) {
        console.log(`  Progress: ${pullableUpdated}/${legacyCards.length} cards updated`)
      }
    }

    console.log(`✅ Updated pullable for ${pullableUpdated} cards\n`)

    // Step 4: Update render_name and position from Portal API
    console.log('🔄 Updating render_name and position from Portal players...')

    // Get all cards with playerid
    const cardsWithPlayers = await pool.query<{
      cardid: number
      playerid: number
    }>(`
      SELECT cardid, playerid
      FROM pbe_cards
      WHERE legacy_card_id IS NOT NULL
        AND playerid IS NOT NULL
    `)

    let renderUpdated = 0

    for (const card of cardsWithPlayers.rows) {
      const portalPlayer = portalPlayers.get(card.playerid)

      if (portalPlayer) {
        // Truncate render_name to 100 chars to fit in VARCHAR(100) column
        const renderName = portalPlayer.render
          ? portalPlayer.render.substring(0, 100)
          : null

        await pool.query(
          `UPDATE pbe_cards
           SET render_name = $1, position = $2
           WHERE cardid = $3`,
          [renderName, portalPlayer.position || 'X', card.cardid]
        )
        renderUpdated++

        if (renderUpdated % 500 === 0) {
          console.log(
            `  Progress: ${renderUpdated}/${cardsWithPlayers.rows.length} cards updated`
          )
        }
      }
    }

    console.log(`✅ Updated render_name and position for ${renderUpdated} cards\n`)

    // Step 5: Verification
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN pullable = true THEN 1 END) as pullable_count,
        COUNT(CASE WHEN render_name IS NOT NULL THEN 1 END) as with_render,
        COUNT(CASE WHEN position != 'X' THEN 1 END) as with_position
      FROM pbe_cards
      WHERE legacy_card_id IS NOT NULL
    `)

    console.log('='.repeat(60))
    console.log('✅ UPDATE COMPLETE!')
    console.log('='.repeat(60))
    console.log('Verification:')
    console.log(`  Total legacy cards: ${stats.rows[0].total}`)
    console.log(`  Pullable cards: ${stats.rows[0].pullable_count}`)
    console.log(`  With render_name: ${stats.rows[0].with_render}`)
    console.log(
      `  With real position: ${stats.rows[0].with_position} (not 'X' default)`
    )

    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
