# Unified header

Status: implemented

- A shared header appears on every route, including authentication, loading, and error states. It sits in normal document flow and scrolls away.
- Branding links Home: the supplied SVG logo plus Humperdinck text. Narrow screens retain only the logo.
- Repository and branch pickers are anchored left beside branding; the account menu is at the right.
- Home/About show a compact repository icon and chevron, with a tooltip and accessible label. No branch picker appears there.
- Repository screens display the selected repository and branch. Switching repository opens its default branch's Release screen; changing branch preserves Release/Settings.
- Release/Settings tabs remain below the header. Repository controls appear when signed in.
- Protect only actual pending Settings edits (including changelog marker edits), not generated differences on initial load or release drafts.
- Internal navigation and logout ask for native confirmation before discarding pending Settings edits. Cancel leaves the route, controls, and edits unchanged.
- Refresh/close uses the browser's standard warning while Settings edits are pending or saving. Browsers retain control over whether the user can leave.
- While saving Settings, internal navigation and logout are blocked with a visible saving indication. Success clears pending edits before navigating to Release; failure retains edits.

## Validation

Check route transitions, cancelled selections, successful/failed saves, pristine/new config loading, and narrow-screen layout. Run typechecking, production build, and relevant tests.

- Production build and typechecking passed; 31 tests passed, including navigation cancellation, redirect prompting, and save-state protection.
- Browser checks with local fixture data verified desktop/mobile headers, long repository names, compact Home chooser, branch switching that retains Settings, cancelled navigation retaining edits, and successful saves clearing protection before returning to Release.
- No live GitHub writes were performed during verification.

## Selected picker design

Selected direction A: inline repository and branch labels with matching outline icons, a subtle divider, and searchable menus. Neither picker has a down chevron. At the mobile breakpoint the repository uses its content width rather than expanding and pushing the branch right; the owner and brand logotype are hidden.

The full three-direction prototype is preserved on local branch `prototype/branch-picker`, commit `de373514756b0d5311bed1f7a840d5281fbeb171`. Run `npm run prototype:branch-picker` on that branch and open `/?variant=A` (or B/C). It includes the shared-header code needed to run the comparison. The sample repository screen is a design aid, not a requested replacement for the real release page.
