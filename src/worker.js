const MAX_HOPS = 20;

function isPrivateHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local')) return true;
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = ipv4.slice(1).map(Number);
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 169 && b === 254 || a === 0;
}

async function traceRedirects(startUrl) {
  let current;
  try {
    current = new URL(startUrl);
  } catch {
    throw new Error('Not a valid URL');
  }
  if (!/^https?:$/.test(current.protocol)) throw new Error('Only http/https URLs are supported');

  const chain = [];
  const seen = new Set();

  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    if (isPrivateHost(current.hostname)) throw new Error(`Refused to fetch private/local address: ${current.hostname}`);
    const key = current.toString();
    if (seen.has(key)) {
      chain.push({ url: key, status: null, note: 'redirect loop detected' });
      return chain;
    }
    seen.add(key);

    let response;
    try {
      response = await fetch(key, { method: 'HEAD', redirect: 'manual' });
      if (response.status === 405 || response.status === 501) {
        response = await fetch(key, { method: 'GET', redirect: 'manual' });
      }
    } catch (e) {
      chain.push({ url: key, status: null, note: `request failed: ${e.message}` });
      return chain;
    }

    chain.push({ url: key, status: response.status });

    const isRedirect = response.status >= 300 && response.status < 400;
    const location = response.headers.get('location');
    if (!isRedirect || !location) return chain;

    try {
      current = new URL(location, key);
    } catch {
      chain.push({ url: location, status: null, note: 'unresolvable Location header' });
      return chain;
    }
  }

  chain.push({ url: current.toString(), status: null, note: `stopped after ${MAX_HOPS} hops` });
  return chain;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/trace') {
      const target = url.searchParams.get('url');
      if (!target) return Response.json({ error: 'Missing ?url=' }, { status: 400 });
      try {
        const chain = await traceRedirects(target);
        return Response.json({ chain });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 400 });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
