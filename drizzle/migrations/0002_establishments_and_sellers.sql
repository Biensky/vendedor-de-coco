
alter table public.profiles add column establishment_id uuid;
alter table public.profiles add column member_role text not null default 'owner';
alter table public.profiles add column invite_code text unique;
alter table public.profiles add column active boolean not null default true;
alter table public.profiles add column display_name text;
update public.profiles set establishment_id = id, invite_code = public.gen_code() where establishment_id is null;
grant update (display_name) on public.profiles to authenticated;

create or replace function public.my_est() returns uuid language sql stable security definer set search_path = public as $$
  select establishment_id from profiles where id = auth.uid()
$$;
create or replace function public.is_est_owner() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and member_role = 'owner')
$$;
create or replace function public.est_of(_uid uuid) returns uuid language sql stable security definer set search_path = public as $$
  select establishment_id from profiles where id = _uid
$$;

-- members read establishment catalog
do $$ declare t text; begin
  foreach t in array array['products','combos','loyalty'] loop
    execute format('create policy "est members read" on public.%I for select to authenticated using (vendor_id = public.my_est())', t);
  end loop;
  foreach t in array array['customers','sales','sale_items','credits','deliveries'] loop
    execute format('create policy "owner reads team" on public.%I for select to authenticated using (public.is_est_owner() and public.est_of(vendor_id) = auth.uid())', t);
  end loop;
end $$;
create policy "owner reads team profiles" on public.profiles for select to authenticated
  using (public.is_est_owner() and establishment_id = auth.uid());

create or replace function public.vendor_is_active(_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles m join profiles o on o.id = m.establishment_id
    where m.id = _uid and m.active and o.plan <> 'suspended' and (o.plan = 'active' or o.plan_expires_at > now()))
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare coco uuid; g500 uuid; g1l uuid; owner_id uuid; inv text := upper(trim(coalesce(new.raw_user_meta_data->>'invite_code', '')));
begin
  if inv <> '' then
    select id into owner_id from profiles where invite_code = inv and member_role = 'owner';
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  if owner_id is not null then
    insert into public.profiles (id, email, business_name, establishment_id, member_role, display_name)
    values (new.id, new.email, (select business_name from profiles where id = owner_id), owner_id, 'seller', new.raw_user_meta_data->>'display_name');
    return new;
  end if;
  insert into public.profiles (id, email, business_name, establishment_id, member_role, invite_code, display_name)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data->>'business_name',''), 'Meu ponto'), new.id, 'owner', public.gen_code(), new.raw_user_meta_data->>'display_name');
  insert into public.products (vendor_id, name, price, cost) values (new.id, 'Coco', 8, 2) returning id into coco;
  insert into public.products (vendor_id, name, price, cost) values (new.id, 'Garrafa 500ml', 10, null) returning id into g500;
  insert into public.products (vendor_id, name, price, cost) values (new.id, 'Garrafa 1L', 18, null) returning id into g1l;
  insert into public.loyalty (vendor_id, product_id, required_qty, reward_product_id, reward_qty) values (new.id, coco, 10, coco, 1);
  insert into public.combos (vendor_id, name, items, reward_product_id, reward_qty, price)
  values (new.id, '3 garrafas de 1L + 1 garrafa de 500ml grátis', jsonb_build_array(jsonb_build_object('product_id', g1l, 'qty', 3)), g500, 1, 54);
  return new;
end $$;

