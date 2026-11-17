// Maintained UI translations. --patch prints an apply_patch patch; it never writes reports.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// notice, reconstruction, legacy-odds tooltip, canonical-outcome description
export const copy = {
  en: [
    "BonzoByte's historical data, odds, player mappings, calculations and models may contain errors. Historical P/L and ROI are hypothetical comparisons with archived bookmaker prices, not evidence of achievable returns or a promise of future profit. We work to improve data quality and evaluate more reliable sources. Evidence-based corrections may change historical data and reported metrics, whether the change increases or reduces ROI.",
    'Chronological retrospective reconstruction using yearly fitted models selected after historical research, not an untouched prospective holdout or proof of achievable returns. Archived bookmaker medians serve as historical reference prices; pre-match availability is unconfirmed. Quote-eligibility rules are stated separately. Missing predictions and incomplete or unverified outcomes are excluded, never replaced by 50%.',
    'These legacy archived odds have not yet been verified or enriched with detailed bookmaker offers.',
    'Canonical finished match records only; player 1 is the winner.'
  ],
  hr: [
    'BonzoByteovi povijesni podaci, koeficijenti, povezivanja igrača, izračuni i modeli mogu sadržavati pogreške. Povijesni P/L i ROI hipotetske su usporedbe s arhiviranim kladioničarskim koeficijentima, a ne dokaz ostvarivog prinosa ili obećanje buduće dobiti. Radimo na kvaliteti podataka i procjeni pouzdanijih izvora. Ispravci utemeljeni na dokazima mogu promijeniti povijesne podatke i prikazane pokazatelje, neovisno o tome povećavaju li ili smanjuju ROI.',
    'Kronološka retrospektivna rekonstrukcija s godišnje prilagođenim modelima odabranima nakon povijesnog istraživanja, a ne netaknuti prospektivni test ili dokaz ostvarivog prinosa. Arhivirani medijani kladioničarskih koeficijenata služe kao povijesne referentne cijene; dostupnost prije meča nije potvrđena. Pravila prihvatljivosti koeficijenata navedena su zasebno. Nedostajuće predikcije i nepotpuni ili neprovjereni ishodi izostavljaju se, nikada se ne zamjenjuju s 50%.',
    'Ovi stariji arhivirani koeficijenti još nisu provjereni ni dopunjeni detaljnim kladioničarskim ponudama.',
    'Samo kanonski zapisi završenih mečeva; igrač 1 je pobjednik.'
  ],
  bs: [
    'BonzoByteovi historijski podaci, koeficijenti, povezivanja igrača, izračuni i modeli mogu sadržavati greške. Historijski P/L i ROI hipotetska su poređenja s arhiviranim kladioničarskim koeficijentima, a ne dokaz ostvarivog prinosa ili obećanje buduće dobiti. Radimo na kvalitetu podataka i procjeni pouzdanijih izvora. Ispravke zasnovane na dokazima mogu promijeniti historijske podatke i prikazane pokazatelje, bez obzira povećavaju li ili smanjuju ROI.',
    'Hronološka retrospektivna rekonstrukcija s godišnje prilagođenim modelima odabranim nakon historijskog istraživanja, a ne netaknuti prospektivni test ili dokaz ostvarivog prinosa. Arhivirani medijani kladioničarskih koeficijenata služe kao historijske referentne cijene; dostupnost prije meča nije potvrđena. Pravila prihvatljivosti koeficijenata navedena su zasebno. Nedostajuće predikcije i nepotpuni ili neprovjereni ishodi izostavljaju se, nikada se ne zamjenjuju s 50%.',
    'Ovi stariji arhivirani koeficijenti još nisu provjereni ni dopunjeni detaljnim kladioničarskim ponudama.',
    'Samo kanonski zapisi završenih mečeva; igrač 1 je pobjednik.'
  ],
  'sr-Latn': [
    'BonzoByteovi istorijski podaci, kvote, povezivanja igrača, proračuni i modeli mogu sadržati greške. Istorijski P/L i ROI predstavljaju hipotetička poređenja sa arhiviranim kladioničarskim kvotama, a ne dokaz ostvarivog prinosa ili obećanje buduće dobiti. Radimo na kvalitetu podataka i proceni pouzdanijih izvora. Ispravke zasnovane na dokazima mogu promeniti istorijske podatke i prikazane pokazatelje, bez obzira na to povećavaju li ili smanjuju ROI.',
    'Hronološka retrospektivna rekonstrukcija sa godišnje prilagođenim modelima odabranim nakon istorijskog istraživanja, a ne netaknuti prospektivni test ili dokaz ostvarivog prinosa. Arhivirane medijane kladioničarskih kvota služe kao istorijske referentne cene; dostupnost pre meča nije potvrđena. Pravila prihvatljivosti kvota navedena su zasebno. Nedostajuće predikcije i nepotpuni ili neprovereni ishodi izostavljaju se, nikada se ne zamenjuju sa 50%.',
    'Ove starije arhivirane kvote još nisu proverene ni dopunjene detaljnim kladioničarskim ponudama.',
    'Samo kanonski zapisi završenih mečeva; igrač 1 je pobednik.'
  ],
  sl: [
    'Zgodovinski podatki, kvote, povezave igralcev, izračuni in modeli BonzoByte lahko vsebujejo napake. Zgodovinska P/L in ROI sta hipotetični primerjavi z arhiviranimi stavnimi kvotami, ne dokaz dosegljivega donosa ali obljuba prihodnjega dobička. Izboljšujemo kakovost podatkov in ocenjujemo zanesljivejše vire. Popravki na podlagi dokazov lahko spremenijo zgodovinske podatke in prikazane kazalnike, ne glede na to, ali ROI povečajo ali zmanjšajo.',
    'Kronološka retrospektivna rekonstrukcija z letno prilagojenimi modeli, izbranimi po zgodovinski raziskavi, ne nedotaknjen prospektivni preizkus ali dokaz dosegljivega donosa. Arhivirane mediane stavnih kvot so zgodovinske referenčne cene; razpoložljivost pred tekmo ni potrjena. Pravila upravičenosti kvot so navedena posebej. Manjkajoče napovedi ter nepopolni ali nepreverjeni izidi so izključeni in nikoli nadomeščeni s 50%.',
    'Te starejše arhivirane kvote še niso preverjene ali dopolnjene s podrobnimi stavnimi ponudbami.',
    'Samo kanonični zapisi končanih tekem; igralec 1 je zmagovalec.'
  ],
  de: [
    'Historische Daten, Quoten, Spielerzuordnungen, Berechnungen und Modelle von BonzoByte können Fehler enthalten. Historische P/L und ROI sind hypothetische Vergleiche mit archivierten Buchmacherquoten, kein Nachweis erzielbarer Renditen und kein Versprechen künftiger Gewinne. Wir verbessern die Datenqualität und prüfen zuverlässigere Quellen. Evidenzbasierte Korrekturen können historische Daten und ausgewiesene Kennzahlen ändern, unabhängig davon, ob der ROI dadurch steigt oder sinkt.',
    'Chronologische retrospektive Rekonstruktion mit jährlich angepassten Modellen, die nach historischer Forschung ausgewählt wurden; kein unangetasteter prospektiver Test und kein Nachweis erzielbarer Renditen. Archivierte Mediane der Buchmacherquoten dienen als historische Referenzpreise; ihre Verfügbarkeit vor dem Spiel ist unbestätigt. Regeln zur Zulässigkeit von Quoten werden gesondert angegeben. Fehlende Prognosen sowie unvollständige oder ungeprüfte Ergebnisse werden ausgeschlossen und niemals durch 50% ersetzt.',
    'Diese älteren archivierten Quoten wurden noch nicht überprüft oder um detaillierte Buchmacherangebote ergänzt.',
    'Nur kanonische Datensätze abgeschlossener Spiele; Spieler 1 ist der Sieger.'
  ],
  fr: [
    'Les données historiques, cotes, associations de joueurs, calculs et modèles de BonzoByte peuvent contenir des erreurs. Le P/L et le ROI historiques sont des comparaisons hypothétiques avec des cotes archivées, pas une preuve de rendements réalisables ni une promesse de gains futurs. Nous améliorons la qualité des données et évaluons des sources plus fiables. Des corrections étayées peuvent modifier les données historiques et les indicateurs affichés, à la hausse comme à la baisse du ROI.',
    'Reconstruction rétrospective chronologique à partir de modèles ajustés annuellement et sélectionnés après recherche historique ; ni test prospectif intact ni preuve de rendements réalisables. Les médianes archivées des cotes servent de prix de référence historiques ; leur disponibilité avant le match n’est pas confirmée. Les règles d’admissibilité des cotes sont indiquées séparément. Les prédictions manquantes et les résultats incomplets ou non vérifiés sont exclus, jamais remplacés par 50%.',
    'Ces anciennes cotes archivées ne sont pas encore vérifiées ni complétées par des offres détaillées de bookmakers.',
    'Uniquement les enregistrements canoniques de matchs terminés ; le joueur 1 est le vainqueur.'
  ],
  es: [
    'Los datos históricos, cuotas, asociaciones de jugadores, cálculos y modelos de BonzoByte pueden contener errores. El P/L y el ROI históricos son comparaciones hipotéticas con cuotas archivadas, no pruebas de rendimientos alcanzables ni promesas de beneficios futuros. Trabajamos para mejorar la calidad de los datos y evaluar fuentes más fiables. Las correcciones basadas en pruebas pueden cambiar los datos históricos y los indicadores publicados, tanto si aumentan como si reducen el ROI.',
    'Reconstrucción retrospectiva cronológica con modelos ajustados anualmente y seleccionados tras una investigación histórica; no es una prueba prospectiva intacta ni demuestra rendimientos alcanzables. Las medianas archivadas de cuotas sirven como precios de referencia históricos; su disponibilidad antes del partido no está confirmada. Las reglas de admisibilidad de cuotas se indican por separado. Se excluyen las predicciones ausentes y los resultados incompletos o no verificados; nunca se sustituyen por un 50%.',
    'Estas cuotas antiguas archivadas aún no se han verificado ni completado con ofertas detalladas de casas de apuestas.',
    'Solo registros canónicos de partidos finalizados; el jugador 1 es el ganador.'
  ],
  it: [
    'Dati storici, quote, associazioni dei giocatori, calcoli e modelli di BonzoByte possono contenere errori. P/L e ROI storici sono confronti ipotetici con quote archiviate, non prove di rendimenti conseguibili né promesse di profitti futuri. Lavoriamo per migliorare la qualità dei dati e valutare fonti più affidabili. Correzioni basate su evidenze possono modificare i dati storici e gli indicatori pubblicati, sia aumentando sia riducendo il ROI.',
    'Ricostruzione retrospettiva cronologica con modelli adattati annualmente e selezionati dopo una ricerca storica; non è un test prospettico intatto né prova rendimenti conseguibili. Le mediane archiviate delle quote fungono da prezzi di riferimento storici; la disponibilità prima dell’incontro non è confermata. Le regole di ammissibilità delle quote sono indicate separatamente. Le previsioni mancanti e gli esiti incompleti o non verificati sono esclusi, mai sostituiti con il 50%.',
    'Queste quote storiche archiviate non sono ancora state verificate né integrate con offerte dettagliate dei bookmaker.',
    'Solo record canonici di incontri conclusi; il giocatore 1 è il vincitore.'
  ],
  'pt-BR': [
    'Os dados históricos, odds, associações de jogadores, cálculos e modelos do BonzoByte podem conter erros. P/L e ROI históricos são comparações hipotéticas com odds arquivadas, não provas de retornos alcançáveis nem promessas de lucro futuro. Trabalhamos para melhorar a qualidade dos dados e avaliar fontes mais confiáveis. Correções fundamentadas em evidências podem alterar dados históricos e indicadores publicados, aumentando ou reduzindo o ROI.',
    'Reconstrução retrospectiva cronológica com modelos ajustados anualmente e selecionados após pesquisa histórica; não é um teste prospectivo intocado nem prova de retornos alcançáveis. As medianas arquivadas das odds servem como preços de referência históricos; a disponibilidade antes da partida não está confirmada. As regras de elegibilidade das odds são informadas separadamente. Previsões ausentes e resultados incompletos ou não verificados são excluídos, nunca substituídos por 50%.',
    'Estas odds antigas arquivadas ainda não foram verificadas nem complementadas com ofertas detalhadas de casas de apostas.',
    'Somente registros canônicos de partidas concluídas; o jogador 1 é o vencedor.'
  ],
  cs: [
    'Historická data, kurzy, přiřazení hráčů, výpočty a modely BonzoByte mohou obsahovat chyby. Historické P/L a ROI jsou hypotetická srovnání s archivovanými kurzy, nikoli důkaz dosažitelných výnosů či příslib budoucího zisku. Pracujeme na kvalitě dat a hodnocení spolehlivějších zdrojů. Opravy podložené důkazy mohou změnit historická data i vykazované ukazatele bez ohledu na to, zda ROI zvýší, nebo sníží.',
    'Chronologická retrospektivní rekonstrukce s každoročně upravenými modely vybranými po historickém výzkumu; nejde o nedotčený prospektivní test ani důkaz dosažitelných výnosů. Archivované mediány kurzů slouží jako historické referenční ceny; dostupnost před zápasem není potvrzena. Pravidla způsobilosti kurzů jsou uvedena samostatně. Chybějící predikce a neúplné či neověřené výsledky jsou vyloučeny, nikdy nenahrazeny 50%.',
    'Tyto starší archivované kurzy zatím nebyly ověřeny ani doplněny podrobnými nabídkami sázkových kanceláří.',
    'Pouze kanonické záznamy dokončených zápasů; hráč 1 je vítěz.'
  ],
  sk: [
    'Historické údaje, kurzy, priradenia hráčov, výpočty a modely BonzoByte môžu obsahovať chyby. Historické P/L a ROI sú hypotetické porovnania s archivovanými kurzami, nie dôkaz dosiahnuteľných výnosov ani prísľub budúceho zisku. Pracujeme na kvalite údajov a hodnotení spoľahlivejších zdrojov. Opravy podložené dôkazmi môžu zmeniť historické údaje a vykazované ukazovatele bez ohľadu na to, či ROI zvýšia alebo znížia.',
    'Chronologická retrospektívna rekonštrukcia s každoročne upravenými modelmi vybranými po historickom výskume; nejde o nedotknutý prospektívny test ani dôkaz dosiahnuteľných výnosov. Archivované mediány kurzov slúžia ako historické referenčné ceny; dostupnosť pred zápasom nie je potvrdená. Pravidlá prípustnosti kurzov sú uvedené samostatne. Chýbajúce predikcie a neúplné alebo neoverené výsledky sú vylúčené, nikdy nenahradené 50%.',
    'Tieto staršie archivované kurzy zatiaľ neboli overené ani doplnené podrobnými ponukami stávkových kancelárií.',
    'Iba kanonické záznamy ukončených zápasov; hráč 1 je víťaz.'
  ],
  pl: [
    'Dane historyczne, kursy, przypisania graczy, obliczenia i modele BonzoByte mogą zawierać błędy. Historyczne P/L i ROI to hipotetyczne porównania z archiwalnymi kursami, a nie dowód osiągalnych zwrotów ani obietnica przyszłych zysków. Pracujemy nad jakością danych i oceną bardziej wiarygodnych źródeł. Korekty oparte na dowodach mogą zmieniać dane historyczne i publikowane wskaźniki niezależnie od tego, czy zwiększają, czy zmniejszają ROI.',
    'Chronologiczna rekonstrukcja retrospektywna z modelami dopasowywanymi co roku i wybranymi po badaniach historycznych; nie jest to nietknięty test prospektywny ani dowód osiągalnych zwrotów. Archiwalne mediany kursów służą jako historyczne ceny odniesienia; dostępność przed meczem nie jest potwierdzona. Zasady kwalifikowania kursów podano osobno. Brakujące predykcje oraz niepełne lub niezweryfikowane wyniki są wykluczane, nigdy nie są zastępowane przez 50%.',
    'Te starsze archiwalne kursy nie zostały jeszcze zweryfikowane ani uzupełnione szczegółowymi ofertami bukmacherów.',
    'Tylko kanoniczne rekordy zakończonych meczów; gracz 1 jest zwycięzcą.'
  ],
  hu: [
    'A BonzoByte múltbeli adatai, oddsai, játékos-hozzárendelései, számításai és modelljei hibákat tartalmazhatnak. A múltbeli P/L és ROI archivált bukmékeri oddsokkal végzett hipotetikus összehasonlítás, nem az elérhető hozam bizonyítéka vagy jövőbeli nyereség ígérete. Az adatminőség javításán és megbízhatóbb források értékelésén dolgozunk. A bizonyítékokon alapuló javítások megváltoztathatják a múltbeli adatokat és a közölt mutatókat, akár növelik, akár csökkentik a ROI-t.',
    'Időrendi retrospektív rekonstrukció évente illesztett, a történeti kutatás után kiválasztott modellekkel; nem érintetlen prospektív teszt vagy elérhető hozam bizonyítéka. Az archivált bukmékeri oddsmediánok múltbeli referenciaárak; a mérkőzés előtti elérhetőségük nem igazolt. Az oddsok beválasztási szabályai külön szerepelnek. A hiányzó előrejelzések és a hiányos vagy ellenőrizetlen eredmények kimaradnak, soha nem helyettesítjük őket 50%-kal.',
    'Ezeket a régebbi archivált oddsokat még nem ellenőriztük és nem egészítettük ki részletes bukmékeri ajánlatokkal.',
    'Csak befejezett mérkőzések kanonikus rekordjai; az 1. játékos a győztes.'
  ],
  ru: [
    'Исторические данные, коэффициенты, сопоставления игроков, расчёты и модели BonzoByte могут содержать ошибки. Исторические P/L и ROI — гипотетические сравнения с архивными букмекерскими коэффициентами, а не доказательство достижимой доходности или обещание будущей прибыли. Мы улучшаем качество данных и оцениваем более надёжные источники. Исправления, основанные на доказательствах, могут изменить исторические данные и опубликованные показатели как в сторону повышения, так и снижения ROI.',
    'Хронологическая ретроспективная реконструкция с ежегодно подгоняемыми моделями, выбранными после исторического исследования; не нетронутый проспективный тест и не доказательство достижимой доходности. Архивные медианы букмекерских коэффициентов служат историческими ориентирами; доступность до матча не подтверждена. Правила допуска коэффициентов указаны отдельно. Отсутствующие прогнозы и неполные или непроверенные результаты исключаются, а не заменяются на 50%.',
    'Эти старые архивные коэффициенты ещё не проверены и не дополнены подробными букмекерскими предложениями.',
    'Только канонические записи завершённых матчей; игрок 1 — победитель.'
  ],
  ja: [
    'BonzoByteの過去データ、オッズ、選手の対応付け、計算、モデルには誤りが含まれる可能性があります。過去のP/LとROIは保存されたブックメーカーのオッズとの仮想的な比較であり、実現可能な収益の証明や将来の利益の約束ではありません。データ品質の向上と、より信頼できる情報源の評価に取り組んでいます。根拠に基づく訂正により、ROIが上がる場合も下がる場合も、過去データや公表指標が変わることがあります。',
    '過去の研究後に選択した年別調整モデルによる時系列の遡及的再構成です。未使用の前向き検証や実現可能な収益の証明ではありません。保存されたブックメーカーのオッズの中央値は過去の参照価格であり、試合前に利用できたかは未確認です。オッズの採用条件は別途記載しています。欠落した予測や不完全・未検証の結果は除外し、50%で置き換えることはありません。',
    'これらの旧アーカイブのオッズは、詳細なブックメーカーの提示情報による検証や補完がまだ行われていません。',
    '正規化済みの終了試合レコードのみを使用し、選手1が勝者です。'
  ]
};

