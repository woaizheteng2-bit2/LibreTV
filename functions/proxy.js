// LibreTV Cloudflare Pages Proxy Function (v1)
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const targetPath = url.pathname.replace('/proxy/', '');
  if (!targetPath) {
    return new Response('Missing proxy target', { status: 400 });
  }
  let targetUrl;
  try {
    targetUrl = decodeURIComponent(targetPath);
    new URL(targetUrl);
  } catch {
    return new Response('Invalid target URL', { status: 400 });
  }
  const authHash = url.searchParams.get('auth');
  const timestamp = url.searchParams.get('t');
  const serverHash = env.PASSWORD || '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
  if (!authHash || !serverHash || authHash !== serverHash) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (timestamp && (Date.now() - parseInt(timestamp)) > 600000) {
    return new Response('Auth expired', { status: 401 });
  }
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': new URL(targetUrl).origin,
      },
    });
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: 500, msg: 'Proxy error: ' + err.message, list: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
