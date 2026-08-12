// Curated 100-brand outreach shortlist for Diez (Warzone / FPS creator).
// Prioritised by fit: Tier A = direct Warzone/FPS + proven creator activations,
// Tier B = strong adjacent fit, Tier C = opportunistic / seasonal.
// `region` = the market whose partnerships/creator team Diez should target (UK/US focus).
// Domains are used to build role inboxes (partnerships@domain, etc.).

export interface SeedBrand {
  name: string;
  domain: string;
  category: string;
  tier: 'A' | 'B' | 'C';
  region: string;
  fit: string;
}

export const SEED_BRANDS: SeedBrand[] = [
  // ── FPS games & publishers (the core — Warzone competitors & new launches) ──
  { name: 'Call of Duty (Activision)', domain: 'activision.com', category: 'FPS Games', tier: 'A', region: 'US', fit: 'Warzone is Diez\'s core game — publisher creator program is the #1 target.' },
  { name: 'Battlefield (EA)', domain: 'ea.com', category: 'FPS Games', tier: 'A', region: 'US', fit: 'Direct Warzone rival; new Battlefield launch needs FPS creators for reach.' },
  { name: 'Apex Legends (Respawn/EA)', domain: 'respawn.com', category: 'FPS Games', tier: 'A', region: 'US', fit: 'Battle-royale FPS with heavy creator marketing; same audience as Warzone.' },
  { name: 'XDefiant / Ubisoft', domain: 'ubisoft.com', category: 'FPS Games', tier: 'A', region: 'US', fit: 'Ubisoft runs large FPS creator activations (R6, XDefiant) — direct fit.' },
  { name: 'Rainbow Six Siege (Ubisoft)', domain: 'ubisoft.com', category: 'FPS Games', tier: 'B', region: 'US', fit: 'Tactical FPS with an active creator ecosystem and seasonal drops.' },
  { name: 'Valorant (Riot Games)', domain: 'riotgames.com', category: 'FPS Games', tier: 'A', region: 'US', fit: 'Riot invests hugely in FPS creators; crossover Warzone/tac-shooter audience.' },
  { name: 'Counter-Strike 2 (Valve)', domain: 'valvesoftware.com', category: 'FPS Games', tier: 'B', region: 'US', fit: 'Biggest tac-shooter; skins/economy angle overlaps Diez\'s audience.' },
  { name: 'The Finals (Embark Studios)', domain: 'embark-studios.com', category: 'FPS Games', tier: 'A', region: 'EU', fit: 'Fast-rising FPS actively seeding creators; hungry for Warzone-style talent.' },
  { name: 'ARC Raiders (Embark)', domain: 'embark-studios.com', category: 'FPS Games', tier: 'B', region: 'EU', fit: 'High-profile extraction shooter launch — creator marketing budget.' },
  { name: 'Delta Force (Garena/TiMi)', domain: 'garena.com', category: 'FPS Games', tier: 'A', region: 'US', fit: 'New F2P military shooter directly courting Warzone creators for launch.' },
  { name: 'Marvel Rivals (NetEase)', domain: 'neteasegames.com', category: 'FPS Games', tier: 'B', region: 'US', fit: 'Hero shooter with a big paid-creator push; broad gamer reach.' },
  { name: 'Escape from Tarkov (Battlestate)', domain: 'battlestategames.com', category: 'FPS Games', tier: 'B', region: 'EU', fit: 'Hardcore FPS; overlapping loadout/meta content style.' },
  { name: 'Gray Zone Warfare (MADFINGER)', domain: 'madfingergames.com', category: 'FPS Games', tier: 'C', region: 'EU', fit: 'Milsim extraction shooter — niche but creator-driven growth.' },
  { name: 'Arena Breakout: Infinite (Level Infinite)', domain: 'levelinfinite.com', category: 'FPS Games', tier: 'B', region: 'US', fit: 'Tencent-backed extraction FPS with heavy influencer spend.' },
  { name: 'Overwatch 2 (Blizzard)', domain: 'blizzard.com', category: 'FPS Games', tier: 'B', region: 'US', fit: 'Blizzard hero shooter; same Activision-Blizzard umbrella as CoD.' },
  { name: 'Destiny 2 (Bungie)', domain: 'bungie.net', category: 'FPS Games', tier: 'C', region: 'US', fit: 'Looter-shooter with loyal creator base; adjacent FPS audience.' },
  { name: 'Halo (343/Xbox Game Studios)', domain: 'halowaypoint.com', category: 'FPS Games', tier: 'C', region: 'US', fit: 'Iconic FPS franchise; seasonal creator activations.' },
  { name: 'Splitgate 2 (1047 Games)', domain: '1047games.com', category: 'FPS Games', tier: 'C', region: 'US', fit: 'Arena FPS relaunch leaning hard on creators.' },
  { name: 'Off The Grid (Gunzilla)', domain: 'gunzillagames.com', category: 'FPS Games', tier: 'C', region: 'EU', fit: 'AAA battle-royale launch with a creator/web3 budget.' },
  { name: 'Hunt: Showdown (Crytek)', domain: 'crytek.com', category: 'FPS Games', tier: 'C', region: 'EU', fit: 'Atmospheric PvPvE shooter; niche but engaged.' },

  // ── Mobile FPS / mobile games ──
  { name: 'Call of Duty: Mobile (Activision)', domain: 'callofduty.com', category: 'Mobile Games', tier: 'A', region: 'US', fit: 'Same franchise on mobile — natural cross-promo for a CoD creator.' },
  { name: 'PUBG Mobile (Krafton)', domain: 'krafton.com', category: 'Mobile Games', tier: 'A', region: 'US', fit: 'Massive mobile BR budget; Diez already worked with PUBG.' },
  { name: 'Warzone Mobile (Activision)', domain: 'callofduty.com', category: 'Mobile Games', tier: 'A', region: 'US', fit: 'Direct mobile extension of Diez\'s core game.' },
  { name: 'Garena Free Fire', domain: 'ff.garena.com', category: 'Mobile Games', tier: 'B', region: 'US', fit: 'One of the biggest mobile BRs with large creator programs.' },
  { name: 'Blood Strike (NetEase)', domain: 'bloodstrike.com', category: 'Mobile Games', tier: 'B', region: 'US', fit: 'Warzone-style mobile BR aggressively paying FPS creators.' },
  { name: 'Farlight 84 (Lilith Games)', domain: 'farlightgames.com', category: 'Mobile Games', tier: 'C', region: 'US', fit: 'Hero BR mobile shooter with UA creator spend.' },
  { name: 'Standoff 2 (AXLEBOLT)', domain: 'axlebolt.com', category: 'Mobile Games', tier: 'C', region: 'EU', fit: 'Mobile tac-shooter with strong creator UA.' },
  { name: 'Supercell', domain: 'supercell.com', category: 'Mobile Games', tier: 'C', region: 'EU', fit: 'Top mobile publisher; broad gamer creator campaigns.' },
  { name: 'Raid: Shadow Legends (Plarium)', domain: 'plarium.com', category: 'Mobile Games', tier: 'B', region: 'US', fit: 'Famous for paying gaming creators regardless of niche.' },

  // ── Mice / keyboards / controllers ──
  { name: 'Razer', domain: 'razer.com', category: 'Peripherals', tier: 'A', region: 'US', fit: 'Prior partner; premier FPS peripheral brand for creators.' },
  { name: 'Logitech G', domain: 'logitechg.com', category: 'Peripherals', tier: 'A', region: 'US', fit: 'Top FPS mouse/keyboard brand with huge creator roster.' },
  { name: 'SteelSeries', domain: 'steelseries.com', category: 'Peripherals', tier: 'A', region: 'US', fit: 'Esports-heavy peripherals; active creator sponsorships.' },
  { name: 'Corsair', domain: 'corsair.com', category: 'Peripherals', tier: 'A', region: 'US', fit: 'Full ecosystem (mice, keys, audio, PC) — big creator budgets.' },
  { name: 'Glorious Gaming', domain: 'gloriousgaming.com', category: 'Peripherals', tier: 'A', region: 'US', fit: 'Creator-first FPS mouse brand; frequent code/affiliate deals.' },
  { name: 'Pulsar Gaming Gears', domain: 'pulsar.gg', category: 'Peripherals', tier: 'B', region: 'US', fit: 'Rising FPS mouse brand courting mid/large creators.' },
  { name: 'Lamzu', domain: 'lamzu.com', category: 'Peripherals', tier: 'B', region: 'US', fit: 'Enthusiast lightweight mice; aggressive creator seeding.' },
  { name: 'Finalmouse', domain: 'finalmouse.com', category: 'Peripherals', tier: 'C', region: 'US', fit: 'Hype FPS mouse brand; creator-led drops.' },
  { name: 'Wooting', domain: 'wooting.io', category: 'Peripherals', tier: 'B', region: 'EU', fit: 'Analog keyboards trending in FPS; strong creator word-of-mouth.' },
  { name: 'Endgame Gear', domain: 'endgamegear.com', category: 'Peripherals', tier: 'C', region: 'EU', fit: 'Enthusiast FPS peripherals, EU-based.' },
  { name: 'Scuf Gaming (Corsair)', domain: 'scufgaming.com', category: 'Peripherals', tier: 'A', region: 'US', fit: 'Pro controllers — flagship console-FPS creator product.' },
  { name: 'GameSir', domain: 'gamesir.hk', category: 'Peripherals', tier: 'B', region: 'US', fit: 'Controllers for mobile/PC FPS; heavy creator gifting.' },
  { name: 'Turtle Beach', domain: 'turtlebeach.com', category: 'Peripherals', tier: 'B', region: 'US', fit: 'Controllers + headsets; console-shooter audience.' },
  { name: 'PowerA', domain: 'powera.com', category: 'Peripherals', tier: 'C', region: 'US', fit: 'Accessible controllers; broad console reach.' },

  // ── Headsets / audio ──
  { name: 'HyperX', domain: 'hyperx.com', category: 'Audio / Headsets', tier: 'A', region: 'US', fit: 'Creator-favourite headset brand; long history of sponsoring gamers.' },
  { name: 'Astro Gaming (Logitech)', domain: 'astrogaming.com', category: 'Audio / Headsets', tier: 'B', region: 'US', fit: 'Premium console headsets; FPS competitive angle.' },
  { name: 'EPOS', domain: 'eposaudio.com', category: 'Audio / Headsets', tier: 'C', region: 'EU', fit: 'High-end gaming audio; competitive FPS positioning.' },
  { name: 'JBL Quantum', domain: 'jbl.com', category: 'Audio / Headsets', tier: 'C', region: 'US', fit: 'Mainstream gaming audio line pushing creator content.' },
  { name: 'Beyerdynamic', domain: 'beyerdynamic.com', category: 'Audio / Headsets', tier: 'C', region: 'EU', fit: 'Audiophile brand entering gaming; premium creators.' },

  // ── Monitors / displays ──
  { name: 'BenQ ZOWIE', domain: 'zowie.benq.com', category: 'Monitors', tier: 'A', region: 'US', fit: 'The competitive-FPS monitor brand; direct creator relevance.' },
  { name: 'ASUS ROG', domain: 'rog.asus.com', category: 'Monitors', tier: 'A', region: 'US', fit: 'High-refresh gaming monitors + full ecosystem; big creator spend.' },
  { name: 'Alienware (Dell)', domain: 'alienware.com', category: 'Monitors', tier: 'B', region: 'US', fit: 'Premium monitors & PCs; established creator sponsorships.' },
  { name: 'LG UltraGear', domain: 'lg.com', category: 'Monitors', tier: 'B', region: 'US', fit: 'OLED high-refresh gaming displays targeting FPS players.' },
  { name: 'Samsung Odyssey', domain: 'samsung.com', category: 'Monitors', tier: 'B', region: 'US', fit: 'Flagship curved gaming monitors; creator campaigns.' },
  { name: 'MSI', domain: 'msi.com', category: 'Monitors', tier: 'B', region: 'US', fit: 'Monitors, laptops & components; broad gaming creator program.' },
  { name: 'Gigabyte AORUS', domain: 'aorus.com', category: 'Monitors', tier: 'C', region: 'US', fit: 'Gaming monitors + hardware; competitive positioning.' },
  { name: 'Acer Predator', domain: 'predator.acer.com', category: 'Monitors', tier: 'C', region: 'US', fit: 'Gaming monitors & laptops with creator activations.' },

  // ── PC components ──
  { name: 'NVIDIA GeForce', domain: 'nvidia.com', category: 'PC Hardware', tier: 'A', region: 'US', fit: 'GPUs power FPS performance; huge #RTXOn creator program.' },
  { name: 'AMD Radeon / Ryzen', domain: 'amd.com', category: 'PC Hardware', tier: 'A', region: 'US', fit: 'GPU/CPU brand with gaming creator sponsorships.' },
  { name: 'Intel', domain: 'intel.com', category: 'PC Hardware', tier: 'B', region: 'US', fit: 'CPUs + gaming marketing; creator campaigns around launches.' },
  { name: 'NZXT', domain: 'nzxt.com', category: 'PC Hardware', tier: 'B', region: 'US', fit: 'Cases, cooling & BLD PCs; creator-centric brand.' },
  { name: 'Kingston FURY', domain: 'kingston.com', category: 'PC Hardware', tier: 'C', region: 'US', fit: 'Memory/storage for gamers; sponsors creators.' },
  { name: 'be quiet!', domain: 'bequiet.com', category: 'PC Hardware', tier: 'C', region: 'EU', fit: 'Premium cooling/PSUs; EU gaming creators.' },
  { name: 'Cooler Master', domain: 'coolermaster.com', category: 'PC Hardware', tier: 'C', region: 'US', fit: 'Cases/cooling/peripherals; broad creator reach.' },
  { name: 'Western Digital / WD_BLACK', domain: 'westerndigital.com', category: 'PC Hardware', tier: 'C', region: 'US', fit: 'Gaming storage (WD_BLACK) with creator marketing.' },
  { name: 'Seagate', domain: 'seagate.com', category: 'PC Hardware', tier: 'C', region: 'US', fit: 'Gaming drives; sponsors gaming content.' },

  // ── Prebuilt PCs / laptops ──
  { name: 'ASUS ROG (Laptops)', domain: 'rog.asus.com', category: 'PCs / Laptops', tier: 'B', region: 'US', fit: 'Gaming laptops for high-FPS play; creator seeding.' },
  { name: 'Lenovo Legion', domain: 'lenovo.com', category: 'PCs / Laptops', tier: 'B', region: 'US', fit: 'Gaming laptops/desktops with growing creator spend.' },
  { name: 'HP OMEN', domain: 'hp.com', category: 'PCs / Laptops', tier: 'B', region: 'US', fit: 'Gaming PC line running influencer campaigns.' },
  { name: 'Origin PC (Corsair)', domain: 'originpc.com', category: 'PCs / Laptops', tier: 'C', region: 'US', fit: 'Custom gaming PCs; creator build sponsorships.' },
  { name: 'CyberPowerPC', domain: 'cyberpowerpc.com', category: 'PCs / Laptops', tier: 'C', region: 'US', fit: 'Affordable prebuilts; frequent creator affiliate deals.' },
  { name: 'iBUYPOWER', domain: 'ibuypower.com', category: 'PCs / Laptops', tier: 'C', region: 'US', fit: 'Prebuilt PCs with esports/creator ties.' },
  { name: 'Razer Blade', domain: 'razer.com', category: 'PCs / Laptops', tier: 'B', region: 'US', fit: 'Premium gaming laptops; existing Razer relationship.' },

  // ── Chairs / furniture ──
  { name: 'Secretlab', domain: 'secretlab.co', category: 'Furniture', tier: 'A', region: 'US', fit: 'The default creator gaming chair; big sponsorship program.' },
  { name: 'AndaSeat', domain: 'andaseat.com', category: 'Furniture', tier: 'B', region: 'US', fit: 'Gaming chairs actively sponsoring FPS creators.' },
  { name: 'noblechairs', domain: 'noblechairs.com', category: 'Furniture', tier: 'C', region: 'EU', fit: 'Premium chairs; EU creator activations.' },
  { name: 'Respawn Products', domain: 'respawnproducts.com', category: 'Furniture', tier: 'C', region: 'US', fit: 'Gaming chairs/desks with creator codes.' },
  { name: 'Autonomous', domain: 'autonomous.ai', category: 'Furniture', tier: 'C', region: 'US', fit: 'Desks/chairs; runs creator affiliate programs.' },

  // ── Energy drinks / supplements ──
  { name: 'G FUEL', domain: 'gfuel.com', category: 'Energy / Supplements', tier: 'A', region: 'US', fit: 'The gaming energy brand; sponsors creators of every size + custom flavours.' },
  { name: 'GamerSupps', domain: 'gamersupps.gg', category: 'Energy / Supplements', tier: 'A', region: 'US', fit: 'Creator-first energy brand; easy affiliate + code deals.' },
  { name: 'Sneak Energy', domain: 'sneakenergy.com', category: 'Energy / Supplements', tier: 'A', region: 'UK', fit: 'UK gaming energy brand — perfect fit for a UK creator.' },
  { name: 'Monster Energy', domain: 'monsterenergy.com', category: 'Energy / Supplements', tier: 'B', region: 'US', fit: 'Heavy gaming/esports sponsor; larger-creator deals.' },
  { name: 'Red Bull', domain: 'redbull.com', category: 'Energy / Supplements', tier: 'B', region: 'UK', fit: 'Gaming division sponsors creators & events; UK presence.' },
  { name: 'ADVANCED.gg', domain: 'advanced.gg', category: 'Energy / Supplements', tier: 'B', region: 'US', fit: 'Gaming energy brand built on creator partnerships.' },
  { name: 'Rogue Energy', domain: 'rogueenergy.com', category: 'Energy / Supplements', tier: 'C', region: 'US', fit: 'Gaming energy with generous affiliate codes.' },
  { name: 'X-Gamer', domain: 'x-gamer.com', category: 'Energy / Supplements', tier: 'C', region: 'UK', fit: 'UK/EU gaming energy brand; creator codes.' },
  { name: 'PRIME (KSI/Logan Paul)', domain: 'drinkprime.com', category: 'Energy / Supplements', tier: 'C', region: 'UK', fit: 'Creator-born brand; UK gaming audience overlap.' },

  // ── Capture / streaming / mic gear ──
  { name: 'Elgato', domain: 'elgato.com', category: 'Streaming Gear', tier: 'A', region: 'US', fit: 'Capture/Stream Deck — essential creator kit; strong sponsor program.' },
  { name: 'AVerMedia', domain: 'avermedia.com', category: 'Streaming Gear', tier: 'B', region: 'US', fit: 'Capture cards & gear; creator sponsorships.' },
  { name: 'Shure', domain: 'shure.com', category: 'Streaming Gear', tier: 'C', region: 'US', fit: 'Pro mics increasingly targeting creators (SM7B/MV7).' },
  { name: 'RODE', domain: 'rode.com', category: 'Streaming Gear', tier: 'B', region: 'US', fit: 'Creator mics (NT/Wireless); active influencer program.' },
  { name: 'Blue Microphones (Logitech)', domain: 'bluemic.com', category: 'Streaming Gear', tier: 'C', region: 'US', fit: 'Yeti mics; entry creator audio.' },

  // ── Clip / content tools (recurring, high-conversion) ──
  { name: 'Eklipse', domain: 'eklipse.gg', category: 'Creator Tools', tier: 'A', region: 'US', fit: 'Prior partner; AI clip tool that pays creators to promote — recurring.' },
  { name: 'Medal.tv', domain: 'medal.tv', category: 'Creator Tools', tier: 'A', region: 'US', fit: 'Clip platform for FPS players; frequent creator deals.' },
  { name: 'Allstar', domain: 'allstar.gg', category: 'Creator Tools', tier: 'A', region: 'US', fit: 'AI highlight tool for Warzone/FPS — exact audience match.' },
  { name: 'Overwolf / Outplayed', domain: 'overwolf.com', category: 'Creator Tools', tier: 'B', region: 'US', fit: 'In-game apps & auto-clipping; creator monetisation.' },
  { name: 'Opus Clip', domain: 'opus.pro', category: 'Creator Tools', tier: 'B', region: 'US', fit: 'AI short-form tool; pays creators to demo it.' },
  { name: 'StreamLadder', domain: 'streamladder.com', category: 'Creator Tools', tier: 'C', region: 'EU', fit: 'Clip-to-short tool with affiliate program.' },
  { name: 'CapCut', domain: 'capcut.com', category: 'Creator Tools', tier: 'C', region: 'US', fit: 'Dominant short-form editor; creator campaigns.' },

  // ── Betting / skins / gaming economy ──
  { name: 'Thunderpick', domain: 'thunderpick.io', category: 'Betting / Economy', tier: 'A', region: 'UK', fit: 'Prior + current partner (ThunderDiez); esports betting for FPS fans.' },
  { name: 'Rivalry', domain: 'rivalry.com', category: 'Betting / Economy', tier: 'B', region: 'UK', fit: 'Esports betting brand built around gaming creators.' },
  { name: 'Stake', domain: 'stake.com', category: 'Betting / Economy', tier: 'B', region: 'UK', fit: 'Major gaming-creator sponsor (age-gated audiences).' },
  { name: 'DMarket', domain: 'dmarket.com', category: 'Betting / Economy', tier: 'C', region: 'US', fit: 'Skins marketplace; creator affiliate deals.' },
  { name: 'Skinport', domain: 'skinport.com', category: 'Betting / Economy', tier: 'C', region: 'EU', fit: 'Skins trading; FPS-economy audience.' },

  // ── VPN / software / tech ──
  { name: 'NordVPN', domain: 'nordvpn.com', category: 'Software / VPN', tier: 'A', region: 'UK', fit: 'Biggest creator-sponsorship spender in tech; gaming angle.' },
  { name: 'ExpressVPN', domain: 'expressvpn.com', category: 'Software / VPN', tier: 'B', region: 'US', fit: 'Heavy YouTube/creator sponsor across gaming.' },
  { name: 'Surfshark', domain: 'surfshark.com', category: 'Software / VPN', tier: 'B', region: 'UK', fit: 'Aggressive creator sponsorships; UK-friendly.' },
  { name: 'ExitLag', domain: 'exitlag.com', category: 'Software / VPN', tier: 'B', region: 'US', fit: 'Ping/latency tool made for FPS players — perfect fit.' },
  { name: 'Displate', domain: 'displate.com', category: 'Software / VPN', tier: 'C', region: 'EU', fit: 'Metal gaming posters; huge creator affiliate program.' },

  // ── Marketplaces / retail / lifestyle ──
  { name: 'Fanatical', domain: 'fanatical.com', category: 'Retail / Marketplace', tier: 'B', region: 'UK', fit: 'UK game-key store; creator affiliate + bundles.' },
  { name: 'Green Man Gaming', domain: 'greenmangaming.com', category: 'Retail / Marketplace', tier: 'B', region: 'UK', fit: 'UK game retailer with creator/affiliate program.' },
  { name: 'CDKeys', domain: 'cdkeys.com', category: 'Retail / Marketplace', tier: 'C', region: 'UK', fit: 'UK game-key retailer; creator codes.' },
  { name: 'Kinguin', domain: 'kinguin.net', category: 'Retail / Marketplace', tier: 'C', region: 'EU', fit: 'Game marketplace with an affiliate/creator scheme.' },
  { name: 'Gamer Advantage', domain: 'gameradvantage.com', category: 'Retail / Marketplace', tier: 'C', region: 'US', fit: 'Gaming glasses; creator-driven brand.' },
  { name: 'Gunnar Optiks', domain: 'gunnar.com', category: 'Retail / Marketplace', tier: 'C', region: 'US', fit: 'Blue-light gaming glasses; affiliate creators.' },

  // ── Esports orgs (sometimes sign / sponsor solo creators) ──
  { name: 'FaZe Clan', domain: 'faze.gg', category: 'Esports Orgs', tier: 'B', region: 'US', fit: 'CoD-rooted org that signs FPS creators & runs brand deals.' },
  { name: 'OpTic Gaming', domain: 'opticgaming.com', category: 'Esports Orgs', tier: 'B', region: 'US', fit: 'CoD heritage org; creator + brand partnerships.' },
  { name: '100 Thieves', domain: '100thieves.com', category: 'Esports Orgs', tier: 'C', region: 'US', fit: 'Lifestyle/esports brand that partners with creators.' },
  { name: 'Guild Esports', domain: 'guildesports.com', category: 'Esports Orgs', tier: 'C', region: 'UK', fit: 'UK-listed org (Beckham-backed) — local creator fit.' },
  { name: 'Team Liquid', domain: 'teamliquid.com', category: 'Esports Orgs', tier: 'C', region: 'US', fit: 'Global org with content-creator division.' },
];
