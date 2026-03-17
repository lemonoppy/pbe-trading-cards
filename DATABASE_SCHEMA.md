# Database Schema Documentation

**Generated:** 2026-02-10
**Database:** PostgreSQL (Neon)
**Timezone:** Database timezone is GMT. Timestamps stored as `timestamp without time zone` are in UTC.

## Overview

This database powers the ISFL Dotts Trading Cards platform, managing:
- **Trading Cards** for ISFL, DSFL, and WFC players
- **User Collections** and card ownership
- **Pack System** for purchasing and opening card packs
- **Trading System** for peer-to-peer card exchanges
- **Binder System** for organizing card collections

---

## Tables

### `pbe_cards`
**Description:** Trading cards for ISFL, DSFL, and WFC

Primary card repository containing all card definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `cardid` | integer | NO | Auto-increment | Primary key |
| `teamid` | integer | NO | - | Team ID from portal/index |
| `playerid` | integer | YES | - | Player ID from portal (nullable for non-player cards) |
| `leagueid` | integer | NO | - | 0=ISFL, 1=DSFL, 2=WFC |
| `author_userid` | integer | YES | - | Card creator's user ID |
| `card_rarity` | varchar(50) | NO | - | Common, Uncommon, Rare, Mythic |
| `sub_type` | varchar(50) | YES | - | Base, Award, Charity, Hall of Fame, Unique, etc. |
| `player_name` | varchar(100) | NO | - | Player name displayed on card |
| `render_name` | varchar(100) | YES | - | Alternative render name |
| `position` | varchar(25) | NO | - | Player position (QB, RB, WR, etc.) |
| `season` | integer | NO | - | Season number |
| `pullable` | boolean | YES | true | Can be pulled from regular packs |
| `event_pullable` | boolean | NO | false | Can be pulled from event packs |
| `approved` | boolean | YES | false | Card approved by admin |
| `author_paid` | boolean | YES | false | Card author has been paid |
| `image_url` | text | YES | - | URL to card image |
| `date_approved` | timestamp | YES | - | When card was approved |
| `legacy_card_id` | varchar(24) | YES | - | ID from legacy system |

**Constraints:**
- PRIMARY KEY: `cardid`

**Rarity Distribution (Base Packs):**
- Common: 80% (8000/10000)
- Uncommon: 17% (1700/10000)
- Rare: 2.5% (250/10000)
- Mythic: 0.5% (50/10000)

**Rarity Distribution (Ruby/Ultimus Packs):**
- Common: 57% (5700/10000)
- Uncommon: 28.5% (2850/10000)
- Rare: 12.5% (1250/10000)
- Mythic: 2% (200/10000)

---

### `pbe_collection`
**Description:** User-owned cards (each row = one owned card instance)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `ownedcardid` | integer | NO | Auto-increment | Primary key (unique instance ID) |
| `userid` | integer | NO | - | Owner's user ID |
| `cardid` | integer | NO | - | Reference to pbe_cards |
| `packid` | integer | YES | - | Pack this card came from (null if admin-added) |

**Constraints:**
- PRIMARY KEY: `ownedcardid`
- FOREIGN KEY: `cardid` → `pbe_cards(cardid)` ON DELETE CASCADE

**Note:** Multiple rows can have the same `cardid` (representing duplicate cards owned by users).

---

### `pbe_packs_owned`
**Description:** Pack ownership and opening history

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `packid` | integer | NO | Auto-increment | Primary key |
| `userid` | integer | NO | - | Pack owner's user ID |
| `packtype` | varchar(50) | NO | - | base, ruby, throwback, event |
| `opened` | boolean | YES | false | Whether pack has been opened |
| `purchasedate` | timestamp | YES | CURRENT_TIMESTAMP | When pack was acquired (UTC) |
| `opendate` | timestamp | YES | - | When pack was opened |
| `source` | varchar(100) | YES | - | Pack Shop, admin_issued, subscription, etc. |

**Constraints:**
- PRIMARY KEY: `packid`

**Important:** `purchasedate` is stored as UTC timestamp without timezone info. Use `AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'` for EST conversions.

---

