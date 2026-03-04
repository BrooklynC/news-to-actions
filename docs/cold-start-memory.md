# Cold Start & Memory Profiling

## Cold Start Measurement

Vercel/serverless cold starts affect cron response time. To measure:

1. Use Vercel Analytics or custom timing: log `Date.now() - startTime` at the top of the cron handler and at first DB/Prisma call.
2. Trigger cron after idle period (e.g., 5+ minutes without requests) and compare to warm response.
3. Typical cold start: 200ms–2s for Node.js serverless; Prisma client generation adds to first request.

Mitigation: Keep minimal handlers; avoid heavy imports at top level.

## Memory Profiling

To profile memory:

```bash
# Node with inspector
node --inspect node_modules/.bin/next start

# Or use V8 heap snapshot
node --expose-gc --max-old-space-size=512 node_modules/.bin/next start
```

Then use Chrome DevTools → Memory tab to capture heap snapshots. Focus on:

- Prisma client retention
- Job runner memory per run
- Large payload buffers (export artifacts)

Vercel: Use Vercel dashboard → Functions → Logs for memory usage per invocation.
