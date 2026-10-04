# Execution

1. Inspect current desktop/phone home and real-cookie room renders; retain
   diagnostic screenshots under /tmp and record specific issues.
2. Implement the architectural entry and cohesive room presentation through
   existing components, application CSS and core-owned dictionary/theme tokens.
3. Inspect desktop 1440/1280, phone 375/320, tablet 768 and landscape renders;
   exercise anonymous, registration, signed-in and populated room states.
4. Extend meaningful browser assertions for any new responsive/motion behavior.
   Run entry desktop/phone, real-cookie, room-control/layout/media regressions.
5. Run ./dx bun run lint, typecheck, test, contract:drift and React build.
6. Record an eight-dimension visual audit and exact evidence; iterate on defects.
   Leave the task active while requirements or visual judgment remain unresolved.

Validation uses the isolated memory fixture on 3000/5173. Existing user services
and configuration are preserved. Stop only the owned fixture at session closure.
No new dependencies are planned. Rollback is the scoped product diff, preserving
the task evidence and unrelated work. Commit/archive require scoped authorization.
