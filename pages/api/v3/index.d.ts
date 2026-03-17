export type ApiResponse<T> =
  | {
      status: 'success'
      payload: T
      message?: null
    }
  | {
      status: 'error' | 'logout'
      payload?: null
      message: string
    }

export type ListTotal = {
  total: number
  totalOwned?: number
}

export type ListResponse<T> = {
  rows: T[]
  total: number
  totalOwned?: number
}

export type CardMakerInfo = {
  userid: number
  username: string
  date_approved: string
}

export type UserMostCards = {
  userid: number
  uniqueCards: number
  totalCards: number
  username: string
  avatar: string
}

export type UserUniqueCollection = {
  userid: number
  username?: string
  card_rarity: string
  owned_count: number
  rarity_rank: number
}

export type SiteUniqueCards = {
  card_rarity: string
  total_count: number
}

export type UserCollection = {
  ownedcardid: number
  userid: number
  username?: string
  cardid: number
  packid: number
  imageurl?: number
  total?: number
}

export type UserPacks = {
  packid: number
  userid: number
  packtype: string
  opened: boolean
  purchasedate: string
  opendate: string
  source?: string
}

export type Rarities = {
  card_rarity: string
}

export type SubType = {
  sub_type: string
}

export type LatestCards = {
  ownedcardid: number
  userid: number
  cardid: number
  packid: number
  player_name: string
  playerid: number
  leagueid: number
  card_rarity: string
  image_url: string
}

export type UserMostCards = {
  userid: number
  uniqueCards: number
  totalCards: number
  username: string
  avatar: string
}

export type binders = {
  binderid: number
  userid: number
  username: string
  binder_name: string
  binder_desc: string
}

export type binderCards = {
  binderid: number
  ownedcardid: number
  position: number
  cardid: number
  userid?: number
  player_name: string
  teamid: number
  playerid: number
  card_rarity: string
  image_url: string
  season: number
  leagueid: number
}

export type Team = {
  id: number
  league: number
  name: string
  abbreviation: string
  location: string
  colors: { primary: string; secondary: string; text: string }
  nameRegex?: RegExp
  logoUrl?: string
  conference?: string
  emoji?: string
  isLegacy?: boolean
  lastSeason?: number
}

export type SortDirection = 'ASC' | 'DESC'
