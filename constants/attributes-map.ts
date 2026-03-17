const attributesMap = {
  overall: {
    abbreviation: 'OVR',
    label: 'Overall',
    name: 'overall',
    positions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DE', 'DT', 'LB', 'CB', 'S', 'K'],
  },

  // Universal Attributes (all positions)
  speed: {
    abbreviation: 'SPD',
    label: 'Speed',
    name: 'speed',
    positions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DE', 'DT', 'LB', 'CB', 'S', 'K'],
  },
  strength: {
    abbreviation: 'STR',
    label: 'Strength',
    name: 'strength',
    positions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DE', 'DT', 'LB', 'CB', 'S', 'K'],
  },
  agility: {
    abbreviation: 'AGI',
    label: 'Agility',
    name: 'agility',
    positions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DE', 'DT', 'LB', 'CB', 'S', 'K'],
  },
  intelligence: {
    abbreviation: 'INT',
    label: 'Intelligence',
    name: 'intelligence',
    positions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DE', 'DT', 'LB', 'CB', 'S', 'K'],
  },
  endurance: {
    abbreviation: 'END',
    label: 'Endurance',
    name: 'endurance',
    positions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DE', 'DT', 'LB', 'CB', 'S', 'K'],
  },

  // QB-specific Attributes
  arm: {
    abbreviation: 'ARM',
    label: 'Arm Strength',
    name: 'arm',
    positions: ['QB'],
  },
  throwingAccuracy: {
    abbreviation: 'TAC',
    label: 'Throwing Accuracy',
    name: 'throwingAccuracy',
    positions: ['QB'],
  },

  // Skill Position Attributes (RB, WR, TE)
  hands: {
    abbreviation: 'HND',
    label: 'Hands',
    name: 'hands',
    positions: ['RB', 'WR', 'TE'],
  },

  // Offensive Line Attributes (OL, TE)
  passBlocking: {
    abbreviation: 'PBK',
    label: 'Pass Blocking',
    name: 'passBlocking',
    positions: ['OL', 'TE'],
  },
  runBlocking: {
    abbreviation: 'RBK',
    label: 'Run Blocking',
    name: 'runBlocking',
    positions: ['OL', 'TE'],
  },

  // Defensive Attributes
  tackling: {
    abbreviation: 'TAK',
    label: 'Tackling',
    name: 'tackling',
    positions: ['DE', 'DT', 'LB', 'CB', 'S'],
  },

  // Kicker Attributes
  kickPower: {
    abbreviation: 'KPW',
    label: 'Kick Power',
    name: 'kickPower',
    positions: ['K'],
  },
  kickAccuracy: {
    abbreviation: 'KAC',
    label: 'Kick Accuracy',
    name: 'kickAccuracy',
    positions: ['K'],
  },
}

export default attributesMap
