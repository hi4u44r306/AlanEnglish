begin;

alter table public.speaking_generation_jobs
    drop constraint if exists speaking_generation_jobs_count_check;

alter table public.speaking_generation_jobs
    add constraint speaking_generation_jobs_count_check
    check (requested_count between 1 and 30) not valid;

alter table public.speaking_generation_jobs
    validate constraint speaking_generation_jobs_count_check;

comment on constraint speaking_generation_jobs_count_check
    on public.speaking_generation_jobs is
    'AI speaking draft jobs may request 1 to 30 questions, matching the single-page authoring limit.';

commit;
