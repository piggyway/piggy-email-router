# piggy-email-router

Cloudflare Email Worker for the PiggyWay mailboxes `support@piggyway.com.au` and `hello@piggyway.com.au`.
Cloudflare Email Routing sends each message for these two addresses to this Worker.
The Worker forwards the message to the team Gmail inboxes, stores the raw message in R2, and tells piggy-backend to file it in the admin mailbox.

## Order of operations

The handler in `src/worker.ts` runs these steps for each message:

1. Forward the message to every address in `FORWARD_TO`, in parallel, and wait for all of them.
2. Read the raw MIME and compute the R2 key `inbound/<sha256>.eml`.
   The hash input is the `Message-ID` header, or the raw bytes when the header is missing.
3. If the key already exists in R2, skip the write and log `MAIL_R2_KEY_EXISTS`.
   Otherwise, put the raw message with content type `message/rfc822` and the custom metadata `envelope_from`, `envelope_to` and `received_at`.
4. Call `POST /api/v1/webhooks/mail/ingest` on piggy-backend through the `BACKEND` service binding.
   The body is `{ "key": "<r2 key>" }` and the header `x-mail-ingest-token` carries `MAIL_INGEST_TOKEN`.
   This call runs in `ctx.waitUntil`, after the handler returns.

Gmail delivery never depends on R2 or on the backend.
An R2 failure or an ingest failure is only logged; the handler does not throw.
If a forward fails, the handler throws before step 2, so nothing goes to R2.

The Worker reads the raw message only after forwarding.
A Worker that reads the raw message before it forwards was never tested, so keep this order.

## Addresses and subaddressing

Email Routing subaddressing is on for the zone.
Admin replies set Reply-To to `support+<thread id>@` or `hello+<thread id>@`.
A customer answer to that address reaches this Worker through the normal `support@` or `hello@` rule.
piggy-backend reads the `+<thread id>` part to put the answer in the same thread.

The Email Routing rules that point the two addresses at this Worker live in the Cloudflare dashboard, not in this repo.

## Bindings and secrets

| Name                | Kind            | Value                                                    |
| ------------------- | --------------- | -------------------------------------------------------- |
| `FORWARD_TO`        | var             | Comma-separated Gmail addresses, set in `wrangler.toml`  |
| `MAIL_BUCKET`       | R2 bucket       | `piggyway-mail` (`piggyway-mail-dev` for `wrangler dev`) |
| `BACKEND`           | service binding | The `piggy-backend` Worker                               |
| `MAIL_INGEST_TOKEN` | secret          | Same value as `MAIL_INGEST_TOKEN` on piggy-backend       |

Set the secret with `npx wrangler secret put MAIL_INGEST_TOKEN`.
If you rotate it, set the new value on piggy-backend and on this Worker at the same time.
Never write the value into this repo.

## Deploy

This Worker has no Workers Builds trigger, so a merge to `production` does not deploy it.
Deploy by hand from an up-to-date `production` checkout:

```bash
npm install
npx wrangler deploy
```

`npm run deploy` runs the same `wrangler deploy`.

## Debug missing mail

Check each step in order, and stop at the first one that failed.

1. Email Routing activity log in the Cloudflare dashboard: did the message reach the Worker?
2. Workers Logs for `piggy-email-router` (observability is on), or a live `npx wrangler tail`.
   Look for these log codes:
   - `MAIL_R2_WRITE_FAILED`: the R2 put failed, so the backend was not told about the message.
   - `MAIL_INGEST_NOTIFY_FAILED`: the backend call failed. The log line holds the HTTP status and the first 200 characters of the response body.
   - `MAIL_R2_KEY_EXISTS`: the same `Message-ID` arrived again. This is normal for a resend and does not mean a failure.
3. R2 bucket `piggyway-mail`, prefix `inbound/`: is the object there?
4. piggy-backend logs and the reconcile cron.
   The backend re-ingests `inbound/` objects from the last 48 hours every 30 minutes, so a failed notify usually recovers by itself.
   See the piggy-backend docs for the reconcile log line.

An object in R2 means that every forward call for that message succeeded, because the Worker forwards first.
If Gmail still shows nothing, look at Gmail spam and filters next.