function valuePatch(lines, key, previous, next) {
  const prefix = JSON.stringify(key) + ': ' + JSON.stringify(previous);
  const line = lines.find(line => line.trimStart().startsWith(prefix));
  assert.ok(line, 'Expected unique translation line: ' + key);
  const replacement = line.replace(JSON.stringify(previous), JSON.stringify(next));
  return ['@@', '-' + line, '+' + replacement].join('\n');
}

let patches = [];
const files = fs.readdirSync(path.join(root, 'src/assets/i18n')).filter(f => f.endsWith('.json'));
assert.deepEqual(files.map(f=>f.slice(0,-5)).sort(), Object.keys(copy).sort());
for (const file of files) {
  const lang = file.slice(0, -5), [notice, reconstruction, odds, outcome] = copy[lang];
  const filename = path.join(root, 'src/assets/i18n', file);
  const raw = fs.readFileSync(filename, 'utf8'), json = JSON.parse(raw.replace(/^\uFEFF/, ''));
  if (process.argv.includes('--patch')) {
    const lines = raw.split(/\r?\n/), edits = [];
    for (const [key, oldValue, newValue] of [
      ['legacyOddsNote', json.matchGrid.legacyOddsNote, odds],
      ['canonicalFinishedTennispredictionRowsOnlyPlayer1IsTheWinner', json.reports.copy.canonicalFinishedTennispredictionRowsOnlyPlayer1IsTheWinner, outcome]
    ]) if (oldValue !== newValue) edits.push(valuePatch(lines, key, oldValue, newValue));
    assert.ok(!json.researchData, 'Do not overwrite an existing translation block');
    edits.splice(1, 0, '@@\n+  "researchData": {\n+    "notice": ' + JSON.stringify(notice) + ',\n+    "reconstruction": ' + JSON.stringify(reconstruction) + '\n+  },\n   "reports": {');
    patches.push('*** Update File: ' + filename.replace(/\\/g, '/') + '\n' + edits.join('\n'));
  } else {
    assert.deepEqual(json.researchData, {notice, reconstruction});
    assert.equal(json.matchGrid.legacyOddsNote, odds);
    assert.equal(json.reports.copy.canonicalFinishedTennispredictionRowsOnlyPlayer1IsTheWinner, outcome);
    // Keys remain stable internal identifiers; no provider names may remain in displayed values.
    const visit = value => {
      if (typeof value === 'string') assert.ok(!/tennis\s*(explorer|prediction)/i.test(value), lang + ': ' + value);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(json);
  }
}
if (process.argv.includes('--patch')) console.log('*** Begin Patch\n' + patches.join('\n') + '\n*** End Patch');
else console.log('PASS: neutral research disclosures and public copy in all ' + files.length + ' languages.');
