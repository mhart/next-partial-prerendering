// Pages doesn't support rules, have to specify this as JSON
import indexMeta from '../server/app/index.meta.json';

export default {
  async fetch(request, env, ctx) {
    const { pathname, searchParams } = new URL(request.url);

    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      pathname === '/' &&
      !request.headers.get('rsc')
    ) {
      const headers = {
        ...indexMeta.headers,
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate',
        'x-matched-path': '/',
        'x-nextjs-cache': 'HIT',
        vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch'
      };

      if (request.method === 'HEAD') {
        return new Response(null, { headers });
      }

      const indexPath = '/cdn-cgi/app/index.html';
      const indexPromise = env.ASSETS.fetch('http://assets' + indexPath);

      const postponePath = '/_next/postponed/resume/index';
      const postponePromise = env.BACKEND.fetch(
        new Request('http://binding' + postponePath, {
          method: 'POST',
          headers: request.headers,
          body: indexMeta.postponed
        })
      );

      const { readable, writable } = new IdentityTransformStream();
      const writer = writable.getWriter();

      const doIndexAndPostponeFetch = async () => {
        const indexResponse = await indexPromise;
        if (!indexResponse.ok) {
          console.error('Not ok', indexResponse.status);
          console.error(await indexResponse.text());
        } else if (indexResponse.body != null) {
          // @ts-expect-error
          for await (const chunk of indexResponse.body) {
            writer.write(chunk);
          }
        }
        const postponeResponse = await postponePromise;
        if (!postponeResponse.ok) {
          console.error('Not ok', postponeResponse.status);
          console.error(await postponeResponse.text());
        } else if (postponeResponse.body != null) {
          // @ts-expect-error
          for await (const chunk of postponeResponse.body) {
            writer.write(chunk);
          }
        }
        writer.close();
      };

      ctx.waitUntil(doIndexAndPostponeFetch());

      return new Response(readable, { headers });
    }

    if (pathname === '/_next/image') {
      let imageUrl =
        searchParams.get('url') ?? 'https://developers.cloudflare.com/_astro/logo.BU9hiExz.svg';
      if (imageUrl.startsWith('/')) {
        return env.ASSETS.fetch('http://assets' + imageUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
      }
      return fetch(imageUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        cf: { cacheEverything: true }
      });
    }

    if (pathname.startsWith('/_next/static')) {
      return env.ASSETS.fetch(request);
    }

    return env.BACKEND.fetch(request);
  }
};
