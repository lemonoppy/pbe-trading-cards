-- Update pbe_pack_today view to support new pack types
-- Adds: throwback and event pack tracking

DROP VIEW IF EXISTS pbe_pack_today CASCADE;

CREATE VIEW pbe_pack_today AS
SELECT
  userid,
  COUNT(*) FILTER (WHERE packtype = 'base')::integer as base,
  COUNT(*) FILTER (WHERE packtype = 'ruby')::integer as ruby,
  COUNT(*) FILTER (WHERE packtype = 'throwback')::integer as throwback,
  COUNT(*) FILTER (WHERE packtype = 'event')::integer as event,
  CURRENT_DATE as date
FROM pbe_packs_owned
WHERE DATE(purchasedate) = CURRENT_DATE
GROUP BY userid;

COMMENT ON VIEW pbe_pack_today IS 'Auto-updating count of packs purchased today (base, ruby/ultimus, throwback, event) - resets daily at midnight';

-- Verify
SELECT * FROM pbe_pack_today LIMIT 5;
