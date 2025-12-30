-- Seed data for basehook tables with LOTS of data
-- This script populates webhook, thread, and thread_update tables with thousands of sample records

-- Clean up existing data (optional - comment out if you want to keep existing data)
-- TRUNCATE TABLE thread_update CASCADE;
-- TRUNCATE TABLE thread CASCADE;
-- TRUNCATE TABLE webhook CASCADE;

-- Insert sample webhooks
INSERT INTO webhook (name, thread_id_path, revision_number_path) VALUES
    ('github', ARRAY['repository', 'id'], ARRAY['push', 'timestamp']),
    ('stripe', ARRAY['data', 'object', 'id'], ARRAY['created']),
    ('slack', ARRAY['event', 'channel'], ARRAY['event_ts']),
    ('shopify', ARRAY['order', 'id'], ARRAY['updated_at']),
    ('discord', ARRAY['guild_id'], ARRAY['timestamp']),
    ('twilio', ARRAY['message_sid'], ARRAY['date_created']),
    ('sendgrid', ARRAY['email_id'], ARRAY['timestamp']),
    ('test', ARRAY['thread_id'], ARRAY['revision'])
ON CONFLICT (name) DO NOTHING;

-- Generate threads (500 threads across all webhooks)
DO $$
DECLARE
    webhook_names TEXT[] := ARRAY['github', 'stripe', 'slack', 'shopify', 'discord', 'twilio', 'sendgrid', 'test'];
    webhook TEXT;
    i INTEGER;
    last_rev FLOAT;
BEGIN
    FOREACH webhook IN ARRAY webhook_names
    LOOP
        FOR i IN 1..100 LOOP
            -- Randomly decide if thread has been processed
            IF random() > 0.3 THEN
                last_rev := 1000000000.0 + (random() * 100000)::INTEGER;
            ELSE
                last_rev := NULL;
            END IF;

            INSERT INTO thread (webhook_name, thread_id, last_revision_number)
            VALUES (
                webhook,
                webhook || '-thread-' || LPAD(i::TEXT, 5, '0'),
                last_rev
            )
            ON CONFLICT (webhook_name, thread_id) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Generate thread updates (10,000+ updates)
DO $$
DECLARE
    webhook_names TEXT[] := ARRAY['github', 'stripe', 'slack', 'shopify', 'discord', 'twilio', 'sendgrid', 'test'];
    statuses TEXT[] := ARRAY['pending', 'success', 'error', 'skipped'];
    webhook TEXT;
    thread_num INTEGER;
    update_num INTEGER;
    thread_id TEXT;
    rev_num FLOAT;
    base_timestamp FLOAT;
    status_val TEXT;
    content_json JSONB;
