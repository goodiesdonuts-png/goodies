export interface SalesPoint {
  id: string | number;
  name: string;
  phone?: string;
  user_id?: string;
  delivery_frequency?: string;
  preferred_days?: string;
}

export interface SaleEntry {
  id: string | number;
  sales_point_id: string | number;
  quantity: number;
  manufacturing_date: string;
  delivery_date: string;
  due_date: string;
  returned_quantity: number;
  withdrawal_date: string;
  unit_value: number;
  total_value: number;
  payment_status: 'PAGO' | 'ABERTO';
  payment_date?: string;
  point_name?: string;
  point_phone?: string;
  product_name?: string;
  reference_month?: string;
  user_id?: string;
  current_inventory?: number;
  sales_since_last_visit?: number;
  notes?: string;
  status?: 'CONCLUIDO' | 'AGENDADO' | 'ATRASADO';
}

export interface Expense {
  id: string | number;
  date: string;
  product: string;
  value: number;
  category?: string;
  payment_method?: 'DÉBITO' | 'DINHEIRO' | 'CRÉDITO';
  user_id?: string;
}

export interface Stats {
  totalSales: number;
  totalReceived: number;
  totalPending: number;
  totalExpenses: number;
  balance: number;
}

