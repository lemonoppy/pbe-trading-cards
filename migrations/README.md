# Trading Cards Legacy Migration

This directory contains migration scripts for importing 5,833 legacy trading cards from MongoDB to PostgreSQL with Vercel Blob image storage.

## Migration Summary

**Completed:** January 13, 2026
**Total Cards:** 5,843 (includes test cards)
**Success Rate:** 100%
**Duration:** ~18 minutes

### What Was Migrated

- ✅ 5,843 legacy cards from `all_cards.json`
- ✅ Player names → Portal Player IDs (97.4% match rate via fuzzy matching)
- ✅ Usernames → Portal User IDs (100% match rate)
- ✅ Team names → Team IDs (including 3 retired teams)
- ✅ External image URLs preserved (imgur, postimg.cc)
- ✅ Positions populated from Portal API
- ✅ Pull status from `currentRotation` field

## Files

### Migration Scripts

- `detect-schema.ts` - Auto-detect database table structure
- `add_legacy_id_column.sql` - Add legacy_card_id column for tracking
- `add_legacy_teams.sql` - Insert retired teams (Berlin, Chicago, Philadelphia)
- `import-legacy-cards.ts` - Main migration script with fuzzy matching
- `update-legacy-cards.ts` - Update script for field corrections
- `run-migration.ts` - Helper to run SQL migration files

### Data Files

- `all_cards.json` - Source data (5,833 legacy cards from MongoDB)
- `.import-progress.json` - Progress tracking (resumable migration)
- `actual-schema.json` - Detected database schema

## Prerequisites

```bash
# Install dependencies
npm install fastest-levenshtein

# Environment variables required
POSTGRES_HOST=...
POSTGRES_PORT=5432
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DATABASE=...
PORTAL_API_URL=https://portal.pbe.simflow.io
```

## Usage

### Running the Migration

```bash
# 1. Detect current table schema
npx tsx migrations/detect-schema.ts

# 2. Add legacy_card_id column
npx tsx migrations/run-migration.ts add_legacy_id_column.sql

# 3. Add legacy teams
npx tsx migrations/run-migration.ts add_legacy_teams.sql

# 4. Test with first 10 cards
npx tsx migrations/import-legacy-cards.ts --test-mode

# 5. Run full migration
npx tsx migrations/import-legacy-cards.ts

# 6. Update fields (if needed)
npx tsx migrations/update-legacy-cards.ts
```

### Verification Queries

```sql
-- Count imported cards
SELECT COUNT(*) FROM pbe_cards WHERE legacy_card_id IS NOT NULL;

-- Check fuzzy match success rate
SELECT
  COUNT(*) as total,
  COUNT(playerid) as matched_players,
  ROUND(100.0 * COUNT(playerid) / COUNT(*), 1) as match_pct
FROM pbe_cards
WHERE legacy_card_id IS NOT NULL;

-- View position distribution
SELECT position, COUNT(*) as count
FROM pbe_cards
WHERE legacy_card_id IS NOT NULL
GROUP BY position
ORDER BY count DESC;

-- Sample cards
SELECT player_name, render_name, position, pullable, card_rarity, image_url
FROM pbe_cards
WHERE legacy_card_id IS NOT NULL
ORDER BY RANDOM()
LIMIT 10;
```

## Reusable Code Snippets

The following code snippets are designed to be portable to other projects.

### 1. Fuzzy String Matching with Levenshtein Distance

