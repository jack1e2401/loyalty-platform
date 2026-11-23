# Loyalty policy page design

## Intent

Give merchants one distinctive, trustworthy page for the current loyalty policy and its prior published versions. The current policy can be inspected and edited; prior versions remain immutable and read-only. Publishing an edit creates the next version.

## Goals

- Present current and historical policies together on the existing **Chính sách điểm** route.
- Make the current version visually distinct and easy to open.
- Show complete version details: earning rate/status, qualification mode, tier thresholds and multipliers, tier colors, and reset configuration.
- Require an in-app confirmation modal before publishing changes.
- Clearly mark fields unavailable on legacy versions when they were never snapshotted.
- Keep merchant scope and order policy snapshots intact.

## Non-goals

- No decorative stock imagery, generated illustration, remote assets, or gradient artwork.
- No editing or deleting a published historical version.
- No rollback that mutates the active version; reusing an old policy, if offered later, must create a new version.
- No change to point formulas, wallet balances, or transaction history.

## Approaches

1. **Policy register with a tier track (selected):** distinguish the current version using a compact dark-green header and current status; list older versions in a restrained timeline. Show tier colors and thresholds as a horizontal rank track or compact rows. The visual identity comes from merchant-configured data and typography, not decorative imagery.
2. **Uniform version cards:** simple stacked cards for all versions. Fastest, but makes current policy less prominent and feels generic.
3. **Dashboard with decorative artwork:** add hero artwork or stock images. Rejected because available product imagery is unrelated to policy and would add decoration without helping comparison.

## Interaction and layout

- Keep `/merchant/loyalty/history` as the **Chính sách điểm** page. The sidebar links to this ledger; it does not open the editor directly.
- Page header summarizes the current version and its publish date.
- The current policy expands into full read-only details. **Chỉnh sửa chính sách hiện tại** opens the full existing configuration form in edit mode. **Tạo chính sách mới** opens the same form prefilled from current settings.
- `/merchant/loyalty/config` renders the form only with an explicit `mode=edit` or `mode=new`; direct visits return to the policy ledger. Saving either mode opens an accessible confirmation modal and always publishes a new immutable version, even when a new-policy draft matches current values. Confirming updates the live policy and appends the snapshot atomically; cancelling leaves persisted data unchanged.
- Prior versions expand into read-only details with publisher and publication time. Their qualification mode and reset policy are shown only when present in the stored snapshot; legacy records show “Chưa được lưu trong phiên bản này.”
- On narrow screens, stack the current policy and version timeline. Tier track falls back to rows to avoid horizontal overflow.
- Keep one editor form for both new and edit modes; do not duplicate the configuration screen. The policy ledger is the default configuration entry point.

## Data and API

- Extend `LoyaltyPolicyVersion` snapshots with qualification mode and reset configuration. Keep existing columns and `tiers` JSON for backwards compatibility; avoid trying to reconstruct old snapshots from mutable `LoyaltyRule` values.
- Return the snapshot fields through the existing history API. Existing versions with absent snapshot fields remain readable and are explicitly marked incomplete in the UI.
- A save from either explicit editor mode must append a new policy version in the same transaction as updating the active rule and tiers. Historical rows and order references remain unchanged.
- `TierResetRun` remains the source for actual reset execution summaries; this page shows the reset policy captured in each version. Detailed per-member reset outcomes are outside this page milestone.

## Acceptance

- Current policy expands with full details; edit and new-policy actions open the shared form.
- Confirming either editor mode persists it and creates exactly one new version, including an unchanged new-policy draft; cancelling persists nothing.
- Prior versions are read-only and display their saved qualification/reset/tier snapshot.
- Legacy versions do not borrow current mutable config values and instead disclose missing historical fields.
- Tenant isolation and historical order snapshots remain intact.
- Frontend typecheck and focused frontend/backend tests pass; migrated local MySQL integration coverage runs if available.

## Remaining implementation calls

- Choose a compact rank-track rendering that degrades to rows on mobile.
- Use the existing `ConfirmActionDialog`; no new dialog dependency.
- Add a forward-only Prisma migration for snapshot columns; never reset the database.
