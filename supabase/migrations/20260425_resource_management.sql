-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- リソース管理: partners / work_orders / documents
-- employees への追加カラム
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ── partners（外注先マスター）────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_name         text        NOT NULL,
  contact_name         text,
  email                text,
  phone                text,
  address              text,
  bank_name            text,
  bank_branch          text,
  bank_account_type    text        NOT NULL DEFAULT '普通',
  bank_account_number  text,
  bank_account_name    text,
  standard_unit_price  integer     NOT NULL DEFAULT 0,
  invoice_number       text,
  withholding_rate     numeric     NOT NULL DEFAULT 0.1021,
  notes                text,
  is_active            boolean     NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partners_select" ON partners FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "partners_insert" ON partners FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "partners_update" ON partners FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "partners_delete" ON partners FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ── work_orders（案件・発注記録）─────────────────────────
CREATE TABLE IF NOT EXISTS work_orders (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  partner_id    uuid        NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  description   text,
  order_date    date        NOT NULL DEFAULT CURRENT_DATE,
  delivery_date date,
  amount        integer     NOT NULL DEFAULT 0,
  status        text        NOT NULL DEFAULT 'ordered',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_orders_select" ON work_orders FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "work_orders_insert" ON work_orders FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "work_orders_update" ON work_orders FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "work_orders_delete" ON work_orders FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ── documents（書類履歴）────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  partner_id     uuid        REFERENCES partners(id) ON DELETE SET NULL,
  work_order_id  uuid        REFERENCES work_orders(id) ON DELETE SET NULL,
  doc_type       text        NOT NULL,
  doc_number     text        NOT NULL,
  issue_date     date        NOT NULL DEFAULT CURRENT_DATE,
  title          text        NOT NULL,
  amount         integer     NOT NULL DEFAULT 0,
  description    text,
  status         text        NOT NULL DEFAULT 'issued',
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select" ON documents FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "documents_insert" ON documents FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "documents_update" ON documents FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "documents_delete" ON documents FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ── employees 追加カラム ────────────────────────────────
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date       date;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department      text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS position_title  text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email           text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone           text;
