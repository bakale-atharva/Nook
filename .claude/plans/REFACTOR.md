# Nook refactor plan

## Context
Codebase-wide refactor to remove repeated code, nested/oversized components, and `any` types, and to apply the `vercel-composition-patterns` and `web-design-guidelines` skills, **without changing behavior**. Stack: Next.js 16, React 19, Convex, Clerk. Safety net: `pnpm test` (vitest + convex-test, 23 tests, backend only), `pnpm lint`, `tsc --noEmit`, `pnpm build`.

Hard constraints:
- Registered Convex function names/paths and public signatures stay identical (frontend calls `api.*`; queued scheduler jobs reference `internal.clerkSync.*`). Extract logic to `convex/lib/*`, keep thin registered wrappers.
- `ConvexError` payload shapes stay byte-identical (`lib/convex-errors.ts` reads `code/message/max/limit`; tests read `code`).
- Order of checks in handlers is observable (which error wins) - preserve it.
- No schema changes, no new indexes, no `returns`/validator tightening that could reject real data.

## Phase 0 - Safety net (before touching code)
Add characterization tests first (highest risk area is untested):
- `clerkSync` upserts/deletes/backfill + `http.ts` webhook path (user, org, membership, subscription).
- Auth errors (`NO_ACTIVE_ORG`, `UNAUTHENTICATED`, `USER_NOT_SYNCED`), permission denials (`FORBIDDEN` on edit/remove others' messages, `channels.create`), `channels.join/addMember/listAddable`, duplicate name, free-plan history cutoff, typing heartbeat/clear.
- Fix `messaging.test.ts:90` `(ctx.db as any).patch(...)` with a typed alternative (e.g. `ctx.db.system`/typed helper) - no `any`.

## Phase 1 - Backend (`convex/`)
1. **`lib/errors.ts`** - typed `ErrorCode` union + `notFound/forbidden/invalidArgument/planLimit` constructors and `errorCodeOf(err)`; replaces ~30 inline `new ConvexError({code})` and the parsing in `channelAccess.ts:84-87` / test helper. Payloads identical (NOT_FOUND sometimes has `message`, FORBIDDEN has `permission` from `requirePermission`, PLAN_LIMIT has `limit`/`max`). Share the `ErrorCode` type with `lib/convex-errors.ts`.
2. **`lib/limits.ts`** - `MAX_REACTIONS_READ` (dup in `messages.ts:26`, `reactions.ts:8`), the `500` scan/list caps (`channels.ts:21,349,378,382`, `dms.ts:13`, `users.ts:64`), batch sizes (`clerkSync.ts`, `cleanup.ts`, `messageCleanup.ts`), typed `FEATURES` / `PERMISSIONS` consts.
3. **`lib/users.ts`** - `displayName`, `displayImage`, `toUserSummary`, `listOrgUserSummaries(ctx, orgId, {excludeUserId?, limit?})` (merges `dms.listCandidates` and `users.listOrgMembers` bodies). Preserve differences: masking rules at `messages.ts:85-87,126-148`, `channels.ts:118-127,350-359,387-391`, `typing.ts:88-89`; `listMembers` returns a `deleted` flag instead of masking.
4. **`lib/auth.ts`** - `requireCaller(ctx, {permission?, user?})` (identity -> permission -> synced user) and `requireOrgPermission`. Migrate ~25 handlers, **except** where order differs: `messages.list` (user lookup after view check), `listThread`, `typing.list`, `historyHidden` (swallows all errors).
5. **`lib/access.ts` / `channelAccess.ts`** - `getInOrg(ctx, org, table, id, {onMissing})`, `loadViewableMessage`; widen `isDm` param and drop `rejectDm` duplicate (`channels.ts:24-28`); return membership from the view check to avoid the second fetch in `assertChannelMember`. Keep per-handler missing-resource behavior (throw vs `null` vs `[]`).
6. **Lookup helpers** - reuse existing `getMembership` (inlined at `channels.ts:254,281,321`); add `addChannelMember` (`channels.ts:209,261,328`, `dms.ts:86`), `getOrgMembership`, `getUserByClerkId` (also used by `getSyncedUser`), `getOrgByClerkId`, `getMembershipByClerkId`, `regularChannels`.
7. **`lib/validators.ts`** - `userSummaryValidator`, shared attachment field definitions (input/output/stored in `messages.ts` and `schema.ts`).
8. **clerkSync** - `lib/clerkUpserts.ts` (`upsertUserRecord/OrgRecord/MembershipRecord`) shared by webhook mutations and backfill `*Row` twins; `lib/cascade.ts` for `cascadeDeleteChannel` body; `deleteReactionsBatch` shared by `messageCleanup.ts:23-34` and `cleanup.ts:13-24`. Keep registered names. Preserve: username fallback only in webhook path, reschedule-vs-null for missing user on membership, `updated_at ?? Date.now()` only in webhook, non-uniform delete early-returns. **Do not fix** the `upsertSubscription` `updatedAt` quirk.
9. **`any` removal** - replace the four `v.any()` in `clerkSync.ts:71,121,266,324` with a typed approach that cannot reject real payloads: keep `v.any()` at the validator boundary only if unavoidable, but immediately narrow through a single typed parse function (e.g. `parseUserData(data: unknown): UserJSON` using Clerk's `WebhookEvent` types) so no `any` flows through code. If a strict `v.object` is chosen instead it must be verified against real payload fixtures - flagged below as a decision.
10. **File splits** - `messages.ts` -> `lib/messageHydrate.ts` + `lib/messageValidation.ts`; `channels.ts` -> `lib/sidebar.ts` (list assembly) + `lib/channelMembers.ts`; `clerkSync.ts` -> `lib/clerkUpserts.ts`, `lib/cascade.ts`, `lib/clerkBackfill.ts`; split `messaging.test.ts` by `describe` into `convex/*.test.ts` with shared helpers in a folder outside `convex/`.
11. **Client/server shared constants** - pure `convex/lib/mentionToken.ts` (regex + `MAX_MENTIONS`, exact duplicate of `lib/mentions.ts:5` / `convex/lib/mentions.ts:8`) and `convex/lib/constants.ts` (`MAX_BODY_LENGTH`, `MAX_ATTACHMENTS`, `MAX_ATTACHMENT_BYTES`, image types, `FREE_CHANNEL_LIMIT`, `DELETED_USER_NAME`) imported by both `messages.ts`/`channels.ts` and the frontend (`message-composer.tsx:16`, `use-attachments.ts:10-12`, `workspace-sidebar.tsx:37`, `convex-errors.ts:14`, `page.tsx:79`, `member-sidebar.tsx`). Preserve: client checks encoded body length, server checks trimmed body.

Out of scope (behavior/schema changing; list in final report): `.filter` after `withIndex` in `typing.ts:40,83` (needs index), unbounded `.collect()` `clerkSync.ts:317`, `identity.subject` vs `tokenIdentifier`, missing `returns` validators, `by_thread` index name, `process.env` in `auth.config.ts`.

## Phase 2 - Chat components (`components/message-*`, `thread-panel`, `mention-textarea`, hooks, `lib/`)
Finding: there are **no nested component definitions** in these files; the smells are one 438-line file, a redundant `variant` prop, ref plumbing, duplicated logic between feed and thread, and a11y gaps.

Order: shared helpers (mechanical) -> split `message-item` -> composer state -> optional pane context.

**Shared helpers (mechanical)**
- `lib/messages.ts`: `GROUP_WINDOW_MS`, `startsGroup(prev, curr, {breakOnDay?})` - replaces `message-list.tsx:16,120-123` and `thread-panel.tsx:17,88-91`.
- `hooks/use-scroll-to-newest.ts` - replaces `message-list.tsx:50-62` and `thread-panel.tsx:37-42` (also drops the `prevNewestId` state + `eslint-disable`).
- `lib/convex-errors.ts`: `toastConvexError(err, fallback)` (replaces 4-5 catch blocks: `message-item.tsx:102,299`, `message-composer.tsx:81`, `use-toggle-reaction.ts:59`, `use-attachments.ts:132`); guard `err.data` for null; drop the `?? 5` literal (use shared constant).
- Shared constants (see Phase 1 item 11) for `MAX_BODY_LENGTH`, attachment limits, accepted types (also fixes hard-coded "10 MB" toast at `use-attachments.ts:78`).
- `@utility text-label` (mono uppercase label, repeated in 7 files + `globals.css:230`) and `@utility focus-ring` (`outline-none focus-visible:ring-3 focus-visible:ring-ring/50`, repeated 6x).
- `components/user-avatar.tsx` (`message-item.tsx:244,319`, `mention-textarea.tsx:163`); `pluralize`/reply-count label (`message-item.tsx:251`, `thread-panel.tsx:81`); `initials` surrogate-pair fix in `lib/utils.ts`.
- `lib/time.ts`: hoist `Intl.DateTimeFormat` instances.
- `LabeledRule` replacing `DateDivider` + thread reply-count divider.
- Hoist `applyToggle` in `hooks/use-toggle-reaction.ts:37-45`.
- `emoji-picker.tsx`: extract `EmojiButton` (63-74 / 88-98), remove single-arg `cn`, hoist `steps`.
- `drop-zone.tsx`: extract `useFileDrop({onFiles})`.

**Split `message-item.tsx` -> `components/message/`** (`message-item` ~120 lines keeps row layout + edit/picker state)
- `message-body`, `message-edit-form`, `message-attachments` (incl. lightbox; `a.url!` -> type-guard `flatMap`; give lightbox `<img>` width/height), `message-reactions`, `message-thread-summary`, `message-actions` with an internal `MessageActionButton({label, icon, pressed?, onClick})` replacing 4 copy-pasted buttons (merge `title` into `aria-label`, or use existing `ui/tooltip`).
- Narrow props: each subcomponent takes only what it uses (not the whole `message`).
- `MessageBody.trailing` render-prop -> `edited?: boolean` (also fixes the `0` rendering when `editedAt` is 0).
- Remove redundant `variant` prop: feed always passes `onOpenThread`, thread never does; `!message.threadRootId` is always true in `messages.list`. `canReply = !!onOpenThread`.

**Composer state (composition patterns: lift state / decouple implementation)**
- `hooks/use-mention-draft.ts` (`value`, `members`, mention map via lazy init/ref, `encode()`, `reset()`), used by `MessageComposer` and `MessageEditForm` (removes duplicated `useQuery(listOrgMembers)`, `mentionMap`, `encodeMentions`, Enter/Escape handling).
- `ComposerProvider` owning `useAttachments()` + typing heartbeat, consumed by `MessageComposer` and `DropZone` -> deletes `ComposerHandle` / `useImperativeHandle` and the `composer` refs in `page.tsx` and `thread-panel.tsx`.
- `useTypingHeartbeat(channelId, enabled)`, `AttachmentPreviewList` extracted from `message-composer.tsx`.
- `use-attachments.ts`: drop redundant `previewUrls` state (derive from `items`), reuse `previewUrl` in `readDimensions` instead of a second blob URL.
- `MentionTextarea`: remove unused `ref`/`useImperativeHandle` and pass-through `onPaste`; add `onEnter`/`onEscape`; extract `MentionSuggestions`; move `findTrigger` + member filter into `lib/mentions.ts` (unit-testable); no button inside `role="option"` `li`.
- `ThreadPanel`: replace `title: ReactNode` render prop with a shared `ThreadHeader`; two `MessageItem` usages stop repeating `variant/threadRootId`.

**Optional (last): channel-pane context** `{channelId, currentUserId, canModerate, openThread, toggleReaction}` via React 19 `use(Context)`; removes prop drilling through page -> `MessageList`/`ThreadPanel` -> `MessageItem`. Most invasive; ship separately from the rest.

**Accessibility findings that change behavior (need approval - see Decisions)**
1. Action bar unreachable by keyboard/touch (`message-item.tsx:362-368`: `hidden group-hover:flex group-focus-within:flex`, row not focusable).
2. Mention menu stays suppressed after Esc (`mention-textarea.tsx:58,71,110`, `dismissedAt` never cleared) - real bug.
3. Non-grouped timestamp `hidden group-hover:inline`; no `<time dateTime>` (`message-item.tsx:256,324,325,334`).
4. Missing live regions: `message-list.tsx:76`, `typing-indicator.tsx:19,30` (single persistent `aria-live="polite"` wrapper; `Intl.ListFormat` for names).
5. Composer upload spinner has no accessible name (`message-composer.tsx:125`).
6. Enter/Tab in `MentionTextarea` missing `isComposing` guard (`:103`).
7. Missing `focus-visible` on "Upgrade to Pro" link (`message-list.tsx:83`) and mention option buttons.
8. Images without width/height: lightbox, composer previews.
9. Delete message has no confirmation/undo.
10. `useIsMobile()` initial `false` causes desktop `aside` -> Sheet remount on phones (`thread-panel.tsx`, `hooks/use-mobile.ts`).

## Phase 3 - App routes, sidebar, dialogs, shells

**Shared hooks / providers (dedupe)**
- `useOrgAccess()` -> `{canManageChannels, canPrivateChannels, canModerate, canManageBilling, isUnlimited, hasDms, isPro, isLoaded}`; replaces 8 `authLoaded && !!has?.(...)` sites in `workspace-sidebar.tsx:128-132`, `c/[channelId]/page.tsx:48-49`, `org/[slug]/layout.tsx:27`. Also removes the `canCreatePrivate` prop.
- `UpgradeProvider` + `useUpgradePrompt().promptUpgrade("channels" | "direct_messages")`, mounted once in the org layout with a single `<UpgradeDialog>` and one copy map shared with `convexErrorMessage`; deletes 3 local `upgradeOpen` states/dialogs (`create-channel-dialog.tsx:38,147`, `new-dm-dialog.tsx:36,167`, `workspace-sidebar.tsx:126,274`), the `reason`/`orgSlug` props, and the duplicated `isPlanLimit()` (-> `isPlanLimitError` in `lib/convex-errors.ts`). `FREE_CHANNEL_LIMIT` / `MAX_PEOPLE` come from the shared constants module.
- `useSubmitAction({run, onSuccess, onPlanLimit, fallback})` and `useSafeMutation(ref, fallback)` for the repeated try/catch + `toast.error(convexErrorMessage(...))` (`workspace-sidebar.tsx:134`, `page.tsx:84,102`, both dialogs, plus Phase 2 sites); `useToggleStar()` (dup at `workspace-sidebar.tsx:134` and `page.tsx:102`); `useOpenChannel()`; single-source hooks `useChannels()`, `useMe()`, `useCurrentOrg()`.
- `UserAvatar` (shared with Phase 2), `dmTitle(members, meId)` (`workspace-sidebar.tsx:41-47`, `page.tsx:76-80`), `ChannelIcon` (replaces nested ternaries `workspace-sidebar.tsx:68-83`, `page.tsx:125-131`), `SkeletonRows`, `EmptyState`.

**`workspace-sidebar.tsx` (282 lines)**
- Replace the inline `row` render-helper closure (`:147-159`) with a top-level `ChannelRow` that reads pathname / star hook itself (drops `href/active/meId/onToggleStar` props). Extract `ChannelBadge`, `SidebarSection({label, action?, state, empty, children})` (3 repeated group scaffolds `:194-259`, flatten nested ternaries `:211-217,239-256`), shared `SidebarChannel` type.
- Fix invalid DOM (`<p>`/`<Skeleton>` directly inside `<ul>` `SidebarMenu` at `:211-218,240-244`) - visual no-op.

**Dialogs**
- Compound `FormDialog` (`Trigger`, `Header`, `Body`, `Footer`) for `create-channel-dialog.tsx` / `new-dm-dialog.tsx` (~40 duplicated lines each); render form body as inner component so state resets on close (currently inconsistent: create resets on success only, DM on any close - **behavior change, see Decisions**). Fix mis-indented JSX `create-channel-dialog.tsx:73-153`. Extract `PersonRow` (`new-dm-dialog.tsx:123-148`).
- Guideline fixes: remove `autoFocus` (`:99`, `:108`), add `name`/`autoComplete="off"`, `type="search"` on filter, placeholders end with `…`.

**Channel page (219 lines, ~15 hooks)** `app/org/[slug]/c/[channelId]/page.tsx`
- `ChannelProvider` (`{channel, members, me, isMember, isDm, title, starred, canManage, canModerate, actions}`) + `useChannel()`; extract `ChannelHeader`, `ChannelSkeleton`, `JoinChannelPrompt`; `useChannelPanels()` for `showMembers` + `threadRootId`. Removes `currentUserId/canModerate/orgSlug/channelId` drilling into `MessageList`/`ThreadPanel` (ties in with Phase 2 pane context - do these together). Composer via `ComposerProvider` (Phase 2). `import type { Id }`; drop `channel!`.
- Split: server `page.tsx` awaiting `params` + client `channel-view.tsx`.

**Simplify / server-vs-client boundaries** (identical behavior)
- Remove needless `"use client"`: `settings/page.tsx`, `upgrade/page.tsx` (use `await params`), `onboarding/page.tsx`; `org/[slug]/layout.tsx` -> server layout taking `params`, extract `PastDueBanner`, `OrgAccessGuard`; `app/page.tsx` -> server page with a tiny client `GoToWorkspaceButton`, split `PricingSection`.
- `plan-sync.tsx` -> `usePlanSync(org)` hook called from the layout (reuses its `organizations.current` query; single `prev` ref). `store-user.tsx` + plan sync -> one `useWorkspaceSync()`.
- `hooks/use-mobile.ts` -> `useSyncExternalStore` (same `false` server/initial value).
- Shells: `HeroStage` shared by `auth-split-shell` / `marketing-shell`; `BrandMark`; `lib/marketing-copy.ts` for tagline + `HIGHLIGHTS`/`SPEC_ROWS`; one `<AuthPage mode>` (or shared `authAppearance`) for sign-in/sign-up; `hero-ghost`/`hero-outline` button variants; `.sheet` utility. `PreviewSheet` extracted from `chat-preview-mockup.tsx:46-81`; remove dead `transition-transform` (`:48`).
- `member-sidebar.tsx`: share `Member` type, use `UserAvatar`/`displayName`, `<h2>`, `aria-label`, tabular numbers.
- `globals.css`/`layout.tsx` guideline items that do not change look: `color-scheme` on `:root`, `export const viewport` with `themeColor`, `touch-action: manipulation`, global `prefers-reduced-motion` guard, `transition-all` -> explicit properties (`ui/sidebar.tsx:292`, `ui/badge.tsx:7`, `ui/button.tsx:6`), title template `%s · Nook`.

**Behavior-changing findings (not applied unless approved)**
- `store-user.tsx` never re-runs after onboarding (deps miss `orgId`) - fallback effectively dead.
- `handleLeave`/`handleDelete` (`page.tsx:92-100`) lack try/catch -> unhandled rejections, no toast; native `confirm()` -> dialog.
- `org/[slug]/layout.tsx` renders children before org loaded (flash "Channel not found").
- `org/[slug]/page.tsx` redirects to `channels[0]` which may be a DM/non-member channel; blank flash while loading.
- Star action hidden on touch (`max-md:hidden`); `DUPLICATE_NAME` only as toast; DM selection silently capped at `MAX_PEOPLE`.
- Dark mode is dead (`.dark` never applied; no ThemeProvider) but Sonner follows OS dark.
- Convex provider/Toaster/Tooltip wrap every route incl. marketing/auth (moving them under `app/org/` is a bundle win but changes provider scope).

## Decisions (confirmed with user)
1. **Fix everything found.** All "behavior-changing findings" above and the a11y list in Phase 2 are IN scope (keyboard/touch-reachable action bar, mention Esc bug, `<time>`, live regions, `isComposing`, focus-visible, img dimensions, delete confirmation dialog instead of `confirm()`/no-undo, try/catch+toast on leave/delete, `store-user` deps fix, layout waits for org before rendering children, redirect to first non-DM member channel + skeleton, touch-accessible star, inline `DUPLICATE_NAME` error, DM cap feedback). Dark mode: nothing applies `.dark` today; I will make the app explicitly light (remove dead `.dark` tokens, pass `theme="light"` to Sonner) rather than introducing a theme switcher - flag in PR description. Providers: move Convex/Tooltip/Toaster under `app/org/` only if `tsc`/`build` and sign-in/onboarding flows verify clean; otherwise leave and note in PR.
2. **`v.any()` -> strict `v.object` validators** for the four `clerkSync` internal mutations (`:71,121,266,324`). Mitigation for real-payload risk: only validate fields we read; mark Clerk-nullable fields `v.optional(v.union(v.string(), v.null()))`; add tests with realistic Clerk webhook fixtures (Phase 0) and verify `http.ts` passes matching shapes. Also remove `as any` in `messaging.test.ts:90`.
3. **Delivery:** new branch off `master` (e.g. `refactor/composition-and-guidelines`), one commit per phase (tests, backend, chat components, routes/dialogs), each with tsc + lint + test + build green.
4. **After implementation: open a PR** with `gh pr create` against `master` (push the branch first). PR body: summary per phase, list of behavior fixes, list of items intentionally left out (Convex `.filter`/index, unbounded `.collect`, `tokenIdentifier`, `returns` validators, `upsertSubscription` `updatedAt` quirk), verification results, and the required attribution line. Do not enable auto-merge. Before creating the PR, `git status` check: leave unrelated pre-existing changes (`convex/_generated/api.d.ts`, `skills-lock.json`, `.claude/skills/*`, `.impeccable/`) out of the commits unless `api.d.ts` changes as a result of new/moved modules.

## Verification (every phase)
- `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build` green after each phase; one commit per phase.
- `grep -rnE "\bany\b|as any|v\.any\(\)"` over `app components hooks lib convex` (excluding `_generated`) returns nothing except deliberate, commented boundaries.
- Manual pass with `preview_start` on the dev server: sign in, open a channel, send/edit/delete message, react, open thread (desktop + mobile width), attach image, @mention, create channel, new DM, upgrade dialog.
- Finally push the branch and open the PR (Decisions #4).