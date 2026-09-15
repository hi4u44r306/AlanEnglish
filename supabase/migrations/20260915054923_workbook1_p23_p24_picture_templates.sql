begin;

create unique index if not exists speaking_question_sets_p23_p24_template_unique
    on public.speaking_question_sets(book_id, (generation_metadata ->> 'template_key'))
    where status <> 'archived'
      and generation_metadata ->> 'template_key' in (
          'workbook_1_p23_picture_gap_v1',
          'workbook_1_p24_picture_gap_v1'
      );

commit;