create or replace function public.register_sale(_customer_id uuid, _items jsonb, _combo_id uuid, _payment text, _take_now boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  est uuid;
  sid uuid; it jsonb; p record; c record; l record; q int;
  v_total numeric := 0; v_cost numeric := 0; lines jsonb := '[]'; loyal_qty int := 0; rewards int;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  if not vendor_is_active(uid) then raise exception 'Plano suspenso ou vencido'; end if;
  est := est_of(uid);
  if _customer_id is not null and not exists (select 1 from customers where id = _customer_id and vendor_id = uid) then
    raise exception 'Cliente inválido'; end if;

  insert into sales (vendor_id, customer_id, combo_id, payment, take_now) values (uid, _customer_id, _combo_id, coalesce(_payment,'dinheiro'), coalesce(_take_now, true)) returning id into sid;

  if _combo_id is not null then
    select * into c from combos where id = _combo_id and vendor_id = est;
    if not found then raise exception 'Combo inválido'; end if;
    v_total := v_total + c.price;
    for it in select * from jsonb_array_elements(c.items) loop
      select * into p from products where id = (it->>'product_id')::uuid and vendor_id = est;
      if found then
        q := (it->>'qty')::int;
        insert into sale_items (vendor_id, sale_id, product_id, qty, unit_price, unit_cost) values (uid, sid, p.id, q, 0, coalesce(p.cost,0));
        v_cost := v_cost + q * coalesce(p.cost,0);
        lines := lines || jsonb_build_object('product_id', p.id, 'qty', q, 'kind', 'pago', 'cost', coalesce(p.cost,0));
      end if;
    end loop;
    if c.reward_product_id is not null and c.reward_qty > 0 then
      select * into p from products where id = c.reward_product_id;
      insert into sale_items (vendor_id, sale_id, product_id, qty, unit_price, unit_cost, is_reward) values (uid, sid, p.id, c.reward_qty, 0, coalesce(p.cost,0), true);
      lines := lines || jsonb_build_object('product_id', p.id, 'qty', c.reward_qty, 'kind', 'brinde', 'cost', coalesce(p.cost,0));
    end if;
  end if;

  for it in select * from jsonb_array_elements(coalesce(_items,'[]')) loop
    q := (it->>'qty')::int;
    if q is null or q <= 0 then continue; end if;
    select * into p from products where id = (it->>'product_id')::uuid and vendor_id = est;
    if not found then raise exception 'Produto inválido'; end if;
    insert into sale_items (vendor_id, sale_id, product_id, qty, unit_price, unit_cost) values (uid, sid, p.id, q, p.price, coalesce(p.cost,0));
    v_total := v_total + q * p.price;
    v_cost := v_cost + q * coalesce(p.cost,0);
    lines := lines || jsonb_build_object('product_id', p.id, 'qty', q, 'kind', 'pago', 'cost', coalesce(p.cost,0));
  end loop;

  if jsonb_array_length(lines) = 0 then raise exception 'Venda vazia'; end if;
  update sales set total = v_total, cost = v_cost where id = sid;

  for it in select * from jsonb_array_elements(lines) loop
    if coalesce(_take_now, true) or _customer_id is null then
      insert into deliveries (vendor_id, customer_id, product_id, kind, qty, unit_cost)
      values (uid, _customer_id, (it->>'product_id')::uuid, it->>'kind', (it->>'qty')::int, (it->>'cost')::numeric);
    else
      insert into credits (vendor_id, customer_id, product_id, kind, qty)
      values (uid, _customer_id, (it->>'product_id')::uuid, it->>'kind', (it->>'qty')::int)
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
            values (uid, _customer_id, l.reward_product_id, 'brinde', rewards * l.reward_qty)
            on conflict (customer_id, product_id, kind) do update set qty = credits.qty + excluded.qty;
          end if;
        end if;
      end if;
    end if;
  end if;
  return sid;
end $$;

create or replace function public.deliver_credit(_customer_id uuid, _product_id uuid, _kind text, _qty int)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cur int; pc numeric;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  if not vendor_is_active(uid) then raise exception 'Plano suspenso ou vencido'; end if;
  select qty into cur from credits where customer_id = _customer_id and product_id = _product_id and kind = _kind and vendor_id = uid for update;
  if cur is null or cur < _qty or _qty <= 0 then raise exception 'Crédito insuficiente'; end if;
  update credits set qty = qty - _qty where customer_id = _customer_id and product_id = _product_id and kind = _kind;
  select coalesce(cost,0) into pc from products where id = _product_id;
  insert into deliveries (vendor_id, customer_id, product_id, kind, qty, unit_cost) values (uid, _customer_id, _product_id, _kind, _qty, pc);
end $$;

create or replace function public.owner_set_member_active(_member uuid, _active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_est_owner() then raise exception 'Apenas o responsável'; end if;
  update profiles set active = _active where id = _member and establishment_id = auth.uid() and member_role = 'seller';
end $$;

create or replace function public.get_public_card(_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c record; res jsonb; est uuid;
begin
  select * into c from customers where code = upper(_code);
  if not found then return null; end if;
  est := est_of(c.vendor_id);
  select jsonb_build_object(
    'name', c.name, 'code', c.code, 'stamps', c.stamps,
    'vendor', (select business_name from profiles where id = est),
    'loyalty', (select jsonb_build_object('required', l.required_qty, 'product', p.name, 'reward', rp.name, 'reward_qty', l.reward_qty, 'active', l.active)
                from loyalty l left join products p on p.id = l.product_id left join products rp on rp.id = l.reward_product_id where l.vendor_id = est),
    'credits', coalesce((select jsonb_agg(jsonb_build_object('product', p.name, 'kind', cr.kind, 'qty', cr.qty)) from credits cr join products p on p.id = cr.product_id where cr.customer_id = c.id and cr.qty > 0), '[]'),
    'history', coalesce((select jsonb_agg(h order by h->>'at' desc) from (
        select jsonb_build_object('type','compra','at', s.created_at, 'total', s.total) h from sales s where s.customer_id = c.id
        union all
        select jsonb_build_object('type','retirada','at', d.created_at, 'qty', d.qty, 'product', p.name) from deliveries d left join products p on p.id = d.product_id where d.customer_id = c.id
        order by 1 desc limit 15) z), '[]')
  ) into res;
  return res;
end $$;

drop function if exists public.admin_list_vendors();
create function public.admin_list_vendors() returns table (id uuid, email text, business_name text, plan public.plan_status, plan_expires_at timestamptz, sellers bigint, customers bigint, sales_month bigint, revenue_month numeric, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(auth.uid(), 'admin') then raise exception 'Acesso negado'; end if;
  return query select p.id, p.email, p.business_name, p.plan, p.plan_expires_at,
    (select count(*) from profiles m where m.establishment_id = p.id and m.member_role = 'seller'),
    (select count(*) from customers c join profiles m on m.id = c.vendor_id where m.establishment_id = p.id),
    (select count(*) from sales s join profiles m on m.id = s.vendor_id where m.establishment_id = p.id and s.created_at >= date_trunc('month', now())),
    (select coalesce(sum(s.total),0) from sales s join profiles m on m.id = s.vendor_id where m.establishment_id = p.id and s.created_at >= date_trunc('month', now())),
    p.created_at
  from profiles p where p.member_role = 'owner' order by p.created_at desc;
end $$;

revoke execute on function public.admin_list_vendors() from anon;
revoke execute on function public.owner_set_member_active(uuid, boolean) from anon;
