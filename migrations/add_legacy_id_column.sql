-- Add legacy_card_id column to track MongoDB ObjectIDs from the old trading card system
--
-- This column enables:
-- 1. Mapping legacy cards imported from all_cards.json to new system
-- 2. Future user collection imports using legacy ID references
-- 3. Auditing and data reconciliation between old and new systems

-- Add the column if it doesn't exist
ALTER TABLE pbe_cards
  ADD COLUMN IF NOT EXISTS legacy_card_id VARCHAR(24) DEFAULT NULL;

-- Add index for efficient lookups during collection imports
CREATE INDEX IF NOT EXISTS idx_pbe_cards_legacy_card_id
  ON pbe_cards(legacy_card_id);

-- Add comment explaining the column's purpose
COMMENT ON COLUMN pbe_cards.legacy_card_id IS
  'Original MongoDB ObjectID (_id) from legacy trading card system. Used for data migration and mapping user collections. Format: 24 hexadecimal characters.';

-- Verify the column was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pbe_cards'
      AND column_name = 'legacy_card_id'
  ) THEN
    RAISE NOTICE '✅ legacy_card_id column successfully added to pbe_cards table';
  ELSE
    RAISE EXCEPTION '❌ Failed to add legacy_card_id column';
  END IF;
END $$;
