-- PBE Trading Cards - Cards Table Schema (PostgreSQL)
-- This table stores all trading cards for PBE and MiLPBE
-- Last updated: 2026-01-13 (schema detection verified)

CREATE TABLE IF NOT EXISTS pbe_cards (
  cardID SERIAL PRIMARY KEY,
  teamID INTEGER NOT NULL,
  playerID INTEGER DEFAULT NULL,
  leagueID INTEGER NOT NULL,
  author_userID INTEGER DEFAULT NULL,

  -- Card metadata
  card_rarity VARCHAR(50) NOT NULL,       -- Pack tier: Common, Uncommon, Rare, Mythic
  sub_type VARCHAR(50) DEFAULT NULL,      -- Card type: Base, Award, Captain, Hall of Fame, etc.
  player_name VARCHAR(100) NOT NULL,
  render_name VARCHAR(100) DEFAULT NULL,
  position VARCHAR(25) NOT NULL,

  -- Card lifecycle
  season INTEGER NOT NULL,
  pullable BOOLEAN DEFAULT true,
  approved BOOLEAN DEFAULT false,
  author_paid BOOLEAN DEFAULT false,
  image_url TEXT DEFAULT NULL,
  date_approved TIMESTAMP DEFAULT NULL,

  -- Legacy migration tracking
  legacy_card_id VARCHAR(24) DEFAULT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pbe_cards_teamID ON pbe_cards(teamID);
CREATE INDEX IF NOT EXISTS idx_pbe_cards_leagueID ON pbe_cards(leagueID);
CREATE INDEX IF NOT EXISTS idx_pbe_cards_playerID ON pbe_cards(playerID);
CREATE INDEX IF NOT EXISTS idx_pbe_cards_position ON pbe_cards(position);
CREATE INDEX IF NOT EXISTS idx_pbe_cards_card_rarity ON pbe_cards(card_rarity);
CREATE INDEX IF NOT EXISTS idx_pbe_cards_season ON pbe_cards(season);
CREATE INDEX IF NOT EXISTS idx_pbe_cards_pullable ON pbe_cards(pullable);
CREATE INDEX IF NOT EXISTS idx_pbe_cards_approved ON pbe_cards(approved);
CREATE INDEX IF NOT EXISTS idx_pbe_cards_legacy_card_id ON pbe_cards(legacy_card_id);
CREATE INDEX IF NOT EXISTS idx_pbe_cards_sub_type ON pbe_cards(sub_type);

-- Comments
COMMENT ON TABLE pbe_cards IS 'Trading cards for PBE and MiLPBE';
COMMENT ON COLUMN pbe_cards.playerID IS 'References player in Portal database (player.pid)';
COMMENT ON COLUMN pbe_cards.leagueID IS '0=PBE, 1=MiLPBE';
COMMENT ON COLUMN pbe_cards.author_userID IS 'User who created/submitted the card';
COMMENT ON COLUMN pbe_cards.card_rarity IS 'Pack pull tier: Common (65%), Uncommon (25%), Rare (8%), Mythic (2%)';
COMMENT ON COLUMN pbe_cards.sub_type IS 'Card descriptor: Base (regular), Award, Captain, Hall of Fame, Ultimus Champion, etc.';
COMMENT ON COLUMN pbe_cards.position IS 'Player position: C, 1B, 2B, 3B, SS, DH, LF, CF, RF, SP, RP, or X (logo cards)';
COMMENT ON COLUMN pbe_cards.pullable IS 'Can be pulled from packs (false for retired/legacy cards)';
COMMENT ON COLUMN pbe_cards.approved IS 'Admin approved for pack pulls';
COMMENT ON COLUMN pbe_cards.author_paid IS 'Card creator has been paid';
COMMENT ON COLUMN pbe_cards.legacy_card_id IS 'Original MongoDB ObjectID from legacy system for migration tracking';

-- Rarity System (as of 2026-01-13)
-- card_rarity values (pack tiers):
--   - Common: Most common cards (Base, Backup, Starter, Star, All-Pro, Legend consolidated)
--   - Uncommon: Less common cards
--   - Rare: Rare cards
--   - Mythic: Rarest cards
--
-- sub_type values (card descriptors):
--   - Base: Regular cards (all Common tier)
--   - Award, Charity, Holograph Expansion, Insert, Team Logo: Uncommon descriptors
--   - Autograph Rookie, Fantasy Kings, Captain, Least Valuable Player, Ultimus Champion: Rare descriptors
--   - Hall of Fame, Unique: Mythic descriptors