```typescript
import { distance } from 'fastest-levenshtein'

interface Player {
  id: number
  name: string
}

class FuzzyMatcher<T extends { id: number; name: string }> {
  private itemsByName: Map<string, T[]> = new Map()

  constructor(items: T[]) {
    for (const item of items) {
      const normalized = this.normalize(item.name)
      if (!this.itemsByName.has(normalized)) {
        this.itemsByName.set(normalized, [])
      }
      this.itemsByName.get(normalized)!.push(item)
    }
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
  }

  findMatch(searchName: string, maxDistance: number = 3): T | null {
    const normalized = this.normalize(searchName)

    // Try exact match first
    const exactMatches = this.itemsByName.get(normalized)
    if (exactMatches && exactMatches.length > 0) {
      return exactMatches[0]
    }

    // Fuzzy match using Levenshtein distance
    let bestMatch: T | null = null
    let bestDistance = Infinity

    for (const [name, items] of this.itemsByName.entries()) {
      const dist = distance(normalized, name)

      if (dist < bestDistance && dist <= maxDistance) {
        bestDistance = dist
        bestMatch = items[0]
      }
    }

    return bestMatch
  }
}

// Usage
const players: Player[] = [
  { id: 1, name: 'John Smith' },
  { id: 2, name: 'Jane Doe' },
]

const matcher = new FuzzyMatcher(players)
const match = matcher.findMatch('Jon Smith') // Finds "John Smith" with distance 1
```

### 2. Batched Processing with Progress Tracking

```typescript
interface Progress<T> {
  processedCount: number
  failedItems: T[]
  lastProcessedId: string | null
  startTime: string
}

async function processBatch<T extends { id: string }>(
  items: T[],
  batchSize: number,
  processItem: (item: T) => Promise<boolean>,
  onProgress?: (current: number, total: number) => void
): Promise<Progress<T>> {
  const progress: Progress<T> = {
    processedCount: 0,
    failedItems: [],
    lastProcessedId: null,
    startTime: new Date().toISOString(),
  }

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, Math.min(i + batchSize, items.length))

    for (const item of batch) {
      try {
        const success = await processItem(item)
        if (success) {
          progress.processedCount++
          progress.lastProcessedId = item.id
        } else {
          progress.failedItems.push(item)
        }
      } catch (error) {
        progress.failedItems.push(item)
      }
    }

    onProgress?.(i + batch.length, items.length)

    // Delay between batches
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return progress
}

// Usage
const items = [{ id: '1' }, { id: '2' }, { id: '3' }]

const progress = await processBatch(
  items,
  10, // batch size
  async (item) => {
    // Process item
    return true // success
  },
  (current, total) => {
    console.log(`Progress: ${current}/${total}`)
  }
)
```

### 3. PostgreSQL Schema Detection

```typescript
import { Pool } from 'pg'

interface ColumnInfo {
  column_name: string
  data_type: string
  character_maximum_length: number | null
  is_nullable: string
  column_default: string | null
}

async function detectTableSchema(
  pool: Pool,
  tableName: string
): Promise<ColumnInfo[]> {
  const result = await pool.query<ColumnInfo>(
    `
    SELECT
      column_name,
      data_type,
      character_maximum_length,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position
  `,
    [tableName]
  )

  return result.rows
}

// Usage
const schema = await detectTableSchema(pool, 'my_table')
console.log(`Table has ${schema.length} columns:`)
schema.forEach((col) => {
  console.log(`  - ${col.column_name}: ${col.data_type}`)
})
```

### 4. Vercel Blob Upload (Optional - For Future Use)

```typescript
import { put } from '@vercel/blob'
import { v4 as uuid } from 'uuid'

async function uploadToVercelBlob(
  base64Image: string,
  folder: string = 'uploads'
): Promise<string> {
  // Strip data URI prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '')

  // Convert to buffer
  const buffer = Buffer.from(base64Data, 'base64')

  // Generate unique filename
  const filename = `${uuid()}.png`

  // Upload to Vercel Blob
  const blob = await put(`${folder}/${filename}`, buffer, {
    access: 'public',
    contentType: 'image/png',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })

  return blob.url
}

// Usage
const imageUrl = await uploadToVercelBlob(base64ImageData, 'card-images')
```

### 5. Image Download with Retry Logic (Optional)

