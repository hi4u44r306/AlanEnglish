begin;

alter table public.speaking_tts_assets
    drop constraint if exists speaking_tts_assets_format_check;

alter table public.speaking_tts_assets
    add constraint speaking_tts_assets_format_check
    check (output_format in ('mp3', 'wav'));

commit;
