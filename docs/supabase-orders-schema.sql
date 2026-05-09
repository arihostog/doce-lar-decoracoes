alter table if exists public.orders
  add column if not exists delivery_type text,
  add column if not exists delivery_address text,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists payment_method text,
  add column if not exists observations text,
  add column if not exists status text default 'novo',
  add column if not exists total numeric default 0,
  add column if not exists items jsonb default '[]'::jsonb,
  add column if not exists whatsapp_message text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
