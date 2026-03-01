export interface SalesPoint {
  id: number;
  name: string;
  phone?: string;
}

export interface SaleEntry {
  id: number;
  sales_point_id: number;
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
}

export interface Expense {
  id: number;
  date: string;
  product: string;
  value: number;
  category?: string;
}

export interface Stats {
  totalSales: number;
  totalReceived: number;
  totalPending: number;
  totalExpenses: number;
  balance: number;
}
