import 'dotenv/config'
import { pool } from '../pages/api/database/database'

const COMMON_OLD_RARITIES = ['Base', 'Backup', 'Starter', 'Star', 'All-Pro', 'Legend']
const UNCOMMON_OLD_RARITIES = [
  'Award',
  'Charity',
  'Holograph Expansion',
  'Insert',
  'Team Logo',
]
const RARE_OLD_RARITIES = [
  'Autograph Rookie',
  'Fantasy Kings',
  'Captain',
  'Least Valuable Player',
  'Ultimus Champion',
]
const MYTHIC_OLD_RARITIES = ['Hall of Fame', 'Unique']

async function restructureRarities() {
  console.log('🎴 Restructuring Card Rarity System')
  console.log('='.repeat(60))
  console.log('New System:')
  console.log('  - card_rarity: Common/Uncommon/Rare/Mythic (4 tiers for pack pulls)')
  console.log('  - sub_type: Descriptive card types (Base, Award, Captain, etc.)\n')

  try {
    // Create backup
    console.log('💾 Creating backup table...')
    await pool.query(`
      DROP TABLE IF EXISTS pbe_cards_backup_rarity;
      CREATE TABLE pbe_cards_backup_rarity AS
      SELECT * FROM pbe_cards;
    `)

    const backupCount = await pool.query(
      `SELECT COUNT(*) as count FROM pbe_cards_backup_rarity`
    )
    console.log(`✅ Backup created: ${backupCount.rows[0].count} cards\n`)

    // Update Common tier - ALL get sub_type='Base'
    console.log('📝 Updating Common tier cards...')
    const commonResult = await pool.query(
      `UPDATE pbe_cards
       SET card_rarity = 'Common',
           sub_type = 'Base'
       WHERE card_rarity = ANY($1::text[])`,
      [COMMON_OLD_RARITIES]
    )
    console.log(`✅ Updated ${commonResult.rowCount} cards to Common / Base\n`)

    // Update Uncommon tier - Keep current name as sub_type
    console.log('📝 Updating Uncommon tier cards...')
    for (const oldRarity of UNCOMMON_OLD_RARITIES) {
      const result = await pool.query(
        `UPDATE pbe_cards
         SET card_rarity = 'Uncommon',
             sub_type = $1
         WHERE card_rarity = $1`,
        [oldRarity]
      )
      console.log(`  ✅ ${oldRarity}: ${result.rowCount} cards → Uncommon / ${oldRarity}`)
    }
    console.log()

    // Update Rare tier - Keep current name as sub_type
    console.log('📝 Updating Rare tier cards...')
    for (const oldRarity of RARE_OLD_RARITIES) {
      const result = await pool.query(
        `UPDATE pbe_cards
         SET card_rarity = 'Rare',
             sub_type = $1
         WHERE card_rarity = $1`,
        [oldRarity]
      )
      console.log(`  ✅ ${oldRarity}: ${result.rowCount} cards → Rare / ${oldRarity}`)
    }
    console.log()

    // Update Mythic tier - Keep current name as sub_type
    console.log('📝 Updating Mythic tier cards...')
    for (const oldRarity of MYTHIC_OLD_RARITIES) {
      const result = await pool.query(
        `UPDATE pbe_cards
         SET card_rarity = 'Mythic',
             sub_type = $1
         WHERE card_rarity = $1`,
        [oldRarity]
      )
      console.log(`  ✅ ${oldRarity}: ${result.rowCount} cards → Mythic / ${oldRarity}`)
    }
    console.log()

    // Verify all cards have sub_type
    console.log('🔍 Verifying data integrity...')
    const nullCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM pbe_cards
      WHERE sub_type IS NULL OR sub_type = ''
    `)

    if (parseInt(nullCheck.rows[0].count) > 0) {
      console.error(`❌ WARNING: ${nullCheck.rows[0].count} cards have NULL sub_type!`)
    } else {
      console.log(`✅ All cards have sub_type set`)
    }

    // Final distribution by rarity
    const stats = await pool.query(`
      SELECT
        card_rarity,
        COUNT(*) as count,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM pbe_cards
      GROUP BY card_rarity
      ORDER BY
        CASE card_rarity
          WHEN 'Common' THEN 1
          WHEN 'Uncommon' THEN 2
          WHEN 'Rare' THEN 3
          WHEN 'Mythic' THEN 4
        END
    `)

    console.log('\n📊 Final card_rarity distribution:')
    console.table(stats.rows)

    // Sub-type distribution within each tier
    const subTypeStats = await pool.query(`
      SELECT
        card_rarity,
        sub_type,
        COUNT(*) as count
      FROM pbe_cards
      GROUP BY card_rarity, sub_type
      ORDER BY
        CASE card_rarity
          WHEN 'Common' THEN 1
          WHEN 'Uncommon' THEN 2
          WHEN 'Rare' THEN 3
          WHEN 'Mythic' THEN 4
        END,
        sub_type
    `)

    console.log('\n📊 card_rarity → sub_type breakdown:')
    console.table(subTypeStats.rows)

    console.log('\n' + '='.repeat(60))
    console.log('✅ RARITY RESTRUCTURING COMPLETE!')
    console.log('='.repeat(60))
  } catch (error) {
    console.error('\n❌ Error during restructuring:', error)
    console.log('\n⚠️  You can rollback using: DROP TABLE pbe_cards; ALTER TABLE pbe_cards_backup_rarity RENAME TO pbe_cards;')
    throw error
  }
}

restructureRarities()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
