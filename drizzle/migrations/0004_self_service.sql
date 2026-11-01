
alter table public.profiles add column public_slug text unique;
alter table public.profiles add column self_max_units int not null default 5;
alter table public.profiles add column self_min_interval_min int not null default 10;
update public.profiles set public_slug = lower(public.gen_code()) where public_slug is null;
grant update (self_max_units, self_min_interval_min) on public.profiles to authenticated;

alter table public.customers add column token text unique default replace(gen_random_uuid()::text, '-', '');
alter table public.customers add column last_self_at timestamptz;
update public.customers set token = replace(gen_random_uuid()::text, '-', '') where token is null;

alter table public.sales add column origin text not null default 'vendedor';
alter table public.sales add column meta jsonb not null default '{}';
alter table public.deliveries add column origin text not null default 'vendedor';
alter table public.deliveries add column sale_id uuid references public.sales(id) on delete cascade;

alter publication supabase_realtime add table public.sales;
alter publication supabase_realtime add table public.deliveries;

-- slug for new users
create or replace function public.set_public_slug() returns trigger language plpgsql as $$
begin
  if new.public_slug is null then new.public_slug := lower(public.gen_code()); end if;
  return new;
end $$;
create trigger profiles_slug before insert on public.profiles for each row execute function public.set_public_slug();

