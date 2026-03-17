-- Replace pbe_owned_cards table with an aggregating VIEW
-- This view automatically calculates card quantities from pbe_collection

-- Drop the empty table (CASCADE removes any dependent objects)
DROP TABLE IF EXISTS pbe_owned_cards CASCADE;

-- Create view that aggregates card ownership by user
CREATE VIEW pbe_owned_cards AS
SELECT
  MIN(ownedcardid) as ownedcardid,  -- Representative ID (lowest ownedcardid for this user/card combo)
  userid,
  cardid,
  MIN(packid) as packid,            -- First pack this card was pulled from
  COUNT(*)::integer as quantity     -- Number of times user pulled this card
FROM pbe_collection
GROUP BY userid, cardid;

-- Verify the view was created
DO $$
DECLARE
  view_exists BOOLEAN;
  row_count INTEGER;
BEGIN
  -- Check if view exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_name = 'pbe_owned_cards'
  ) INTO view_exists;

  IF view_exists THEN
    RAISE NOTICE '✅ pbe_owned_cards view created successfully';

    -- Check row count
    SELECT COUNT(*) INTO row_count FROM pbe_owned_cards;
    RAISE NOTICE '✅ View contains % unique card ownerships', row_count;
  ELSE
    RAISE EXCEPTION '❌ Failed to create pbe_owned_cards view';
  END IF;
END $$;
