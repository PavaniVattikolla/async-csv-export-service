-- seeds/seed_10m.sql
-- WARNING: This inserts 10 million rows and will take a long time and use disk/CPU.
INSERT INTO users (name, email, country_code, subscription_tier, lifetime_value)
SELECT
    'user_' || i,
    'user_' || i || '@example.com',
    (ARRAY['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'JP', 'CN'])[((i-1) % 8) + 1],
    (ARRAY['free', 'premium', 'enterprise'])[((i-1) % 3) + 1],
    round((random() * 1000)::numeric, 2)
FROM generate_series(1, 10000000) as s(i);
