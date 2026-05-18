alter table public.transaction_items
  add column if not exists meta jsonb;

create or replace function public.create_sale(
  _payment_mode text,
  _ref_id text,
  _customer_name text,
  _customer_phone text,
  _items jsonb -- [{kind, product_id, quantity} | {kind: crate, pricing, crate_count, pack_size, mix: [{product_id, quantity}]}]
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  _shop uuid;
  _txn uuid;
  _total numeric := 0;
  _item jsonb;
  _prod public.products%rowtype;
  _qty int;
  _unit_price numeric;
  _line_total numeric;
  _kind text;
  _mix jsonb;
  _mix_item jsonb;
  _mix_qty int;
  _mix_total int;
  _crate_count int;
  _pack int;
  _pricing text;
  _crate_unit numeric;
  _mix_names text[];
  _name_snapshot text;
begin
  _shop := public.current_shop_id();
  if _shop is null then raise exception 'No shop assigned'; end if;
  if _payment_mode not in ('cash','atm','mpesa') then raise exception 'Invalid payment mode'; end if;

  insert into public.transactions(shop_id, employee_id, total_amount, payment_mode, ref_id, customer_name, customer_phone)
  values (_shop, auth.uid(), 0, _payment_mode, _ref_id, _customer_name, _customer_phone)
  returning id into _txn;

  for _item in select * from jsonb_array_elements(_items)
  loop
    _kind := coalesce(_item->>'kind', 'bottle');
    if _kind = 'crate' then
      _crate_count := greatest(1, (_item->>'crate_count')::int);
      _pack := coalesce((_item->>'pack_size')::int, 24);
      _pricing := coalesce(_item->>'pricing', 'retail');
      _mix := _item->'mix';
      if _pricing not in ('retail','wholesale') then raise exception 'Invalid crate pricing'; end if;
      if _mix is null or jsonb_typeof(_mix) <> 'array' then raise exception 'Invalid crate mix'; end if;

      _mix_total := 0;
      _crate_unit := 0;
      _mix_names := array[]::text[];

      for _mix_item in select * from jsonb_array_elements(_mix)
      loop
        _mix_qty := (_mix_item->>'quantity')::int;
        if _mix_qty is null or _mix_qty <= 0 then continue; end if;
        select * into _prod from public.products where id = (_mix_item->>'product_id')::uuid for update;
        if not found then raise exception 'Product not found'; end if;
        if _prod.shop_id <> _shop then raise exception 'Product not in your shop'; end if;
        if _prod.stock_quantity < (_mix_qty * _crate_count) then raise exception 'Insufficient stock for %', _prod.name; end if;

        _mix_total := _mix_total + _mix_qty;

        _unit_price := case
          when _pricing = 'wholesale'
            then (coalesce(_prod.price_wholesale_crate, _prod.price * _pack) / _pack)
          when _prod.discount_price is not null and _prod.discount_price > 0 and _prod.discount_price < _prod.price
            then _prod.discount_price
          else _prod.price
        end;

        _crate_unit := _crate_unit + (_unit_price * _mix_qty);
        _mix_names := array_append(_mix_names, _prod.name || ' x' || _mix_qty);

        update public.products
          set stock_quantity = stock_quantity - (_mix_qty * _crate_count)
          where id = _prod.id;
      end loop;

      if _mix_total <> _pack then raise exception 'Crate must contain % bottles', _pack; end if;

      _line_total := _crate_unit * _crate_count;
      _total := _total + _line_total;

      _name_snapshot := format('Crate (%s) - %s', initcap(_pricing), array_to_string(_mix_names, ', '));

      insert into public.transaction_items(transaction_id, product_id, name_snapshot, sku_snapshot, quantity, unit_price, total, meta)
      values (_txn, null, _name_snapshot, null, _crate_count, _crate_unit, _line_total,
        jsonb_build_object('kind','crate','pricing',_pricing,'pack_size',_pack,'mix',_mix));
    else
      _qty := (_item->>'quantity')::int;
      select * into _prod from public.products where id = (_item->>'product_id')::uuid for update;
      if not found then raise exception 'Product not found'; end if;
      if _prod.shop_id <> _shop then raise exception 'Product not in your shop'; end if;
      if _prod.stock_quantity < _qty then raise exception 'Insufficient stock for %', _prod.name; end if;

      _unit_price := case
        when _prod.discount_price is not null and _prod.discount_price > 0 and _prod.discount_price < _prod.price
          then _prod.discount_price
        else _prod.price
      end;
      _line_total := _unit_price * _qty;
      _total := _total + _line_total;

      update public.products set stock_quantity = stock_quantity - _qty where id = _prod.id;
      insert into public.transaction_items(transaction_id, product_id, name_snapshot, sku_snapshot, quantity, unit_price, total, meta)
      values (_txn, _prod.id, _prod.name, _prod.sku, _qty, _unit_price, _line_total, jsonb_build_object('kind','bottle'));
    end if;
  end loop;

  update public.transactions set total_amount = _total where id = _txn;

  insert into public.activity_logs(employee_id, shop_id, action, details)
  values (auth.uid(), _shop, 'sale', jsonb_build_object('transaction_id', _txn, 'total', _total, 'items', jsonb_array_length(_items)));

  return _txn;
end;
$$;
