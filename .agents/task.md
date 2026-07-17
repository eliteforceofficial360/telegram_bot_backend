# Tasks Checklist - Admin Fixes & Premium Redesign

- [ ] 1. Update Firestore Rules
  - [ ] Add access rules for `auditLogs` and `securityEvents` in `firestore.rules`
- [ ] 2. Fix Task Service Fallback
  - [ ] Edit `subscribeToTasks` in `taskService.ts` to allow empty task list
- [ ] 3. Fix Admin Actions (Task Edit/Delete, Ban/Unban)
  - [ ] Ensure Firebase Auth session is maintained and validated
  - [ ] Ensure proper CRUD operations for tasks inside `Admin.tsx`
  - [ ] Update user unban/ban triggers in `Admin.tsx`
- [ ] 4. Redesign Admin Panel UI
  - [ ] Style the Sidebar, Header, Dashboard, and views with premium dark glassmorphism
  - [ ] Improve forms, selectors, buttons, and alert layouts
- [ ] 5. Compilation & Build Verification
  - [ ] Run `npm run build` locally in `frontend` to verify compile success
- [ ] 6. Deploy to Vercel Production
  - [ ] Run `npx vercel --prod --yes` and verify production deployment
