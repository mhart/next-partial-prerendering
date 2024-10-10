// @ts-expect-error
import indexHtml from '../.next/server/app/index.html';
// @ts-expect-error
import indexMetaStr from '../.next/server/app/index.meta';

const encoder = new TextEncoder();
const indexHtmlBuffer = encoder.encode(indexHtml);

const indexMeta = JSON.parse(indexMetaStr);

interface FrontEnv {
  BACKEND: Fetcher;
}

export default {
  async fetch(request: Request, env: FrontEnv, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
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

      writer.write(indexHtmlBuffer);

      const doPostponeFetch = async () => {
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

      ctx.waitUntil(doPostponeFetch());

      return new Response(readable, { headers });
    }
    return env.BACKEND.fetch(request);
  }
};
