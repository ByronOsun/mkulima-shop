alter table public.products
  add column if not exists discount_price numeric(12,2) check (discount_price is null or discount_price >= 0);

create or replace function public.create_sale(
  _payment_mode text,
  _ref_id text,
  _customer_name text,
  _customer_phone text,
  _items jsonb -- [{product_id, quantity}]
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
begin
  _shop := public.current_shop_id();
  if _shop is null then raise exception 'No shop assigned'; end if;
  if _payment_mode not in ('cash','atm','mpesa') then raise exception 'Invalid payment mode'; end if;

  insert into public.transactions(shop_id, employee_id, total_amount, payment_mode, ref_id, customer_name, customer_phone)
  values (_shop, auth.uid(), 0, _payment_mode, _ref_id, _customer_name, _customer_phone)
  returning id into _txn;

  for _item in select * from jsonb_array_elements(_items)
  loop
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
    insert into public.transaction_items(transaction_id, product_id, name_snapshot, sku_snapshot, quantity, unit_price, total)
    values (_txn, _prod.id, _prod.name, _prod.sku, _qty, _unit_price, _line_total);
  end loop;

  update public.transactions set total_amount = _total where id = _txn;

  insert into public.activity_logs(employee_id, shop_id, action, details)
  values (auth.uid(), _shop, 'sale', jsonb_build_object('transaction_id', _txn, 'total', _total, 'items', jsonb_array_length(_items)));

  return _txn;
end;
$$;
