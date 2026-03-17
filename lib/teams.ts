// Team data for PBE and MiLPBE
// This is a temporary mock until the Portal API endpoints are created

export type Team = {
  location: string
  name: string
  abbreviation: string
  nameRegex: RegExp
  logoUrl: string
  league: 'PBE' | 'MiLPBE'
  conference: string
  colors: {
    primary: string
    secondary: string
    text: string
  }
  emoji: string
  id: number
  isLegacy?: boolean
  lastSeason?: number
}

const LeagueNames = ['PBE', 'MiLPBE']

export const Teams = Object.freeze({
  AMARILLO_ARMADILLOS: {
    location: 'Amarillo',
    name: 'Armadillos',
    abbreviation: 'AMA',
    nameRegex: /amarillo|ama|armadillos/i,
    logoUrl: '',
    league: 'PBE',
    conference: 'West',
    colors: {
      primary: '#8B4513',
      secondary: '#D2691E',
      text: '#FFFFFF',
    },
    emoji: '',
    id: 1,
  },
  ANCHORAGE_WHEELERS: {
    location: 'Anchorage',
    name: 'Wheelers',
    abbreviation: 'ANC',
    nameRegex: /anchorage|anc|wheelers/i,
    logoUrl: '',
    league: 'PBE',
    conference: 'West',
    colors: {
      primary: '#1C3A6B',
      secondary: '#FFFFFF',
      text: '#FFFFFF',
    },
    emoji: '',
    id: 2,
  },
  BREW_CITY_BEARS: {
    location: 'Brew City',
    name: 'Bears',
    abbreviation: 'BCB',
    nameRegex: /(brew city)|bcb|bears/i,
    logoUrl: '',
    league: 'PBE',
    conference: 'East',
    colors: {
      primary: '#4A2311',
      secondary: '#FFC107',
      text: '#FFFFFF',
    },
    emoji: '',
    id: 3,
  },
  CALIFORNIA_FIREHAWKS: {
    location: 'California',
    name: 'Firehawks',
    abbreviation: 'CAL',
    nameRegex: /california|cal|firehawks/i,
    logoUrl: '',
    league: 'PBE',
    conference: 'West',
    colors: {
      primary: '#CC2200',
      secondary: '#FF8C00',
      text: '#FFFFFF',
    },
    emoji: '',
    id: 4,
  },
  CHICAGO_KINGPINS: {
    location: 'Chicago',
    name: 'Kingpins',
    abbreviation: 'CHI',
    nameRegex: /chicago|chi|kingpins/i,
    logoUrl: '',
    league: 'PBE',
    conference: 'East',
    colors: {
      primary: '#1B1B4B',
      secondary: '#C8A800',
      text: '#FFFFFF',
    },
    emoji: '',
    id: 5,
  },
  FLORIDA_FLAMINGOS: {
    location: 'Florida',
    name: 'Flamingos',
    abbreviation: 'FLA',
    nameRegex: /florida|fla|flamingos/i,
    logoUrl: '',
    league: 'PBE',
    conference: 'East',
    colors: {
      primary: '#FF69B4',
      secondary: '#FFFFFF',
      text: '#FFFFFF',
    },
    emoji: '',
    id: 6,
  },
  KANSAS_CITY_HEPCATS: {
    location: 'Kansas City',
    name: 'Hepcats',
    abbreviation: 'KCH',
    nameRegex: /(kansas city)|kch|hepcats/i,
    logoUrl: '',
    league: 'PBE',
    conference: 'East',
    colors: {
      primary: '#003087',
      secondary: '#E31837',
      text: '#FFFFFF',
    },
    emoji: '',
    id: 7,
  },
  LOUISVILLE_LEMURS: {
    location: 'Louisville',
    name: 'Lemurs',
    abbreviation: 'LOU',
    nameRegex: /louisville|lou|lemurs/i,
    logoUrl: '',
    league: 'PBE',
    conference: 'East',
    colors: {
      primary: '#FF6B00',
      secondary: '#FFFFFF',
      text: '#FFFFFF',
    },
    emoji: '',
    id: 8,
  },
  STATE_COLLEGE_SWIFT_STEEDS: {
    location: 'State College',
    name: 'Swift Steeds',
    abbreviation: 'SCS',
    nameRegex: /(state college)|scs|(swift steeds)/i,
    logoUrl: '',
    league: 'PBE',
    conference: 'East',
    colors: {
      primary: '#1E4D2B',
      secondary: '#FFFFFF',
      text: '#FFFFFF',
    },
    emoji: '',
    id: 9,
  },
} satisfies Record<string, Team>)

// TODO: Add MiLPBE teams when team names are confirmed

export const AllTeams = Object.freeze({
  ...Teams,
})

export const findTeamByName = (
  teamName: string,
  leagueType: string | undefined = undefined
): Team | undefined => {
  if (!teamName) return undefined
  if (leagueType)
    return Object.values(AllTeams).find(
      (team) => team.nameRegex.test(teamName) && team.league === leagueType
    )

  return Object.values(AllTeams).find((team) => team.nameRegex.test(teamName))
}

export const findTeamsByLeague = (league: number) => {
  return Object.values(AllTeams).filter((team) => {
    if (team.league === LeagueNames[league]) return team
  })
}