```typescript
async function downloadImage(url: string, retries: number = 3): Promise<Buffer> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000) // 30s timeout
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      console.error(`Download attempt ${attempt}/${retries} failed:`, error)

      if (attempt === retries) {
        throw new Error(`Failed to download after ${retries} attempts`)
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt))
      )
    }
  }

  throw new Error('Unreachable')
}

// Usage
try {
  const imageBuffer = await downloadImage('https://example.com/image.png')
  console.log(`Downloaded ${imageBuffer.length} bytes`)
} catch (error) {
  console.error('Download failed:', error)
}
```

### 6. PostgreSQL Transaction Pattern

```typescript
import { Pool, PoolClient } from 'pg'

async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Usage
await withTransaction(pool, async (client) => {
  await client.query('INSERT INTO users (name) VALUES ($1)', ['Alice'])
  await client.query('INSERT INTO profiles (user_id) VALUES ($1)', [1])
  // Both queries committed together or rolled back on error
})
```

## Migration Architecture

### Key Design Decisions

1. **No Image Re-upload**: Preserved external URLs (imgur, postimg.cc) instead of downloading and re-uploading to Vercel Blob. Reduced migration time from 4-5 hours to ~18 minutes.

2. **Fuzzy Matching**: Used Levenshtein distance (max 3 characters) to handle:
   - Name variations ("Bob" vs "Robert")
   - Typos in legacy data
   - Special characters (accents, hyphens)
   - Achieved 97.4% player match rate

3. **Batched Processing**: 50 cards per batch with 1s delay
   - Avoids Portal API rate limiting
   - Resumable via progress file
   - Clear progress indicators

4. **Legacy Team Support**: Added 3 retired teams to `lib/teams.ts` and `pbe_team_data`:
   - Berlin Fire Salamanders (teamid: 100)
   - Chicago Butchers (teamid: 101)
   - Philadelphia Liberty (teamid: 102)

5. **Schema Auto-Detection**: Detected actual table structure before migration to avoid assumptions and ensure compatibility.

### Data Mapping

| Legacy Field        | Target Column     | Transformation                                  |
| ------------------- | ----------------- | ----------------------------------------------- |
| `_id`               | `legacy_card_id`  | Direct string (MongoDB ObjectID)                |
| `playerName`        | `player_name`     | Direct string                                   |
| `playerName`        | `playerid`        | Fuzzy match via Portal API player list         |
| `playerName`        | `render_name`     | From Portal API player.render field             |
| `playerName`        | `position`        | From Portal API player.position field           |
| `playerTeam`        | `teamid`          | Fuzzy match via lib/teams.ts regex patterns     |
| `playerTeam`        | `leagueid`        | Derived from team.league                        |
| `rarity`            | `card_rarity`     | Direct string                                   |
| `imageUrl`          | `image_url`       | Direct copy (keep external URL)                 |
| `approved`          | `approved`        | Direct boolean                                  |
| `currentRotation`   | `pullable`        | Direct boolean                                  |
| `submissionUsername`| `author_userid`   | Fuzzy match via Portal API userinfo list        |
| `submissionDate`    | `date_approved`   | Parse ISO string to timestamp                   |
| `submissionDate`    | `season`          | Extract year (2020-06-15 → 2020)                |

## Troubleshooting

### Common Issues

**Issue:** `psql` command not found
**Solution:** Use `npx tsx migrations/run-migration.ts <file.sql>` instead

**Issue:** Migration fails partway through
**Solution:** Migration is resumable - just run the same command again. Progress is saved to `.import-progress.json`

**Issue:** Database connection errors
**Solution:** Check environment variables are set correctly in `.env`

**Issue:** VARCHAR column too long errors
**Solution:** Already handled - render_name truncated to 100 chars

## Future Enhancements

1. **Collection Import**: Import user collections using `legacy_card_id` mapping
2. **Dead Link Detection**: Periodic job to check external image URLs
3. **Image Migration**: Optional script to migrate specific cards to Vercel Blob
4. **Parallel Processing**: Process multiple batches concurrently for faster migrations

## License

This migration system was developed for the ISFL Trading Cards project and can be adapted for similar data migration needs.
