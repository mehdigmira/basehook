-- Seed data for basehook tables with LOTS of data
-- This script populates webhook, thread, and thread_update tables with thousands of sample records

-- Clean up existing data (optional - comment out if you want to keep existing data)
-- TRUNCATE TABLE thread_update CASCADE;
-- TRUNCATE TABLE thread CASCADE;
-- TRUNCATE TABLE webhook CASCADE;


  -- 8. Zendesk-style webhook (no HMAC, relies on IP allowlisting)
  INSERT INTO webhook (
      name,
      thread_id_path,
      revision_number_path,
      hmac_enabled,
      hmac_secret,
      hmac_header,
      hmac_timestamp_header,
      hmac_signature_format,
      hmac_encoding,
      hmac_algorithm,
      hmac_prefix
  ) VALUES (
      'zendesk-tickets',
      ARRAY['ticket', 'id'],
      ARRAY['ticket', 'updated_at'],
      false,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL
  );

  update thread_update set content='{
  "token": "YzPLud7HqlqYwfBXSiZoXDpZ",
  "team_id": "T0823S1DGGM",
  "context_team_id": "T0823S1DGGM",
  "context_enterprise_id": null,
  "api_app_id": "A0A2W6VMUJX",
  "event": {
    "type": "message",
    "user": "U082KCBQZ09",
    "ts": "1767194158.923389",
    "client_msg_id": "dd560098-9a07-4541-ac02-0756190cf786",
    "text": "test",
    "team": "T0823S1DGGM",
    "thread_ts": "1767194091.516949",
    "parent_user_id": "U082KCBQZ09",
    "blocks": [
      {
        "type": "rich_text",
        "block_id": "gB9fq",
        "elements": [
          {
            "type": "rich_text_section",
            "elements": [
              {
                "type": "text",
                "text": "test"
              }
            ]
          }
        ]
      }
    ],
    "channel": "C092ZMD8QHZ",
    "event_ts": "1767194158.923389",
    "channel_type": "channel"
  },
  "type": "event_callback",
  "event_id": "Ev0A67D2JBN2",
  "event_time": 1767194158,
  "authorizations": [
    {
      "enterprise_id": null,
      "team_id": "T0823S1DGGM",
      "user_id": "U0A3WUHHKNU",
      "is_bot": true,
      "is_enterprise_install": false
    }
  ],
  "is_ext_shared_channel": false,
  "event_context": "4-eyJldCI6Im1lc3NhZ2UiLCJ0aWQiOiJUMDgyM1MxREdHTSIsImFpZCI6IkEwQTJXNlZNVUpYIiwiY2lkIjoiQzA5MlpNRDhRSFoifQ"
}'::jsonb

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
    traceback_text TEXT;
    error_type INTEGER;
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

                -- Generate realistic traceback for errors
                traceback_text := NULL;
                IF status_val = 'ERROR' THEN
                    error_type := (random() * 5)::INTEGER;
                    CASE error_type
                        WHEN 0 THEN
                            traceback_text := 'Traceback (most recent call last):
  File "/app/basehook/pull.py", line 42, in process_update
    result = await handler.process(update.content)
  File "/app/handlers/webhook_handler.py", line 87, in process
    data = self.parse_content(content)
  File "/app/handlers/webhook_handler.py", line 123, in parse_content
    return json.loads(content["data"])
KeyError: ''data''

The webhook payload is missing the required ''data'' field.';
                        WHEN 1 THEN
                            traceback_text := 'Traceback (most recent call last):
  File "/app/basehook/pull.py", line 42, in process_update
    result = await handler.process(update.content)
  File "/app/handlers/webhook_handler.py", line 102, in process
    await self.validate_schema(content)
  File "/app/handlers/webhook_handler.py", line 156, in validate_schema
    raise ValueError(f"Invalid revision number: {content[''revision'']}")
ValueError: Invalid revision number: None

Revision number cannot be None or missing.';
                        WHEN 2 THEN
                            traceback_text := 'Traceback (most recent call last):
  File "/app/basehook/pull.py", line 42, in process_update
    result = await handler.process(update.content)
  File "/app/handlers/webhook_handler.py", line 67, in process
    async with self.db.transaction():
  File "/usr/local/lib/python3.11/site-packages/sqlalchemy/ext/asyncio/engine.py", line 346, in __aenter__
    await self.start()
  File "/usr/local/lib/python3.11/site-packages/sqlalchemy/ext/asyncio/engine.py", line 256, in start
    self._connection = await self._engine.connect()
