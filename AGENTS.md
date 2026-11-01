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
- Multi-tenant: an establishment = owner profile (`profiles.establishment_id`); sellers join via owner `invite_code`. Customer/sales rows are per seller (`vendor_id`), catalog (products/combos/loyalty) belongs to the owner and is readable by members; owner reads all team rows via RLS. UI filters customer lists by own `vendor_id`.
- Sales, stamps and credit deliveries go through SECURITY DEFINER RPCs (`register_sale`, `deliver_credit`) — keeps multi-table updates atomic and consistent.
- Public customer card reads only via `get_public_card(code)` RPC — anon never touches tables directly.
- Plan fields on `profiles` are not client-updatable (column-level grants); admin changes them via `admin_*` RPCs that check `has_role` — prevents self-activation.
- New vendor defaults (products, loyalty, combo) are created by the `handle_new_user` auth trigger.
- Financial math lives in `src/lib/finance.ts` with tests in `src/test/finance.test.ts`.
- Self-service (`/v/{slug}`) runs only through `self_*` RPCs validated by seller `public_slug` + customer `token` (stored in localStorage); core logic lives in internal `_do_sale`/`_do_deliver` (no client EXECUTE) shared with vendor RPCs. `sales.meta` stores what a sale changed so `undo_sale`/`undo_delivery` can reverse it.
- Existing-customer token recovery uses `self_identify_secure` with server-side card proof, transaction locks and persistent attempt state; failures return structured results rather than exceptions so lockouts and seller security events commit. The legacy identification entry cannot recover existing tokens.
- Card code presentation and WhatsApp messages are shared across customer and seller surfaces to keep recovery instructions consistent.
- Content routes define leaf metadata; the shared page metadata helper keeps required social fields consistent.
- Google and Apple sign-in use the managed Lovable OAuth helper and a public `/auth/callback`; navigate to protected pages only after `getUser` confirms the returned session. Invitation-based signup retains its existing email flow because OAuth cannot attach invitation metadata at account creation.
