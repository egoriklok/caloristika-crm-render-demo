# lunch_up_spb_lo_20260604 integration plan

## Physical Reality
- Runtime verified through WSL bash.
- The workspace root is not a Git repository, so branch enforcement and commits are unavailable in this checkout.
- Current app is a Next.js CRM with bot APIs and client catalog. No local `/miniapp` route exists yet.
- Strategy package exists at `../outputs/lunch_up_spb_lo_20260604`.

## Specification
- Treat `209498707_lunch_up_spb_lo_20260604` as the active strategy token.
- Expose the active strategy in dashboard data, agent manifest, bot catalog, and local miniapp.
- Make `/miniapp` open the active SPB+LO strategy by default when no `strategy` query is passed.
- Keep SPB delivery free Monday-Thursday, but explicitly state that LO is handled by agreed routes and individual delivery terms.
- Remove old SPB-only wording from system order terms, dashboard order rules, client catalog terms, and bot-facing examples.

## Verification
- Extend `npm run verify` to assert the active strategy token, SPB+LO package metadata, local miniapp route, and LO delivery guardrail.
- Run `npm run verify`.
- Run a production build.
- Start the local app and inspect `/miniapp` plus dashboard/catalog/bot catalog endpoints.
