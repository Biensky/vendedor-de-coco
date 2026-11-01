
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
  v_total numeric := 0;
  v_cost numeric := 0;
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
    v_total := v_total + c.price;
    for it in select * from jsonb_array_elements(c.items) loop
      select * into p from products where id = (it->>'product_id')::uuid and vendor_id = uid;
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
    select * into p from products where id = (it->>'product_id')::uuid and vendor_id = uid;
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
revoke execute on function public.register_sale(uuid,jsonb,uuid,text,boolean) from anon;
