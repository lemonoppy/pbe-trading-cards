export const userGroups = {
  PBE_COMMISSIONER: 25,
  MILPBE_COMMISSIONER: 12,
  PBE_HO: 26,
  MILPBE_HO: 8,
  PBE_INTERN: 9,
  MILPBE_INTERN: 8,
  HEAD_UPDATER: -1, // TODO: Set when head updater group is created
  UPDATER: 21,
  PBE_GM: 27,
  MILPBE_GM: 16,
  PORTAL_MANAGEMENT: 33,
  ROOKIE_MENTOR: 20,
  BANKER: 23,
  PT_GRADER: 22,
  PLAYER_PROGRESSION_TEAM: 19,
  DOTTS_ADMIN: 34, // Dotts admin team (formerly DOTTS_TEAM)
  DOTTS_TEAM: 30, // Dotts card creators
} as const

export const generateIndexLink = (
  playerID: number,
  leagueID: string | number,
  withPortalMode?: string
) => {
  const league = LEAGUE_OPTIONS.find(
    (l) => l.value === String(leagueID)
  ).label.toLowerCase()

  return `https://index.pbe.simflow.io/${league}/player/${playerID}${
    withPortalMode ? `?portalView=${withPortalMode}` : ''
  }`
}

export const LEAGUE_OPTIONS = [
  { value: '0', label: 'PBE' },
  { value: '1', label: 'MiLPBE' },
]

// Default league filter values
export const DEFAULT_LEAGUE_ALL = ['0', '1'] // All leagues
export const DEFAULT_LEAGUE_PBE = ['0'] // PBE only

export type RoleGroup = (keyof Readonly<typeof userGroups>)[]

export const CAN_RUN_SCRIPTS: RoleGroup = ['DOTTS_ADMIN', 'PORTAL_MANAGEMENT']
export const CAN_ISSUE_PACKS: RoleGroup = ['DOTTS_ADMIN', 'PORTAL_MANAGEMENT']
export const CAN_EDIT_DONATIONS: RoleGroup = ['DOTTS_ADMIN', 'PORTAL_MANAGEMENT']
export const CAN_VIEW_ALL_CARDS: RoleGroup = [
  'DOTTS_ADMIN',
  'DOTTS_TEAM',
  'PORTAL_MANAGEMENT',
]
export const CAN_SUBMIT_CARD_REQUESTS: RoleGroup = ['DOTTS_ADMIN', 'PORTAL_MANAGEMENT']
export const CAN_CLAIM_CARDS: RoleGroup = [
  'DOTTS_ADMIN',
  'DOTTS_TEAM',
  'PORTAL_MANAGEMENT',
]
export const CAN_EDIT_CARDS: RoleGroup = ['DOTTS_ADMIN', 'PORTAL_MANAGEMENT']
export const CAN_SUBMIT_CARDS: RoleGroup = [
  'DOTTS_ADMIN',
  'DOTTS_TEAM',
  'PORTAL_MANAGEMENT',
]
export const CAN_PROCESS_CARDS: RoleGroup = ['DOTTS_ADMIN', 'PORTAL_MANAGEMENT']
export const LEAGUE_LINK_MAP = ['PBE', 'MiLPBE']

export const BINDER_CONSTANTS = {
  ROWS_PER_PAGE: 10,
  TOTAL_POSITIONS: 100,
  MAX_BINDERS: 5,
} as const