### `pbe_settings`
**Description:** User subscription settings for daily pack distributions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `userid` | integer | NO | - | Primary key |
| `subscription` | integer | YES | 0 | Base pack daily subscription (0-3) |
| `rubysubscription` | integer | YES | 0 | Ruby pack daily subscription (0-3) |
| `created_at` | timestamp | YES | CURRENT_TIMESTAMP | - |
| `updated_at` | timestamp | YES | CURRENT_TIMESTAMP | - |

**Constraints:**
- PRIMARY KEY: `userid`
- CHECK: `subscription >= 0 AND subscription <= 3`
- CHECK: `rubysubscription >= 0 AND rubysubscription <= 3`

---

### `pbe_binders`
**Description:** User-created binders for organizing collections

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `binderid` | integer | NO | Auto-increment | Primary key |
| `uid` | integer | NO | - | Binder owner's user ID |
| `binder_name` | varchar(100) | NO | - | Binder name |
| `binder_desc` | text | YES | - | Binder description |

**Constraints:**
- PRIMARY KEY: `binderid`

**Max Binders:** 5 per user (enforced in application logic)

---

### `pbe_binder_cards`
**Description:** Cards placed in binders with specific positions

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | integer | NO | Auto-increment | Primary key |
| `binderid` | integer | NO | - | Reference to binder |
| `ownedcardid` | integer | NO | - | Reference to owned card |
| `position` | integer | NO | - | Position in binder (1-100) |

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: `(binderid, position)` - no duplicate positions in same binder
- FOREIGN KEY: `binderid` → `pbe_binders(binderid)` ON DELETE CASCADE
- FOREIGN KEY: `ownedcardid` → `pbe_collection(ownedcardid)` ON DELETE CASCADE

---

### `pbe_trades`
**Description:** Card trade transactions between users

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `tradeid` | integer | NO | Auto-increment | Primary key |
| `initiatorid` | integer | NO | - | User who created the trade |
| `recipientid` | integer | NO | - | User receiving the trade offer |
| `trade_status` | enum | YES | PENDING | PENDING, COMPLETE, DECLINED, AUTO_DECLINED |
| `declineuserid` | integer | YES | - | User who declined (if declined) |
| `create_date` | timestamp | YES | CURRENT_TIMESTAMP | - |
| `update_date` | timestamp | YES | CURRENT_TIMESTAMP | - |

**Constraints:**
- PRIMARY KEY: `tradeid`

---

### `pbe_trade_assets`
**Description:** Individual cards involved in trades

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | integer | NO | Auto-increment | Primary key |
| `tradeid` | integer | NO | - | Reference to trade |
| `ownedcardid` | integer | NO | - | Card being traded |
| `toid` | integer | NO | - | User receiving this card |
| `fromid` | integer | NO | - | User giving this card |

**Constraints:**
- PRIMARY KEY: `id`
- FOREIGN KEY: `tradeid` → `pbe_trades(tradeid)` ON DELETE CASCADE
- FOREIGN KEY: `ownedcardid` → `pbe_collection(ownedcardid)` ON DELETE CASCADE

---

### `pbe_team_data`
**Description:** Team information for ISFL, DSFL, and WFC

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | integer | NO | Auto-increment | Primary key |
| `teamid` | integer | NO | - | Team ID |
| `leagueid` | integer | NO | - | 0=ISFL, 1=DSFL, 2=WFC |
| `season` | integer | NO | - | Season number |
| `name` | varchar(100) | NO | - | Team name |
| `nickname` | varchar(100) | YES | - | Team nickname |
| `abbreviation` | varchar(10) | NO | - | Team abbreviation |
| `location` | varchar(100) | YES | - | Team location |
| `colors` | jsonb | YES | - | Team colors (primary, secondary, text) |
| `conference` | varchar(50) | YES | - | Conference name |

**Constraints:**
- PRIMARY KEY: `id`
- UNIQUE: `(teamid, leagueid, season)` - one team entry per season

---

### `pbe_cards_backup_rarity`
**Description:** Backup table for card rarity changes (no constraints, used for migrations)

Contains same columns as `pbe_cards` but with all columns nullable and no constraints.

---

## Views

### `pbe_pack_today`
**Description:** Auto-updating count of packs purchased today (base, ruby/ultimus, throwback, event) - resets daily at midnight EST (America/New_York timezone). Assumes purchasedate is stored in UTC.

