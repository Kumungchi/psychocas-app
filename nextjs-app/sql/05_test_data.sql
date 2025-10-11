-- Test data for health check
-- Create one test branch
INSERT INTO public.branches (id, name, city)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Praha - testovací pobočka', 'Praha')
ON CONFLICT (id) DO NOTHING;

-- Example partner offer (national)
INSERT INTO public.partner_offers (title, description, discount_percentage, scope, active)
VALUES (
  'Testovací celostátní partner',
  'Ukázková sleva dostupná všem členům Psychočas.',
  10,
  'national',
  true
)
ON CONFLICT DO NOTHING;

-- Note: Test member will need to be created after a test user is registered in Supabase Auth
-- Example for manual testing:
-- INSERT INTO public.members (user_id, email, full_name, branch_id, role, membership_active)
-- VALUES ('[USER_UUID_FROM_AUTH]', 'test@example.com', 'Test User', '550e8400-e29b-41d4-a716-446655440000', 'member', true);

-- Health check queries:
-- SELECT * FROM public.branches;
-- SELECT * FROM public.members;
-- SELECT * FROM public.tokens;
-- SELECT * FROM public.redemptions;