-- Migration: Remove all stat columns from pbe_cards
-- Date: 2024-12-21
-- Reason: PBE Trading Cards doesn't use stat attributes - card creators add them manually to images

-- Remove all hockey/football stat columns
ALTER TABLE pbe_cards
  DROP COLUMN IF EXISTS overall,
  DROP COLUMN IF EXISTS skating,
  DROP COLUMN IF EXISTS shooting,
  DROP COLUMN IF EXISTS hands,
  DROP COLUMN IF EXISTS checking,
  DROP COLUMN IF EXISTS defense,
  DROP COLUMN IF EXISTS high_shots,
  DROP COLUMN IF EXISTS low_shots,
  DROP COLUMN IF EXISTS quickness,
  DROP COLUMN IF EXISTS control,
  DROP COLUMN IF EXISTS conditioning,
  DROP COLUMN IF EXISTS speed,
  DROP COLUMN IF EXISTS strength,
  DROP COLUMN IF EXISTS agility,
  DROP COLUMN IF EXISTS intelligence,
  DROP COLUMN IF EXISTS endurance,
  DROP COLUMN IF EXISTS arm,
  DROP COLUMN IF EXISTS throwingAccuracy,
  DROP COLUMN IF EXISTS passBlocking,
  DROP COLUMN IF EXISTS runBlocking,
  DROP COLUMN IF EXISTS tackling,
  DROP COLUMN IF EXISTS kickPower,
  DROP COLUMN IF EXISTS kickAccuracy;

-- Verify the table structure after migration
-- Run this to see the remaining columns:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pbe_cards' ORDER BY ordinal_position;
