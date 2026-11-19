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
  oddsWarning:'Unverified archived odds: values may be incomplete, misassigned or outdated. Not used in model-performance statistics.',
  forecastHint:'Model estimate, not a guarantee. No market comparison.',
  disclosure:'Retrospective model reconstruction, not an untouched prospective test. Historical results do not guarantee future accuracy or returns.',
  historyNotice:'Both players need at least two earlier valid finished matches. Missing forecasts, unverified outcomes and exact 50/50 forecasts are excluded from accuracy.',
  source:'Source',sourceCoverage:'Eligible forecasts / archived matches',excluded:'Excluded',year:'Year',quarter:'Quarter',
  error:'Model-performance data unavailable.',forecast:'Prediction',
};
type Copy = typeof en;
const translated:Record<string,Partial<Copy>> = {
  hr:{title:'Uspješnost modela',subtitle:'Povijesne prognoze, neovisno o kladioničarskim kvotama.',forecasts:'Prihvatljive prognoze',accuracy:'Točnost',coverage:'Obuhvat',meanConfidence:'Prosječna procijenjena vjerojatnost',brier:'Brierov rezultat',logLoss:'Logaritamski gubitak',lowerBetter:'Niže je bolje',threshold:'Minimalna vjerojatnost modela',thresholdHint:'Minimalna procijenjena vjerojatnost, a ne tržišni edge. Obuhvat se računa unutar odabranog toura.',thresholdsTitle:'Točnost i obuhvat prema pragu',calibrationTitle:'Procijenjena vjerojatnost i stvarni ishodi',observed:'Ostvareno',ideal:'Idealna kalibracija',calendar:'Rezultati po razdobljima',period:'Razdoblje',correct:'Pogoci',surfaces:'Rezultati po podlozi',modelOdds:'Modelske kvote',modelOddsHint:'1 / vjerojatnost modela, bez marže. Procjena modela, a ne ponuđena tržišna kvota.',oddsWarning:'Nepotvrđene arhivirane kvote: mogu biti nepotpune, pogrešno povezane ili zastarjele. Ne koriste se u statistici uspješnosti modela.',forecastHint:'Procjena modela, ne jamstvo. Bez tržišne usporedbe.',disclosure:'Retrospektivna rekonstrukcija modela, a ne neovisan test budućih mečeva. Povijesni rezultati ne jamče buduću točnost ni prinos.',historyNotice:'Oba igrača trebaju barem dva ranija valjana završena meča. Prognoze koje nedostaju, nepotvrđeni ishodi i točnih 50/50 izostavljeni su iz statistike točnosti.',source:'Izvor',sourceCoverage:'Prihvatljive prognoze / arhivirani mečevi',excluded:'Izostavljeno',year:'Godina',quarter:'Kvartal',error:'Podaci o uspješnosti modela nisu dostupni.',forecast:'Prognoza'},
};
export function probabilityFirstCopy(language:string):Copy { return {...en,...probabilityFirstInternational[language],...translated[language]}; }
