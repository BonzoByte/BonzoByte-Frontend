/** Presentation-only text; old market dictionaries and calculations are retained. */
import { probabilityFirstInternational } from './probability-first-locales';
const en = {
  title:'Model performance', subtitle:'Historical forecasts, independent of bookmaker odds.',
  forecasts:'Eligible forecasts',accuracy:'Accuracy',coverage:'Coverage',meanConfidence:'Mean forecast probability',
  brier:'Brier score',logLoss:'Log loss',lowerBetter:'Lower is better',threshold:'Minimum model probability',
  thresholdHint:'Minimum model probability, not market edge. Coverage is relative to the selected tour.',
  thresholdsTitle:'Accuracy and coverage by threshold',calibrationTitle:'Forecast probability vs actual outcomes',
  observed:'Observed',ideal:'Perfect calibration',calendar:'Calendar results',period:'Period',correct:'Correct',surfaces:'Surface results',
  modelOdds:'Model odds',modelOddsHint:'1 / model probability, without margin. A model estimate, not an offered market price.',
  retrospectiveOddsHint:'Model odds calculated later from data available before the match day. Not an offered price or a published pre-match forecast.',
  retrospectivePredictionHint:'Reconstructed later using data from before the match day. Not included in accuracy.',
  notScored:'Not scored',evenMatch:'Even match',
  oddsWarning:'Unverified archived odds: values may be incomplete, misassigned or outdated. Not used in model-performance statistics.',
  forecastHint:'Model estimate, not a guarantee. No market comparison.',
  disclosure:'Retrospective model reconstruction, not an untouched prospective test. Historical results do not guarantee future accuracy or returns.',
  historyNotice:'Both players need at least two earlier valid finished matches. Missing forecasts, unverified outcomes and exact 50/50 forecasts are excluded from accuracy.',
  source:'Source',sourceCoverage:'Eligible forecasts / archived matches',excluded:'Excluded',year:'Year',quarter:'Quarter',
  error:'Model-performance data unavailable.',forecast:'Prediction',
  noticeSettingTitle:'Prediction explanation',noticeSettingHint:'Show the model-odds and forecast-limits notice. Saved in this browser; stays hidden after closing until you enable it again.',
};
type Copy = typeof en;
const translated:Record<string,Partial<Copy>> = {
  hr:{title:'Uspješnost modela',subtitle:'Povijesne prognoze, neovisno o kladioničarskim kvotama.',forecasts:'Prihvatljive prognoze',accuracy:'Točnost',coverage:'Obuhvat',meanConfidence:'Prosječna procijenjena vjerojatnost',brier:'Brierov rezultat',logLoss:'Logaritamski gubitak',lowerBetter:'Niže je bolje',threshold:'Minimalna vjerojatnost modela',thresholdHint:'Minimalna procijenjena vjerojatnost, a ne tržišni edge. Obuhvat se računa unutar odabranog toura.',thresholdsTitle:'Točnost i obuhvat prema pragu',calibrationTitle:'Procijenjena vjerojatnost i stvarni ishodi',observed:'Ostvareno',ideal:'Idealna kalibracija',calendar:'Rezultati po razdobljima',period:'Razdoblje',correct:'Pogoci',surfaces:'Rezultati po podlozi',modelOdds:'Modelske kvote',modelOddsHint:'1 / vjerojatnost modela, bez marže. Procjena modela, a ne ponuđena tržišna kvota.',oddsWarning:'Nepotvrđene arhivirane kvote: mogu biti nepotpune, pogrešno povezane ili zastarjele. Ne koriste se u statistici uspješnosti modela.',forecastHint:'Procjena modela, ne jamstvo. Bez tržišne usporedbe.',disclosure:'Retrospektivna rekonstrukcija modela, a ne neovisan test budućih mečeva. Povijesni rezultati ne jamče buduću točnost ni prinos.',historyNotice:'Oba igrača trebaju barem dva ranija valjana završena meča. Prognoze koje nedostaju, nepotvrđeni ishodi i točnih 50/50 izostavljeni su iz statistike točnosti.',source:'Izvor',sourceCoverage:'Prihvatljive prognoze / arhivirani mečevi',excluded:'Izostavljeno',year:'Godina',quarter:'Kvartal',error:'Podaci o uspješnosti modela nisu dostupni.',forecast:'Prognoza'},
};
const noticeSettings:Record<string,readonly [string,string]> = {
  hr:['Objašnjenje prognoza','Prikaži objašnjenje modelskih kvota i ograničenja prognoza. Sprema se u ovom pregledniku; nakon zatvaranja ostaje skriveno dok ga ponovno ne uključiš.'],
  bs:['Objašnjenje prognoza','Prikaži objašnjenje modelskih kvota i ograničenja prognoza. Sprema se u ovom pregledniku; nakon zatvaranja ostaje skriveno dok ga ponovo ne uključiš.'],
  'sr-Latn':['Objašnjenje prognoza','Prikaži objašnjenje modelskih kvota i ograničenja prognoza. Čuva se u ovom pregledaču; nakon zatvaranja ostaje skriveno dok ga ponovo ne uključiš.'],
  sl:['Pojasnilo napovedi','Prikaži pojasnilo modelskih kvot in omejitev napovedi. Shrani se v tem brskalniku; po zaprtju ostane skrito, dokler ga znova ne vklopiš.'],
  de:['Erläuterung der Prognosen','Hinweis zu Modellquoten und Prognosegrenzen anzeigen. In diesem Browser gespeichert; nach dem Schließen bis zur erneuten Aktivierung ausgeblendet.'],
  es:['Explicación de los pronósticos','Mostrar el aviso sobre las cuotas del modelo y los límites de los pronósticos. Se guarda en este navegador; al cerrarlo, permanece oculto hasta que lo actives de nuevo.'],
  fr:['Explication des pronostics','Afficher les explications sur les cotes du modèle et les limites des pronostics. Enregistré dans ce navigateur ; après fermeture, reste masqué jusqu’à sa réactivation.'],
  it:['Spiegazione dei pronostici','Mostra l’avviso sulle quote del modello e sui limiti dei pronostici. Salvato in questo browser; dopo la chiusura resta nascosto finché non lo riattivi.'],
  'pt-BR':['Explicação das previsões','Mostrar o aviso sobre as odds do modelo e os limites das previsões. Salvo neste navegador; após fechar, fica oculto até ser ativado novamente.'],
  ru:['Пояснение прогнозов','Показывать пояснение коэффициентов модели и ограничений прогнозов. Сохраняется в этом браузере; после закрытия скрыто до повторного включения.'],
  ja:['予測の説明','モデルのオッズと予測の限界についての説明を表示します。このブラウザに保存され、閉じると再び有効にするまで非表示になります。'],
  pl:['Objaśnienie prognoz','Pokaż informację o kursach modelu i ograniczeniach prognoz. Zapisywane w tej przeglądarce; po zamknięciu pozostaje ukryte do ponownego włączenia.'],
  cs:['Vysvětlení předpovědí','Zobrazit vysvětlení modelových kurzů a omezení předpovědí. Uloženo v tomto prohlížeči; po zavření zůstane skryté do opětovného zapnutí.'],
  sk:['Vysvetlenie predpovedí','Zobraziť vysvetlenie modelových kurzov a obmedzení predpovedí. Uložené v tomto prehliadači; po zatvorení zostane skryté do opätovného zapnutia.'],
  hu:['Az előrejelzések magyarázata','A modell oddsainak és az előrejelzések korlátainak magyarázata. Ebben a böngészőben mentve; bezárás után az újbóli bekapcsolásig rejtve marad.'],
};
const retrospectiveOdds:Record<string,string> = {
  hr:'Modelske kvote izračunate naknadno iz podataka dostupnih prije dana meča. Nisu tržišne kvote ni tada objavljena prognoza.',
  bs:'Modelske kvote izračunate naknadno iz podataka dostupnih prije dana meča. Nisu tržišne kvote niti tada objavljena prognoza.',
  'sr-Latn':'Modelske kvote izračunate naknadno iz podataka dostupnih pre dana meča. Nisu tržišne kvote niti tada objavljena prognoza.',
  sl:'Modelne kvote, naknadno izračunane iz podatkov pred dnevom dvoboja. Niso tržne kvote ali takrat objavljena napoved.',
  de:'Modellquoten nachträglich aus Daten vor dem Spieltag berechnet. Keine Marktquoten oder vorab veröffentlichten Prognosen.',
  es:'Cuotas del modelo calculadas a posteriori con datos anteriores al día del partido. No son cuotas de mercado ni un pronóstico publicado antes del partido.',
  fr:'Cotes du modèle calculées après coup à partir de données antérieures au jour du match. Ni cotes de marché ni pronostic publié avant le match.',
  it:'Quote del modello calcolate a posteriori su dati precedenti al giorno della partita. Non sono quote di mercato né un pronostico pubblicato prima della partita.',
  'pt-BR':'Odds do modelo calculadas depois, com dados anteriores ao dia da partida. Não são odds de mercado nem uma previsão publicada antes da partida.',
  ru:'Коэффициенты модели рассчитаны позднее по данным до дня матча. Это не рыночные котировки и не прогноз, опубликованный до матча.',
  ja:'試合日の前までのデータを使って後から算出したモデルオッズです。市場オッズでも、試合前に公開された予測でもありません。',
  pl:'Kursy modelu obliczone później na podstawie danych sprzed dnia meczu. To nie kursy rynkowe ani prognoza opublikowana przed meczem.',
  cs:'Modelové kurzy dopočtené z dat před dnem zápasu. Nejde o tržní kurzy ani o předpověď zveřejněnou před zápasem.',
  sk:'Modelové kurzy dopočítané z údajov spred dňa zápasu. Nie sú to trhové kurzy ani predpoveď zverejnená pred zápasom.',
  hu:'Utólag számított modelloddsok, a mérkőzés napja előtti adatok alapján. Nem piaci oddsok, és nem a mérkőzés előtt közzétett előrejelzések.',
};
const ungradedPrediction:Record<string,readonly [string,string,string]> = {
  hr:['Neocijenjeno','Izjednačena procjena','Naknadna procjena iz podataka prije dana meča. Ne ulazi u statistiku točnosti.'],
  bs:['Neocijenjeno','Izjednačena procjena','Naknadna procjena iz podataka prije dana meča. Ne ulazi u statistiku tačnosti.'],
  'sr-Latn':['Neocenjeno','Izjednačena procena','Naknadna procena iz podataka pre dana meča. Ne ulazi u statistiku tačnosti.'],
  sl:['Neocenjeno','Izenačena ocena','Naknadna ocena iz podatkov pred dnevom dvoboja. Ni vključena v statistiko točnosti.'],
  de:['Nicht gewertet','Ausgeglichen','Nachträgliche Schätzung aus Daten vor dem Spieltag. Nicht in der Trefferquote enthalten.'],
  es:['Sin evaluar','Igualado','Estimación posterior con datos anteriores al día del partido. No cuenta para la precisión.'],
  fr:['Non évalué','Équilibré','Estimation rétrospective à partir de données antérieures au jour du match. Exclue de la mesure de précision.'],
  it:['Non valutato','Equilibrato','Stima retrospettiva basata su dati precedenti al giorno della partita. Esclusa dalle statistiche di accuratezza.'],
  'pt-BR':['Não avaliado','Equilibrado','Estimativa retrospectiva com dados anteriores ao dia da partida. Não conta para a precisão.'],
  ru:['Не оценён','Равные шансы','Ретроспективная оценка по данным до дня матча. Не учитывается в статистике точности.'],
  ja:['評価対象外','互角','試合日より前のデータを使って後から推定した値です。予測精度の集計には含まれません。'],
  pl:['Bez oceny','Równe szanse','Ocena obliczona później z danych sprzed dnia meczu. Nie wlicza się do statystyk trafności.'],
  cs:['Bez hodnocení','Vyrovnaný odhad','Odhad dopočtený z dat před dnem zápasu. Nezahrnuje se do statistik přesnosti.'],
  sk:['Bez hodnotenia','Vyrovnaný odhad','Odhad dopočítaný z údajov spred dňa zápasu. Nezahŕňa sa do štatistiky presnosti.'],
  hu:['Nem értékelt','Kiegyenlített','A meccs napja előtti adatokból utólag számított becslés. Nem számít bele a pontosságba.'],
};
export function probabilityFirstCopy(language:string):Copy {
  const notice=noticeSettings[language]??[en.noticeSettingTitle,en.noticeSettingHint];
  const [notScored,evenMatch,retrospectivePredictionHint]=ungradedPrediction[language]??
    [en.notScored,en.evenMatch,en.retrospectivePredictionHint];
  return {...en,...probabilityFirstInternational[language],...translated[language],noticeSettingTitle:notice[0],noticeSettingHint:notice[1],
    retrospectiveOddsHint:retrospectiveOdds[language]??en.retrospectiveOddsHint,notScored,evenMatch,retrospectivePredictionHint};
}
