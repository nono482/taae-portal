-- =============================================================
-- Smart TAYORU — 全テーブル RLS 完全設定
-- 2026-04-17
-- 実行は冪等（既存ポリシーを DROP してから CREATE）
-- =============================================================

-- ─── ヘルパー関数: 現在ユーザーの tenant_id を返す ──────────
CREATE OR REPLACE FUNCTION current_tenant_id()
  RETURNS UUID
  LANGUAGE sql STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;


-- =============================================================
-- 1. tenants テーブル
-- =============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_select"  ON tenants;
DROP POLICY IF EXISTS "tenants_update"  ON tenants;

-- 自テナントのみ参照可
CREATE POLICY "tenants_select" ON tenants
  FOR SELECT USING (id = current_tenant_id());

-- 管理者のみ更新可
CREATE POLICY "tenants_update" ON tenants
  FOR UPDATE USING (
    id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND tenant_id = current_tenant_id() AND role = 'admin'
    )
  );


-- =============================================================
-- 2. users テーブル
-- =============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;

-- 同テナントのメンバーは参照可
CREATE POLICY "users_select" ON users
  FOR SELECT USING (tenant_id = current_tenant_id());

-- 管理者のみ招待・追加可
CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND tenant_id = current_tenant_id() AND role = 'admin'
    )
  );

-- 自分自身、または管理者が更新可
CREATE POLICY "users_update" ON users
  FOR UPDATE USING (
    tenant_id = current_tenant_id()
    AND (
      id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND tenant_id = current_tenant_id() AND role = 'admin'
      )
    )
  );


-- =============================================================
-- 3. expense_categories テーブル
-- =============================================================
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_categories_select" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_insert" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_update" ON expense_categories;
DROP POLICY IF EXISTS "expense_categories_delete" ON expense_categories;

CREATE POLICY "expense_categories_select" ON expense_categories
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "expense_categories_insert" ON expense_categories
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "expense_categories_update" ON expense_categories
  FOR UPDATE USING (tenant_id = current_tenant_id());

CREATE POLICY "expense_categories_delete" ON expense_categories
  FOR DELETE USING (tenant_id = current_tenant_id() AND is_system = FALSE);


-- =============================================================
-- 4. expenses テーブル
-- =============================================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_update" ON expenses;
DROP POLICY IF EXISTS "expenses_delete" ON expenses;

CREATE POLICY "expenses_select" ON expenses
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

-- 承認操作は管理者のみ、それ以外は自分の経費のみ更新可
CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE USING (
    tenant_id = current_tenant_id()
    AND (
      submitted_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND tenant_id = current_tenant_id() AND role = 'admin'
      )
    )
  );

-- 管理者のみ削除可（または自分の未承認経費）
CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (
    tenant_id = current_tenant_id()
    AND (
      (submitted_by = auth.uid() AND status = 'pending')
      OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND tenant_id = current_tenant_id() AND role = 'admin'
      )
    )
  );


-- =============================================================
-- 5. employees テーブル
-- =============================================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_select" ON employees;
DROP POLICY IF EXISTS "employees_insert" ON employees;
DROP POLICY IF EXISTS "employees_update" ON employees;
DROP POLICY IF EXISTS "employees_delete" ON employees;

CREATE POLICY "employees_select" ON employees
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "employees_insert" ON employees
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "employees_update" ON employees
  FOR UPDATE USING (tenant_id = current_tenant_id());

CREATE POLICY "employees_delete" ON employees
  FOR DELETE USING (tenant_id = current_tenant_id());


-- =============================================================
-- 6. payroll_records テーブル
-- =============================================================
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_records_select" ON payroll_records;
DROP POLICY IF EXISTS "payroll_records_insert" ON payroll_records;
DROP POLICY IF EXISTS "payroll_records_update" ON payroll_records;
DROP POLICY IF EXISTS "payroll_records_delete" ON payroll_records;

CREATE POLICY "payroll_records_select" ON payroll_records
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "payroll_records_insert" ON payroll_records
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "payroll_records_update" ON payroll_records
  FOR UPDATE USING (tenant_id = current_tenant_id());

CREATE POLICY "payroll_records_delete" ON payroll_records
  FOR DELETE USING (tenant_id = current_tenant_id());


