import React from 'react'
import { query } from '@pages/api/database/query'
import { Team } from '@pages/api/v3'
import { GET } from '@constants/http-methods'
import axios from 'axios'

export const generateCardTooltipContent = (card: Card, teamData: Team[]) => {
  const teamInfo = teamData.find((t) => t.id === card.teamid)
  const renderInfo = card.render_name ? `\nRender: ${card.render_name}` : ''

  const basicInfo = `
${card.player_name}
Card Type: ${card.sub_type} | Rarity: ${card.card_rarity}
Position: ${card.position} | Season: ${card.season}
Team: ${teamInfo.name} (${teamInfo.abbreviation})${renderInfo}
  `.trim()

  return basicInfo
}

export const CardInfo = ({ card }: { card: Card }) => {
  const { payload: teamData, isLoading: teamDataIsLoading } = query<Team[]>({
    queryKey: ['teamData', String(card.leagueid)],
    queryFn: () =>
      axios({
        method: GET,
        url: `/api/v3/teams?league=${card.leagueid}`,
      }),
  })

  return (
    <div className="pt-2 w-full">
      {!teamDataIsLoading && (
        <pre className="whitespace-pre-wrap break-words font-mono mt-2">
          {generateCardTooltipContent(card, teamData)}
        </pre>
      )}
    </div>
  )
}
