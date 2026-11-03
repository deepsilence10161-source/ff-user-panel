-- D31: creator_applications par DELETE-own policy missing thi —
-- user panel ka "🔄 Dobara Apply Karo" button (rejected ke baad
-- dobara apply karne ka RASTA) silently fail hota tha. Ab user
-- sirf APNI row delete kar sakta hai (RLS: jwt sub = user_id).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                 and tablename='creator_applications' and policyname='ca_delete_own') then
    execute 'create policy ca_delete_own on public.creator_applications
             for delete to anon, authenticated
             using ((auth.jwt() ->> ''sub'') = user_id)';
  end if;
end $$;
select jsonb_build_object('ca_policies',(select coalesce(jsonb_agg(policyname),'[]'::jsonb)
  from pg_policies where schemaname='public' and tablename='creator_applications')) as cadel_proof;