**Returns:**
- `userid` - User ID
- `base` - Count of base packs purchased today
- `ruby` - Count of ruby packs purchased today
- `throwback` - Count of throwback packs purchased today
- `event` - Count of event packs purchased today
- `date` - Current date in EST

**Definition:**
```sql
SELECT userid,
  COUNT(*) FILTER (WHERE packtype = 'base')::integer AS base,
  COUNT(*) FILTER (WHERE packtype = 'ruby')::integer AS ruby,
  COUNT(*) FILTER (WHERE packtype = 'throwback')::integer AS throwback,
  COUNT(*) FILTER (WHERE packtype = 'event')::integer AS event,
  (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date AS date
FROM pbe_packs_owned
WHERE DATE(purchasedate AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') =
      (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date
GROUP BY userid;
```

**Important:** Used to enforce daily pack purchase limits:
- Base packs: 3 per day
- Ruby packs: 1 per day
- Throwback packs: 1 per day
- Event packs: 1 per day

---

### `pbe_owned_cards`
**Description:** Aggregated view of user card collections (groups duplicates)

**Returns:**
- `ownedcardid` - First owned card ID (for reference)
- `userid` - User ID
- `cardid` - Card ID
- `packid` - First pack ID (for reference)
- `quantity` - Number of copies owned

**Definition:**
```sql
SELECT
  MIN(ownedcardid) AS ownedcardid,
  userid,
  cardid,
  MIN(packid) AS packid,
  COUNT(*)::integer AS quantity
FROM pbe_collection
GROUP BY userid, cardid;
```

---

### `trade_details`
**Description:** Denormalized view of trade data joining trades, trade assets, collection, and card details

**Returns:**
- `tradeid` - Trade ID
- `initiatorid` - Initiator user ID
- `recipientid` - Recipient user ID
- `trade_status` - Trade status
- `ownedcardid` - Owned card ID
- `cardid` - Card ID
- `image_url` - Card image URL
- `toid` - User receiving card
- `fromid` - User giving card
- `create_date` - Trade created
- `update_date` - Trade last updated
- `card_rarity` - Card rarity
- `sub_type` - Card sub-type

---

### `unique_cards`
**Description:** Count of unique cards by rarity (approved cards only)

**Returns:**
- `card_rarity` - Card rarity
- `total_count` - Number of unique cards

**Definition:**
```sql
SELECT
  card_rarity,
  COUNT(DISTINCT cardid)::integer AS total_count
FROM pbe_cards
WHERE approved = true AND card_rarity IS NOT NULL
GROUP BY card_rarity
ORDER BY (
  CASE card_rarity
    WHEN 'Common' THEN 1
    WHEN 'Uncommon' THEN 2
    WHEN 'Rare' THEN 3
    WHEN 'Mythic' THEN 4
    ELSE 5
  END
);
```

---

### `user_unique_cards`
**Description:** User rankings by unique cards owned per rarity

**Returns:**
- `userid` - User ID
- `card_rarity` - Card rarity
- `owned_count` - Number of unique cards owned
- `rarity_rank` - User's rank for this rarity (1 = most cards)

**Definition:**
```sql
WITH user_rarity_counts AS (
  SELECT
    oc.userid,
    cards.card_rarity,
    COUNT(DISTINCT oc.cardid)::integer AS owned_count
  FROM pbe_owned_cards oc
  JOIN pbe_cards cards ON oc.cardid = cards.cardid
  WHERE cards.approved = true AND cards.card_rarity IS NOT NULL
  GROUP BY oc.userid, cards.card_rarity
),
ranked_users AS (
  SELECT
    userid,
    card_rarity,
    owned_count,
    DENSE_RANK() OVER (PARTITION BY card_rarity ORDER BY owned_count DESC) AS rarity_rank
  FROM user_rarity_counts
)
SELECT userid, card_rarity, owned_count, rarity_rank
FROM ranked_users
ORDER BY (
  CASE card_rarity
    WHEN 'Common' THEN 1
    WHEN 'Uncommon' THEN 2
    WHEN 'Rare' THEN 3
    WHEN 'Mythic' THEN 4
    ELSE 5
  END
), rarity_rank;
```

---

## Important Notes

### Timezone Handling

