-- Cover the shipping-method foreign key used when methods are updated or retired.
create index if not exists store_orders_shipping_method_idx
    on public.store_orders(shipping_method_code);
