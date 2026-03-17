import { allTeamsMaps } from '@constants/teams-map'

const emptyTeamFlags = Object.fromEntries(
  Object.values(allTeamsMaps)
    .filter((t) => t.league === 'PBE' || t.league === 'MiLPBE')
    .map((t) => [t.abbreviation, false])
) as Record<string, boolean>

export function createPhotoshopCsv(
  cardRequests: CardRequest[]
): Photoshopcsv[] {
  return cardRequests.map((cardRequest) => {
    const [firstName, ...rest] = cardRequest.player_name.split(' ')
    const lastName = rest.join(' ')

    // Find team for PBE/MiLPBE leagues
    const team = Object.values(allTeamsMaps).find(
      (t) => t.teamid === cardRequest.teamid
    )
    const teamAbbr = team?.abbreviation
    const teamFlags = { ...emptyTeamFlags }
    if (teamAbbr) {
      teamFlags[teamAbbr] = true
    }

    // Determine position category
    const offensePositions = ['QB', 'RB', 'WR', 'TE', 'OL']
    const defensePositions = ['DE', 'DT', 'LB', 'CB', 'S']
    const specialPositions = ['K']

    const isOffense = offensePositions.includes(cardRequest.position)
    const isDefense = defensePositions.includes(cardRequest.position)
    const isSpecial = specialPositions.includes(cardRequest.position)

    const rarityFlags: Record<string, boolean> = {
      bronze: false,
      silver: false,
      gold: false,
      ruby: false,
      diamond: false,
    }

    const rarityKey = cardRequest.card_rarity.toLowerCase()
    if (rarityKey in rarityFlags) {
      rarityFlags[rarityKey] = true
    }

    return {
      firstName,
      lastName,
      render: cardRequest.renderName ?? null,
      position: cardRequest.position,
      offense: isOffense,
      defense: isDefense,
      special: isSpecial,
      ...teamFlags,
      season: cardRequest.season,
      ...rarityFlags,
    } as Photoshopcsv
  })
}