asyncio.exceptions.TimeoutError: Database connection timeout after 30s';
                        WHEN 3 THEN
                            traceback_text := 'Traceback (most recent call last):
  File "/app/basehook/pull.py", line 42, in process_update
    result = await handler.process(update.content)
  File "/app/handlers/' || webhook || '_handler.py", line 91, in process
    user_id = int(content["user"]["id"])
  File "/usr/local/lib/python3.11/site-packages/pydantic/main.py", line 234, in __getitem__
    return self.__dict__[item]
KeyError: ''user''

The payload structure does not match expected schema for ' || webhook || ' webhooks.';
                        ELSE
                            traceback_text := 'Traceback (most recent call last):
  File "/app/basehook/pull.py", line 42, in process_update
    result = await handler.process(update.content)
  File "/app/handlers/webhook_handler.py", line 78, in process
    response = await self.http_client.post(webhook_url, json=payload)
  File "/usr/local/lib/python3.11/site-packages/httpx/_client.py", line 1842, in post
    return await self.request("POST", url, **kwargs)
  File "/usr/local/lib/python3.11/site-packages/httpx/_client.py", line 1547, in request
    return await self.send(request, auth=auth, follow_redirects=follow_redirects)
httpx.ConnectError: [Errno 111] Connection refused

Failed to connect to downstream service at https://api.example.com/' || webhook || '/events';
                    END CASE;
                END IF;

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

                INSERT INTO thread_update (webhook_name, thread_id, revision_number, content, timestamp, status, traceback)
                VALUES (
                    webhook,
                    thread_id,
                    rev_num,
                    content_json,
                    base_timestamp,
                    status_val::threadupdatestatus,
                    traceback_text
                );
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- Create some specific test scenarios with known data
INSERT INTO thread_update (webhook_name, thread_id, revision_number, content, timestamp, status, traceback) VALUES
    -- Thread with all pending updates (ready to process)
    ('test', 'test-pending-only', 1.0, '{"thread_id": "test-pending-only", "revision": 1.0, "data": "pending 1"}', extract(epoch from now() - interval '10 minutes'), 'pending', NULL),
    ('test', 'test-pending-only', 2.0, '{"thread_id": "test-pending-only", "revision": 2.0, "data": "pending 2"}', extract(epoch from now() - interval '8 minutes'), 'pending', NULL),
    ('test', 'test-pending-only', 3.0, '{"thread_id": "test-pending-only", "revision": 3.0, "data": "pending 3 (latest)"}', extract(epoch from now() - interval '5 minutes'), 'pending', NULL),

    -- Thread with out-of-order revisions
    ('test', 'test-out-of-order', 5.0, '{"thread_id": "test-out-of-order", "revision": 5.0}', extract(epoch from now() - interval '15 minutes'), 'pending', NULL),
    ('test', 'test-out-of-order', 2.0, '{"thread_id": "test-out-of-order", "revision": 2.0}', extract(epoch from now() - interval '14 minutes'), 'pending', NULL),
    ('test', 'test-out-of-order', 8.0, '{"thread_id": "test-out-of-order", "revision": 8.0}', extract(epoch from now() - interval '13 minutes'), 'pending', NULL),
    ('test', 'test-out-of-order', 3.0, '{"thread_id": "test-out-of-order", "revision": 3.0}', extract(epoch from now() - interval '12 minutes'), 'pending', NULL),

    -- Thread with errors (with detailed tracebacks)
    ('test', 'test-with-errors', 1.0, '{"thread_id": "test-with-errors", "revision": 1.0}', extract(epoch from now() - interval '25 minutes'), 'error',
'Traceback (most recent call last):
  File "/app/basehook/pull.py", line 42, in process_update
    result = await handler.process(update.content)
  File "/app/handlers/test_handler.py", line 65, in process
    await self.send_to_downstream(content)
  File "/app/handlers/test_handler.py", line 112, in send_to_downstream
    response = await self.http_client.post(self.webhook_url, json=data, timeout=10.0)
  File "/usr/local/lib/python3.11/site-packages/httpx/_client.py", line 1842, in post
    return await self.request("POST", url, **kwargs)
httpx.ReadTimeout: timed out

Downstream service did not respond within 10 seconds.'),

    ('test', 'test-with-errors', 2.0, '{"thread_id": "test-with-errors", "revision": 2.0}', extract(epoch from now() - interval '20 minutes'), 'error',
'Traceback (most recent call last):
  File "/app/basehook/pull.py", line 42, in process_update
    result = await handler.process(update.content)
  File "/app/handlers/test_handler.py", line 58, in process
    validated = self.schema.validate(content)
  File "/app/handlers/test_handler.py", line 145, in validate
    return TestSchema(**data)
  File "/usr/local/lib/python3.11/site-packages/pydantic/main.py", line 341, in __init__
    __pydantic_self__.__pydantic_validator__.validate_python(data, self_instance=__pydantic_self__)
pydantic.ValidationError: 1 validation error for TestSchema
revision
  Field required [type=missing, input_value={''thread_id'': ''test-with-errors''}, input_type=dict]'),

    ('test', 'test-with-errors', 3.0, '{"thread_id": "test-with-errors", "revision": 3.0}', extract(epoch from now() - interval '15 minutes'), 'pending', NULL);

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


-- Insert webhooks with different HMAC configurations

  -- 1. Slack-style webhook with HMAC
  INSERT INTO webhook (
      name,
      thread_id_path,
      revision_number_path,
      hmac_enabled,
      hmac_secret,
      hmac_header,
      hmac_timestamp_header,
      hmac_signature_format,
      hmac_encoding,
      hmac_algorithm,
      hmac_prefix
  ) VALUES (
      'slack-events',
      ARRAY['event', 'thread_ts'],
      ARRAY['event_time'],
      true,
      'slack-signing-secret-key',
      'X-Slack-Signature',
      'X-Slack-Request-Timestamp',
      'v0:{timestamp}:{body}',
      'hex',
      'sha256',
      'v0='
  );

  -- 2. GitHub-style webhook with HMAC
  INSERT INTO webhook (
      name,
      thread_id_path,
      revision_number_path,
      hmac_enabled,
      hmac_secret,
      hmac_header,
      hmac_timestamp_header,
      hmac_signature_format,
      hmac_encoding,
      hmac_algorithm,
      hmac_prefix
  ) VALUES (
      'github-webhooks',
      ARRAY['repository', 'full_name'],
      ARRAY['head_commit', 'timestamp'],
      true,
      'github-webhook-secret',
      'X-Hub-Signature-256',
      NULL,
      '{body}',
      'hex',
      'sha256',
      'sha256='
  );

  -- 3. Shopify-style webhook with HMAC
  INSERT INTO webhook (
      name,
      thread_id_path,
      revision_number_path,
      hmac_enabled,
      hmac_secret,
      hmac_header,
      hmac_timestamp_header,
      hmac_signature_format,
      hmac_encoding,
      hmac_algorithm,
      hmac_prefix
  ) VALUES (
      'shopify-orders',
      ARRAY['id'],
      ARRAY['updated_at'],
      true,
      'shopify-shared-secret',
      'X-Shopify-Hmac-SHA256',
      NULL,
      '{body}',
      'base64',
      'sha256',
      NULL
  );

  -- 4. Stripe-style webhook with HMAC
  INSERT INTO webhook (
      name,
      thread_id_path,
      revision_number_path,
      hmac_enabled,
      hmac_secret,
      hmac_header,
      hmac_timestamp_header,
      hmac_signature_format,
      hmac_encoding,
      hmac_algorithm,
      hmac_prefix
  ) VALUES (
      'stripe-events',
      ARRAY['data', 'object', 'id'],
      ARRAY['created'],
      true,
      'stripe-webhook-secret',
      'Stripe-Signature',
      NULL,
      '{timestamp}.{body}',
      'hex',
      'sha256',
      NULL
  );

  -- 5. Simple webhook without HMAC
  INSERT INTO webhook (
      name,
      thread_id_path,
      revision_number_path,
      hmac_enabled,
      hmac_secret,
      hmac_header,
      hmac_timestamp_header,
      hmac_signature_format,
      hmac_encoding,
      hmac_algorithm,
      hmac_prefix
  ) VALUES (
      'internal-api',
      ARRAY['request_id'],
      ARRAY['timestamp'],
      false,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL
  );

  -- 6. Twilio-style webhook with HMAC (SHA1)
  INSERT INTO webhook (
      name,
      thread_id_path,
      revision_number_path,
      hmac_enabled,
      hmac_secret,
      hmac_header,
      hmac_timestamp_header,
      hmac_signature_format,
      hmac_encoding,
      hmac_algorithm,
      hmac_prefix
  ) VALUES (
      'twilio-sms',
      ARRAY['MessageSid'],
      ARRAY['DateSent'],
      true,
      'twilio-auth-token',
      'X-Twilio-Signature',
      NULL,
      '{url}{body}',
      'base64',
      'sha1',
      NULL
  );

  -- 7. Custom API webhook
  INSERT INTO webhook (
      name,
      thread_id_path,
      revision_number_path,
      hmac_enabled,
      hmac_secret,
      hmac_header,
      hmac_timestamp_header,
      hmac_signature_format,
      hmac_encoding,
      hmac_algorithm,
      hmac_prefix
  ) VALUES (
      'custom-api',
      ARRAY['transaction', 'id'],
      ARRAY['transaction', 'version'],
      true,
      'my-custom-secret',
      'X-Custom-Signature',
      NULL,
      '{body}',
      'hex',
      'sha256',
      NULL
  );
