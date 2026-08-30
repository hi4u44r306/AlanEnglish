begin;

alter table public.store_orders
    drop constraint if exists store_orders_payment_status_check;
alter table public.store_orders
    add constraint store_orders_payment_status_check
    check (payment_status in ('pending','paid','failed','expired','refunded','cancelled'));

alter table public.store_order_status_history
    drop constraint if exists store_order_history_payment_status_valid;
alter table public.store_order_status_history
    add constraint store_order_history_payment_status_valid
    check (payment_status in ('pending','paid','failed','expired','refunded','cancelled'));

commit;
