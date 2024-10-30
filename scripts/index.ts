import { Readable } from 'node:stream';

import type { NextConfig } from 'next';
import {
  NodeNextRequest,
  NodeNextResponse,
} from 'next/dist/server/base-http/node';
import { createRequestResponseMocks } from 'next/dist/server/lib/mock-request';
import NextNodeServer, {
  NodeRequestHandler,
} from 'next/dist/server/next-server';

// Injected at build time
const nextConfig: NextConfig = JSON.parse(
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG ?? '{}'
);

let requestHandler: NodeRequestHandler | null = null;

export default {
  async fetch(request: Request, env: any, ctx: any) {
    if (requestHandler == null) {
      globalThis.process.env = { ...globalThis.process.env, ...env };
      requestHandler = new NextNodeServer({
        conf: { ...nextConfig, env },
        customServer: false,
        dev: false,
        dir: '',
        minimalMode: false,
      }).getRequestHandler();
    }

    const url = new URL(request.url);

    if (url.pathname === '/_next/image') {
      let imageUrl =
        url.searchParams.get('url') ??
        'https://developers.cloudflare.com/_astro/logo.BU9hiExz.svg';
      if (imageUrl.startsWith('/')) {
        return Response.redirect(new URL(imageUrl, request.url));
      }
      return fetch(imageUrl, { cf: { cacheEverything: true } } as any);
    }

    const resBody = new TransformStream();
    const writer = resBody.writable.getWriter();
    let resBodyWritten = false;

    const reqBodyNodeStream = request.body
      ? Readable.fromWeb(request.body as any)
      : undefined;

    const { req, res } = createRequestResponseMocks({
      method: request.method,
      url: url.href.slice(url.origin.length),
      headers: Object.fromEntries([...request.headers]),
      bodyReadable: reqBodyNodeStream,
      resWriter: (chunk) => {
        resBodyWritten = true;
        writer.write(chunk).catch(console.error);
        return true;
      },
    });

    // Should add this to the mock implementation – only modify statusCode if not sent
    (res as any)._statusCode = res.statusCode;
    Object.defineProperty(res, 'statusCode', {
      get: function () {
        return this._statusCode;
      },
      set: function (val) {
        if (this.finished || this.headersSent) {
          return;
        }
        this._statusCode = val;
      },
    });

    let headPromiseResolve: any = null;
    const headPromise = new Promise<void>((resolve) => {
      headPromiseResolve = resolve;
    });
    res.flushHeaders = () => headPromiseResolve?.();

    if (reqBodyNodeStream != null) {
      const origPush = reqBodyNodeStream.push;
      reqBodyNodeStream.push = (chunk: any) => {
        req.push(chunk);
        return origPush.call(reqBodyNodeStream, chunk);
      };
    }

    ctx.waitUntil((res as any).hasStreamed.then(() => writer.close()));

    ctx.waitUntil(
      requestHandler(new NodeNextRequest(req), new NodeNextResponse(res))
    );

    await Promise.race([res.headPromise, headPromise]);

    res.setHeader('content-encoding', 'identity');

    return new Response(resBodyWritten ? resBody.readable : null, {
      status: res.statusCode,
      headers: (res as any).headers,
    });
  },
};
