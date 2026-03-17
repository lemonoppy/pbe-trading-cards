-- PBE Trading Cards - Trade Stored Procedures (PostgreSQL)
-- These procedures handle trade creation and asset management

-- Function to create a new trade
-- Returns a table with the created trade information
CREATE OR REPLACE FUNCTION create_trade(
  p_initiatorid INTEGER,
  p_recipientid INTEGER
)
RETURNS TABLE(
  tradeid INTEGER,
  initiatorid INTEGER,
  recipientid INTEGER,
  trade_status trade_status_enum,
  declineuserid INTEGER,
  create_date TIMESTAMP,
  update_date TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO pbe_trades (initiatorid, recipientid, trade_status)
  VALUES (p_initiatorid, p_recipientid, 'PENDING')
  RETURNING
    pbe_trades.tradeid,
    pbe_trades.initiatorid,
    pbe_trades.recipientid,
    pbe_trades.trade_status,
    pbe_trades.declineuserid,
    pbe_trades.create_date,
    pbe_trades.update_date;
END;
$$;

-- Function to add a trade asset
-- Returns void since we don't need the result
CREATE OR REPLACE FUNCTION add_trade_asset(
  p_tradeid INTEGER,
  p_ownedcardid INTEGER,
  p_toid INTEGER,
  p_fromid INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO pbe_trade_assets (tradeid, ownedcardid, toid, fromid)
  VALUES (p_tradeid, p_ownedcardid, p_toid, p_fromid);
END;
$$;
