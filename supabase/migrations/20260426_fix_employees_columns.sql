-- =============================================================
-- employees テーブル カラム整合修正
-- 問題: 旧コードが joined_at を使用、新コードが hire_date を使用
-- 対応: joined_at を hire_date にリネーム（冪等・3パターン対応）
-- =============================================================

DO $$
BEGIN

  -- ── hired_date / joined_at の整合 ──────────────────────────

  -- パターン A: joined_at のみ存在 → hire_date にリネーム
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'employees'
      AND column_name  = 'joined_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'employees'
      AND column_name  = 'hire_date'
  ) THEN
    ALTER TABLE employees RENAME COLUMN joined_at TO hire_date;
    RAISE NOTICE 'employees: joined_at を hire_date にリネームしました';
  END IF;

  -- パターン B: 両方存在（resource_management.sql が途中まで適用済み）
  --             → データをマージして joined_at を削除
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'employees'
      AND column_name  = 'joined_at'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'employees'
      AND column_name  = 'hire_date'
  ) THEN
    UPDATE employees
      SET hire_date = joined_at
      WHERE hire_date IS NULL AND joined_at IS NOT NULL;
    ALTER TABLE employees DROP COLUMN joined_at;
    RAISE NOTICE 'employees: joined_at のデータを hire_date にマージし、joined_at を削除しました';
  END IF;

  -- パターン C: どちらも存在しない（新規環境）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'employees'
      AND column_name  = 'hire_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'employees'
      AND column_name  = 'joined_at'
  ) THEN
    ALTER TABLE employees ADD COLUMN hire_date date;
    RAISE NOTICE 'employees: hire_date カラムを新規追加しました';
  END IF;

  -- ── 他の追加カラム（既存なら何もしない）───────────────────

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'employees'
      AND column_name  = 'department'
  ) THEN
    ALTER TABLE employees ADD COLUMN department text;
    RAISE NOTICE 'employees: department カラムを追加しました';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'employees'
      AND column_name  = 'position_title'
  ) THEN
    ALTER TABLE employees ADD COLUMN position_title text;
    RAISE NOTICE 'employees: position_title カラムを追加しました';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'employees'
      AND column_name  = 'phone'
  ) THEN
    ALTER TABLE employees ADD COLUMN phone text;
    RAISE NOTICE 'employees: phone カラムを追加しました';
  END IF;

  -- email は元テーブルに既存のため追加不要（念のため確認のみ）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'employees'
      AND column_name  = 'email'
  ) THEN
    ALTER TABLE employees ADD COLUMN email text;
    RAISE NOTICE 'employees: email カラムを追加しました';
  END IF;

  -- name_kana は元テーブルに既存のため確認のみ
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'employees'
      AND column_name  = 'name_kana'
  ) THEN
    ALTER TABLE employees ADD COLUMN name_kana text;
    RAISE NOTICE 'employees: name_kana カラムを追加しました';
  END IF;

  RAISE NOTICE 'employees カラム整合性チェック: 完了';

END
$$;
