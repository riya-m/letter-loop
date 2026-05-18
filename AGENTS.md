# Session Context - 2026-05-17

## Product Direction Confirmed

- Building a LetterLoop clone for a friend group.
- Admin manually controls lifecycle phases:
  - Phase 1: question addition
  - Phase 2: answering
  - Phase 3: published/read-only
- Once published, loop cannot go back to phase 1 or 2.
- Auth mode: Supabase email magic link.
- Access control: invited emails only.
- No explicit join flow; all invited users can see all loops.
- Nicknames should be used everywhere instead of profile names.
- Nicknames changed from per-loop to global (admin-managed).
- Admin should not be able to view answers in manage page before publish.
- On closed/published loops, dashboard should show only "View Published" for everyone.

## Major Code Changes Implemented

- Replaced old jsonblob/localStorage flow with Supabase-backed data flow.
- Added auth/session gating in app shell.
- Added invite-based access check and access-pending UX.
- Refactored data layer in `src/lib/store.ts` for:
  - invited context checks
  - loop listing/creation
  - phase advancement (forward-only)
  - question/answer writes with phase checks
  - global nickname resolution and save
- Updated dashboard actions by role and phase.
- Updated admin page:
  - forward-only phase control
  - global nickname editor
  - removed live answer preview
- Updated submit/newsletter pages to use global nicknames.
- Added phase-2 fixed section flow with seeded prompts:
  - Announcements
  - Shout-outs
  - Mann-ki-baat
  - Questions section remains phase-1 question based
- Added optional multiline responses and optional image uploads for:
  - fixed section responses
  - question answers
- Added compact image rendering in published view and then updated to vertically stacked answer rows.
- Added light UI redesign and then tuned it to be less pink (warmer neutral palette).
- Updated browser title from `Pulse` to `LetterLoop`.
- Updated types to match Supabase model.
- Removed jsonblob proxy config from Vite/Vercel config.
- Replaced template README with project + SQL setup instructions.
- **Rich text editor for questions and answers:**
  - Custom `RichTextEditor` component extracted to `src/components/RichTextEditor.tsx` (no external editor library).
  - Shared utilities in `src/lib/richText.ts`: `sanitizeRichText`, `toPlainText`, `normalizeLineBreaks`.
  - Toolbar: Bold, Italic, Underline, Ordered list, Unordered list, Link, Clear formatting.
  - Elegant subtle styling: light background (`#f8f6f2`), small square buttons with hover effects, dividers between groups.
  - Sanitizes HTML with `DOMPurify` (allowed tags: p, br, strong, em, b, i, u, ul, ol, li, a).
  - Stores both `rich_text` (sanitized HTML) and `text` (plain text) for each answer/question.
  - Draft autosave includes rich text.
  - Published view renders rich text with formatting preserved.
  - Links open in new tab with `noopener noreferrer`.
  - Lists (`ul`, `ol`) styled with `list-style-position: inside` to prevent overflow in editor and published view.
- **Phase-2 answer drafts with cloud autosave:**
  - Answers auto-save to Supabase on debounce (~900ms) while typing.
  - Drafts persist across refresh, tab switch, and devices.
  - No submit button in phase 2; answers lock when admin moves to phase 3.
  - Draft tables: `question_drafts`, `answer_drafts` with RLS policies.
  - Phase 3 transition trigger publishes drafts into final answer tables.
- **Email notifications via Brevo:**
  - Replaced Resend with Brevo (forever free tier, single sender verification, no domain required).
  - Sends emails on loop create (phase 1), phase 2 transition, and phase 3 publish.
  - Serverless endpoint `api/notify-loop.ts` validates admin auth, fetches active invites, sends per-recipient with rate limiting.
  - Env vars: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`.
  - Throttled sends (250ms delay) to respect Brevo rate limits.

## Infra/Deployment Notes

- Project deployed to Vercel account `pranjalminocha13-2677` using CLI deployments.
- Active production alias: `https://letter-loop-psi.vercel.app`.
- GitHub auto-deploy not enabled because repo ownership/integration access is unavailable.
- Deployment workflow: push to GitHub, then deploy via `npx vercel --prod`.
- Vercel env vars required:
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client)
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only, for email endpoint)
  - `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` (server-only)

## Supabase Notes

- Supabase project created and env vars configured in Vercel.
- Encountered "Access pending" issues due to invite/policy/schema mismatches.
- Global nickname required schema patch (`invited_emails.nickname`).
- Policies/functions updated guidance provided for `is_invited`, `is_global_admin`, and invited table read/update policies.
- Additional schema introduced for new content model:
  - `section_prompts`
  - `prompt_answers` (added `rich_text` column)
  - `question_answers` (added `rich_text` column)
  - `questions` (added `rich_text` column)
  - `question_drafts` (added `rich_text` column)
  - `answer_drafts` (added `rich_text` column)
- Storage bucket required for images:
  - `loop-images` (public bucket)
  - storage policies for read + invited upload
- Supabase SQL policy syntax note:
  - `create policy if not exists` failed in this environment; use `drop policy if exists` + `create policy`.
- **Publish trigger:** `publish_loop_drafts()` runs on phase transition to 3, copies drafts to final tables including `rich_text`, then deletes drafts. Uses `security definer` to bypass RLS.

## Validation Notes

- Local build/lint checks passed after refactor (`tsc`, `eslint`).
- Local dev server blocked in this environment by Node 18 vs Vite 8 Node 20+ requirement.
- Manual Playwright MCP validation was partially blocked by expired magic links; user performed comprehensive functional testing and reported it working.
- Playwright MCP verified:
  - deployed app loads correctly
  - page title is now `LetterLoop`
  - mobile viewport sanity check (390x844) for unauthenticated screens
  - authenticated end-to-end checks still require fresh magic links when needed

## Git Notes

- A local commit was created and later pushed by user.
- `.playwright-mcp/` was added to `.gitignore`.

## Next Session Checklist

- Verify Supabase schema is fully aligned with current README SQL, including:
  - `invited_emails.nickname`
  - `section_prompts`, `prompt_answers`, `question_answers` (with `rich_text` columns)
  - `question_drafts`, `answer_drafts` (with `rich_text` columns)
  - storage bucket + policies (`loop-images`)
- Reconfirm admin + member login works without "Access pending" using fresh magic links.
- Run a complete manual browser pass:
  - admin dashboard buttons by phase
  - member dashboard buttons by phase
  - global nickname update and propagation
  - fixed section answering flow (phase 2)
  - optional question answering (can skip questions)
  - image upload + published rendering
  - phase 3 lock behavior + published view
  - rich text formatting (bold, italic, lists, links) preserved in published view
  - draft autosave across refresh/tab/device
  - email notifications on phase transitions
- If any auth/policy bug appears, inspect Supabase policy logs before frontend changes.
- Keep deployment flow: push to GitHub, then `npx vercel --prod`.
