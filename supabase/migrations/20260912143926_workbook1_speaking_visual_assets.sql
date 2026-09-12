begin;

create table if not exists public.speaking_visual_assets (
    id uuid primary key default gen_random_uuid(),
    book_id bigint not null references public.books(id) on delete restrict,
    source_document_id bigint references public.speaking_source_documents(id) on delete set null,
    source_page_label text not null,
    private_object_key text not null,
    mime_type text not null,
    byte_size bigint not null,
    width integer,
    height integer,
    alt_zh text not null,
    status text not null default 'draft',
    created_by bigint references public.students(id) on delete set null,
    reviewed_by bigint references public.students(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint speaking_visual_assets_object_key_unique unique (private_object_key),
    constraint speaking_visual_assets_page_nonempty check (
        btrim(source_page_label) <> '' and char_length(source_page_label) <= 40
    ),
    constraint speaking_visual_assets_object_key_nonempty check (
        btrim(private_object_key) <> '' and char_length(private_object_key) <= 500
    ),
    constraint speaking_visual_assets_mime_check check (
        mime_type in ('image/jpeg', 'image/png', 'image/webp')
    ),
    constraint speaking_visual_assets_size_check check (byte_size between 1 and 10485760),
    constraint speaking_visual_assets_dimensions_check check (
        (width is null and height is null)
        or (width between 1 and 8192 and height between 1 and 8192)
    ),
    constraint speaking_visual_assets_alt_nonempty check (
        btrim(alt_zh) <> '' and char_length(alt_zh) <= 240
    ),
    constraint speaking_visual_assets_status_check check (status in ('draft', 'ready', 'archived')),
    constraint speaking_visual_assets_review_consistency check (
        (status = 'ready' and reviewed_by is not null and reviewed_at is not null)
        or status <> 'ready'
    )
);

create table if not exists public.speaking_question_visual_assets (
    question_id bigint primary key references public.speaking_questions(id) on delete cascade,
    asset_id uuid not null references public.speaking_visual_assets(id) on delete restrict,
    crop_metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint speaking_question_visual_assets_crop_object check (jsonb_typeof(crop_metadata) = 'object')
);

create table if not exists public.speaking_question_interactions (
    question_id bigint primary key references public.speaking_questions(id) on delete cascade,
    interaction_type text not null,
    prompt_text text not null,
    answer_text text not null,
    accepted_full_responses jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint speaking_question_interactions_type_check check (
        interaction_type in ('picture_qa', 'picture_gap_sentence')
    ),
    constraint speaking_question_interactions_prompt_nonempty check (
        btrim(prompt_text) <> '' and char_length(prompt_text) <= 800
    ),
    constraint speaking_question_interactions_answer_nonempty check (
        btrim(answer_text) <> '' and char_length(answer_text) <= 2000
    ),
    constraint speaking_question_interactions_responses_array check (
        jsonb_typeof(accepted_full_responses) = 'array'
        and jsonb_array_length(accepted_full_responses) <= 12
    )
);

create table if not exists public.speaking_question_word_audio (
    question_id bigint not null references public.speaking_questions(id) on delete cascade,
    token_index smallint not null,
    word text not null,
    asset_id uuid not null references public.speaking_tts_assets(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (question_id, token_index),
    constraint speaking_question_word_audio_index_check check (token_index between 0 and 63),
    constraint speaking_question_word_audio_word_nonempty check (
        btrim(word) <> '' and char_length(word) <= 80
    )
);

create index if not exists speaking_visual_assets_book_status_idx
    on public.speaking_visual_assets(book_id, status, updated_at desc);
create index if not exists speaking_visual_assets_document_idx
    on public.speaking_visual_assets(source_document_id)
    where source_document_id is not null;
create index if not exists speaking_question_visual_assets_asset_idx
    on public.speaking_question_visual_assets(asset_id);
create index if not exists speaking_question_interactions_type_idx
    on public.speaking_question_interactions(interaction_type);
create index if not exists speaking_question_word_audio_asset_idx
    on public.speaking_question_word_audio(asset_id);

alter table public.speaking_visual_assets enable row level security;
alter table public.speaking_question_visual_assets enable row level security;
alter table public.speaking_question_interactions enable row level security;
alter table public.speaking_question_word_audio enable row level security;

revoke all on table public.speaking_visual_assets from public, anon, authenticated;
revoke all on table public.speaking_question_visual_assets from public, anon, authenticated;
revoke all on table public.speaking_question_interactions from public, anon, authenticated;
revoke all on table public.speaking_question_word_audio from public, anon, authenticated;

grant select, insert, update, delete on table public.speaking_visual_assets to service_role;
grant select, insert, update, delete on table public.speaking_question_visual_assets to service_role;
grant select, insert, update, delete on table public.speaking_question_interactions to service_role;
grant select, insert, update, delete on table public.speaking_question_word_audio to service_role;

comment on table public.speaking_visual_assets is
    'Server-only metadata for teacher-reviewed speaking challenge images stored in private R2.';
comment on table public.speaking_question_visual_assets is
    'Server-only link between one speaking question and one approved private visual asset.';
comment on table public.speaking_question_interactions is
    'Server-only reviewed question, answer, accepted full responses and visible sentence pattern for picture speaking modes.';
comment on table public.speaking_question_word_audio is
    'Server-only ordered links to pre-generated TTS assets for visible P22 sentence words.';

commit;
