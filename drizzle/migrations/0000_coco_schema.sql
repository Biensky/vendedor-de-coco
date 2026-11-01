
create type public.app_role as enum ('admin','user');
create type public.plan_status as enum ('trial','active','suspended');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default 'Meu ponto',
  email text,
  plan public.plan_status not null default 'trial',
  plan_expires_at timestamptz not null default (now() + interval '30 days'),
  daily_goal int not null default 10,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant update (business_name, daily_goal) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null default auth.uid(),
  name text not null,
  price numeric(10,2) not null default 0,
  cost numeric(10,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.gen_code() returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random()*32)::int, 1), '') from generate_series(1,7)
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null default auth.uid(),
  name text not null,
  whatsapp text,
  notes text,
  code text not null unique default public.gen_code(),
  stamps int not null default 0,
  created_at timestamptz not null default now()
);

create table public.loyalty (
  vendor_id uuid primary key default auth.uid(),
  active boolean not null default true,
  product_id uuid references public.products(id) on delete set null,
  required_qty int not null default 10,
  reward_product_id uuid references public.products(id) on delete set null,
  reward_qty int not null default 1
);

create table public.combos (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null default auth.uid(),
  name text not null,
  items jsonb not null default '[]',
  reward_product_id uuid references public.products(id) on delete set null,
  reward_qty int not null default 0,
  price numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null default auth.uid(),
  customer_id uuid references public.customers(id) on delete set null,
  combo_id uuid references public.combos(id) on delete set null,
  total numeric(10,2) not null default 0,
  cost numeric(10,2) not null default 0,
  payment text not null default 'dinheiro',
  take_now boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null default auth.uid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  qty int not null,
  unit_price numeric(10,2) not null default 0,
  unit_cost numeric(10,2) not null default 0,
  is_reward boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.credits (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null default auth.uid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  kind text not null check (kind in ('pago','brinde')),
  qty int not null default 0,
  unique (customer_id, product_id, kind)
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null default auth.uid(),
  customer_id uuid references public.customers(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  kind text not null,
  qty int not null,
  unit_cost numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['products','customers','loyalty','combos','sales','sale_items','credits','deliveries'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "vendor own" on public.%I for all to authenticated using (vendor_id = auth.uid()) with check (vendor_id = auth.uid())', t);
  end loop;
end $$;

create index on public.sales (vendor_id, created_at);
create index on public.deliveries (vendor_id, created_at);
create index on public.customers (vendor_id);

-- signup: profile + defaults
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare coco uuid; g500 uuid; g1l uuid;
begin
  insert into public.profiles (id, email, business_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'business_name', 'Meu ponto'));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  insert into public.products (vendor_id, name, price, cost) values (new.id, 'Coco', 8, 2) returning id into coco;
  insert into public.products (vendor_id, name, price, cost) values (new.id, 'Garrafa 500ml', 10, null) returning id into g500;
  insert into public.products (vendor_id, name, price, cost) values (new.id, 'Garrafa 1L', 18, null) returning id into g1l;
  insert into public.loyalty (vendor_id, product_id, required_qty, reward_product_id, reward_qty) values (new.id, coco, 10, coco, 1);
  insert into public.combos (vendor_id, name, items, reward_product_id, reward_qty, price)
  values (new.id, '3 garrafas de 1L + 1 garrafa de 500ml grátis', jsonb_build_array(jsonb_build_object('product_id', g1l, 'qty', 3)), g500, 1, 54);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.vendor_is_active(_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = _uid and plan <> 'suspended' and (plan = 'active' or plan_expires_at > now()))
$$;

-- register sale atomically
create or replace function public.register_sale(_customer_id uuid, _items jsonb, _combo_id uuid, _payment text, _take_now boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  sid uuid;
  it jsonb;
  p record;
  c record;
  l record;
  q int;
  total numeric := 0;
  cost numeric := 0;
  lines jsonb := '[]';
  loyal_qty int := 0;
  rewards int;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  if not vendor_is_active(uid) then raise exception 'Plano suspenso ou vencido'; end if;
  if _customer_id is not null and not exists (select 1 from customers where id = _customer_id and vendor_id = uid) then
    raise exception 'Cliente inválido'; end if;

  insert into sales (vendor_id, customer_id, combo_id, payment, take_now) values (uid, _customer_id, _combo_id, coalesce(_payment,'dinheiro'), coalesce(_take_now, true)) returning id into sid;

  if _combo_id is not null then
    select * into c from combos where id = _combo_id and vendor_id = uid;
    if not found then raise exception 'Combo inválido'; end if;
    total := total + c.price;
    for it in select * from jsonb_array_elements(c.items) loop
      select * into p from products where id = (it->>'product_id')::uuid and vendor_id = uid;
      if found then
        q := (it->>'qty')::int;
        insert into sale_items (vendor_id, sale_id, product_id, qty, unit_price, unit_cost) values (uid, sid, p.id, q, 0, coalesce(p.cost,0));
        cost := cost + q * coalesce(p.cost,0);
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
    select * into p from products where id = (it->>'product_id')::uuid and vendor_id = uid;
    if not found then raise exception 'Produto inválido'; end if;
    insert into sale_items (vendor_id, sale_id, product_id, qty, unit_price, unit_cost) values (uid, sid, p.id, q, p.price, coalesce(p.cost,0));
    total := total + q * p.price;
    cost := cost + q * coalesce(p.cost,0);
    lines := lines || jsonb_build_object('product_id', p.id, 'qty', q, 'kind', 'pago', 'cost', coalesce(p.cost,0));
  end loop;

  if jsonb_array_length(lines) = 0 then raise exception 'Venda vazia'; end if;
  update sales set total = register_sale.total, cost = register_sale.cost where id = sid;

  -- deliver now or store as credits
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

  -- loyalty stamps
  if _customer_id is not null then
    select * into l from loyalty where vendor_id = uid and active;
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
  select qty into cur from credits where customer_id = _customer_id and product_id = _product_id and kind = _kind and vendor_id = uid for update;
  if cur is null or cur < _qty or _qty <= 0 then raise exception 'Crédito insuficiente'; end if;
  update credits set qty = qty - _qty where customer_id = _customer_id and product_id = _product_id and kind = _kind;
  select coalesce(cost,0) into pc from products where id = _product_id;
  insert into deliveries (vendor_id, customer_id, product_id, kind, qty, unit_cost) values (uid, _customer_id, _product_id, _kind, _qty, pc);
end $$;

create or replace function public.get_public_card(_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c record; res jsonb;
begin
  select * into c from customers where code = upper(_code);
  if not found then return null; end if;
  select jsonb_build_object(
    'name', c.name, 'code', c.code, 'stamps', c.stamps,
    'vendor', (select business_name from profiles where id = c.vendor_id),
    'loyalty', (select jsonb_build_object('required', l.required_qty, 'product', p.name, 'reward', rp.name, 'reward_qty', l.reward_qty, 'active', l.active)
                from loyalty l left join products p on p.id = l.product_id left join products rp on rp.id = l.reward_product_id where l.vendor_id = c.vendor_id),
    'credits', coalesce((select jsonb_agg(jsonb_build_object('product', p.name, 'kind', cr.kind, 'qty', cr.qty)) from credits cr join products p on p.id = cr.product_id where cr.customer_id = c.id and cr.qty > 0), '[]'),
    'history', coalesce((select jsonb_agg(h order by h->>'at' desc) from (
        select jsonb_build_object('type','compra','at', s.created_at, 'total', s.total) h from sales s where s.customer_id = c.id
        union all
        select jsonb_build_object('type','retirada','at', d.created_at, 'qty', d.qty, 'product', p.name) from deliveries d left join products p on p.id = d.product_id where d.customer_id = c.id
        order by 1 desc limit 15) z), '[]')
  ) into res;
  return res;
end $$;
grant execute on function public.get_public_card(text) to anon, authenticated;

create or replace function public.admin_list_vendors() returns table (id uuid, email text, business_name text, plan public.plan_status, plan_expires_at timestamptz, customers bigint, sales_month bigint, revenue_month numeric, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_role(auth.uid(), 'admin') then raise exception 'Acesso negado'; end if;
  return query select p.id, p.email, p.business_name, p.plan, p.plan_expires_at,
    (select count(*) from customers c where c.vendor_id = p.id),
    (select count(*) from sales s where s.vendor_id = p.id and s.created_at >= date_trunc('month', now())),
    (select coalesce(sum(s.total),0) from sales s where s.vendor_id = p.id and s.created_at >= date_trunc('month', now())),
    p.created_at
  from profiles p order by p.created_at desc;
end $$;

create or replace function public.admin_set_plan(_vendor uuid, _plan public.plan_status, _expires timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(auth.uid(), 'admin') then raise exception 'Acesso negado'; end if;
  update profiles set plan = _plan, plan_expires_at = coalesce(_expires, plan_expires_at) where id = _vendor;
end $$;

revoke execute on function public.register_sale(uuid,jsonb,uuid,text,boolean) from anon;
revoke execute on function public.deliver_credit(uuid,uuid,text,int) from anon;
revoke execute on function public.admin_list_vendors() from anon;
revoke execute on function public.admin_set_plan(uuid,public.plan_status,timestamptz) from anon;
