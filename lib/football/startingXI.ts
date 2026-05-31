// Hardcoded starting XIs for top clubs — slotId → playerId mappings
// Formation order matches FORMATIONS presets in formations.ts

export const STARTING_XI: Record<string, Record<string, string>> = {
  barcelona: {
    GK: 'ter-stegen',
    RB: 'kounde', RCB: 'cubarsi', LCB: 'inigo-martinez', LB: 'balde',
    RCM: 'dani-olmo', CM: 'pedri', LCM: 'gavi',
    RW: 'yamal', ST: 'lewandowski', LW: 'ferran-torres',
  },
  real_madrid: {
    GK: 'courtois',
    RB: 'carvajal', RCB: 'militao', LCB: 'rudiger', LB: 'mendy',
    RM: 'valverde', RCM: 'tchouameni', LCM: 'bellingham', LM: 'camavinga',
    RST: 'vinicius', LST: 'mbappe',
  },
  man_city: {
    GK: 'ederson',
    RB: 'walker', RCB: 'ruben-dias', LCB: 'akanji', LB: 'gvardiol',
    RCM: 'bernardo-silva', CM: 'rodri', LCM: 'kevin-de-bruyne',
    RW: 'doku', ST: 'haaland', LW: 'foden',
  },
  liverpool: {
    GK: 'alisson',
    RB: 'trent', RCB: 'konate', LCB: 'van-dijk', LB: 'robertson',
    RCM: 'jones', CM: 'mac-allister', LCM: 'szoboszlai',
    RW: 'salah', ST: 'nunez', LW: 'diaz',
  },
  arsenal: {
    GK: 'raya',
    RB: 'ben-white', RCB: 'saliba', LCB: 'magalhaes', LB: 'zinchenko',
    RCM: 'odegaard', CM: 'partey', LCM: 'rice',
    RW: 'saka', ST: 'havertz', LW: 'trossard',
  },
  chelsea: {
    GK: 'sanchez-chelsea',
    RB: 'reece-james', RCB: 'colwill', LCB: 'disasi', LB: 'cucurella',
    RCM: 'palmer', CM: 'caicedo', LCM: 'enzo',
    RW: 'madueke', ST: 'jackson', LW: 'mudryk',
  },
  psg: {
    GK: 'donnarumma',
    RB: 'hakimi', RCB: 'marquinhos', LCB: 'pacho', LB: 'hernandez-psg',
    RCM: 'vitinha', CM: 'ruiz', LCM: 'neves',
    RW: 'doue', ST: 'barcola', LW: 'kvaratskhelia',
  },
  bayern: {
    GK: 'neuer',
    RB: 'kimmich', RCB: 'upamecano', LCB: 'dier', LB: 'davies',
    RCM: 'muller', CM: 'goretzka', LCM: 'sane',
    RW: 'gnabry', ST: 'kane', LW: 'musiala',
  },
};
