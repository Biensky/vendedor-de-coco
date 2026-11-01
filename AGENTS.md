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

# Architecture rules
- Multi-tenant: every app table has `vendor_id` (defaults to auth.uid()) with a "vendor own" RLS policy — keeps each vendor isolated.
- Sales, stamps and credit deliveries go through SECURITY DEFINER RPCs (`register_sale`, `deliver_credit`) — keeps multi-table updates atomic and consistent.
- Public customer card reads only via `get_public_card(code)` RPC — anon never touches tables directly.
- Plan fields on `profiles` are not client-updatable (column-level grants); admin changes them via `admin_*` RPCs that check `has_role` — prevents self-activation.
- New vendor defaults (products, loyalty, combo) are created by the `handle_new_user` auth trigger.
- Financial math lives in `src/lib/finance.ts` with tests in `src/test/finance.test.ts`.
