// =============================================================
// Smart TAYORU — Supabase Database Types
// =============================================================

export type UserRole       = 'admin' | 'member'
export type ExpenseStatus  = 'pending' | 'approved' | 'rejected'
export type ScheduleType   = 'withholding_tax' | 'expense_payment' | 'invoice_payment' | 'custom'
export type ScheduleStatus = 'pending' | 'completed' | 'overdue'
export type ExpenseSource  = 'line' | 'slack' | 'web' | 'manual'
export type TaxTableType   = 'A' | 'B'
export type AccountType    = 'checking' | 'savings' | 'other'
export type TxDirection    = 'in' | 'out'
export type InvoiceStatus  = 'pending' | 'approved' | 'paid' | 'cancelled'
export type PlanType       = 'free' | 'starter' | 'pro'

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          slug: string
          name: string
          plan: PlanType
          invoice_number: string | null
          fiscal_month: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>
      }
      users: {
        Row: {
          id: string
          tenant_id: string
          email: string
          display_name: string
          role: UserRole
          avatar_url: string | null
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      expense_categories: {
        Row: {
          id: string
          tenant_id: string
          name: string
          account_code: string
          tax_type: string
          is_system: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['expense_categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['expense_categories']['Insert']>
      }
      expenses: {
        Row: {
          id: string
          tenant_id: string
          submitted_by: string
          category_id: string | null
          vendor_name: string
          amount: number
          tax_amount: number
          expense_date: string
          receipt_url: string | null
          status: ExpenseStatus
          source: ExpenseSource
          ocr_confidence: number | null
          approved_by: string | null
          approved_at: string | null
          applied_at: string | null
          payment_expected_date: string | null
          memo: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>
      }
      employees: {
        Row: {
          id: string
          tenant_id: string
          name: string
          name_kana: string | null
          email: string | null
          phone: string | null
          department: string | null
          position_title: string | null
          hire_date: string | null
          base_salary: number
          dependents: number
          tax_table: TaxTableType
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['employees']['Insert']>
      }
      payroll_records: {
        Row: {
          id: string
          tenant_id: string
          employee_id: string
          pay_year_month: string
          base_salary: number
          allowances: number
          health_ins: number
          pension_ins: number
          employment_ins: number
          income_tax: number
          residence_tax: number
          net_pay: number
          sent_at: string | null
          pdf_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['payroll_records']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['payroll_records']['Insert']>
      }
      contractors: {
        Row: {
          id: string
          tenant_id: string
          name: string
          email: string
          invoice_number: string | null
          withholding_rate: number
          invoice_transition: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['contractors']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['contractors']['Insert']>
      }
      contractor_invoices: {
        Row: {
          id: string
          tenant_id: string
          contractor_id: string
          invoice_date: string
          gross_amount: number
          withholding_tax: number
          transition_deduction: number
          net_payment: number
          status: InvoiceStatus
          paid_at: string | null
          memo: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['contractor_invoices']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['contractor_invoices']['Insert']>
      }
      bank_accounts: {
        Row: {
          id: string
          tenant_id: string
          bank_name: string
          branch_name: string | null
          account_number: string
          account_type: AccountType
          balance: number
          last_synced_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['bank_accounts']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['bank_accounts']['Insert']>
      }
      bank_transactions: {
        Row: {
          id: string
          tenant_id: string
          account_id: string
          transaction_date: string
          description: string
          amount: number
          direction: TxDirection
          balance_after: number | null
          category_id: string | null
          source_csv: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['bank_transactions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['bank_transactions']['Insert']>
      }
      financial_schedules: {
        Row: {
          id: string
          tenant_id: string
          schedule_type: ScheduleType
          title: string
          due_date: string
          amount: number | null
          related_id: string | null
          related_table: string | null
          status: ScheduleStatus
          memo: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['financial_schedules']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['financial_schedules']['Insert']>
      }
      audit_logs: {
        Row: {
          id: string
          tenant_id: string
          user_id: string | null
          action: string
          table_name: string
          record_id: string | null
          diff_json: Record<string, unknown> | null
          ip_address: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>
        Update: never
      }
      notifications: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          category: string
          priority: string
          title: string
          body: string
          is_read: boolean
          action_label: string | null
          action_href: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
    }
  }
}

// 型エイリアス（使いやすく）
export type Tenant             = Database['public']['Tables']['tenants']['Row']
export type User               = Database['public']['Tables']['users']['Row']
export type ExpenseCategory    = Database['public']['Tables']['expense_categories']['Row']
export type Expense            = Database['public']['Tables']['expenses']['Row']
export type Employee           = Database['public']['Tables']['employees']['Row']
export type PayrollRecord      = Database['public']['Tables']['payroll_records']['Row']
export type Contractor         = Database['public']['Tables']['contractors']['Row']
export type ContractorInvoice  = Database['public']['Tables']['contractor_invoices']['Row']
export type BankAccount        = Database['public']['Tables']['bank_accounts']['Row']
export type BankTransaction    = Database['public']['Tables']['bank_transactions']['Row']
export type AuditLog           = Database['public']['Tables']['audit_logs']['Row']
export type FinancialSchedule  = Database['public']['Tables']['financial_schedules']['Row']
export type Notification       = Database['public']['Tables']['notifications']['Row']