-- =============================================================
-- 7. contractors テーブル
-- =============================================================
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractors_select" ON contractors;
DROP POLICY IF EXISTS "contractors_insert" ON contractors;
DROP POLICY IF EXISTS "contractors_update" ON contractors;
DROP POLICY IF EXISTS "contractors_delete" ON contractors;

CREATE POLICY "contractors_select" ON contractors
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "contractors_insert" ON contractors
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "contractors_update" ON contractors
  FOR UPDATE USING (tenant_id = current_tenant_id());

CREATE POLICY "contractors_delete" ON contractors
  FOR DELETE USING (tenant_id = current_tenant_id());


-- =============================================================
-- 8. contractor_invoices テーブル
-- =============================================================
ALTER TABLE contractor_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractor_invoices_select" ON contractor_invoices;
DROP POLICY IF EXISTS "contractor_invoices_insert" ON contractor_invoices;
DROP POLICY IF EXISTS "contractor_invoices_update" ON contractor_invoices;
DROP POLICY IF EXISTS "contractor_invoices_delete" ON contractor_invoices;

CREATE POLICY "contractor_invoices_select" ON contractor_invoices
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "contractor_invoices_insert" ON contractor_invoices
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "contractor_invoices_update" ON contractor_invoices
  FOR UPDATE USING (tenant_id = current_tenant_id());

CREATE POLICY "contractor_invoices_delete" ON contractor_invoices
  FOR DELETE USING (tenant_id = current_tenant_id());


-- =============================================================
-- 9. bank_accounts テーブル
-- =============================================================
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_accounts_select" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_insert" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_update" ON bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_delete" ON bank_accounts;

CREATE POLICY "bank_accounts_select" ON bank_accounts
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "bank_accounts_insert" ON bank_accounts
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "bank_accounts_update" ON bank_accounts
  FOR UPDATE USING (tenant_id = current_tenant_id());

CREATE POLICY "bank_accounts_delete" ON bank_accounts
  FOR DELETE USING (tenant_id = current_tenant_id());


-- =============================================================
-- 10. bank_transactions テーブル
-- =============================================================
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_transactions_select" ON bank_transactions;
DROP POLICY IF EXISTS "bank_transactions_insert" ON bank_transactions;
DROP POLICY IF EXISTS "bank_transactions_update" ON bank_transactions;
DROP POLICY IF EXISTS "bank_transactions_delete" ON bank_transactions;

CREATE POLICY "bank_transactions_select" ON bank_transactions
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "bank_transactions_insert" ON bank_transactions
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "bank_transactions_update" ON bank_transactions
  FOR UPDATE USING (tenant_id = current_tenant_id());

CREATE POLICY "bank_transactions_delete" ON bank_transactions
  FOR DELETE USING (tenant_id = current_tenant_id());


-- =============================================================
-- 11. financial_schedules テーブル（既存 migration に追加）
-- =============================================================
-- ※ 既存ポリシーは 20260416_outsourcing_schedules.sql で定義済み
--   万が一未適用の場合のため再定義（冪等）

ALTER TABLE financial_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_select" ON financial_schedules;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON financial_schedules;
DROP POLICY IF EXISTS "tenant_isolation_update" ON financial_schedules;
DROP POLICY IF EXISTS "tenant_isolation_delete" ON financial_schedules;

CREATE POLICY "tenant_isolation_select" ON financial_schedules
  FOR SELECT USING (tenant_id = current_tenant_id());

CREATE POLICY "tenant_isolation_insert" ON financial_schedules
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "tenant_isolation_update" ON financial_schedules
  FOR UPDATE USING (tenant_id = current_tenant_id());

CREATE POLICY "tenant_isolation_delete" ON financial_schedules
  FOR DELETE USING (tenant_id = current_tenant_id());


-- =============================================================
-- 12. audit_logs テーブル
-- =============================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;

-- 参照は管理者のみ
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND tenant_id = current_tenant_id() AND role = 'admin'
    )
  );

-- INSERT はサービスロール（バックエンド）経由のみを想定
-- anon/authenticated ロールからは拒否
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());


-- =============================================================
-- 完了メッセージ
-- =============================================================
DO $$
BEGIN
  RAISE NOTICE 'Smart TAYORU: 全テーブルの RLS ポリシー設定が完了しました';
END
$$;