BEGIN
    FOREACH webhook IN ARRAY webhook_names
    LOOP
        FOR thread_num IN 1..100 LOOP
            thread_id := webhook || '-thread-' || LPAD(thread_num::TEXT, 5, '0');

            -- Generate 3-20 updates per thread
            FOR update_num IN 1..(3 + (random() * 17)::INTEGER) LOOP
                rev_num := 1000000000.0 + (thread_num * 1000) + (update_num * 10) + (random() * 9);
                base_timestamp := extract(epoch from now() - (random() * interval '30 days'));

                -- Status distribution: 40% success, 30% pending, 20% skipped, 10% error
                CASE
                    WHEN random() < 0.4 THEN status_val := 'SUCCESS';
                    WHEN random() < 0.7 THEN status_val := 'PENDING';
                    WHEN random() < 0.9 THEN status_val := 'SKIPPED';
                    ELSE status_val := 'ERROR';
                END CASE;

                -- Generate realistic content based on webhook type
                CASE webhook
                    WHEN 'github' THEN
                        content_json := jsonb_build_object(
                            'repository', jsonb_build_object('id', thread_id, 'name', 'repo-' || thread_num),
                            'push', jsonb_build_object('timestamp', rev_num),
                            'commits', jsonb_build_array(
                                jsonb_build_object(
                                    'sha', md5(random()::TEXT),
                                    'message', 'Commit message ' || update_num,
                                    'author', jsonb_build_object('name', 'Developer ' || (1 + (random() * 10)::INTEGER))
                                )
                            ),
                            'ref', 'refs/heads/main'
                        );
                    WHEN 'stripe' THEN
                        content_json := jsonb_build_object(
                            'data', jsonb_build_object(
                                'object', jsonb_build_object(
                                    'id', thread_id,
                                    'amount', (random() * 100000)::INTEGER,
                                    'currency', 'usd'
                                )
                            ),
                            'created', rev_num,
                            'type', CASE (random() * 4)::INTEGER
                                WHEN 0 THEN 'customer.created'
                                WHEN 1 THEN 'customer.updated'
                                WHEN 2 THEN 'invoice.paid'
                                ELSE 'payment_intent.succeeded'
                            END
                        );
                    WHEN 'slack' THEN
                        content_json := jsonb_build_object(
                            'event', jsonb_build_object(
                                'channel', thread_id,
                                'text', 'Message ' || update_num || ' - ' || md5(random()::TEXT),
                                'user', 'U' || LPAD((random() * 100000)::INTEGER::TEXT, 10, '0')
                            ),
                            'event_ts', rev_num
                        );
                    WHEN 'shopify' THEN
                        content_json := jsonb_build_object(
                            'order', jsonb_build_object(
                                'id', thread_id,
                                'order_number', 1000 + thread_num,
                                'total_price', (random() * 1000)::NUMERIC(10,2)
                            ),
                            'updated_at', rev_num
                        );
                    WHEN 'discord' THEN
                        content_json := jsonb_build_object(
                            'guild_id', thread_id,
                            'channel_id', 'C' || LPAD((random() * 1000000)::INTEGER::TEXT, 10, '0'),
                            'message', 'Discord message ' || update_num,
                            'timestamp', rev_num
                        );
                    WHEN 'twilio' THEN
                        content_json := jsonb_build_object(
                            'message_sid', thread_id,
                            'from', '+1' || LPAD((random() * 10000000000)::BIGINT::TEXT, 10, '0'),
                            'to', '+1' || LPAD((random() * 10000000000)::BIGINT::TEXT, 10, '0'),
                            'body', 'SMS message ' || update_num,
                            'date_created', rev_num
                        );
                    WHEN 'sendgrid' THEN
                        content_json := jsonb_build_object(
                            'email_id', thread_id,
                            'email', 'user' || thread_num || '@example.com',
                            'subject', 'Email subject ' || update_num,
                            'timestamp', rev_num,
                            'event', CASE (random() * 5)::INTEGER
                                WHEN 0 THEN 'processed'
                                WHEN 1 THEN 'delivered'
                                WHEN 2 THEN 'open'
                                WHEN 3 THEN 'click'
                                ELSE 'bounce'
                            END
                        );
                    ELSE
                        content_json := jsonb_build_object(
                            'thread_id', thread_id,
                            'revision', rev_num,
                            'data', 'Test data ' || update_num,
                            'metadata', jsonb_build_object(
                                'processed_at', base_timestamp,
                                'worker_id', 'worker-' || (1 + (random() * 5)::INTEGER)
                            )
                        );
                END CASE;

                INSERT INTO thread_update (webhook_name, thread_id, revision_number, content, timestamp, status)
                VALUES (
                    webhook,
                    thread_id,
                    rev_num,
                    content_json,
                    base_timestamp,
                    status_val::threadupdatestatus
                );
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- Create some specific test scenarios with known data
INSERT INTO thread_update (webhook_name, thread_id, revision_number, content, timestamp, status) VALUES
    -- Thread with all pending updates (ready to process)
    ('test', 'test-pending-only', 1.0, '{"thread_id": "test-pending-only", "revision": 1.0, "data": "pending 1"}', extract(epoch from now() - interval '10 minutes'), 'pending'),
    ('test', 'test-pending-only', 2.0, '{"thread_id": "test-pending-only", "revision": 2.0, "data": "pending 2"}', extract(epoch from now() - interval '8 minutes'), 'pending'),
    ('test', 'test-pending-only', 3.0, '{"thread_id": "test-pending-only", "revision": 3.0, "data": "pending 3 (latest)"}', extract(epoch from now() - interval '5 minutes'), 'pending'),

    -- Thread with out-of-order revisions
    ('test', 'test-out-of-order', 5.0, '{"thread_id": "test-out-of-order", "revision": 5.0}', extract(epoch from now() - interval '15 minutes'), 'pending'),
    ('test', 'test-out-of-order', 2.0, '{"thread_id": "test-out-of-order", "revision": 2.0}', extract(epoch from now() - interval '14 minutes'), 'pending'),
    ('test', 'test-out-of-order', 8.0, '{"thread_id": "test-out-of-order", "revision": 8.0}', extract(epoch from now() - interval '13 minutes'), 'pending'),
    ('test', 'test-out-of-order', 3.0, '{"thread_id": "test-out-of-order", "revision": 3.0}', extract(epoch from now() - interval '12 minutes'), 'pending'),

    -- Thread with errors
    ('test', 'test-with-errors', 1.0, '{"thread_id": "test-with-errors", "revision": 1.0}', extract(epoch from now() - interval '25 minutes'), 'error'),
    ('test', 'test-with-errors', 2.0, '{"thread_id": "test-with-errors", "revision": 2.0}', extract(epoch from now() - interval '20 minutes'), 'error'),
    ('test', 'test-with-errors', 3.0, '{"thread_id": "test-with-errors", "revision": 3.0}', extract(epoch from now() - interval '15 minutes'), 'pending');

-- Add corresponding threads for test scenarios
INSERT INTO thread (webhook_name, thread_id, last_revision_number) VALUES
    ('test', 'test-pending-only', NULL),
    ('test', 'test-out-of-order', NULL),
    ('test', 'test-with-errors', NULL)
ON CONFLICT (webhook_name, thread_id) DO NOTHING;

-- Display comprehensive summary
SELECT
    '=== SUMMARY BY WEBHOOK ===' as section;

SELECT
    webhook_name,
    COUNT(*) as total_updates,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
    SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
FROM thread_update
GROUP BY webhook_name
ORDER BY webhook_name;

SELECT
    '=== OVERALL STATISTICS ===' as section;

SELECT
    COUNT(DISTINCT webhook_name) as total_webhooks,
    COUNT(DISTINCT thread_id) as total_threads,
    COUNT(*) as total_updates,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as total_pending,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as total_success,
    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as total_error,
    SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as total_skipped
FROM thread_update;

SELECT
    '=== RECENT UPDATES (Last 10) ===' as section;

SELECT
    webhook_name,
    thread_id,
    revision_number,
    status,
    to_timestamp(timestamp) as created_at
FROM thread_update
ORDER BY timestamp DESC
LIMIT 10;
