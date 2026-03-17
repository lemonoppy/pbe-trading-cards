-- Create views for unique card collections
-- These views support the collection sets feature

-- View 1: Total count of each rarity across all cards
CREATE OR REPLACE VIEW unique_cards AS
SELECT
  card_rarity,
  COUNT(DISTINCT cardid)::integer as total_count
FROM pbe_cards
WHERE approved = true
  AND card_rarity IS NOT NULL
  AND (sub_type IS NULL OR sub_type != 'Unique')
GROUP BY card_rarity
ORDER BY
  CASE card_rarity
    WHEN 'Common' THEN 1
    WHEN 'Uncommon' THEN 2
    WHEN 'Rare' THEN 3
    WHEN 'Mythic' THEN 4
    ELSE 5
  END;

-- View 2: User's unique card ownership by rarity with global ranking
CREATE OR REPLACE VIEW user_unique_cards AS
WITH user_rarity_counts AS (
  SELECT
    oc.userid,
    cards.card_rarity,
    COUNT(DISTINCT oc.cardid)::integer as owned_count
  FROM pbe_owned_cards oc
  JOIN pbe_cards cards ON oc.cardid = cards.cardid
  WHERE cards.approved = true
    AND cards.card_rarity IS NOT NULL
    AND (cards.sub_type IS NULL OR cards.sub_type != 'Unique')
  GROUP BY oc.userid, cards.card_rarity
),
ranked_users AS (
  SELECT
    userid,
    card_rarity,
    owned_count,
    DENSE_RANK() OVER (PARTITION BY card_rarity ORDER BY owned_count DESC) as rarity_rank
  FROM user_rarity_counts
)
SELECT
  r.userid,
  r.card_rarity,
  r.owned_count,
  r.rarity_rank
FROM ranked_users r
ORDER BY
  CASE r.card_rarity
    WHEN 'Common' THEN 1
    WHEN 'Uncommon' THEN 2
    WHEN 'Rare' THEN 3
    WHEN 'Mythic' THEN 4
    ELSE 5
  END,
  r.rarity_rank;

-- Verify the views were created
DO $$
DECLARE
  view1_exists BOOLEAN;
  view2_exists BOOLEAN;
  unique_cards_count INTEGER;
  user_unique_cards_count INTEGER;
BEGIN
  -- Check if unique_cards view exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_name = 'unique_cards'
  ) INTO view1_exists;

  -- Check if user_unique_cards view exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_name = 'user_unique_cards'
  ) INTO view2_exists;

  IF view1_exists THEN
    SELECT COUNT(*) INTO unique_cards_count FROM unique_cards;
    RAISE NOTICE '✅ unique_cards view created successfully with % rarities', unique_cards_count;
  ELSE
    RAISE EXCEPTION '❌ Failed to create unique_cards view';
  END IF;

  IF view2_exists THEN
    SELECT COUNT(*) INTO user_unique_cards_count FROM user_unique_cards;
    RAISE NOTICE '✅ user_unique_cards view created successfully with % entries', user_unique_cards_count;
  ELSE
    RAISE EXCEPTION '❌ Failed to create user_unique_cards view';
  END IF;
END $$;
