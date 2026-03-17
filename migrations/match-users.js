const fs = require('fs');
const path = require('path');

// Read the files
const usersJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'feb9-users.json'), 'utf8'));
const csvData = fs.readFileSync(path.join(__dirname, 'portal-users.csv'), 'utf8');

// Parse CSV
const csvLines = csvData.split('\n');
const portalUsers = csvLines
  .filter(line => line.trim())
  .map(line => {
    // Handle CSV parsing - format is uid,username,email
    const parts = line.split(',');
    if (parts.length >= 3) {
      return {
        uid: parts[0].trim(),
        username: parts[1].trim(),
        email: parts[2].trim().toLowerCase()
      };
    }
    return null;
  })
  .filter(Boolean);

// Create email to username map from portal CSV
const emailToPortalUser = new Map();
const usernameToPortalUser = new Map();
portalUsers.forEach(user => {
  emailToPortalUser.set(user.email, user.username);
  usernameToPortalUser.set(user.username.toLowerCase(), user.username);
});

// Match users
const matches = [];
const unmatched = [];

usersJson.accounts.forEach(account => {
  const email = account.email?.toLowerCase();
  const isflUsername = account.isflUsername;

  let portalUsername = null;
  let matchType = 'no_match';

  // Try to match by email first
  if (email && emailToPortalUser.has(email)) {
    portalUsername = emailToPortalUser.get(email);
    matchType = 'email';
  }
  // Try to match by username (case insensitive)
  else if (isflUsername && usernameToPortalUser.has(isflUsername.toLowerCase())) {
    portalUsername = usernameToPortalUser.get(isflUsername.toLowerCase());
    matchType = 'username';
  }

  const result = {
    mongodb_id: account._id,
    dotts_email: account.email || '',
    dotts_username: account.isflUsername || '',
    portal_username: portalUsername || '',
    match_type: matchType,
    num_cards: account.numberOfOwnedCards || 0,
    regular_packs: account.ownedRegularPacks || 0,
    ultimus_packs: account.ownedUltimusPacks || 0,
    is_subscribed: account.isSubscribed || false,
    is_admin: account.isAdmin || false
  };

  if (portalUsername) {
    matches.push(result);
  } else {
    unmatched.push(result);
  }
});

// Sort: matched first, then by number of cards descending
const allResults = [...matches, ...unmatched].sort((a, b) => {
  if (a.portal_username && !b.portal_username) return -1;
  if (!a.portal_username && b.portal_username) return 1;
  return b.num_cards - a.num_cards;
});

// Generate TSV
const headers = [
  'mongodb_id',
  'dotts_email',
  'dotts_username',
  'portal_username',
  'match_type',
  'num_cards',
  'regular_packs',
  'ultimus_packs',
  'is_subscribed',
  'is_admin'
];

const tsvLines = [headers.join('\t')];
allResults.forEach(row => {
  const line = headers.map(header => {
    const value = row[header];
    // Convert to string and escape tabs/newlines
    return String(value).replace(/\t/g, ' ').replace(/\n/g, ' ');
  }).join('\t');
  tsvLines.push(line);
});

const tsv = tsvLines.join('\n');

// Write to file
fs.writeFileSync(path.join(__dirname, 'user-matches.tsv'), tsv, 'utf8');

// Print summary
console.log('\n=== MATCHING SUMMARY ===');
console.log(`Total users in MongoDB: ${usersJson.accounts.length}`);
console.log(`Total users in Portal CSV: ${portalUsers.length}`);
console.log(`Matched by email: ${matches.filter(m => m.match_type === 'email').length}`);
console.log(`Matched by username: ${matches.filter(m => m.match_type === 'username').length}`);
console.log(`Unmatched: ${unmatched.length}`);
console.log(`\nTSV file created: migrations/user-matches.tsv`);
console.log(`\nTop 10 unmatched users by card count:`);
unmatched.slice(0, 10).forEach(u => {
  console.log(`  ${u.dotts_username || u.dotts_email} - ${u.num_cards} cards`);
});
