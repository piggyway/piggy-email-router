## Summary

<!--
Say what this PR does and why, in two to four short sentences.
-->

## Changes

<!--
Write one bullet per file.
Example: - `src/worker.ts`: log the R2 key when the ingest call fails.
-->

-

## Not in this PR

<!--
List related work that this PR does not do, and any piggy-backend PR this one needs.
Write "Nothing." when there is none.
-->

## Risk

<!--
Tier: Low is README.md only. Medium is anything else. High is a change to the forward order, R2 writes, the ingest call, wrangler.toml or .github/**.
The paths in the diff set the tier, not the author.
Give one line that says why.
-->

- Tier:
- Why:
- High-risk paths:

## How to revert

<!--
Write the steps to undo this change. Delete the lines that do not apply.
1. Code: revert the merge commit with `git revert -m 1 <merge sha>` and open a PR to `production`.
2. Worker: this Worker is deployed by hand, so a revert does nothing until you deploy again.
   To go back at once, run `npx wrangler rollback`.
3. Data: if the change wrote objects to the `piggyway-mail` bucket or sent data to piggy-backend, give the steps to undo it.
   Say whether the data change can be undone.
   If it cannot be undone, say so plainly.
4. Config: list any secret (`MAIL_INGEST_TOKEN`), `FORWARD_TO` value or Email Routing rule to restore by hand.
-->

- Code:
- Worker:
- Data:
- Config:

## Checks

<!--
This repo has no CI, so run each command locally and paste the result.
Write "not run" and the reason when you skip one.
-->

- `pnpm typecheck`:
- `pnpm check:bundle`:
