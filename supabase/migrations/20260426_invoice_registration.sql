-- インボイス制度対応: partners テーブルに登録有無フラグを追加
-- invoice_number は 20260425_resource_management.sql で既に追加済み

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS is_invoice_registered boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN partners.is_invoice_registered IS
  '適格請求書発行事業者（インボイス登録）かどうか。false の場合、経過措置による控除率（80%/50%）が適用される。';
