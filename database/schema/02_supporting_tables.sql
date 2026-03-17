-- PBE Trading Cards - Supporting Tables Schema (PostgreSQL)
-- These tables support the card trading system
-- Note: These tables are card-agnostic and require no changes from SHL version

-- User-owned cards (collection)
CREATE TABLE IF NOT EXISTS pbe_collection (
  ownedCardID SERIAL PRIMARY KEY,
  userID INTEGER NOT NULL,
  cardID INTEGER NOT NULL,
  packID INTEGER DEFAULT NULL,

  CONSTRAINT fk_pbe_collection_cardID FOREIGN KEY (cardID) REFERENCES pbe_cards(cardID) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pbe_collection_userID ON pbe_collection(userID);
CREATE INDEX IF NOT EXISTS idx_pbe_collection_cardID ON pbe_collection(cardID);
CREATE INDEX IF NOT EXISTS idx_pbe_collection_packID ON pbe_collection(packID);

COMMENT ON COLUMN pbe_collection.packID IS 'Pack this card came from';

-- Aggregated view of user card ownership (with quantities)
-- This VIEW automatically calculates how many of each card a user owns
-- Source data: pbe_collection (one row per individual card pull)
-- Last updated: 2026-01-13
CREATE OR REPLACE VIEW pbe_owned_cards AS
SELECT
  MIN(ownedcardid) as ownedcardid,  -- Representative ID (lowest for this user/card combo)
  userid,
  cardid,
  MIN(packid) as packid,            -- First pack this card was pulled from
  COUNT(*)::integer as quantity     -- Total number of times user pulled this card
FROM pbe_collection
GROUP BY userid, cardid;

COMMENT ON VIEW pbe_owned_cards IS 'Aggregated card ownership with quantities - auto-updates from pbe_collection';

-- Packs owned by users
CREATE TABLE IF NOT EXISTS pbe_packs_owned (
  packID SERIAL PRIMARY KEY,
  userID INTEGER NOT NULL,
  packType VARCHAR(50) NOT NULL,
  opened BOOLEAN DEFAULT false,
  purchaseDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  openDate TIMESTAMP DEFAULT NULL,
  source VARCHAR(100) DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_pbe_packs_owned_userID ON pbe_packs_owned(userID);
CREATE INDEX IF NOT EXISTS idx_pbe_packs_owned_packType ON pbe_packs_owned(packType);
CREATE INDEX IF NOT EXISTS idx_pbe_packs_owned_opened ON pbe_packs_owned(opened);

COMMENT ON COLUMN pbe_packs_owned.packType IS 'base, ruby, etc.';
COMMENT ON COLUMN pbe_packs_owned.source IS 'Where pack came from';

-- Daily pack purchase tracking (VIEW - auto-updates and resets daily)
-- Last updated: 2026-03-04
CREATE OR REPLACE VIEW pbe_pack_today AS
SELECT
  userid,
  COUNT(*) FILTER (WHERE packtype = 'base')::integer as base,
  COUNT(*) FILTER (WHERE packtype = 'ruby')::integer as ruby,
  COUNT(*) FILTER (WHERE packtype = 'throwback')::integer as throwback,
  COUNT(*) FILTER (WHERE packtype = 'event')::integer as event,
  CURRENT_DATE as date
FROM pbe_packs_owned
WHERE DATE(purchasedate) = CURRENT_DATE
  AND source != 'free_pack'
GROUP BY userid;

COMMENT ON VIEW pbe_pack_today IS 'Auto-updating count of packs purchased today - automatically resets at midnight. Excludes free_pack source. Columns: base (3/day), ruby/ultimus (1/day), throwback (1/day), event (1/day)';

-- Create custom type for trade status
DO $$ BEGIN
  CREATE TYPE trade_status_enum AS ENUM ('PENDING', 'COMPLETE', 'DECLINED', 'AUTO_DECLINED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Trades between users
CREATE TABLE IF NOT EXISTS pbe_trades (
  tradeID SERIAL PRIMARY KEY,
  initiatorID INTEGER NOT NULL,
  recipientID INTEGER NOT NULL,
  trade_status trade_status_enum DEFAULT 'PENDING',
  declineUserID INTEGER DEFAULT NULL,
  create_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pbe_trades_initiatorID ON pbe_trades(initiatorID);
CREATE INDEX IF NOT EXISTS idx_pbe_trades_recipientID ON pbe_trades(recipientID);
CREATE INDEX IF NOT EXISTS idx_pbe_trades_trade_status ON pbe_trades(trade_status);

COMMENT ON COLUMN pbe_trades.initiatorID IS 'User who initiated trade';
COMMENT ON COLUMN pbe_trades.recipientID IS 'User receiving trade offer';
COMMENT ON COLUMN pbe_trades.declineUserID IS 'User who declined (if applicable)';

-- Trigger to auto-update update_date on trades table
CREATE OR REPLACE FUNCTION update_pbe_trades_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.update_date = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pbe_trades_timestamp ON pbe_trades;
CREATE TRIGGER trigger_update_pbe_trades_timestamp
BEFORE UPDATE ON pbe_trades
FOR EACH ROW
EXECUTE FUNCTION update_pbe_trades_timestamp();

-- Cards in trades
CREATE TABLE IF NOT EXISTS pbe_trade_assets (
  id SERIAL PRIMARY KEY,
  tradeID INTEGER NOT NULL,
  ownedCardID INTEGER NOT NULL,
  toID INTEGER NOT NULL,
  fromID INTEGER NOT NULL,

  CONSTRAINT fk_pbe_trade_assets_tradeID FOREIGN KEY (tradeID) REFERENCES pbe_trades(tradeID) ON DELETE CASCADE,
  CONSTRAINT fk_pbe_trade_assets_ownedCardID FOREIGN KEY (ownedCardID) REFERENCES pbe_collection(ownedCardID) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pbe_trade_assets_tradeID ON pbe_trade_assets(tradeID);
CREATE INDEX IF NOT EXISTS idx_pbe_trade_assets_ownedCardID ON pbe_trade_assets(ownedCardID);

COMMENT ON COLUMN pbe_trade_assets.toID IS 'User receiving this card';
COMMENT ON COLUMN pbe_trade_assets.fromID IS 'User giving this card';

-- User card binders/collections
CREATE TABLE IF NOT EXISTS pbe_binders (
  binderID SERIAL PRIMARY KEY,
  uid INTEGER NOT NULL,
  binder_name VARCHAR(100) NOT NULL,
  binder_desc TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_pbe_binders_uid ON pbe_binders(uid);

COMMENT ON COLUMN pbe_binders.uid IS 'User ID (owner)';

-- Cards in binders
CREATE TABLE IF NOT EXISTS pbe_binder_cards (
  id SERIAL PRIMARY KEY,
  binderID INTEGER NOT NULL,
  ownedCardID INTEGER NOT NULL,
  position INTEGER NOT NULL,

  CONSTRAINT unique_binder_position UNIQUE (binderID, position),
  CONSTRAINT fk_pbe_binder_cards_binderID FOREIGN KEY (binderID) REFERENCES pbe_binders(binderID) ON DELETE CASCADE,
  CONSTRAINT fk_pbe_binder_cards_ownedCardID FOREIGN KEY (ownedCardID) REFERENCES pbe_collection(ownedCardID) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pbe_binder_cards_binderID ON pbe_binder_cards(binderID);
CREATE INDEX IF NOT EXISTS idx_pbe_binder_cards_ownedCardID ON pbe_binder_cards(ownedCardID);

COMMENT ON COLUMN pbe_binder_cards.position IS 'Position in binder (1-75)';


-- Settings Helper
CREATE TABLE IF NOT EXISTS pbe_settings (
                                              userID INTEGER PRIMARY KEY,
                                              subscription INTEGER DEFAULT 0 CHECK (subscription >= 0 AND subscription <= 3),
                                              rubySubscription INTEGER DEFAULT 0 CHECK (rubySubscription >= 0 AND rubySubscription <= 3),
                                              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settings_userid ON pbe_settings(userID);

-- Pack configuration (availability, daily limits, subscription distribution, pricing)
CREATE TABLE IF NOT EXISTS pbe_pack_config (
  packtype             VARCHAR(50) PRIMARY KEY,
  enabled              BOOLEAN NOT NULL DEFAULT true,
  daily_limit          INTEGER NOT NULL DEFAULT 1,
  subscription_enabled BOOLEAN NOT NULL DEFAULT false,
  price                INTEGER NOT NULL DEFAULT 100000,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO pbe_pack_config (packtype, enabled, daily_limit, subscription_enabled, price) VALUES
  ('base',      true,  3, true,  100000),
  ('ruby',      true,  1, true,  250000),
  ('throwback', false, 1, false, 1000000),
  ('event',     false, 1, false, 1000000)
ON CONFLICT (packtype) DO NOTHING;
