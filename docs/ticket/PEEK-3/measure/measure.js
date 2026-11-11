const { createClient } = require('../../../../node_modules/@supabase/supabase-js');
const WS = require('../../../../node_modules/ws');
const { HttpsProxyAgent } = require('../../../../node_modules/https-proxy-agent');
const agent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
class ProxiedWS extends WS { constructor(u, p) { super(u, p, { agent }); } }
const URL = 'https://uppezappkwsizsdyoalo.supabase.co', KEY = 'sb_publishable_spyYnc7Ia7i-yqpm1QIrjg_b4VQwVP_';
const room = 'yolognese:measure:' + Date.now();
const bob = createClient(URL, KEY, { auth: { persistSession: false }, realtime: { transport: ProxiedWS } }).channel(room);
const heard = new Map();
bob.on('broadcast', { event: 'scored' }, ({ payload }) => heard.get(payload.i)?.(performance.now()));
const call = async (i) => {
  const arrived = new Promise((resolve) => heard.set(i, resolve));
  const t0 = performance.now();
  const res = await fetch(`${URL}/functions/v1/yolognese-measure`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ room, i, secret: ['red', 'blue', 'red', 'green'], guess: ['red', 'red', 'blue', 'green'] }),
  });
  const body = await res.json();
  const answered = performance.now() - t0;
  const seen = (await Promise.race([arrived, new Promise((r) => setTimeout(() => r(NaN), 5000))])) - t0;
  return { answered, seen, ...body };
};
const stats = (xs) => { const s = [...xs].sort((a, b) => a - b), q = (p) => s[Math.floor(p * (s.length - 1))].toFixed(0); return `median ${q(0.5)}  p90 ${q(0.9)}  min ${q(0)}  max ${q(1)}`; };
bob.subscribe(async (status) => {
  if (status !== 'SUBSCRIBED') return;
  await new Promise((r) => setTimeout(r, 1000));
  const first = await call(0);
  console.log(`first call (cold start): guesser answered ${first.answered.toFixed(0)} ms, rival saw it ${first.seen.toFixed(0)} ms, server ${first.serverMs.toFixed(0)} ms (db ${first.dbMs.toFixed(0)}, broadcast ${first.broadcastMs.toFixed(0)}), result ${first.exact} exact ${first.misplaced} misplaced`);
  const runs = [];
  for (let i = 1; i <= 30; i += 1) { runs.push(await call(i)); await new Promise((r) => setTimeout(r, 200)); }
  console.log('warm, 30 guesses (ms):');
  console.log('  guesser gets the score   ', stats(runs.map((r) => r.answered)));
  console.log('  rival sees it (broadcast)', stats(runs.map((r) => r.seen)));
  console.log('  inside the function      ', stats(runs.map((r) => r.serverMs)));
  console.log('    of which db query      ', stats(runs.map((r) => r.dbMs)));
  console.log('    of which broadcast call', stats(runs.map((r) => r.broadcastMs)));
  process.exit(0);
});
setTimeout(() => { console.log('timeout'); process.exit(1); }, 120000);
