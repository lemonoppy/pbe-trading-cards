-- PBE Trading Cards - Trade Details View
-- This view provides a denormalized view of trade data for easy querying
-- Created: 2026-01-13

CREATE OR REPLACE VIEW trade_details AS
SELECT
  t.tradeid,
  t.initiatorid,
  t.recipientid,
  t.trade_status,
  ta.ownedcardid,
  c.cardid,
  card.image_url,
  ta.toid,
  ta.fromid,
  t.create_date,
  t.update_date,
  card.card_rarity,
  card.sub_type
FROM pbe_trades AS t
INNER JOIN pbe_trade_assets AS ta ON t.tradeid = ta.tradeid
INNER JOIN pbe_collection AS c ON ta.ownedcardid = c.ownedcardid
INNER JOIN pbe_cards AS card ON c.cardid = card.cardid;

COMMENT ON VIEW trade_details IS 'Denormalized view of trade data joining trades, trade assets, collection, and card details';
