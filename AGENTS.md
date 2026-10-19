<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture
- Keep the workbook-derived draw bands, match graph and result propagation in a browser-safe domain module; this makes all winner/loser paths independently testable.
- Share tournament state through a root provider and persist signed-in users' state in owner-scoped Lovable Cloud rows; unsigned-in users can try the tournament without granting public write access.
- Keep the tournament context and consumer hook in a separate browser-safe module from the provider component; hot updates must not create different context identities for the root and its consumers.
- Use separate TanStack content routes for the bracket, teams and standings; this preserves navigable views while sharing the same tournament state.
- Parse participant files locally with a dynamically imported Excel reader and keep validation/state replacement in a browser-safe domain module; private source fields never enter tournament state and import rules stay independently testable.
