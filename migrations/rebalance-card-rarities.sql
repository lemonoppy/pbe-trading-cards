-- Rebalance card rarities
-- Move Captain and Ultimus Champion from Rare to Uncommon to fix rarity distribution

-- Before:
-- Common: 2,883 (Base)
-- Uncommon: 762 (Award, Charity, Insert, etc.)
-- Rare: 1,966 (Captain, Ultimus Champion, Autograph Rookie, etc.)
-- Mythic: 219 (Hall of Fame, Unique)

-- After:
-- Common: 2,883 (Base)
-- Uncommon: 2,221 (Award, Charity, Insert, Captain, Ultimus Champion)
-- Rare: 507 (Autograph Rookie, Least Valuable Player, Fantasy Kings)
-- Mythic: 219 (Hall of Fame, Unique)

BEGIN;

-- Update Captain cards from Rare to Uncommon
UPDATE pbe_cards
SET card_rarity = 'Uncommon'
WHERE sub_type = 'Captain'
  AND card_rarity = 'Rare';

-- Update Ultimus Champion cards from Rare to Uncommon
UPDATE pbe_cards
SET card_rarity = 'Uncommon'
WHERE sub_type = 'Ultimus Champion'
  AND card_rarity = 'Rare';

COMMIT;

-- Verify the changes
DO $$
DECLARE
  common_count INTEGER;
  uncommon_count INTEGER;
  rare_count INTEGER;
  mythic_count INTEGER;
  captain_updated INTEGER;
  ultimus_updated INTEGER;
BEGIN
  -- Count cards by rarity
  SELECT COUNT(*) INTO common_count FROM pbe_cards WHERE card_rarity = 'Common' AND approved = true;
  SELECT COUNT(*) INTO uncommon_count FROM pbe_cards WHERE card_rarity = 'Uncommon' AND approved = true;
  SELECT COUNT(*) INTO rare_count FROM pbe_cards WHERE card_rarity = 'Rare' AND approved = true;
  SELECT COUNT(*) INTO mythic_count FROM pbe_cards WHERE card_rarity = 'Mythic' AND approved = true;

  -- Count updated cards
  SELECT COUNT(*) INTO captain_updated FROM pbe_cards WHERE sub_type = 'Captain' AND card_rarity = 'Uncommon';
  SELECT COUNT(*) INTO ultimus_updated FROM pbe_cards WHERE sub_type = 'Ultimus Champion' AND card_rarity = 'Uncommon';

  RAISE NOTICE '✅ Rarity rebalancing complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'New distribution:';
  RAISE NOTICE '  Common: % cards', common_count;
  RAISE NOTICE '  Uncommon: % cards (includes % Captain + % Ultimus Champion)', uncommon_count, captain_updated, ultimus_updated;
  RAISE NOTICE '  Rare: % cards', rare_count;
  RAISE NOTICE '  Mythic: % cards', mythic_count;
END $$;
