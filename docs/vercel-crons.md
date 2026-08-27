# Cron jobs

`vercel.json` holds two, and the explanation lives here because **vercel.json
cannot carry comments**. Vercel validates it against a strict schema and
rejects any property it does not recognise:

```
The `vercel.json` schema validation failed with the following message:
should NOT have additional property `_comment`
```

That is a **build failure**, not a warning. A `_comment` key added to explain
the very thing below took the whole deployment down.

## Why only two, and only daily

Vercel's Hobby plan allows at most **two cron jobs**, each running **no more
than once a day**. Exceeding either limit rejects the entire deployment rather
than ignoring the extra job, so the symptom is not "my cron did not run" - it
is "nothing I have pushed since is live", with no other sign.

Current jobs:

| Path | Schedule | |
| --- | --- | --- |
| `/api/cron/weekly-digest` | `0 6 * * 1` | Monday 06:00 |
| `/api/cron/trial-reminders` | `0 7 * * *` | Daily 07:00 |

## Webhook delivery

`/api/cron/webhooks` exists and works, but has **no entry in vercel.json**,
because a third job would breach the limit above. It is called at the end of
the `trial-reminders` run instead.

That means a queued lead can wait until the next daily run. Poor, but honest,
and nothing queues forever.

**On the Pro plan**, do both of these together:

1. Add to `vercel.json`:
   ```json
   { "path": "/api/cron/webhooks", "schedule": "*/5 * * * *" }
   ```
2. Delete the `deliverPending` call at the end of
   `app/api/cron/trial-reminders/route.ts`.

Doing only the first means every lead is delivered twice a day for no reason;
doing only the second means they are not delivered at all.

## Triggering a delivery by hand

The route is secured with `CRON_SECRET` (see `lib/cron-auth`), so it can be
called directly to flush the queue without waiting:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://www.cardtly.com/api/cron/webhooks
```
