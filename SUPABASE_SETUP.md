# Supabase setup

1. Create a Supabase project and run `supabase-schema.sql` in its SQL Editor.
2. In Project Settings → API, copy the project URL and **publishable/anon** key into `supabase-config.js`. Never use the service-role key in this client.
3. In Authentication → URL Configuration, add the browser URL and Android app/web-view URL as allowed redirect URLs.
4. Serve DayFlow over HTTP(S), choose **Connect**, and create an account or sign in.

## Email and push reminders

1. Run the latest `supabase-schema.sql` in the SQL Editor. This adds reminder fields, push subscriptions, and duplicate-delivery protection.
2. Create a [Resend](https://resend.com) API key and verify the sender domain/address used by `REMINDER_EMAIL_FROM`.
3. Generate a VAPID key pair (for example, `npx web-push generate-vapid-keys`). Put the public key in `supabase-config.js` and keep the private key only in Supabase secrets.
4. Set the Edge Function secrets:

   ```sh
   supabase secrets set RESEND_API_KEY=... REMINDER_EMAIL_FROM="DayFlow <reminders@example.com>" VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=...
   ```

5. Deploy the worker without JWT verification; it authenticates scheduled calls with `CRON_SECRET`:

   ```sh
   supabase functions deploy send-reminders --no-verify-jwt
   ```

6. In the Supabase dashboard, create a Cron job that runs every five minutes and sends a POST request to `https://PROJECT_REF.supabase.co/functions/v1/send-reminders` with `Authorization: Bearer YOUR_CRON_SECRET`.
7. Test email first by creating an appointment a few minutes ahead with a one-minute email reminder. Then open **Account**, enable push on the Android device, and test a push reminder.

Reminders apply only to appointments with a date and start time. The app stores the device's IANA time zone on each reminder-enabled appointment so delivery remains correct across daylight-saving changes. The scheduled worker accepts reminders up to ten minutes late to tolerate a delayed Cron run, while the database prevents duplicates.

At the first sign-in, existing `df6` local tasks are uploaded when the account has no remote tasks. Afterward, Supabase is the source of truth and local storage is only a fast cache.
