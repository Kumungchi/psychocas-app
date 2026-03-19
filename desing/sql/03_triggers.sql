-- =============================================================================
-- PSYCHOČAS — TRIGGERS
-- =============================================================================
-- Triggers are functions that run automatically when something happens in the DB.
-- They enforce business rules that MUST be true regardless of how data is inserted
-- (app, Edge Function, Supabase dashboard, direct SQL — doesn't matter).
-- =============================================================================


-- =============================================================================
-- 1. ANTI-SPAM: One active token per member at a time
-- =============================================================================
-- A token is "active" if it hasn't been redeemed AND hasn't expired.
-- This prevents a member from generating 100 tokens and giving them to friends.
--
-- When a member tries to INSERT a new token, this trigger checks if they
-- already have an active one. If yes, the INSERT is rejected.

CREATE OR REPLACE FUNCTION public.prevent_token_spam()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tokens
    WHERE member_id = NEW.member_id
      AND redeemed_at IS NULL
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Již máte aktivní token. Počkejte na jeho vypršení.'
      USING HINT = 'active_token_exists';
    -- Czech: "You already have an active token. Wait for it to expire."
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_token_spam ON public.tokens;
CREATE TRIGGER trg_token_spam
  BEFORE INSERT ON public.tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_token_spam();


-- =============================================================================
-- 2. AUTO-EXPIRE: Clean up old tokens periodically
-- =============================================================================
-- This is NOT a trigger — it's a helper function you can call manually or
-- schedule with pg_cron (Supabase supports this in the dashboard).
-- It marks tokens as expired if they're past their expires_at time.
--
-- In practice, the app checks expires_at client-side for the countdown.
-- This function is just for housekeeping / cleaning up the DB.

CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete tokens that expired more than 24 hours ago and were never redeemed
  -- (we keep redeemed tokens forever for analytics)
  DELETE FROM public.tokens
  WHERE redeemed_at IS NULL
    AND expires_at < now() - INTERVAL '24 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


-- =============================================================================
-- 3. STATS VIEW: Daily redemptions by branch
-- =============================================================================
-- A view is a saved query that acts like a table.
-- Instead of writing a complex GROUP BY every time, you just:
--   SELECT * FROM redemptions_daily WHERE branch_id = '...'

CREATE OR REPLACE VIEW public.redemptions_daily AS
SELECT
  branch_id,
  partner_id,
  discount_id,
  date_trunc('day', redeemed_at)::date AS day,
  count(*) AS total
FROM public.redemptions
GROUP BY branch_id, partner_id, discount_id, day;
