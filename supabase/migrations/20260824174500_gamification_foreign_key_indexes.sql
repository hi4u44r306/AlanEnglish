create index if not exists idx_rewards_created_by
    on public.rewards(created_by)
    where created_by is not null;

create index if not exists idx_reward_redemptions_reward
    on public.reward_redemptions(reward_id);

create index if not exists idx_reward_redemptions_updated_by
    on public.reward_redemptions(updated_by)
    where updated_by is not null;