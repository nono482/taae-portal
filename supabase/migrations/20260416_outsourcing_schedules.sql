-- =============================================================
-- Smart TAYORU — 業務委託・スケジュール管理 マイグレーション
-- 2026-04-16
-- =============================================================

-- ─── 1. expenses テーブルにカラム追加 ─────────────────────
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS applied_at            DATE,
  ADD COLUMN IF NOT EXISTS payment_expected_date DATE;

COMMENT ON COLUMN expenses.applied_at             IS '経費の申請日（申請者が提出した日付）';
COMMENT ON COLUMN expenses.payment_expected_date  IS '支払予定日（精算の振込予定日）';


-- ─── 2. financial_schedules テーブル新規作成 ──────────────
CREATE TABLE IF NOT EXISTS financial_schedules (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  schedule_type  TEXT        NOT NULL CHECK (schedule_type IN (
                               'withholding_tax',
                               'expense_payment',
                               'invoice_payment',
                               'custom'
                             )),
  title          TEXT        NOT NULL,
  due_date       DATE        NOT NULL,
  amount         NUMERIC(12, 0),
  related_id     UUID,
  related_table  TEXT,
  status         TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'completed', 'overdue')),
  memo           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  financial_schedules                  IS '経費支払・源泉所得税納付などのスケジュール管理';
COMMENT ON COLUMN financial_schedules.schedule_type    IS 'withholding_tax / expense_payment / invoice_payment / custom';
COMMENT ON COLUMN financial_schedules.related_id       IS '関連するレコードのID（contractor_invoices.id など）';
COMMENT ON COLUMN financial_schedules.related_table    IS '関連テーブル名（contractor_invoices, expenses など）';

-- インデックス
CREATE INDEX IF NOT EXISTS idx_financial_schedules_tenant_due
  ON financial_schedules (tenant_id, due_date);

CREATE INDEX IF NOT EXISTS idx_financial_schedules_status
  ON financial_schedules (tenant_id, status);


-- ─── 3. RLS ポリシー ──────────────────────────────────────
ALTER TABLE financial_schedules ENABLE ROW LEVEL SECURITY;

-- 同一テナントのユーザーのみ参照・操作可能
CREATE POLICY "tenant_isolation_select" ON financial_schedules
  FOR SELECT USING (
    tenant_id = (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "tenant_isolation_insert" ON financial_schedules
  FOR INSERT WITH CHECK (
    tenant_id = (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "tenant_isolation_update" ON financial_schedules
  FOR UPDATE USING (
    tenant_id = (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "tenant_isolation_delete" ON financial_schedules
  FOR DELETE USING (
    tenant_id = (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );
