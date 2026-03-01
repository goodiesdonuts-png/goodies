import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Store,
  Receipt,
  TrendingUp,
  Plus,
  Search,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  MoreVertical,
  ArrowLeft,
  Trash2,
  Bell,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import type { SalesPoint, SaleEntry, Expense, Stats } from './types';
import { cn, formatCurrency, formatDate } from './utils';
import { supabase } from './supabase';
import Auth from './Auth';
import { Session } from '@supabase/supabase-js';

type View = 'dashboard' | 'sales-points' | 'expenses' | 'point-detail' | 'reports';
type ModalType = 'none' | 'new-point' | 'new-sale' | 'new-expense' | 'expiring-alerts' | 'quick-restock';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [activeModal, setActiveModal] = useState<ModalType>('none');
  const [selectedPoint, setSelectedPoint] = useState<SalesPoint | null>(null);
  const [salesPoints, setSalesPoints] = useState<SalesPoint[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pointSales, setPointSales] = useState<SaleEntry[]>([]);
  const [expiringSales, setExpiringSales] = useState<SaleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'month' | 'year'>('month');

  // Reports State
  const [reports, setReports] = useState<SaleEntry[]>([]);
  const [reportFilters, setReportFilters] = useState({ month: '', point_id: '', product: '' });
  const [products, setProducts] = useState<string[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializingAuth, setIsInitializingAuth] = useState(true);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchInitialData();
    }
  }, [periodFilter, session]);

  useEffect(() => {
    if (currentView === 'reports') {
      fetchReports();
    }
  }, [currentView, reportFilters]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (reportFilters.month) queryParams.append('month', reportFilters.month);
      if (reportFilters.point_id) queryParams.append('point_id', reportFilters.point_id);
      if (reportFilters.product) queryParams.append('product', reportFilters.product);

      const res = await fetch(`/api/reports/sales?${queryParams.toString()}`);
      const data = await res.json();
      setReports(data);
    } catch (error) {
      console.error("Failed to fetch reports", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInitialData = async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const [pointsRes, statsRes, expensesRes, expiringRes, productsRes] = await Promise.all([
        fetch('/api/sales-points'),
        fetch(`/api/stats?filter=${periodFilter}`),
        fetch('/api/expenses'),
        fetch('/api/expiring-sales'),
        fetch('/api/products')
      ]);

      const points = await pointsRes.json();
      const statsData = await statsRes.json();
      const expensesData = await expensesRes.json();
      const expiringData = await expiringRes.json();
      const productsData = await productsRes.json();

      setSalesPoints(points);
      setStats(statsData);
      setExpenses(expensesData);
      setExpiringSales(expiringData);
      setProducts(productsData);

      // Show alert if there are expiring sales and we are on dashboard
      if (expiringData.length > 0 && currentView === 'dashboard') {
        setActiveModal('expiring-alerts');
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPointSales = async (pointId: number) => {
    try {
      const res = await fetch(`/api/sales/${pointId}`);
      const data = await res.json();
      setPointSales(data);
    } catch (error) {
      console.error("Failed to fetch point sales", error);
    }
  };

  const handleUpdatePhone = async () => {
    if (!selectedPoint) return;
    try {
      const res = await fetch(`/api/sales-points/${selectedPoint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: newPhone })
      });
      if (res.ok) {
        setSelectedPoint({ ...selectedPoint, phone: newPhone });
        setSalesPoints(salesPoints.map(p => p.id === selectedPoint.id ? { ...p, phone: newPhone } : p));
        setIsEditingPhone(false);
      }
    } catch (error) {
      console.error("Failed to update phone", error);
    }
  };

  const handlePointClick = (point: SalesPoint) => {
    setSelectedPoint(point);
    fetchPointSales(point.id);
    setCurrentView('point-detail');
    setSearchTerm('');
  };

  const handleAddPoint = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;

    try {
      const res = await fetch('/api/sales-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone })
      });
      if (res.ok) {
        setActiveModal('none');
        fetchInitialData();
      }
    } catch (error) {
      console.error("Failed to add point", error);
    }
  };

  const handleAddSale = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPoint) return;

    const formData = new FormData(e.currentTarget);
    const quantity = Number(formData.get('quantity'));
    const unit_value = Number(formData.get('unit_value'));

    const data = {
      sales_point_id: selectedPoint.id,
      quantity,
      unit_value,
      total_value: quantity * unit_value,
      manufacturing_date: formData.get('manufacturing_date'),
      delivery_date: formData.get('delivery_date'),
      due_date: formData.get('due_date'),
      payment_status: 'ABERTO',
      product_name: formData.get('product_name') || 'Brownie'
    };

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setActiveModal('none');
        fetchPointSales(selectedPoint.id);
        fetchInitialData();
      }
    } catch (error) {
      console.error("Failed to add sale", error);
    }
  };

  const handleQuickRestock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const pointId = Number(formData.get('point_id'));
    const quantity = Number(formData.get('quantity'));
    const unit_value = Number(formData.get('unit_value'));

    const data = {
      sales_point_id: pointId,
      quantity,
      unit_value,
      total_value: quantity * unit_value,
      manufacturing_date: formData.get('manufacturing_date'),
      delivery_date: formData.get('delivery_date'),
      due_date: formData.get('due_date'),
      payment_status: 'ABERTO',
      product_name: formData.get('product_name') || 'Brownie'
    };

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setActiveModal('none');
        fetchInitialData();
      }
    } catch (error) {
      console.error("Failed to add quick restock", error);
    }
  };

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      product: formData.get('product'),
      value: Number(formData.get('value')),
      date: formData.get('date'),
      category: formData.get('category')
    };

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setActiveModal('none');
        fetchInitialData();
      }
    } catch (error) {
      console.error("Failed to add expense", error);
    }
  };

  const updatePaymentStatus = async (saleId: number, status: 'PAGO' | 'ABERTO') => {
    try {
      await fetch(`/api/sales/${saleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: status })
      });
      if (selectedPoint) fetchPointSales(selectedPoint.id);
      fetchInitialData();
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const updateReturnedQuantity = async (saleId: number, quantity: number) => {
    try {
      await fetch(`/api/sales/${saleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returned_quantity: quantity })
      });
      if (selectedPoint) fetchPointSales(selectedPoint.id);
      fetchInitialData();
    } catch (error) {
      console.error("Failed to update returned quantity", error);
    }
  };

  const deleteExpense = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) fetchInitialData();
    } catch (error) {
      console.error("Failed to delete expense", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSale = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta entrega?')) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedPoint) fetchPointSales(selectedPoint.id);
        fetchInitialData();
      }
    } catch (error) {
      console.error("Failed to delete sale", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSalesPoint = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir este ponto de venda? Todas as vendas vinculadas também serão excluídas.')) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/sales-points/${id}`, { method: 'DELETE' });
      if (res.ok) fetchInitialData();
    } catch (error) {
      console.error("Failed to delete sales point", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendRestockMessage = (sale: SaleEntry) => {
    const message = `Olá ${sale.point_name}! Notei que os brownies entregues em ${formatDate(sale.delivery_date)} estão próximos do vencimento (${formatDate(sale.due_date)}). Gostaria de agendar um reabastecimento para garantir produtos sempre fresquinhos?`;
    const encodedMessage = encodeURIComponent(message);
    const phone = sale.point_phone?.replace(/\D/g, '');

    if (phone) {
      window.open(`https://wa.me/55${phone}?text=${encodedMessage}`, '_blank');
    } else {
      alert('Telefone não cadastrado para este ponto de venda.');
    }
  };
  const renderDashboard = () => {
    if (!stats) return null;

    const chartData = [
      { name: 'Vendas', value: stats.totalSales, color: '#0ea5e9' },
      { name: 'Recebido', value: stats.totalReceived, color: '#10b981' },
      { name: 'Pendente', value: stats.totalPending, color: '#f59e0b' },
      { name: 'Despesas', value: stats.totalExpenses, color: '#ef4444' },
    ];

    return (
      <div className="space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-slate-500 mt-1">Visão geral do seu negócio de brownies.</p>
          </div>
          <div className="flex gap-3">
            {expiringSales.length > 0 && (
              <button
                onClick={() => setActiveModal('expiring-alerts')}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors relative"
              >
                <Bell className="w-4 h-4" />
                Alertas ({expiringSales.length})
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
              </button>
            )}
            <button
              onClick={() => setActiveModal('quick-restock')}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white border border-brand-500 rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              Reabastecimento Rápido
            </button>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setPeriodFilter('month')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  periodFilter === 'month' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Calendar className="w-4 h-4" />
                Este Mês
              </button>
              <button
                onClick={() => setPeriodFilter('year')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  periodFilter === 'year' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <TrendingUp className="w-4 h-4" />
                Este Ano
              </button>
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total de Vendas', value: stats.totalSales, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Total Recebido', value: stats.totalReceived, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'À Receber', value: stats.totalPending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Saldo Líquido', value: stats.balance, icon: Receipt, color: 'text-slate-900', bg: 'bg-slate-100' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={cn("p-3 rounded-xl", stat.bg)}>
                  <stat.icon className={cn("w-6 h-6", stat.color)} />
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  12%
                </span>
              </div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <h3 className="text-2xl font-bold mt-1">{formatCurrency(stat.value)}</h3>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <div className="lg:col-span-2 glass-card p-6">
            <h3 className="text-lg font-semibold mb-6">Desempenho Financeiro</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `R$${value}`} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [formatCurrency(value), 'Valor']}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Expenses */}
          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Últimas Compras</h3>
              <button onClick={() => setCurrentView('expenses')} className="text-sm text-brand-600 font-medium hover:underline">Ver todas</button>
            </div>
            <div className="space-y-4">
              {expenses.slice(0, 5).map((expense, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{expense.product}</p>
                      <p className="text-xs text-slate-500">{formatDate(expense.date)}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-red-600">-{formatCurrency(expense.value)}</p>
                </div>
              ))}
              {expenses.length === 0 && (
                <p className="text-center text-slate-400 py-8 italic">Nenhuma despesa registrada.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSalesPoints = () => {
    const filteredPoints = salesPoints.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pontos de Venda</h1>
            <p className="text-slate-500 mt-1">Gerencie seus parceiros e locais de distribuição.</p>
          </div>
          <button
            onClick={() => setActiveModal('new-point')}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            Novo Ponto
          </button>
        </header>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar ponto de venda..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPoints.map((point, i) => (
            <motion.div
              key={point.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handlePointClick(point)}
              className="glass-card p-6 cursor-pointer hover:shadow-md hover:border-brand-200 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                  <Store className="w-6 h-6" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => deleteSalesPoint(e, point.id)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    title="Excluir ponto de venda"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-500 transition-colors" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{point.name}</h3>
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Status</p>
                  <span className="text-xs font-medium text-emerald-600 flex items-center gap-1 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Ativo
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Ações</p>
                  <p className="text-sm font-bold mt-1 text-brand-600">Ver Detalhes</p>
                </div>
              </div>
            </motion.div>
          ))}
          {filteredPoints.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 italic">
              Nenhum ponto de venda encontrado.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPointDetail = () => {
    if (!selectedPoint) return null;

    const totalGeral = pointSales.reduce((acc, s) => acc + s.total_value, 0);
    const totalRecebido = pointSales.filter(s => s.payment_status === 'PAGO').reduce((acc, s) => acc + s.total_value, 0);
    const aReceber = totalGeral - totalRecebido;

    return (
      <div className="space-y-8">
        <header className="flex items-center gap-4">
          <button
            onClick={() => { setCurrentView('sales-points'); setIsEditingPhone(false); }}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold tracking-tight">{selectedPoint.name}</h1>
              {isEditingPhone ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="WhatsApp... (DDD + Número)"
                    className="px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 outline-none w-64"
                    autoFocus
                  />
                  <button onClick={handleUpdatePhone} className="px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-500/10 transition-all hover:bg-brand-600">Salvar</button>
                  <button onClick={() => setIsEditingPhone(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">Cancelar</button>
                </div>
              ) : (
                <button
                  onClick={() => { setIsEditingPhone(true); setNewPhone(selectedPoint.phone || ''); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-brand-50 text-slate-600 hover:text-brand-600 rounded-xl text-xs font-bold transition-all border border-transparent hover:border-brand-200 shadow-sm"
                  title="Clique para editar o telefone"
                >
                  <MessageCircle className="w-4 h-4" />
                  {selectedPoint.phone ? selectedPoint.phone : 'Sem telefone cadastrado (Clique p/ adicionar)'}
                </button>
              )}
            </div>
            <p className="text-slate-500 mt-1">Histórico de entregas e pagamentos.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 border-l-4 border-l-blue-500">
            <p className="text-sm font-medium text-slate-500">Total Geral</p>
            <h3 className="text-2xl font-bold mt-1">{formatCurrency(totalGeral)}</h3>
          </div>
          <div className="glass-card p-6 border-l-4 border-l-emerald-500">
            <p className="text-sm font-medium text-slate-500">Total Recebido</p>
            <h3 className="text-2xl font-bold mt-1">{formatCurrency(totalRecebido)}</h3>
          </div>
          <div className="glass-card p-6 border-l-4 border-l-amber-500">
            <p className="text-sm font-medium text-slate-500">À Receber</p>
            <h3 className="text-2xl font-bold mt-1">{formatCurrency(aReceber)}</h3>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-6 border-bottom border-slate-100 flex justify-between items-center">
            <h3 className="text-lg font-semibold">Entregas Realizadas</h3>
            <button
              onClick={() => setActiveModal('new-sale')}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600 transition-all"
            >
              <Plus className="w-4 h-4" />
              Nova Entrega
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-y border-slate-100">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qtd</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fabricação</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Entrega</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vencimento</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Devolvidos</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor Unit.</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pointSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold">{sale.product_name || 'Brownie'}</td>
                    <td className="px-6 py-4 text-sm font-medium">{sale.quantity}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(sale.manufacturing_date)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-semibold">{formatDate(sale.delivery_date)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(sale.due_date)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <input
                        type="number"
                        defaultValue={sale.returned_quantity || 0}
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (val !== sale.returned_quantity) {
                            updateReturnedQuantity(sale.id, val);
                          }
                        }}
                        className="w-16 px-2 py-1 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 outline-none"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatCurrency(sale.unit_value)}</td>
                    <td className="px-6 py-4 text-sm font-bold">{formatCurrency(sale.total_value)}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold",
                        sale.payment_status === 'PAGO'
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}>
                        {sale.payment_status === 'PAGO' ? 'Pago' : 'Em Aberto'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updatePaymentStatus(sale.id, sale.payment_status === 'PAGO' ? 'ABERTO' : 'PAGO');
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                            sale.payment_status === 'PAGO'
                              ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              : "bg-brand-500 text-white hover:bg-brand-600 shadow-sm"
                          )}
                        >
                          {sale.payment_status === 'PAGO' ? 'Reabrir' : 'Marcar Pago'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSale(sale.id);
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                          title="Excluir entrega"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pointSales.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400 italic">
                      Nenhuma entrega registrada para este ponto.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderExpenses = () => {
    const filteredExpenses = expenses.filter(e =>
      e.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Controle de Compras</h1>
            <p className="text-slate-500 mt-1">Registre insumos, embalagens e outras despesas.</p>
          </div>
          <button
            onClick={() => setActiveModal('new-expense')}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
          >
            <Plus className="w-4 h-4" />
            Nova Despesa
          </button>
        </header>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar despesa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 glass-card overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-y border-slate-100">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto/Serviço</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoria</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Valor</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(expense.date)}</td>
                    <td className="px-6 py-4 text-sm font-semibold">{expense.product}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
                        {expense.category || 'Insumos'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-red-600 text-right">{formatCurrency(expense.value)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteExpense(expense.id);
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                        title="Excluir despesa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                      Nenhuma despesa encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Resumo de Gastos</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Total Acumulado</span>
                  <span className="text-lg font-bold text-red-600">{formatCurrency(stats?.totalExpenses || 0)}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-red-500 h-full" style={{ width: '100%' }} />
                </div>
              </div>
            </div>

            <div className="glass-card p-6 bg-brand-500 text-white border-none">
              <h3 className="font-bold mb-2">Dica de Gestão</h3>
              <p className="text-sm text-brand-50 opacity-90 leading-relaxed">
                Mantenha suas notas fiscais organizadas para facilitar o fechamento do mês.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderReports = () => {
    return (
      <div className="space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Histórico de Abastecimentos</h1>
          <p className="text-slate-500 mt-1">Visualize e filtre todo o histórico de abastecimentos por mês, ponto de venda ou produto.</p>
        </header>

        <div className="glass-card p-6 flex flex-wrap gap-4 items-end bg-white">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Mês de Referência</label>
            <input
              type="month"
              value={reportFilters.month}
              onChange={(e) => setReportFilters({ ...reportFilters, month: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Ponto de Venda</label>
            <select
              value={reportFilters.point_id}
              onChange={(e) => setReportFilters({ ...reportFilters, point_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
            >
              <option value="">Todos os Pontos</option>
              {salesPoints.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Produto</label>
            <select
              value={reportFilters.product}
              onChange={(e) => setReportFilters({ ...reportFilters, product: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none"
            >
              <option value="">Todos os Produtos</option>
              {products.map((p, i) => (
                <option key={i} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setReportFilters({ month: '', point_id: '', product: '' })}
            className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition-colors"
          >
            Limpar Filtros
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-y border-slate-100">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mês Ref.</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ponto de Venda</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Produto</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qtd</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Entrega</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600 font-semibold">{report.reference_month}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{report.point_name}</td>
                    <td className="px-6 py-4 text-sm font-semibold">{report.product_name || 'Brownie'}</td>
                    <td className="px-6 py-4 text-sm font-medium">{report.quantity}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(report.delivery_date)}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold",
                        report.payment_status === 'PAGO'
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}>
                        {report.payment_status === 'PAGO' ? 'Pago' : 'Em Aberto'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">{formatCurrency(report.total_value)}</td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderModal = () => {
    if (activeModal === 'none') return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-xl font-bold">
              {activeModal === 'new-point' && 'Novo Ponto de Venda'}
              {activeModal === 'new-sale' && 'Nova Entrega'}
              {activeModal === 'new-expense' && 'Nova Despesa'}
              {activeModal === 'quick-restock' && 'Reabastecimento Rápido'}
            </h3>
            <button onClick={() => setActiveModal('none')} className="text-slate-400 hover:text-slate-600">
              <Plus className="w-6 h-6 rotate-45" />
            </button>
          </div>

          <form
            onSubmit={
              activeModal === 'new-point' ? handleAddPoint :
                activeModal === 'new-sale' ? handleAddSale :
                  activeModal === 'quick-restock' ? handleQuickRestock :
                    handleAddExpense
            }
            className="p-6 space-y-4"
          >
            {activeModal === 'new-point' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Ponto</label>
                  <input name="name" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" placeholder="Ex: Padaria Almeida" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp (DDD + Número)</label>
                  <input name="phone" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" placeholder="Ex: 11999999999" />
                </div>
              </div>
            )}

            {activeModal === 'new-sale' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Produto</label>
                  <input name="product_name" required defaultValue="Brownie" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" placeholder="Ex: Brownie" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                    <input name="quantity" type="number" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor Unitário</label>
                    <input name="unit_value" type="number" step="0.01" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data de Fabricação</label>
                  <input name="manufacturing_date" type="date" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data de Entrega</label>
                  <input name="delivery_date" type="date" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data de Vencimento</label>
                  <input name="due_date" type="date" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" />
                </div>
              </>
            )}

            {activeModal === 'quick-restock' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ponto de Venda</label>
                  <select name="point_id" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none">
                    <option value="">Selecione um ponto...</option>
                    {salesPoints.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Produto</label>
                  <input name="product_name" required defaultValue="Brownie" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" placeholder="Ex: Brownie" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
                    <input name="quantity" type="number" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor Unitário</label>
                    <input name="unit_value" type="number" step="0.01" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data de Fabricação</label>
                  <input name="manufacturing_date" type="date" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data de Entrega</label>
                  <input name="delivery_date" type="date" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data de Vencimento</label>
                  <input name="due_date" type="date" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" />
                </div>
              </>
            )}

            {activeModal === 'new-expense' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Produto/Serviço</label>
                  <input name="product" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" placeholder="Ex: Chocolate 50%" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor</label>
                    <input name="value" type="number" step="0.01" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                    <select name="category" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none">
                      <option value="Insumos">Insumos</option>
                      <option value="Embalagens">Embalagens</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <input name="date" type="date" required className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 outline-none" />
                </div>
              </>
            )}

            {activeModal === 'expiring-alerts' && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <p className="text-sm text-slate-500 mb-4">Os seguintes pontos possuem produtos que vencem nos próximos 3 dias:</p>
                {expiringSales.map((sale) => (
                  <div key={sale.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center gap-4">
                    <div>
                      <h4 className="font-bold text-slate-900">{sale.point_name}</h4>
                      <p className="text-xs text-slate-500">Vence em: <span className="font-semibold text-amber-600">{formatDate(sale.due_date)}</span></p>
                      <p className="text-xs text-slate-500">Qtd: {sale.quantity} unidades</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => sendRestockMessage(sale)}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Reabastecer
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeModal !== 'expiring-alerts' && (
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveModal('none')}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-xl font-medium hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
                >
                  Salvar
                </button>
              </div>
            )}
          </form>
        </motion.div>
      </div>
    );
  };

  if (isInitializingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {renderModal()}
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 p-6 flex flex-col gap-8 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
            <TrendingUp className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">BrownieManager</span>
        </div>

        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={cn("sidebar-item w-full", currentView === 'dashboard' && "sidebar-item-active")}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>
          <button
            onClick={() => setCurrentView('sales-points')}
            className={cn("sidebar-item w-full", (currentView === 'sales-points' || currentView === 'point-detail') && "sidebar-item-active")}
          >
            <Store className="w-5 h-5" />
            Pontos de Venda
          </button>
          <button
            onClick={() => setCurrentView('expenses')}
            className={cn("sidebar-item w-full", currentView === 'expenses' && "sidebar-item-active")}
          >
            <Receipt className="w-5 h-5" />
            Despesas
          </button>
          <button
            onClick={() => setCurrentView('reports')}
            className={cn("sidebar-item w-full", currentView === 'reports' && "sidebar-item-active")}
          >
            <Filter className="w-5 h-5" />
            Histórico
          </button>
        </nav>

        <div className="mt-auto glass-card p-4 bg-slate-900 text-white border-none">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold overflow-hidden">
              {session.user.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{session.user.email}</p>
              <p className="text-[10px] text-slate-400">Usuário Ativo</p>
            </div>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto">
        {isLoading && (
          <div className="fixed top-4 right-4 z-50">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500"></div>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {currentView === 'dashboard' && renderDashboard()}
            {currentView === 'sales-points' && renderSalesPoints()}
            {currentView === 'point-detail' && renderPointDetail()}
            {currentView === 'expenses' && renderExpenses()}
            {currentView === 'reports' && renderReports()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
