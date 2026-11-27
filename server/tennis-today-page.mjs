const base = 'https://bonzobyte.com', zone = 'Europe/Zagreb';

const fmt = (opts, d) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, ...opts }).format(d);
const dayOf = d => new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(d);

const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Prefer better-ranked fields and a variety of tournaments, irrespective of who won.
function select(pool, n) {
  const sorted = [...pool].sort((a,b) => a.priority-b.priority || a.id-b.id);
  const used = new Set(), first = [], rest = [];
  for (const m of sorted) {
    if (used.has(m.grid.eventId)) rest.push(m);
    else { used.add(m.grid.eventId); first.push(m); }
  }
  return [...first, ...rest].slice(0,n);
}

export function renderToday(fixtures, results, now) {
const upcoming = select(fixtures.filter(m => !m.hasResultRow && m.time > now), 6).sort((a,b) => a.time-b.time);
const finished = select(fixtures.filter(m => m.score), 10-upcoming.length);
const dateText = fmt({ weekday:'long', day:'numeric', month:'long', year:'numeric' }, now);
const clock = d => fmt({hour:'2-digit',minute:'2-digit'}, d);
const scoreText = s => escape(s.replaceAll(':','–'));
function card(m) {
  const p = m.grid.forecast?.p, at = Date.parse(m.grid.forecast?.at);
  const projected = !m.hasResultRow && Number.isFinite(p) && p>0 && p<1 && at <= +now && at < +m.time;
  const note = m.score
    ? '<strong>Final: ' + scoreText(m.score) + '</strong>' + (m.sets ? ' · ' + scoreText(m.sets) : '')
    : projected ? 'Model favourite: <strong>' + escape(m.names[p>=.5?0:1]) + '</strong> · ' + (Math.max(p,1-p)*100).toFixed(1) + '%'
    : 'Scheduled start · subject to change';
  if(m.unconfirmed) return '<li><div class="meta">'+escape(m.grid.title)+'</div><h3>'+escape(m.names[0])+' <span>vs</span> '+escape(m.names[1])+'</h3><p>Result not yet available</p></li>';
  return '<li><div class="meta">' + escape([m.grid.tour,m.grid.title,m.grid.round].filter(Boolean).join(' · ')) + '</div><h3>' + escape(m.names[0]) + ' <span>vs</span> ' + escape(m.names[1]) + '</h3><p>' + (m.score?'':'<time datetime="'+m.time.toISOString()+'">'+clock(m.time)+'</time> · ') + note + '</p></li>';
}
function section(label, list, empty) {
  return '<section><h2>'+label+'</h2>'+(list.length?'<ul>'+list.map(card).join('')+'</ul>':'<p>'+empty+'</p>')+'</section>';
}
return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tennis today: schedule and selected results, ${dateText} | BonzoByte</title>
<meta name="robots" content="index, follow"><meta name="description" content="A selection from the tennis schedule for ${dateText}, with Zagreb start times, BonzoByte model favourites and scores.">
<link rel="canonical" href="https://bonzobyte.com/tennis-today">
<style>
*{box-sizing:border-box}body{margin:0;background:#102829;color:#f8f5e9;font:16px/1.5 system-ui,sans-serif}main,nav,footer{max-width:62rem;margin:auto;padding:1.2rem clamp(1rem,4vw,3rem)}nav,footer{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}nav{border-bottom:1px solid #597270}a{color:#e7fa9c;text-underline-offset:.25em}nav b{letter-spacing:.15em}header{padding:1.5rem 0;border-bottom:2px solid #cee681}.meta,time{color:#bdd1cb;font-size:.9rem}.eyebrow{color:#e7fa9c;letter-spacing:.12em;text-transform:uppercase;font-weight:650;font-size:.8rem}h1{font:clamp(3.3rem,9vw,6rem)/1 Georgia,serif;margin:.3rem 0}h2{font:2rem/1.2 Georgia,serif}h3{font-size:1.08rem;line-height:1.4;margin:.35rem 0}h3 span{color:#a8bab0;font-size:.85rem;font-weight:400}ul{padding:0;list-style:none;display:grid;gap:.65rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))}li{padding:1rem;border:1px solid #496461;background:#163435;border-radius:.35rem}li p{margin:.55rem 0 0;color:#e6ebdb}footer{border-top:1px solid #496461;font-size:.9rem}a:focus-visible{outline:2px solid #e7fa9c;outline-offset:3px}
</style></head><body>
<nav aria-label="Site"><b>BONZOBYTE</b><a href="${base}/matches">Full match grid →</a></nav>
<main><header><p class="eyebrow">The daily tennis desk</p><h1>Tennis today</h1><p>${dateText} · Times in Zagreb</p>
<p>A selection from ${fixtures.length} singles matches on today’s schedule. We look first for the strongest combined player rankings, with room for different tournaments.</p>
<a href="${base}/matches">Explore the full schedule and match details →</a></header>
${section('Scheduled for later', upcoming, 'No later timed fixtures in this schedule snapshot.')}
${section('Selected results', finished, 'No final scores available in this snapshot.')}
${!upcoming.length && !finished.length ? section('On today’s card',select(fixtures.filter(m=>!m.hasResultRow), 10).map(m=>({...m,unconfirmed:true})), 'No match details available yet.') : ''}
<p class="meta">Schedule times are estimates, not live status. This edition was prepared at ${clock(now)} Zagreb time.${results?.observedAt?' Rally score update: '+fmt({day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'},new Date(results.observedAt))+' Zagreb time.':''}</p>
</main><footer><span>BonzoByte · Tennis in numbers</span><a href="${base}/tennis-stats">From the archive: a match in Yokohama →</a></footer></body></html>`;
}
export { dayOf };
