# Supabase setup

1. Create a Supabase project and run `supabase-schema.sql` in its SQL Editor.
2. In Project Settings → API, copy the project URL and **publishable/anon** key into `supabase-config.js`. Never use the service-role key in this client.
3. In Authentication → URL Configuration, add the browser URL and Android app/web-view URL as allowed redirect URLs.
4. Serve DayFlow over HTTP(S), choose **Connect**, and create an account or sign in.

At the first sign-in, existing `df6` local tasks are uploaded when the account has no remote tasks. Afterward, Supabase is the source of truth and local storage is only a fast cache.
