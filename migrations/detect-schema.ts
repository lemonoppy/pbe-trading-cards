import 'dotenv/config'
import { pool } from '../pages/api/database/database'

interface ColumnInfo {
  column_name: string
  data_type: string
  character_maximum_length: number | null
  is_nullable: string
  column_default: string | null
  ordinal_position: number
}

async function detectTableSchema(tableName: string): Promise<ColumnInfo[]> {

  // Query column information from PostgreSQL information schema
  const result = await pool.query<ColumnInfo>(
    `
    SELECT
      column_name,
      data_type,
      character_maximum_length,
      is_nullable,
      column_default,
      ordinal_position
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position
  `,
    [tableName]
  )

  return result.rows
}

async function main() {
  try {
    console.log('🔍 Detecting schema for pbe_cards table...\n')

    const schema = await detectTableSchema('pbe_cards')

    if (schema.length === 0) {
      console.error('❌ Table "pbe_cards" not found or has no columns!')
      process.exit(1)
    }

    console.log(`✅ Found ${schema.length} columns in pbe_cards table:\n`)

    // Display table
    console.log('┌─────┬──────────────────────┬────────────────────┬──────────┬──────────────────┐')
    console.log('│ Pos │ Column Name          │ Data Type          │ Nullable │ Default          │')
    console.log('├─────┼──────────────────────┼────────────────────┼──────────┼──────────────────┤')

    schema.forEach((col) => {
      const pos = col.ordinal_position.toString().padEnd(3)
      const name = col.column_name.padEnd(20).substring(0, 20)
      const type = col.data_type.padEnd(18).substring(0, 18)
      const nullable = (col.is_nullable === 'YES' ? 'YES' : 'NO').padEnd(8)
      const defaultVal = (col.column_default || 'NULL').padEnd(16).substring(0, 16)

      console.log(`│ ${pos} │ ${name} │ ${type} │ ${nullable} │ ${defaultVal} │`)
    })

    console.log('└─────┴──────────────────────┴────────────────────┴──────────┴──────────────────┘\n')

    // Output JSON for programmatic use
    console.log('📄 JSON output (for saving to file):\n')
    console.log(JSON.stringify(schema, null, 2))

    // Check if legacy_card_id exists
    const hasLegacyId = schema.some((col) => col.column_name === 'legacy_card_id')
    if (hasLegacyId) {
      console.log('\n✅ legacy_card_id column already exists')
    } else {
      console.log('\n⚠️  legacy_card_id column does NOT exist - need to run migration')
    }

    process.exit(0)
  } catch (error) {
    console.error('❌ Error detecting schema:', error)
    process.exit(1)
  }
}

main()
