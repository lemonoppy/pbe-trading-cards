-- Add legacy/retired teams to pbe_team_data for historical card support
-- These teams no longer exist in the league but appear in historical card data

-- Berlin Fire Salamanders (legacy)
INSERT INTO pbe_team_data (teamid, leagueid, name, abbreviation, location, conference, season, nickname, colors)
VALUES (
  100,
  0,
  'Fire Salamanders',
  'BFS',
  'Berlin',
  'NSFC',
  30,  -- Last active season (approximate)
  'Fire Salamanders',
  '{"primary": "#FF4500", "secondary": "#000000", "text": "#FFFFFF"}'::jsonb
)
ON CONFLICT (teamid, leagueid, season) DO NOTHING;

-- Chicago Butchers (legacy)
INSERT INTO pbe_team_data (teamid, leagueid, name, abbreviation, location, conference, season, nickname, colors)
VALUES (
  101,
  0,
  'Butchers',
  'CHI',
  'Chicago',
  'NSFC',
  30,  -- Last active season (approximate)
  'Butchers',
  '{"primary": "#8B0000", "secondary": "#FFD700", "text": "#FFFFFF"}'::jsonb
)
ON CONFLICT (teamid, leagueid, season) DO NOTHING;

-- Philadelphia Liberty (legacy)
INSERT INTO pbe_team_data (teamid, leagueid, name, abbreviation, location, conference, season, nickname, colors)
VALUES (
  102,
  0,
  'Liberty',
  'PHI',
  'Philadelphia',
  'ASFC',
  30,  -- Last active season (approximate)
  'Liberty',
  '{"primary": "#002868", "secondary": "#BF0A30", "text": "#FFFFFF"}'::jsonb
)
ON CONFLICT (teamid, leagueid, season) DO NOTHING;

-- Verify the teams were added
DO $$
DECLARE
  added_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO added_count
  FROM pbe_team_data
  WHERE teamid IN (100, 101, 102) AND leagueid = 0;

  IF added_count = 3 THEN
    RAISE NOTICE '✅ Successfully added 3 legacy teams to pbe_team_data';
  ELSE
    RAISE NOTICE 'ℹ️  Added % legacy team(s) (some may have already existed)', added_count;
  END IF;
END $$;
