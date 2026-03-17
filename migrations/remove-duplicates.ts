import 'dotenv/config'
import { pool } from '../pages/api/database/database'

async function removeDuplicates() {
  console.log('🔍 Finding duplicate legacy cards...\n')

  // Find duplicates
  const duplicates = await pool.query(`
    SELECT
      legacy_card_id,
      COUNT(*) as dup_count,
      ARRAY_AGG(cardid ORDER BY cardid) as cardids
    FROM pbe_cards
    WHERE legacy_card_id IS NOT NULL
    GROUP BY legacy_card_id
    HAVING COUNT(*) > 1
  `)

  console.log(`Found ${duplicates.rowCount} duplicate legacy_card_id values`)

  if (duplicates.rowCount === 0) {
    console.log('✅ No duplicates found - database is clean!')
    return
  }

  console.log('\nDuplicates found:')
  duplicates.rows.forEach((dup) => {
    console.log(`  ${dup.legacy_card_id}: ${dup.dup_count} copies (cardIDs: ${dup.cardids})`)
  })

  console.log('\n🗑️  Removing duplicates (keeping lowest cardid)...\n')

  // Delete duplicates (keep first cardid, delete rest)
  let totalDeleted = 0
  for (const dup of duplicates.rows) {
    const cardidsToDelete = dup.cardids.slice(1) // Keep first, delete rest

    const result = await pool.query(
      `DELETE FROM pbe_cards WHERE cardid = ANY($1::int[])`,
      [cardidsToDelete]
    )

    totalDeleted += result.rowCount
    console.log(
      `  Removed ${result.rowCount} duplicate(s) for legacy_card_id: ${dup.legacy_card_id}`
    )
  }

  console.log(`\n✅ Removed ${totalDeleted} duplicate cards`)

  // Verify
  const finalCount = await pool.query(`
    SELECT COUNT(*) as count
    FROM pbe_cards
    WHERE legacy_card_id IS NOT NULL
  `)

  console.log(`\n📊 Final legacy card count: ${finalCount.rows[0].count}`)
}

removeDuplicates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
