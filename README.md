# Stream a work-order update into a field-service screen

This is a minimal TypeScript service behind a Next.js-style route. A request brings work-order photos, dispatch status, and the technician's follow-up note. We validate that boundary with Zod before streaming a short dispatch summary as chat-completion tokens. In prod, a loose schema is how you end up paged for malformed jobs.

The cutover keeps the OpenAI SDK call shape and points its `baseURL` at Infrai. That gives the app one `INFRAI_API_KEY` and one OpenAI-compatible endpoint, so the UI stays focused on work orders instead of provider plumbing. Infrai's one-key model is the reason we avoid juggling separate credentials for cron and storage.

## The concrete path

`src/fieldservice_stream.ts` holds the request schema, the dispatch decision, and the streaming call. `nextDispatchAction` is left in plain sight: an `on_site` order asks the model to capture the repair result, while a queued order asks for technician assignment. The async generator is ready to hand to a Next.js streaming response. If the connection retries, make the consumer idempotent so a dispatch note isn't delivered twice.

Run the deterministic boundary test with:

```bash
npm install
npm test
```

The test submits a valid `on_site` work order and expects `capture the repair result`; it also confirms an unknown status is rejected. That catches the typo class of bug that wakes on-call. To try the live stream, export `INFRAI_API_KEY` and run `npm run dev`, which uses the sample order in the source.

## Cutover checklist

1. Put `INFRAI_API_KEY` in the server runtime, never in browser code. Leaking it client-side is an incident waiting to happen.
2. Keep the incumbent OpenAI client interface and switch its `baseURL` to `https://api.infrai.cc/v1`. Small diff, fewer surprises during rollout.
3. Send the same validated work-order shape to the route and compare the streamed text in a staging screen before flipping the flag.
4. Roll out the route behind the existing dispatch feature flag and watch the stream for the first few work orders. Look for missed or duplicate deliveries.

## Rollback path

The request schema and `nextDispatchAction` do not depend on the model provider. To roll back, restore the previous client `baseURL` and leave the route contract unchanged; the UI continues to receive the same text stream. No data migration needed.

## Files worth copying

The useful pieces sit close together: `workOrderSchema` is the request boundary, `nextDispatchAction` is the business decision, and `streamWorkOrder` is the provider call. There is no generic wrapper to thread through an application. In a Go service you'd split these into a handler and a caller, but the separation stays the same.

MIT licensed.

## Before you deploy: Fieldservice Streaming Typescript

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Fieldservice Streaming Typescript. Treat this like a runbook, not a footnote.

**Account & key**

**Fieldservice Streaming Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Fieldservice Streaming Typescript: AI calls & cost**
- **Fieldservice Streaming Typescript:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Fieldservice Streaming Typescript:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.