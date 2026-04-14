# LetterLoop Clone

A lightweight LetterLoop-style app for a private friend group.

## Features

- Email magic-link authentication (Supabase Auth)
- Invite-only access with global admin/member roles
- Loop lifecycle phases:
  - Phase 1: add questions
  - Phase 2: answer fixed sections + questions
  - Phase 3: published/read-only
- Fixed section prompts in every loop:
  - Announcements
  - Shout-outs
  - Mann-ki-baat
- Optional answers (users can skip any prompt/question)
- One response per user per prompt/question
- Optional image uploads in all responses
- Global nicknames used everywhere

## Environment Variables

Create `.env` from `.env.example` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Supabase SQL Setup

Run this in Supabase SQL editor (fresh prototype schema):

```sql
create extension if not exists pgcrypto;

create table if not exists invited_emails (
  email text primary key,
  active boolean not null default true,
  is_admin boolean not null default false,
  nickname text,
  created_at timestamptz not null default now()
);

create table if not exists loops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  phase smallint not null default 1 check (phase in (1,2,3)),
  admin_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists section_prompts (
  id uuid primary key default gen_random_uuid(),
  loop_id uuid not null references loops(id) on delete cascade,
  key text not null check (key in ('announcements', 'shoutouts', 'mann_ki_baat')),
  title text not null,
  display_order int not null,
  created_at timestamptz not null default now(),
  unique(loop_id, key)
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  loop_id uuid not null references loops(id) on delete cascade,
  author_email text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists question_answers (
  id uuid primary key default gen_random_uuid(),
  loop_id uuid not null references loops(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  author_email text not null,
  text text not null default '',
  image_url text,
  image_path text,
  image_mime text,
  image_size bigint,
  created_at timestamptz not null default now(),
  unique(question_id, author_email)
);

create table if not exists prompt_answers (
  id uuid primary key default gen_random_uuid(),
  loop_id uuid not null references loops(id) on delete cascade,
  prompt_id uuid not null references section_prompts(id) on delete cascade,
  author_email text not null,
  text text not null default '',
  image_url text,
  image_path text,
  image_mime text,
  image_size bigint,
  created_at timestamptz not null default now(),
  unique(prompt_id, author_email)
);

create or replace function is_invited()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from invited_emails i
    where lower(i.email) = lower(auth.email()) and i.active = true
  );
$$;

create or replace function is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from invited_emails i
    where lower(i.email) = lower(auth.email()) and i.active = true and i.is_admin = true
  );
$$;

create or replace function is_loop_admin(loop_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from loops l
    where l.id = loop_id and lower(l.admin_email) = lower(auth.email())
  );
$$;

create or replace function enforce_loop_phase_transition()
returns trigger
language plpgsql
as $$
begin
  if old.phase = 3 and new.phase <> 3 then
    raise exception 'Published loops are locked';
  end if;

  if new.phase <> old.phase then
    if new.phase <> old.phase + 1 then
      raise exception 'Phase must move forward exactly one step';
    end if;
  end if;

  if old.phase <> 3 and new.phase = 3 and new.published_at is null then
    new.published_at := now();
  end if;

  if old.phase = 3 and new.published_at <> old.published_at then
    raise exception 'Published timestamp is locked';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists loops_phase_guard on loops;
create trigger loops_phase_guard
before update on loops
for each row execute function enforce_loop_phase_transition();

alter table invited_emails enable row level security;
alter table loops enable row level security;
alter table section_prompts enable row level security;
alter table questions enable row level security;
alter table question_answers enable row level security;
alter table prompt_answers enable row level security;

drop policy if exists invited_read on invited_emails;
create policy invited_read on invited_emails
for select using (is_invited());

drop policy if exists invited_update_admin on invited_emails;
create policy invited_update_admin on invited_emails
for update using (is_global_admin()) with check (is_global_admin());

drop policy if exists loops_read on loops;
create policy loops_read on loops
for select using (is_invited());

drop policy if exists loops_insert_admin on loops;
create policy loops_insert_admin on loops
for insert with check (is_global_admin() and lower(admin_email) = lower(auth.email()));

drop policy if exists loops_update_admin_forward_only on loops;
create policy loops_update_admin_forward_only on loops
for update using (is_loop_admin(id)) with check (is_loop_admin(id));

drop policy if exists prompts_read on section_prompts;
create policy prompts_read on section_prompts
for select using (is_invited());

drop policy if exists prompts_insert_admin on section_prompts;
create policy prompts_insert_admin on section_prompts
for insert with check (is_loop_admin(loop_id));

drop policy if exists questions_read on questions;
create policy questions_read on questions
for select using (is_invited());

drop policy if exists questions_insert_phase1 on questions;
create policy questions_insert_phase1 on questions
for insert with check (
  is_invited()
  and lower(author_email) = lower(auth.email())
  and exists (select 1 from loops l where l.id = loop_id and l.phase = 1)
);

drop policy if exists question_answers_read on question_answers;
create policy question_answers_read on question_answers
for select using (is_invited());

drop policy if exists question_answers_insert_phase2 on question_answers;
create policy question_answers_insert_phase2 on question_answers
for insert with check (
  is_invited()
  and lower(author_email) = lower(auth.email())
  and exists (select 1 from loops l where l.id = loop_id and l.phase = 2)
  and exists (select 1 from questions q where q.id = question_id and q.loop_id = loop_id)
);

drop policy if exists prompt_answers_read on prompt_answers;
create policy prompt_answers_read on prompt_answers
for select using (is_invited());

drop policy if exists prompt_answers_insert_phase2 on prompt_answers;
create policy prompt_answers_insert_phase2 on prompt_answers
for insert with check (
  is_invited()
  and lower(author_email) = lower(auth.email())
  and exists (select 1 from loops l where l.id = loop_id and l.phase = 2)
  and exists (select 1 from section_prompts p where p.id = prompt_id and p.loop_id = loop_id)
);
```

Create a public storage bucket for images:

```sql
insert into storage.buckets (id, name, public)
values ('loop-images', 'loop-images', true)
on conflict (id) do nothing;
```

Storage policies:

```sql
create policy if not exists "loop-images read" on storage.objects
for select to public
using (bucket_id = 'loop-images');

create policy if not exists "loop-images upload invited" on storage.objects
for insert to authenticated
with check (bucket_id = 'loop-images' and is_invited());
```

Add invited users:

```sql
insert into invited_emails(email, active, is_admin, nickname)
values
  ('you@example.com', true, true, 'You'),
  ('friend1@example.com', true, false, 'Friend1'),
  ('friend2@example.com', true, false, 'Friend2')
on conflict (email) do update
set active = excluded.active,
    is_admin = excluded.is_admin,
    nickname = excluded.nickname;
```

## Run Locally

```bash
npm install
npm run dev
```
