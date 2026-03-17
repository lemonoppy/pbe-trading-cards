import 'dotenv/config'
import { readFileSync } from 'fs'
import { join } from 'path'
import { pool } from '../pages/api/database/database'

async function runMigration(sqlFile: string) {
  const sql = readFileSync(join(__dirname, sqlFile), 'utf-8')

  try {
    console.log(`🚀 Running migration: ${sqlFile}`)
    await pool.query(sql)
    console.log(`✅ Migration completed successfully\n`)
  } catch (error) {
    console.error(`❌ Migration failed:`, error)
    throw error
  }
}

async function main() {
  const migrationFile = process.argv[2]

  if (!migrationFile) {
    console.error('Usage: npx tsx migrations/run-migration.ts <migration-file.sql>')
    console.error('Example: npx tsx migrations/run-migration.ts add_legacy_id_column.sql')
    process.exit(1)
  }

  try {
    await runMigration(migrationFile)
    process.exit(0)
  } catch (error) {
    process.exit(1)
  }
}

main()
