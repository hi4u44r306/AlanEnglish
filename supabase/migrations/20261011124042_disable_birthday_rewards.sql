-- The birthday month campaign is retired: turning the existing switch off stops both
-- new birthday gifts and the birthday XP multiplier. Points already granted stay.
-- Rollback: an admin re-enables it in 獎品與兌換管理 → 生日月活動.

update public.birthday_reward_settings
set enabled = false, version = version + 1, updated_at = now()
where singleton and enabled;