-- core sale (internal)
create or replace function public._do_sale(_uid uuid, _customer_id uuid, _items jsonb, _combo_id uuid, _payment text, _take_now boolean, _origin text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  est uuid := est_of(_uid);
  sid uuid; it jsonb; p record; c record; l record; q int;
  v_total numeric := 0; v_cost numeric := 0; lines jsonb := '[]'; loyal_qty int := 0; rewards int := 0;
  take boolean := coalesce(_take_now, true) or _customer_id is null;
begin
  if not vendor_is_active(_uid) then raise exception 'Plano suspenso ou vencido'; end if;
  if _customer_id is not null and not exists (select 1 from customers where id = _customer_id and vendor_id = _uid) then
    raise exception 'Cliente inválido'; end if;

  insert into sales (vendor_id, customer_id, combo_id, payment, take_now, origin) values (_uid, _customer_id, _combo_id, coalesce(_payment,'dinheiro'), take, coalesce(_origin,'vendedor')) returning id into sid;

  if _combo_id is not null then
    select * into c from combos where id = _combo_id and vendor_id = est and active;
    if not found then raise exception 'Combo inválido'; end if;
    v_total := v_total + c.price;
    for it in select * from jsonb_array_elements(c.items) loop
      select * into p from products where id = (it->>'product_id')::uuid and vendor_id = est;
      if found then
        q := (it->>'qty')::int;
        insert into sale_items (vendor_id, sale_id, product_id, qty, unit_price, unit_cost) values (_uid, sid, p.id, q, 0, coalesce(p.cost,0));
        v_cost := v_cost + q * coalesce(p.cost,0);
        lines := lines || jsonb_build_object('product_id', p.id, 'qty', q, 'kind', 'pago', 'cost', coalesce(p.cost,0));
      end if;
    end loop;
    if c.reward_product_id is not null and c.reward_qty > 0 then
      select * into p from products where id = c.reward_product_id;
      insert into sale_items (vendor_id, sale_id, product_id, qty, unit_price, unit_cost, is_reward) values (_uid, sid, p.id, c.reward_qty, 0, coalesce(p.cost,0), true);
      lines := lines || jsonb_build_object('product_id', p.id, 'qty', c.reward_qty, 'kind', 'brinde', 'cost', coalesce(p.cost,0));
    end if;
  end if;

  for it in select * from jsonb_array_elements(coalesce(_items,'[]')) loop
    q := (it->>'qty')::int;
    if q is null or q <= 0 then continue; end if;
    select * into p from products where id = (it->>'product_id')::uuid and vendor_id = est and active;
    if not found then raise exception 'Produto inválido'; end if;
    insert into sale_items (vendor_id, sale_id, product_id, qty, unit_price, unit_cost) values (_uid, sid, p.id, q, p.price, coalesce(p.cost,0));
    v_total := v_total + q * p.price;
    v_cost := v_cost + q * coalesce(p.cost,0);
    lines := lines || jsonb_build_object('product_id', p.id, 'qty', q, 'kind', 'pago', 'cost', coalesce(p.cost,0));
  end loop;

  if jsonb_array_length(lines) = 0 then raise exception 'Venda vazia'; end if;

  for it in select * from jsonb_array_elements(lines) loop
    if take then
      insert into deliveries (vendor_id, customer_id, product_id, kind, qty, unit_cost, origin, sale_id)
      values (_uid, _customer_id, (it->>'product_id')::uuid, it->>'kind', (it->>'qty')::int, (it->>'cost')::numeric, coalesce(_origin,'vendedor'), sid);
    else
      insert into credits (vendor_id, customer_id, product_id, kind, qty)
      values (_uid, _customer_id, (it->>'product_id')::uuid, it->>'kind', (it->>'qty')::int)
      on conflict (customer_id, product_id, kind) do update set qty = credits.qty + excluded.qty;
    end if;
  end loop;

  if _customer_id is not null then
    select * into l from loyalty where vendor_id = est and active;
    if found and l.product_id is not null and l.required_qty > 0 then
      select coalesce(sum((x->>'qty')::int),0) into loyal_qty from jsonb_array_elements(lines) x
        where x->>'kind' = 'pago' and (x->>'product_id')::uuid = l.product_id;
      if loyal_qty > 0 then
        update customers set stamps = stamps + loyal_qty where id = _customer_id returning stamps into q;
        rewards := q / l.required_qty;
        if rewards > 0 then
          update customers set stamps = q % l.required_qty where id = _customer_id;
          if l.reward_product_id is not null then
            insert into credits (vendor_id, customer_id, product_id, kind, qty)
            values (_uid, _customer_id, l.reward_product_id, 'brinde', rewards * l.reward_qty)
            on conflict (customer_id, product_id, kind) do update set qty = credits.qty + excluded.qty;
          end if;
        end if;
      end if;
    end if;
  end if;

  update sales set total = v_total, cost = v_cost,
    meta = jsonb_build_object('lines', lines, 'stamps_added', loyal_qty, 'reward_events', rewards,
      'required', coalesce(l.required_qty, 0), 'reward_product_id', l.reward_product_id, 'reward_qty', coalesce(l.reward_qty, 0))
  where id = sid;
  return sid;
end $$;

create or replace function public.register_sale(_customer_id uuid, _items jsonb, _combo_id uuid, _payment text, _take_now boolean)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  return _do_sale(auth.uid(), _customer_id, _items, _combo_id, _payment, _take_now, 'vendedor');
end $$;

create or replace function public._do_deliver(_uid uuid, _customer_id uuid, _product_id uuid, _kind text, _qty int, _origin text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cur int; pc numeric; did uuid;
begin
  if not vendor_is_active(_uid) then raise exception 'Plano suspenso ou vencido'; end if;
  select qty into cur from credits where customer_id = _customer_id and product_id = _product_id and kind = _kind and vendor_id = _uid for update;
  if cur is null or _qty is null or cur < _qty or _qty <= 0 then raise exception 'Crédito insuficiente'; end if;
  update credits set qty = qty - _qty where customer_id = _customer_id and product_id = _product_id and kind = _kind;
  select coalesce(cost,0) into pc from products where id = _product_id;
  insert into deliveries (vendor_id, customer_id, product_id, kind, qty, unit_cost, origin)
  values (_uid, _customer_id, _product_id, _kind, _qty, pc, coalesce(_origin,'vendedor')) returning id into did;
  return did;
end $$;

create or replace function public.deliver_credit(_customer_id uuid, _product_id uuid, _kind text, _qty int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  perform _do_deliver(auth.uid(), _customer_id, _product_id, _kind, _qty, 'vendedor');
end $$;

revoke execute on function public._do_sale(uuid,uuid,jsonb,uuid,text,boolean,text) from public, anon, authenticated;
revoke execute on function public._do_deliver(uuid,uuid,uuid,text,int,text) from public, anon, authenticated;

-- public self-service API
create or replace function public._self_ctx(_slug text, _token text, out vendor uuid, out customer uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  select id into vendor from profiles where public_slug = lower(_slug);
  if vendor is null then raise exception 'Vendedor não encontrado'; end if;
  if _token is not null then
    select id into customer from customers where token = _token and vendor_id = vendor;
    if customer is null then raise exception 'Cliente não reconhecido'; end if;
  end if;
end $$;
revoke execute on function public._self_ctx(text,text) from public, anon, authenticated;

create or replace function public.self_vendor(_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v record; est uuid;
begin
  select * into v from profiles where public_slug = lower(_slug);
  if not found then return null; end if;
  est := v.establishment_id;
  return jsonb_build_object(
    'slug', v.public_slug,
    'seller', coalesce(v.display_name, ''),
    'business', (select business_name from profiles where id = est),
    'active', vendor_is_active(v.id),
    'max_units', (select self_max_units from profiles where id = est),
    'loyalty', (select jsonb_build_object('required', l.required_qty, 'product', p.name, 'reward', rp.name, 'reward_qty', l.reward_qty, 'active', l.active)
                from loyalty l left join products p on p.id = l.product_id left join products rp on rp.id = l.reward_product_id where l.vendor_id = est),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'price', price) order by created_at) from products where vendor_id = est and active), '[]'),
    'combos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'price', price) order by created_at) from combos where vendor_id = est and active), '[]')
  );
end $$;

create or replace function public.self_identify(_slug text, _name text, _whatsapp text) returns text
language plpgsql security definer set search_path = public as $$
declare ctx record; digits text := regexp_replace(coalesce(_whatsapp,''), '\D', '', 'g'); tok text;
begin
  select * into ctx from _self_ctx(_slug, null);
  if length(digits) < 10 or length(digits) > 13 then raise exception 'WhatsApp inválido'; end if;
  if length(trim(coalesce(_name,''))) < 2 then raise exception 'Informe seu nome'; end if;
  if not vendor_is_active(ctx.vendor) then raise exception 'Este vendedor não está aceitando autoatendimento no momento'; end if;
  select token into tok from customers where vendor_id = ctx.vendor and right(regexp_replace(coalesce(whatsapp,''), '\D', '', 'g'), 11) = right(digits, 11) limit 1;
  if tok is null then
    insert into customers (vendor_id, name, whatsapp, notes) values (ctx.vendor, left(trim(_name), 80), digits, 'Cadastro por autoatendimento') returning token into tok;
  end if;
  return tok;
end $$;

create or replace function public.self_card(_slug text, _token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ctx record; c record;
begin
  select * into ctx from _self_ctx(_slug, _token);
  select * into c from customers where id = ctx.customer;
  return get_public_card(c.code) || jsonb_build_object(
    'credit_items', coalesce((select jsonb_agg(jsonb_build_object('product_id', cr.product_id, 'product', p.name, 'kind', cr.kind, 'qty', cr.qty)) from credits cr join products p on p.id = cr.product_id where cr.customer_id = c.id and cr.qty > 0), '[]'));
end $$;

create or replace function public.self_register_sale(_slug text, _token text, _items jsonb, _combo_id uuid, _take_now boolean, _payment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ctx record; est uuid; maxu int; mins int; units int := 0; last timestamptz; sid uuid; s record;
begin
  select * into ctx from _self_ctx(_slug, _token);
  if not vendor_is_active(ctx.vendor) then raise exception 'Este vendedor não está aceitando autoatendimento no momento'; end if;
  est := est_of(ctx.vendor);
  select self_max_units, self_min_interval_min into maxu, mins from profiles where id = est;
  select coalesce(sum((x->>'qty')::int), 0) into units from jsonb_array_elements(coalesce(_items,'[]')) x;
  if _combo_id is not null then
    units := units + coalesce((select sum((x->>'qty')::int) from combos c, jsonb_array_elements(c.items) x where c.id = _combo_id), 0);
  end if;
  if units > maxu then raise exception 'Máximo de % unidades por registro. Fale com o vendedor.', maxu; end if;
  select last_self_at into last from customers where id = ctx.customer for update;
  if last is not null and last > now() - make_interval(mins => mins) then
    raise exception 'Aguarde % minutos entre registros. Fale com o vendedor.', mins;
  end if;
  sid := _do_sale(ctx.vendor, ctx.customer, _items, _combo_id, coalesce(_payment, 'nao_informado'), _take_now, 'autoatendimento');
  update customers set last_self_at = now() where id = ctx.customer;
  select * into s from sales where id = sid;
  return jsonb_build_object('at', s.created_at, 'total', s.total, 'take_now', s.take_now, 'reward_events', s.meta->'reward_events');
end $$;

create or replace function public.self_withdraw(_slug text, _token text, _product_id uuid, _kind text, _qty int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ctx record; did uuid;
begin
  select * into ctx from _self_ctx(_slug, _token);
  if not vendor_is_active(ctx.vendor) then raise exception 'Este vendedor não está aceitando autoatendimento no momento'; end if;
  did := _do_deliver(ctx.vendor, ctx.customer, _product_id, _kind, _qty, 'autoatendimento');
  return jsonb_build_object('at', now(), 'qty', _qty, 'product', (select name from products where id = _product_id));
end $$;

grant execute on function public.self_vendor(text) to anon, authenticated;
grant execute on function public.self_identify(text,text,text) to anon, authenticated;
grant execute on function public.self_card(text,text) to anon, authenticated;
grant execute on function public.self_register_sale(text,text,jsonb,uuid,boolean,text) to anon, authenticated;
grant execute on function public.self_withdraw(text,text,uuid,text,int) to anon, authenticated;

-- undo
create or replace function public._can_manage(_vendor uuid) returns boolean language sql stable security definer set search_path = public as $$
  select _vendor = auth.uid() or (is_est_owner() and est_of(_vendor) = auth.uid())
$$;

create or replace function public.undo_sale(_sale_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s record; it jsonb; m jsonb;
begin
  select * into s from sales where id = _sale_id for update;
  if not found or not _can_manage(s.vendor_id) then raise exception 'Venda não encontrada'; end if;
  m := s.meta;
  if not s.take_now and s.customer_id is not null then
    for it in select * from jsonb_array_elements(coalesce(m->'lines','[]')) loop
      update credits set qty = greatest(0, qty - (it->>'qty')::int)
      where customer_id = s.customer_id and product_id = (it->>'product_id')::uuid and kind = it->>'kind';
    end loop;
  end if;
  if s.customer_id is not null and coalesce((m->>'stamps_added')::int, 0) > 0 then
    update customers set stamps = greatest(0, stamps - (m->>'stamps_added')::int + coalesce((m->>'reward_events')::int,0) * coalesce((m->>'required')::int,0))
    where id = s.customer_id;
    if coalesce((m->>'reward_events')::int,0) > 0 and m->>'reward_product_id' is not null then
      update credits set qty = greatest(0, qty - (m->>'reward_events')::int * coalesce((m->>'reward_qty')::int,0))
      where customer_id = s.customer_id and product_id = (m->>'reward_product_id')::uuid and kind = 'brinde';
    end if;
  end if;
  if s.origin = 'autoatendimento' and s.customer_id is not null then
    update customers set last_self_at = null where id = s.customer_id;
  end if;
  delete from sales where id = s.id;
end $$;

create or replace function public.undo_delivery(_delivery_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select * into d from deliveries where id = _delivery_id for update;
  if not found or not _can_manage(d.vendor_id) or d.sale_id is not null or d.customer_id is null then raise exception 'Retirada não encontrada'; end if;
  insert into credits (vendor_id, customer_id, product_id, kind, qty) values (d.vendor_id, d.customer_id, d.product_id, d.kind, d.qty)
  on conflict (customer_id, product_id, kind) do update set qty = credits.qty + excluded.qty;
  delete from deliveries where id = d.id;
end $$;

revoke execute on function public.undo_sale(uuid) from anon;
revoke execute on function public.undo_delivery(uuid) from anon;
revoke execute on function public._can_manage(uuid) from anon;
