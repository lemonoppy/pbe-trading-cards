// PBE Trading Cards - Teams Map
// Team data for PBE and MiLPBE leagues

export type TeamMap = {
  teamid: number
  label: string
  city: string
  team: string
  abbreviation: string
  league: 'PBE' | 'MiLPBE'
  conference: string
  colors?: {
    primary: string
    secondary: string
    text: string
  }
}

export const allTeamsMaps: Record<string, TeamMap> = {
  // ===================================
  // PBE TEAMS (main league, 9 teams)
  // ===================================

  '1': {
    teamid: 1,
    label: 'Amarillo Armadillos',
    city: 'Amarillo',
    team: 'Armadillos',
    abbreviation: 'AMA',
    league: 'PBE',
    conference: 'West',
    colors: {
      primary: '#8B4513',
      secondary: '#D2691E',
      text: '#FFFFFF',
    },
  },
  '2': {
    teamid: 2,
    label: 'Anchorage Wheelers',
    city: 'Anchorage',
    team: 'Wheelers',
    abbreviation: 'ANC',
    league: 'PBE',
    conference: 'West',
    colors: {
      primary: '#1C3A6B',
      secondary: '#FFFFFF',
      text: '#FFFFFF',
    },
  },
  '3': {
    teamid: 3,
    label: 'Brew City Bears',
    city: 'Brew City',
    team: 'Bears',
    abbreviation: 'BCB',
    league: 'PBE',
    conference: 'East',
    colors: {
      primary: '#4A2311',
      secondary: '#FFC107',
      text: '#FFFFFF',
    },
  },
  '4': {
    teamid: 4,
    label: 'California Firehawks',
    city: 'California',
    team: 'Firehawks',
    abbreviation: 'CAL',
    league: 'PBE',
    conference: 'West',
    colors: {
      primary: '#CC2200',
      secondary: '#FF8C00',
      text: '#FFFFFF',
    },
  },
  '5': {
    teamid: 5,
    label: 'Chicago Kingpins',
    city: 'Chicago',
    team: 'Kingpins',
    abbreviation: 'CHI',
    league: 'PBE',
    conference: 'East',
    colors: {
      primary: '#1B1B4B',
      secondary: '#C8A800',
      text: '#FFFFFF',
    },
  },
  '6': {
    teamid: 6,
    label: 'Florida Flamingos',
    city: 'Florida',
    team: 'Flamingos',
    abbreviation: 'FLA',
    league: 'PBE',
    conference: 'East',
    colors: {
      primary: '#FF69B4',
      secondary: '#FFFFFF',
      text: '#FFFFFF',
    },
  },
  '7': {
    teamid: 7,
    label: 'Kansas City Hepcats',
    city: 'Kansas City',
    team: 'Hepcats',
    abbreviation: 'KCH',
    league: 'PBE',
    conference: 'East',
    colors: {
      primary: '#003087',
      secondary: '#E31837',
      text: '#FFFFFF',
    },
  },
  '8': {
    teamid: 8,
    label: 'Louisville Lemurs',
    city: 'Louisville',
    team: 'Lemurs',
    abbreviation: 'LOU',
    league: 'PBE',
    conference: 'East',
    colors: {
      primary: '#FF6B00',
      secondary: '#FFFFFF',
      text: '#FFFFFF',
    },
  },
  '9': {
    teamid: 9,
    label: 'State College Swift Steeds',
    city: 'State College',
    team: 'Swift Steeds',
    abbreviation: 'SCS',
    league: 'PBE',
    conference: 'East',
    colors: {
      primary: '#1E4D2B',
      secondary: '#FFFFFF',
      text: '#FFFFFF',
    },
  },

  // ===================================
  // MiLPBE TEAMS (minor league)
  // TODO: Populate with actual MiLPBE team names when confirmed
  // ===================================
}

// Helper functions
export const getTeamByID = (teamID: number | string): TeamMap | undefined => {
  return allTeamsMaps[String(teamID)]
}

export const getTeamsByLeague = (league: 'PBE' | 'MiLPBE'): TeamMap[] => {
  return Object.values(allTeamsMaps).filter((team) => team.league === league)
}

export const getTeamsByConference = (conference: string): TeamMap[] => {
  return Object.values(allTeamsMaps).filter((team) => team.conference === conference)
}

export const getTeamByAbbreviation = (abbreviation: string): TeamMap | undefined => {
  return Object.values(allTeamsMaps).find((team) => team.abbreviation === abbreviation)
}

export default allTeamsMaps
