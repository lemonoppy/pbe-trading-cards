import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Database connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  ssl: { rejectUnauthorized: false }, // Needed for Neon
});

// Manual overrides for unmatched users
const MANUAL_OVERRIDES: Record<string, number> = {
  'andrewrralph@gmail.com': 399,      // Bayleyisland - 6,490 cards
  'wyldzephyr@gmail.com': 2589,       // HasumiKi - 1,710 cards
  'bigjoereed@icloud.com': 3172,      // Joseph Reed - 120 cards
};

interface DataDumpAccount {
  _id: string;
  email?: string;
  isflUsername?: string;
  ownedCards?: string[];
  ownedRegularPacks?: number;
  ownedUltimusPacks?: number;
}

interface DataDump {
  accounts: DataDumpAccount[];
}

interface UserMatch {
  mongodb_id: string;
  pbe_email: string;
  pbe_username: string;
  portal_username: string;
  match_type: string;
}

interface LegacyCardMap {
  [legacy_card_id: string]: number; // maps to cardID
}

interface ImportStats {
  usersProcessed: number;
  cardsInserted: number;
  basePacksGranted: number;
  rubyPacksGranted: number;
  unmatchedCards: Set<string>;
  unmatchedUsers: Set<string>;
  errors: string[];
}

const stats: ImportStats = {
  usersProcessed: 0,
  cardsInserted: 0,
  basePacksGranted: 0,
  rubyPacksGranted: 0,
  unmatchedCards: new Set(),
  unmatchedUsers: new Set(),
  errors: [],
};

const logFile = path.join(__dirname, 'import-legacy-collections.log');
let logStream: fs.WriteStream;

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  if (logStream) {
    logStream.write(logMessage + '\n');
  }
}

async function loadDataDump(): Promise<DataDump> {
  log('Loading feb9-users.json...');
  const filePath = path.join(__dirname, 'feb9-users.json');
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

async function loadPortalUsers(): Promise<Map<string, number>> {
  log('Loading portal-users.csv...');
  const filePath = path.join(__dirname, 'portal-users.csv');
  const data = fs.readFileSync(filePath, 'utf8');
  const lines = data.split('\n');

  const usernameMap = new Map<string, number>();
  for (const line of lines) {
    if (!line.trim()) continue;
    const [uidStr, username, email] = line.split(',');
    const uid = parseInt(uidStr);
    if (uid && username) {
      // Store lowercase username for case-insensitive matching
      usernameMap.set(username.toLowerCase(), uid);
    }
  }

  log(`Loaded ${usernameMap.size} portal users`);
  return usernameMap;
}

async function loadUserMatches(): Promise<Map<string, UserMatch>> {
  log('Loading user-matches.tsv...');
  const filePath = path.join(__dirname, 'user-matches.tsv');
  const data = fs.readFileSync(filePath, 'utf8');
  const lines = data.split('\n').slice(1); // Skip header

  const matches = new Map<string, UserMatch>();
  for (const line of lines) {
    if (!line.trim()) continue;
    const [mongodb_id, pbe_email, pbe_username, portal_username, match_type] = line.split('\t');
    if (mongodb_id && portal_username) {
      matches.set(mongodb_id, {
        mongodb_id,
        pbe_email,
        pbe_username,
        portal_username,
        match_type,
      });
    }
  }

  log(`Loaded ${matches.size} user matches`);
  return matches;
}

async function buildLegacyCardMap(): Promise<LegacyCardMap> {
  log('Building legacy card ID map...');
  const result = await pool.query(
    'SELECT cardid, legacy_card_id FROM pbe_cards WHERE legacy_card_id IS NOT NULL'
  );

  const map: LegacyCardMap = {};
  for (const row of result.rows) {
    map[row.legacy_card_id] = row.cardid;
  }

  log(`Mapped ${Object.keys(map).length} legacy cards`);
  return map;
}

async function checkAlreadyImported(): Promise<boolean> {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM pbe_collection WHERE packid = -1'
  );
  const count = parseInt(result.rows[0].count);
  if (count > 0) {
    log(`WARNING: Found ${count} existing rows with packID = -1. Import may have already run.`);
    return true;
  }
  return false;
}

async function importUserCollection(
  account: DataDumpAccount,
  portalUserID: number,
  legacyCardMap: LegacyCardMap
) {
  const ownedCards = account.ownedCards || [];

  if (ownedCards.length === 0) {
    return;
  }

  // Prepare batch insert for cards
  const cardInserts: Array<{ userID: number; cardID: number; packID: number }> = [];

  for (const legacyCardID of ownedCards) {
    const cardID = legacyCardMap[legacyCardID];
    if (!cardID) {
      stats.unmatchedCards.add(legacyCardID);
      continue;
    }

    cardInserts.push({
      userID: portalUserID,
      cardID: cardID,
      packID: -1,
    });
  }

  // Batch insert cards in chunks of 1000
  const BATCH_SIZE = 1000;
  for (let i = 0; i < cardInserts.length; i += BATCH_SIZE) {
    const batch = cardInserts.slice(i, i + BATCH_SIZE);
    const values = batch.map((_, idx) => {
      const base = idx * 3;
      return `($${base + 1}, $${base + 2}, $${base + 3})`;
    }).join(', ');

    const params = batch.flatMap(c => [c.userID, c.cardID, c.packID]);

    await pool.query(
      `INSERT INTO pbe_collection (userid, cardid, packid) VALUES ${values}`,
      params
    );
  }

  stats.cardsInserted += cardInserts.length;
  log(`  Imported ${cardInserts.length} cards for user ${portalUserID}`);
}

