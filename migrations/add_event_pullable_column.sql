-- Add event_pullable column to control which cards can appear in event packs
--
-- This column enables:
-- 1. Separate control over event pack card availability vs regular packs
-- 2. Cards can be pullable in regular packs but excluded from event packs
-- 3. Special event-themed cards can be marked for event pack distribution
--
-- Default: false (cards must be explicitly enabled for event packs)

-- Add the column if it doesn't exist
ALTER TABLE pbe_cards
  ADD COLUMN IF NOT EXISTS event_pullable BOOLEAN DEFAULT false NOT NULL;

-- Add index for efficient filtering during event pack opening
CREATE INDEX IF NOT EXISTS idx_pbe_cards_event_pullable
  ON pbe_cards(event_pullable, card_rarity)
  WHERE event_pullable = true AND approved = true;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN pbe_cards.event_pullable IS
  'Controls whether this card can appear in event packs. Cards must have both pullable=true and event_pullable=true to be included in event pack distributions. Defaults to false.';

-- Verify the column was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pbe_cards'
      AND column_name = 'event_pullable'
  ) THEN
    RAISE NOTICE '✅ event_pullable column successfully added to pbe_cards table';
  ELSE
    RAISE EXCEPTION '❌ Failed to add event_pullable column';
  END IF;
END $$;
