export type Position = {
  label: string
  value: string
  category: 'infield' | 'outfield' | 'pitcher' | 'logo'
}

const positionMap = {
  // Infield
  c:  { label: 'Catcher',           value: 'C',  category: 'infield' as const },
  '1b': { label: 'First Base',      value: '1B', category: 'infield' as const },
  '2b': { label: 'Second Base',     value: '2B', category: 'infield' as const },
  '3b': { label: 'Third Base',      value: '3B', category: 'infield' as const },
  ss: { label: 'Shortstop',         value: 'SS', category: 'infield' as const },
  dh: { label: 'Designated Hitter', value: 'DH', category: 'infield' as const },

  // Outfield
  lf: { label: 'Left Field',        value: 'LF', category: 'outfield' as const },
  cf: { label: 'Center Field',      value: 'CF', category: 'outfield' as const },
  rf: { label: 'Right Field',       value: 'RF', category: 'outfield' as const },

  // Pitcher
  sp: { label: 'Starting Pitcher',  value: 'SP', category: 'pitcher' as const },
  rp: { label: 'Relief Pitcher',    value: 'RP', category: 'pitcher' as const },

  // Logo/Special
  logo: { label: 'Logo',            value: 'X',  category: 'logo' as const },
}

export default positionMap
