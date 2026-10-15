-- Approval-required Supabase Storage setup. Do not run against the operational project yet.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('payment-evidence','payment-evidence',false,5000000,array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- Intentionally no anon/authenticated storage.objects policies: the API service role is the
-- only storage principal. Application authorization controls owner uploads and signed review.
