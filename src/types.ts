export interface SalesPoint {
  id: string | number;
  name: string;
  phone?: string;
  user_id?: string;
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
  point_name?: string;
  point_phone?: string;
  product_name?: string;
  reference_month?: string;
  user_id?: string;
}

export interface Expense {
  id: string | number;
  date: string;
  product: string;
  value: number;
  category?: string;
  user_id?: string;
}

export interface Stats {
  totalSales: number;
  totalReceived: number;
  totalPending: number;
  totalExpenses: number;
  balance: number;
}
