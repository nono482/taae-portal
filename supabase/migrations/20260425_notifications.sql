-- 2026-04-25: notifications テーブル + receipts ストレージバケット

-- ─── notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  category     text        NOT NULL DEFAULT 'expense',
  priority     text        NOT NULL DEFAULT 'medium',
  title        text        NOT NULL,
  body         text        NOT NULL,
  is_read      boolean     NOT NULL DEFAULT false,
  action_label text,
  action_href  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_tenant_idx  ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifs_select" ON notifications;
DROP POLICY IF EXISTS "notifs_insert" ON notifications;
DROP POLICY IF EXISTS "notifs_update" ON notifications;

-- ユーザーは自分宛のみ閲覧可
CREATE POLICY "notifs_select" ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- サービスロール（管理者クライアント）から INSERT 可
CREATE POLICY "notifs_insert" ON notifications
  FOR INSERT WITH CHECK (true);

-- ユーザーは自分宛のみ更新可（既読マーク）
CREATE POLICY "notifs_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- ─── receipts ストレージバケット ──────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "receipts_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_select" ON storage.objects;

CREATE POLICY "receipts_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "receipts_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'receipts' AND auth.uid() IS NOT NULL);
