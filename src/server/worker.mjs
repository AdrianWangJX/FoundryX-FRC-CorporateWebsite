import { submitInquiry } from './inquiries.mjs';
export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === '/api/inquiries') return submitInquiry(request, env, ctx);
    if (path.startsWith('/api/'))
      return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
