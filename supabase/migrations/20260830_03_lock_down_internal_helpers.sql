-- Referral production-readiness, follow-up: privilege lockdown.
--
-- Caught by the Supabase security advisor after part 2 went in. Supabase
-- grants EXECUTE on functions in `public` to anon/authenticated by default, so
-- the `revoke ... from public` in part 2 was not enough -- those roles hold the
-- privilege directly, and every helper was reachable over PostgREST.
--
-- send_email was the serious one: with the Resend key in Vault, anyone holding
-- the (public, browser-visible) anon key could POST arbitrary HTML to any
-- recipient from the verified sending domain. An open spam relay.

revoke execute on function public.send_email(text, text, text)
  from anon, authenticated;
revoke execute on function public.send_verification_email(text, text, text)
  from anon, authenticated;
revoke execute on function public.send_confirmation_email(text, text, text)
  from anon, authenticated;
revoke execute on function public.resolve_origin(text)
  from anon, authenticated;
revoke execute on function public.caller_ip()
  from anon, authenticated;

-- join_waitlist and verify_email stay callable by anon: that is the entire
-- intended public surface, and both are written to be safe against hostile
-- input. Calls into the helpers above still work from inside them, because a
-- SECURITY DEFINER function runs with the owner's privileges.
