# LetterLoop Clone

A lightweight LetterLoop-style app for a private friend group.

## Features

- Email magic-link authentication (Supabase Auth)
- Global invite allowlist (only invited emails can use the app)
- Admin-created loops with fixed lifecycle phases
  - Phase 1: add questions
  - Phase 2: answer questions
  - Phase 3: published/read-only
- Irreversible publishing: once phase 3 is reached, loop is locked forever
- Admin-managed global nicknames, used everywhere in UI
- All invited users see all loops on dashboard (no join step)

## Environment Variables

Create `.env` from `.env.example` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Supabase SQL Setup

Run this in your Supabase SQL editor (fresh prototype schema):

```sql
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

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  loop_id uuid not null references loops(id) on delete cascade,
  author_email text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  loop_id uuid not null references loops(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  author_email text not null,
  text text not null,
  created_at timestamptz not null default now(),
  unique(question_id, author_email)
);

create or replace function is_invited() returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from invited_emails i
    where lower(i.email) = lower(auth.email()) and i.active = true
  );
$$;

create or replace function is_loop_admin(loop_id uuid) returns boolean language sql stable as $$
  select exists (
    select 1 from loops l
    where l.id = loop_id and lower(l.admin_email) = lower(auth.email())
  );
$$;

create or replace function is_global_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from invited_emails i
    where lower(i.email) = lower(auth.email()) and i.active = true and i.is_admin = true
  );
$$;

alter table invited_emails enable row level security;
alter table loops enable row level security;
alter table questions enable row level security;
alter table answers enable row level security;

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
for insert with check (
  is_global_admin()
  and lower(admin_email) = lower(auth.email())
);

drop policy if exists loops_update_admin_forward_only on loops;
create policy loops_update_admin_forward_only on loops
for update using (is_loop_admin(id))
with check (
  is_loop_admin(id)
);

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

drop policy if exists answers_read on answers;
create policy answers_read on answers
for select using (is_invited());

drop policy if exists answers_insert_phase2 on answers;
create policy answers_insert_phase2 on answers
for insert with check (
  is_invited()
  and lower(author_email) = lower(auth.email())
  and exists (select 1 from loops l where l.id = loop_id and l.phase = 2)
);

```

Add your invited users:

```sql
insert into invited_emails(email, active, is_admin, nickname)
values
  ('you@example.com', true, true, 'you'),
  ('friend1@example.com', true, false, 'friend1'),
  ('friend2@example.com', true, false, 'friend2')
on conflict (email) do update set active = excluded.active, is_admin = excluded.is_admin, nickname = excluded.nickname;
```

## Run Locally

```bash
npm install
npm run dev
```