async function grantPacks(
  account: DataDumpAccount,
  portalUserID: number
) {
  const basePacks = account.ownedRegularPacks || 0;
  const rubyPacks = account.ownedUltimusPacks || 0;

  if (basePacks === 0 && rubyPacks === 0) {
    return;
  }

  // Insert base packs
  if (basePacks > 0) {
    const values = Array.from({ length: basePacks }, (_, idx) =>
      `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`
    ).join(', ');

    const params = Array.from({ length: basePacks }, () => [portalUserID, 'base', 'Dotts Transfer']).flat();

    await pool.query(
      `INSERT INTO pbe_packs_owned (userid, packtype, source) VALUES ${values}`,
      params
    );

    stats.basePacksGranted += basePacks;
  }

  // Insert ruby packs
  if (rubyPacks > 0) {
    const values = Array.from({ length: rubyPacks }, (_, idx) =>
      `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3})`
    ).join(', ');

    const params = Array.from({ length: rubyPacks }, () => [portalUserID, 'ruby', 'Dotts Transfer']).flat();

    await pool.query(
      `INSERT INTO pbe_packs_owned (userid, packtype, source) VALUES ${values}`,
      params
    );

    stats.rubyPacksGranted += rubyPacks;
  }

  log(`  Granted ${basePacks} base packs and ${rubyPacks} ruby packs for user ${portalUserID}`);
}

async function main() {
  logStream = fs.createWriteStream(logFile, { flags: 'a' });

  log('='.repeat(80));
  log('Starting legacy collection import');
  log('='.repeat(80));

  try {
    // Check if already imported
    const alreadyImported = await checkAlreadyImported();
    if (alreadyImported) {
      log('Continuing anyway... (set a flag to abort if needed)');
    }

    // Load data
    const dataDump = await loadDataDump();
    const userMatches = await loadUserMatches();
    const portalUsers = await loadPortalUsers();
    const legacyCardMap = await buildLegacyCardMap();

    log(`Total accounts in data dump: ${dataDump.accounts.length}`);

    // Process each account
    for (const account of dataDump.accounts) {
      const mongoID = account._id;
      const email = account.email?.toLowerCase();

      // Check manual overrides first
      let portalUserID: number | null = null;
      if (email && MANUAL_OVERRIDES[email]) {
        portalUserID = MANUAL_OVERRIDES[email];
        log(`Using manual override for ${email} -> UID ${portalUserID}`);
      } else {
        // Try to find in user matches
        const match = userMatches.get(mongoID);
        if (match && match.portal_username) {
          // Look up portal UID from CSV
          portalUserID = portalUsers.get(match.portal_username.toLowerCase()) || null;
        }
      }

      if (!portalUserID) {
        stats.unmatchedUsers.add(account.isflUsername || account.email || mongoID);
        log(`  Skipping unmatched user: ${account.isflUsername || account.email || mongoID}`);
        continue;
      }

      try {
        await importUserCollection(account, portalUserID, legacyCardMap);
        await grantPacks(account, portalUserID);
        stats.usersProcessed++;
      } catch (error) {
        const errorMsg = `Error processing user ${portalUserID}: ${error.message}`;
        stats.errors.push(errorMsg);
        log(`  ERROR: ${errorMsg}`);
      }
    }

    // Print summary
    log('='.repeat(80));
    log('Import Complete - Summary:');
    log(`  Users processed: ${stats.usersProcessed}`);
    log(`  Cards inserted: ${stats.cardsInserted}`);
    log(`  Base packs granted: ${stats.basePacksGranted}`);
    log(`  Ruby packs granted: ${stats.rubyPacksGranted}`);
    log(`  Unmatched cards: ${stats.unmatchedCards.size}`);
    log(`  Unmatched users: ${stats.unmatchedUsers.size}`);
    log(`  Errors: ${stats.errors.length}`);

    if (stats.unmatchedCards.size > 0) {
      log('\nUnmatched legacy card IDs (sample):');
      Array.from(stats.unmatchedCards).slice(0, 10).forEach(id => log(`  ${id}`));
    }

    if (stats.unmatchedUsers.size > 0) {
      log('\nUnmatched users:');
      Array.from(stats.unmatchedUsers).forEach(user => log(`  ${user}`));
    }

    if (stats.errors.length > 0) {
      log('\nErrors encountered:');
      stats.errors.forEach(err => log(`  ${err}`));
    }

    log('='.repeat(80));

  } catch (error) {
    log(`FATAL ERROR: ${error.message}`);
    log(error.stack);
    process.exit(1);
  } finally {
    logStream.end();
    await pool.end();
  }
}

main();
