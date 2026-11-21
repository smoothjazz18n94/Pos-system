import React, { useState, useEffect } from 'react';
import { TrendingUp, ShoppingCart, DollarSign, Package, AlertTriangle, RefreshCw } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays } from 'date-fns';
import { reportAPI } from '../services/api';
import { useSyncStore } from '../store/syncStore';
import toast from 'react-hot-toast';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

export default function DashboardPage() {
  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isOnline } = useSyncStore();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    if (!isOnline) { setLoading(false); return; }
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekStart = format(subDays(new Date(), 6), 'yyyy-MM-dd');
      const [d, w, ls] = await Promise.all([
        reportAPI.daily({ date: today }),
        reportAPI.weekly({ weekStart }),
        reportAPI.lowStock(),
      ]);
      setDaily(d.data.data);
      setWeekly(w.data.data);
      setLowStock(ls.data.data);
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOnline) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 text-slate-500">
        <AlertTriangle size={32} className="mb-2 text-amber-500" />
        <p className="font-medium text-white">Dashboard requires internet</p>
        <p className="text-sm">Connect to view reports and analytics</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-surface-900 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  const summary = daily?.summary || {};
  const weeklyData = weekly?.dailyBreakdown || [];
  const paymentData = daily?.paymentBreakdown || [];
  const bestSellers = daily?.bestSellers?.slice(0, 5) || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-500 text-sm">{format(new Date(), 'EEEE, MMMM d yyyy')}</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white bg-slate-800 px-3 py-2 rounded-lg">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Today's Revenue"
          value={`₵${(summary.revenue || 0).toFixed(2)}`}
          sub={`${summary.totalSales || 0} sales`}
          icon={DollarSign}
          color="indigo"
        />
        <KPICard
          label="Today's Profit"
          value={`₵${(summary.profit || 0).toFixed(2)}`}
          sub={`${(summary.margin || 0).toFixed(1)}% margin`}
          icon={TrendingUp}
          color="emerald"
        />
        <KPICard
          label="Transactions"
          value={summary.totalSales || 0}
          sub={`Avg ₵${(summary.averageOrderValue || 0).toFixed(2)}`}
          icon={ShoppingCart}
          color="purple"
        />
        <KPICard
          label="Low Stock Alerts"
          value={lowStock.length}
          sub={`${lowStock.filter(l => l.isOutOfStock).length} out of stock`}
          icon={Package}
          color={lowStock.length > 0 ? 'amber' : 'slate'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly revenue chart */}
        <div className="lg:col-span-2 bg-surface-900 rounded-2xl p-5 border border-slate-800">
          <h3 className="font-semibold text-white mb-4">Revenue — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="dayName" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }}
                formatter={(v) => [`₵${v.toFixed(2)}`, 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Payment breakdown */}
        <div className="bg-surface-900 rounded-2xl p-5 border border-slate-800">
          <h3 className="font-semibold text-white mb-4">Payment Methods</h3>
          {paymentData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">No data today</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={paymentData} dataKey="_count.id" nameKey="paymentMethod" cx="50%" cy="50%" outerRadius={60} strokeWidth={0}>
                    {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {paymentData.map((p, i) => (
                  <div key={p.paymentMethod} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-400">{p.paymentMethod.replace('_', ' ')}</span>
                    </div>
                    <span className="text-white font-medium">{p._count?.id} txns</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Best sellers */}
        <div className="bg-surface-900 rounded-2xl p-5 border border-slate-800">
          <h3 className="font-semibold text-white mb-4">Best Selling Products</h3>
          {bestSellers.length === 0 ? (
            <p className="text-slate-600 text-sm">No sales data today</p>
          ) : (
            <div className="space-y-3">
              {bestSellers.map((item, i) => (
                <div key={item.productId} className="flex items-center gap-3">
                  <span className="text-slate-600 text-sm w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.productName}</p>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, (item._sum.quantity / bestSellers[0]._sum.quantity) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-slate-400 text-sm flex-shrink-0">{item._sum.quantity} sold</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className="bg-surface-900 rounded-2xl p-5 border border-slate-800">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            Low Stock Alerts
            {lowStock.length > 0 && (
              <span className="bg-amber-600 text-white text-xs rounded-full px-2 py-0.5">{lowStock.length}</span>
            )}
          </h3>
          {lowStock.length === 0 ? (
            <p className="text-slate-600 text-sm">All stock levels are healthy ✓</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {lowStock.slice(0, 8).map(item => (
                <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.product.name}</p>
                    <p className="text-xs text-slate-500">{item.branch?.name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-sm font-semibold ${item.isOutOfStock ? 'text-red-400' : 'text-amber-400'}`}>
                      {item.quantity}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.isOutOfStock ? 'bg-red-900/40 text-red-400' : 'bg-amber-900/40 text-amber-400'
                    }`}>
                      {item.isOutOfStock ? 'Out' : 'Low'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, sub, icon: Icon, color }) {
  const colors = {
    indigo: 'bg-indigo-900/30 text-indigo-400 border-indigo-800/50',
    emerald: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50',
    purple: 'bg-purple-900/30 text-purple-400 border-purple-800/50',
    amber: 'bg-amber-900/30 text-amber-400 border-amber-800/50',
    slate: 'bg-slate-800/50 text-slate-400 border-slate-700/50',
  };
  return (
    <div className="bg-surface-900 border border-slate-800 rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 border ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      <p className="text-xs text-slate-600 mt-1">{sub}</p>
    </div>
  );
}