⚠️ **Critical:** All `timestamp without time zone` columns store UTC timestamps, but PostgreSQL treats them as having no timezone info.

**To convert to EST:**
```sql
-- WRONG (assumes timestamp is already in EST):
purchasedate AT TIME ZONE 'America/New_York'

-- CORRECT (converts from UTC to EST):
purchasedate AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York'
```

**Affected columns:**
- `pbe_packs_owned.purchasedate` - UTC
- `pbe_packs_owned.opendate` - UTC
- `pbe_cards.date_approved` - UTC
- `pbe_trades.create_date` - UTC
- `pbe_trades.update_date` - UTC
- `pbe_settings.created_at` - UTC
- `pbe_settings.updated_at` - UTC

### Pack Limits

Daily pack purchase limits (resets midnight EST):
- **Base packs:** 3 per day
- **Ruby (Ultimus) packs:** 1 per day
- **Throwback packs:** 1 per day
- **Event packs:** 1 per day

Enforced via `pbe_pack_today` view.

### Card Rarity Values

Must match exactly (case-sensitive):
- `Common`
- `Uncommon`
- `Rare`
- `Mythic`

### Sub-Type Values

Common sub-types (not exhaustive):
- `Base` - Standard cards
- `Award` - Award winner cards
- `Charity` - Charity event cards
- `Hall of Fame` - HoF inductee cards (typically all Mythic)
- `Unique` - One-of-a-kind cards
- `Ultimus Champion` - Championship cards
- `Autograph Rookie` - Rookie autograph cards
- `Fantasy Kings` - Fantasy league cards
- `Captain` - Team captain cards
- `Holograph Expansion` - Special holographic cards
- `Insert` - Special insert cards
- `Team Logo` - Team logo cards

### League IDs

- `0` = ISFL (International Simulation Football League)
- `1` = DSFL (Developmental Simulation Football League)
- `2` = WFC (World Football Conference)

### Trade Status Values

- `PENDING` - Trade offer awaiting response
- `COMPLETE` - Trade completed
- `DECLINED` - Trade declined by recipient
- `AUTO_DECLINED` - Trade auto-declined (e.g., cards no longer available)

---

## Entity Relationships

```
pbe_cards (1) ──────< (N) pbe_collection
                              │
                              ├───< (N) pbe_binder_cards ──> (1) pbe_binders
                              │
                              └───< (N) pbe_trade_assets ──> (1) pbe_trades

pbe_packs_owned (1) ───< (N) pbe_collection (via packid)

pbe_settings (1:1 with users, managed externally via Portal API)

pbe_team_data (reference data, no FK relationships)
```

---

## External Dependencies

### Portal API
User data (usernames, avatars, permissions, bank balances) is managed by the **ISFL Portal API**, not this database:
- `/api/isfl/v1/userinfo` - User information
- `/api/isfl/v1/user/permissions` - User permissions
- `/api/isfl/v1/bank/header-info` - Bank balances
- `/api/isfl/v1/bank/transactions/external-create` - Create transactions

**Portal API Client:** `services/portalApiService.ts`

### User Permissions (from Portal)
- `DOTTS_ADMIN` (group 34) - Full admin access
- `DOTTS_TEAM` (group 30) - Card creator access
- `PORTAL_MANAGEMENT` (group 33) - Management access

---

## Quick Reference: Common Queries

### Get user's card collection with details
```sql
SELECT
  oc.ownedcardid,
  oc.quantity,
  c.*
FROM pbe_owned_cards oc
JOIN pbe_cards c ON oc.cardid = c.cardid
WHERE oc.userid = $1
ORDER BY c.card_rarity, c.player_name;
```

### Check user's pack limits for today
```sql
SELECT * FROM pbe_pack_today WHERE userid = $1;
```

### Get all unopened packs for a user
```sql
SELECT * FROM pbe_packs_owned
WHERE userid = $1 AND opened = false
ORDER BY purchasedate DESC;
```

### Get pending trades for a user
```sql
SELECT * FROM trade_details
WHERE (initiatorid = $1 OR recipientid = $1)
  AND trade_status = 'PENDING'
ORDER BY create_date DESC;
```

---

**Last Updated:** 2026-02-10
**Maintained By:** Development Team
**For Questions:** See README.md or contact repository maintainers
