do $$
declare
    updated_count integer;
begin
    update public.subscription_plans
    set is_public = true,
        updated_at = now()
    where code = 'ai_materials_addon_monthly'
      and enabled = true;

    get diagnostics updated_count = row_count;

    if updated_count <> 1 then
        raise exception 'Expected exactly one enabled AI materials add-on plan, updated % row(s)', updated_count;
    end if;
end
$$;
