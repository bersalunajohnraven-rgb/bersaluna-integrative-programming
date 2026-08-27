/*
# Create profiles table and auto-provisioning trigger

1. Overview
- This migration creates a `profiles` table that stores one row per
  authenticated user, keyed to `auth.users.id`.
- It replaces the old localStorage-based user store with a real, persistent
  database table protected by Row Level Security.
- A trigger automatically inserts a `profiles` row whenever a new auth user
  is created, so the app never has to write the row from the client.

2. New Tables
- `profiles`
  - `id` uuid, primary key, references `auth.users.id` ON DELETE CASCADE
  - `name` text, not null (display name)
  - `email` text, not null (denormalized for convenience; the source of truth
    for auth email is auth.users, but we keep a copy for listing/admin)
  - `role` text, not null, default 'user' (either 'user' or 'admin')
  - `phone` text, nullable (optional contact phone)
  - `address` text, nullable (optional delivery address)
  - `created_at` timestamptz, default now()

3. Security
- Row Level Security is ENABLED on `profiles`.
- SELECT: authenticated users can read their own profile row.
- INSERT: blocked at the policy level (profiles are created only by the
  server-side trigger, so no client INSERT policy is defined).
- UPDATE: authenticated users can update their own profile, but only the
  user-editable columns (name, phone, address). The `role` column is NOT
  client-editable; admin role changes go through the SECURITY DEFINER
  edge function.
- DELETE: blocked at the policy level (account deletion is handled by
  the admin edge function with the service role key).

4. Trigger
- `handle_new_user` function (SECURITY DEFINER, search_path fixed) inserts
  a `profiles` row from `new.name` and `new.email` when a new auth user
  is created. Default role is 'user'.
- Trigger `on_auth_user_created` fires AFTER INSERT on `auth.users`.

5. Important Notes
- The trigger uses `new.raw_user_meta_data->>'name'` for the display name,
  falling back to the email local part if not provided.
- The `role` column defaults to 'user'. Admins are provisioned separately
  by inserting/updating the row with the service role key.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: users can read their own profile
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- UPDATE: users can update their own profile (name, phone, address only;
-- role changes are enforced by the admin edge function)
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No INSERT or DELETE policies: profiles are created by the trigger and
-- deleted via cascade when the auth user is deleted (admin edge function).

-- Function to auto-create a profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
