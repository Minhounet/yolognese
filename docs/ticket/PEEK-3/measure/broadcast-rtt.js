const { createClient } = require('../../../../node_modules/@supabase/supabase-js');
const WS = require('../../../../node_modules/ws');
const { HttpsProxyAgent } = require('../../../../node_modules/https-proxy-agent');
const agent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
class ProxiedWS extends WS { constructor(u, p) { super(u, p, { agent }); } }
const mk = () => createClient('https://uppezappkwsizsdyoalo.supabase.co', 'sb_publishable_spyYnc7Ia7i-yqpm1QIrjg_b4VQwVP_', { auth: { persistSession: false }, realtime: { transport: ProxiedWS } });
const room = 'yolognese:measure:' + Date.now();
const a = mk().channel(room, { config: { broadcast: { self: false } } });
const b = mk().channel(room, { config: { broadcast: { self: false } } });
const N = 30, times = [];
let sentAt = 0, i = 0;
const ping = () => { sentAt = performance.now(); a.send({ type: 'broadcast', event: 'ping', payload: { i } }); };
b.on('broadcast', { event: 'ping' }, ({ payload }) => b.send({ type: 'broadcast', event: 'pong', payload }));
a.on('broadcast', { event: 'pong' }, () => {
  times.push(performance.now() - sentAt);
  if (++i < N) setTimeout(ping, 100); else {
    const s = [...times].sort((x, y) => x - y), q = (p) => s[Math.floor(p * (s.length - 1))].toFixed(0);
    console.log(`round trips: ${N}  min ${q(0)} ms  median ${q(0.5)} ms  p90 ${q(0.9)} ms  max ${q(1)} ms  (one way ≈ half)`);
    process.exit(0);
  }
});
b.subscribe((s) => s === 'SUBSCRIBED' && a.subscribe((s2) => s2 === 'SUBSCRIBED' && setTimeout(ping, 1500)));
setTimeout(() => { console.log('timeout', times.length); process.exit(1); }, 60000);
