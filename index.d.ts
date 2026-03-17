// data types
type Card = {
  cardid: number
  teamid: number
  playerid: number | null
  author_userid: number
  card_rarity: string
  sub_type: string
  player_name: string
  render_name?: string
  pullable: boolean
  event_pullable: boolean
  approved: boolean
  image_url?: string
  position: string
  season: number
  author_paid: boolean
  packid?: number
  quantity?: number
  totalCardQuantity?: number
  date_approved: string | null
  author_username: string | null
  total?: number
  leagueid?: number
}

type CardRequest = {
  teamid?: number
  playerid?: number
  card_rarity: string
  sub_type: string
  player_name: string
  position: string
  season: number
  renderName?: string
}

type CollectionCard = {
  cardid: number
  quantity: number
  image_url: string
  card_rarity: string
  player_name: string
  teamid: number
  playerid: number | null
  leagueid: number
}

type NewCard = {
  quantity: number
}

type SetCard = {
  cardid: number
  setid: number
}

type Collection = {
  userid: number
  cardid: number
  quantity: number
}

type CardSet = {
  setid: number
  name: string
  description: string
}

// Hockey-specific type - may not be needed for football
// type StartingLineup = {
//   userid: number
//   center: number
//   rightwing: number
//   leftwing: number
//   rightdefense: number
//   leftdefense: number
//   goalie: number
// }

type TradeStatus = 'COMPLETE' | 'PENDING' | 'DECLINED' | 'AUTO_DECLINED'

type Trade = {
  tradeid: number
  initiatorid: number
  initiatorUsername: string
  recipientid: number
  recipientUsername: string
  declineuserid: number
  trade_status: TradeStatus
  update_date: Date
  create_date: string
}

type TradeDetails = {
  tradeid: number
  initiatorid: number
  recipientid: number
  trade_status: TradeStatus
  ownedcardid: number
  cardid: number
  image_url: string
  toid: number
  fromid: number
  create_date: string
  update_date: Date
  card_rarity: string
  sub_type: string
  initiator_quantity: number
  recipient_quantity: number
}

type DuplicateCardsIntrades = {
  tradeid: number
  initiatorid: number
  recipientid: number
  cardid: number
}

type User = {
  uid: number
  username: string
  avatar?: string
  usergroup?: number
  additionalgroups?: string
  displaygroup?: number
  subscription?: number
}

type TradeUser = {
  username: string
  userid: number
}

type PackKey = 'base' | 'ruby'
type PackLabel = 'Base' | 'Ultimus'

type PackType = {
  key: PackKey
  label: PackLabel
  imageUrl: string
}

type UserPack = {
  packid: number
  userid: number
  packType: string
  purchaseDate: Date
}

// table types
type PlayerTableButtons = {
  id: PlayerTableButtonId
  text: string
  disabled: boolean
  onClick: Function
}
type PlayerTableButtonId = 'offense' | 'defense' | 'special'

type CollectionTableButtons = {
  id: string
  text: string
  onClick: Function
}

type ColumnData = {
  id: string
  Header: string
  accessor: string
  title: string
  sortDescFirst: boolean
}

type GridColumn = {
  accessor: string
}

type PackData = {
  packID: number
  userID: number
  packType: string
  opened: boolean
  purchaseDate: Date
  openDate: Date
  source: string
}

type MostCardsOwner = {
  userid: number
  sum: number
  uniqueCards: number
  username: string
  avatar?: string
}

type Donator = {
  uid: number
  subscription: number
}

type InternalUserUniqueCollection = {
  userid: number
  username: string
  card_rarity: string
  owned_count: number
  rarity_rank: number
}

type InternalSiteUniqueCards = {
  card_rarity: string
  total_count: number
}

type Photoshopcsv = {
  firstName: string
  lastName: string
  render: string | null
  position: string // QB, RB, WR, TE, OL, DE, DT, LB, CB, S, K
  // Position categories
  offense: boolean
  defense: boolean
  special: boolean
  // Team booleans (PBE teams)
  AMA: boolean
  ANC: boolean
  BCB: boolean
  CAL: boolean
  CHI: boolean
  FLA: boolean
  KCH: boolean
  LOU: boolean
  SCS: boolean
  // MiLPBE teams (TODO: populate when team abbreviations confirmed)
  season: number
  // Rarity booleans
  bronze: boolean
  silver: boolean
  gold: boolean
  ruby: boolean
  diamond: boolean
}
