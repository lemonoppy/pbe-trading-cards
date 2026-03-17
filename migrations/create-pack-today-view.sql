-- Replace pbe_pack_today table with an auto-updating VIEW
-- This view automatically counts packs purchased today and resets daily

-- Drop the existing table (it was never being updated anyway)
DROP TABLE IF EXISTS pbe_pack_today CASCADE;

-- Create view that counts packs purchased today by type
CREATE VIEW pbe_pack_today AS
SELECT
  userid,
  COUNT(*) FILTER (WHERE packtype = 'base')::integer as base,
  COUNT(*) FILTER (WHERE packtype = 'ruby')::integer as ruby,
  CURRENT_DATE as date
FROM pbe_packs_owned
WHERE DATE(purchasedate) = CURRENT_DATE
GROUP BY userid;

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
    WHERE table_name = 'pbe_pack_today'
  ) INTO view_exists;

  IF view_exists THEN
    RAISE NOTICE '✅ pbe_pack_today view created successfully';

    -- Check row count
    SELECT COUNT(*) INTO row_count FROM pbe_pack_today;
    RAISE NOTICE '✅ View shows % users who bought packs today', row_count;
  ELSE
    RAISE EXCEPTION '❌ Failed to create pbe_pack_today view';
  END IF;
END $$;

-- Example query to test the view
COMMENT ON VIEW pbe_pack_today IS 'Auto-updating count of packs purchased today per user - resets daily at midnight';
