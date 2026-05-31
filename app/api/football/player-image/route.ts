import { NextRequest, NextResponse } from 'next/server';

// Cache results for 24 h to avoid hammering TheSportsDB
export const revalidate = 86400;

const SPORTSDB = 'https://www.thesportsdb.com/api/v1/json/3';

// Known TheSportsDB IDs for top players — avoids search latency for the most-used ones
const KNOWN_IDS: Record<string, string> = {
  'robert lewandowski': '34147176',
  'pedri':              '34146557',
  'gavi':               '34146556',
  'lamine yamal':       '34161657',
  'ferran torres':      '34146560',
  'marc ter stegen':    '34147095',
  'jules kounde':       '34147094',
  'pau cubarsi':        '34161656',
  'alejandro balde':    '34158771',
  'dani olmo':          '34161655',
  'vinicius junior':    '34147178',
  'kylian mbappe':      '34145939',
  'jude bellingham':    '34161015',
  'luka modric':        '34147196',
  'toni kroos':         '34147197',
  'federico valverde':  '34147199',
  'aurelien tchouameni':'34158773',
  'eduardo camavinga':  '34158774',
  'rodrygo':            '34158775',
  'thibaut courtois':   '34147193',
  'erling haaland':     '34145938',
  'kevin de bruyne':    '34145937',
  'phil foden':         '34155775',
  'bernardo silva':     '34155776',
  'rodri':              '34155777',
  'ruben dias':         '34155778',
  'jeremy doku':        '34161660',
  'ederson':            '34155779',
  'kyle walker':        '34155780',
  'manuel akanji':      '34158776',
  'josko gvardiol':     '34161661',
  'mohammad salah':     '34145936',
  'virgil van dijk':    '34145935',
  'darwin nunez':       '34158777',
  'luis diaz':          '34158778',
  'dominik szoboszlai': '34161662',
  'alexis mac allister':'34161663',
  'alisson becker':     '34155781',
  'trent alexander-arnold': '34155782',
  'cody gakpo':         '34161664',
  'bukayo saka':        '34158779',
  'declan rice':        '34155783',
  'martin odegaard':    '34155784',
  'william saliba':     '34161665',
  'kai havertz':        '34158780',
  'leandro trossard':   '34161666',
  'gabriel magalhaes':  '34158781',
  'oleksandr zinchenko':'34155785',
  'thomas partey':      '34155786',
  'david raya':         '34158782',
  'cole palmer':        '34161667',
  'moises caicedo':     '34161668',
  'enzo fernandez':     '34158783',
  'nicolas jackson':    '34161669',
  'pedro neto':         '34161670',
  'mykhaylo mudryk':    '34161671',
  'gianluigi donnarumma':'34155787',
  'achraf hakimi':      '34155788',
  'marquinhos':         '34155789',
  'fabian ruiz':        '34155790',
  'vitinha':            '34158784',
  'desire doue':        '34161672',
  'bradley barcola':    '34161673',
  'khvicha kvaratskhelia':'34161674',
  'manuel neuer':       '34147200',
  'harry kane':         '34145934',
  'thomas muller':      '34147201',
  'leroy sane':         '34155791',
  'jamal musiala':      '34161675',
  'serge gnabry':       '34155792',
  'joshua kimmich':     '34155793',
  'leon goretzka':      '34155794',
  'alphonso davies':    '34158785',
  'dayot upamecano':    '34158786',
  'kim min-jae':        '34161676',
  'jan oblak':          '34147198',
  'antoine griezmann':  '34145940',
  'joao felix':         '34158787',
  'koke':               '34155795',
  'paulo dybala':       '34147202',
  'dusan vlahovic':     '34161677',
  'federico chiesa':    '34155796',
  'kenan yildiz':       '34161678',
  'rasmus hojlund':     '34161679',
  'marcus rashford':    '34155797',
  'bruno fernandes':    '34155798',
  'alejandro garnacho': '34161680',
  'lautaro martinez':   '34155799',
  'marcus thuram':      '34161681',
  'nicolo barella':     '34155800',
  'hakan calhanoglu':   '34158788',
  'rafael leao':        '34158789',
  'olivier giroud':     '34145941',
  'christian pulisic':  '34155801',
  'theo hernandez':     '34155802',
  'mike maignan':       '34158790',
};

interface SportsDBPlayer {
  strThumb?: string;
  strCutout?: string;
  strRender?: string;
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')?.toLowerCase().trim();
  if (!name) return NextResponse.json({ imageUrl: null });

  try {
    let imageUrl: string | null = null;

    // Try known ID first (faster — direct image URL)
    const knownId = KNOWN_IDS[name];
    if (knownId) {
      // Try cutout first, then thumb
      const cutoutUrl = `https://www.thesportsdb.com/images/media/player/cutout/${knownId}.png`;
      const thumbUrl  = `https://www.thesportsdb.com/images/media/player/thumb/${knownId}.jpg`;
      // Check cutout exists
      const probe = await fetch(cutoutUrl, { method: 'HEAD' }).catch(() => null);
      imageUrl = probe?.ok ? cutoutUrl : thumbUrl;
    } else {
      // Search by name
      const searchUrl = `${SPORTSDB}/searchplayers.php?p=${encodeURIComponent(name)}`;
      const res = await fetch(searchUrl, { next: { revalidate: 86400 } });
      const data = await res.json();
      const player: SportsDBPlayer | undefined = data?.player?.[0];
      if (player) {
        imageUrl = player.strCutout || player.strThumb || player.strRender || null;
      }
    }

    return NextResponse.json({ imageUrl }, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600' },
    });
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
}
