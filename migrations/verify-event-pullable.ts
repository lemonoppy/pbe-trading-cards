import 'dotenv/config'
import { pool } from '../pages/api/database/database'

async function verify() {
  try {
    // Check if column exists
    const result = await pool.query(`
      SELECT
        column_name,
        data_type,
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'pbe_cards'
        AND column_name = 'event_pullable'
    `)

    if (result.rows.length === 0) {
      console.log('❌ event_pullable column not found')
      process.exit(1)
    }

    const column = result.rows[0]
    console.log('✅ event_pullable column verified!')
    console.log(`   Type: ${column.data_type}`)
    console.log(`   Default: ${column.column_default}`)
    console.log(`   Nullable: ${column.is_nullable}`)

    // Check stats
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_cards,
        COUNT(*) FILTER (WHERE event_pullable = true) as event_pullable_count,
        COUNT(*) FILTER (WHERE event_pullable = false) as event_not_pullable_count
      FROM pbe_cards
    `)

    console.log('\n📊 Current stats:')
    console.log(`   Total cards: ${stats.rows[0].total_cards}`)
    console.log(`   Event pullable: ${stats.rows[0].event_pullable_count}`)
    console.log(`   Not event pullable: ${stats.rows[0].event_not_pullable_count}`)

    await pool.end()
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

verify()
