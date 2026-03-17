-- PBE Trading Cards - Team Data Table (PostgreSQL)
-- Stores team information for PBE and MiLPBE

CREATE TABLE IF NOT EXISTS pbe_team_data (
  id SERIAL PRIMARY KEY,
  teamID INTEGER NOT NULL,
  LeagueID INTEGER NOT NULL,
  season INTEGER NOT NULL,
  Name VARCHAR(100) NOT NULL,
  Nickname VARCHAR(100) DEFAULT NULL,
  abbreviation VARCHAR(10) NOT NULL,
  location VARCHAR(100) DEFAULT NULL,
  colors JSONB DEFAULT NULL,
  conference VARCHAR(50) DEFAULT NULL,

  CONSTRAINT unique_team_league_season UNIQUE (teamID, LeagueID, season)
);

CREATE INDEX IF NOT EXISTS idx_pbe_team_data_LeagueID ON pbe_team_data(LeagueID);
CREATE INDEX IF NOT EXISTS idx_pbe_team_data_season ON pbe_team_data(season);
CREATE INDEX IF NOT EXISTS idx_pbe_team_data_abbreviation ON pbe_team_data(abbreviation);

COMMENT ON TABLE pbe_team_data IS 'Team information for PBE and MiLPBE';
COMMENT ON COLUMN pbe_team_data.LeagueID IS '0=PBE, 1=MiLPBE';
COMMENT ON COLUMN pbe_team_data.Name IS 'Full team name';
COMMENT ON COLUMN pbe_team_data.colors IS 'JSON: {primary, secondary, text}';
COMMENT ON COLUMN pbe_team_data.conference IS 'East, West, etc.';

-- Populate PBE Teams (LeagueID = 0)
INSERT INTO pbe_team_data (teamID, LeagueID, season, Name, Nickname, abbreviation, location, conference, colors) VALUES
(1, 0, 1, 'Amarillo Armadillos',       'Armadillos',   'AMA', 'Amarillo',     'West', '{"primary": "#8B4513", "secondary": "#D2691E", "text": "#FFFFFF"}'::jsonb),
(2, 0, 1, 'Anchorage Wheelers',         'Wheelers',     'ANC', 'Anchorage',    'West', '{"primary": "#1C3A6B", "secondary": "#FFFFFF", "text": "#FFFFFF"}'::jsonb),
(3, 0, 1, 'Brew City Bears',            'Bears',        'BCB', 'Brew City',    'East', '{"primary": "#4A2311", "secondary": "#FFC107", "text": "#FFFFFF"}'::jsonb),
(4, 0, 1, 'California Firehawks',       'Firehawks',    'CAL', 'California',   'West', '{"primary": "#CC2200", "secondary": "#FF8C00", "text": "#FFFFFF"}'::jsonb),
(5, 0, 1, 'Chicago Kingpins',           'Kingpins',     'CHI', 'Chicago',      'East', '{"primary": "#1B1B4B", "secondary": "#C8A800", "text": "#FFFFFF"}'::jsonb),
(6, 0, 1, 'Florida Flamingos',          'Flamingos',    'FLA', 'Florida',      'East', '{"primary": "#FF69B4", "secondary": "#FFFFFF", "text": "#FFFFFF"}'::jsonb),
(7, 0, 1, 'Kansas City Hepcats',        'Hepcats',      'KCH', 'Kansas City',  'East', '{"primary": "#003087", "secondary": "#E31837", "text": "#FFFFFF"}'::jsonb),
(8, 0, 1, 'Louisville Lemurs',          'Lemurs',       'LOU', 'Louisville',   'East', '{"primary": "#FF6B00", "secondary": "#FFFFFF", "text": "#FFFFFF"}'::jsonb),
(9, 0, 1, 'State College Swift Steeds', 'Swift Steeds', 'SCS', 'State College','East', '{"primary": "#1E4D2B", "secondary": "#FFFFFF", "text": "#FFFFFF"}'::jsonb)
ON CONFLICT (teamID, LeagueID, season) DO NOTHING;

-- TODO: Populate MiLPBE Teams (LeagueID = 1) when team names are confirmed

-- Note: Colors are placeholders — update when official team colors are confirmed
-- Season is set to 1 — update for current season as needed
