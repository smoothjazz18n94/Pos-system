import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { format, startOfMonth, subMonths } from 'date-fns';
import { Calendar, Download, TrendingUp, ShoppingCart, DollarSign, Percent } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { reportAPI } from '../services/api';

const TOOLTIP_STYLE = { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' };

export default function ReportsPage() {
  const [period, setPeriod] = useState('daily');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => { loadReport(); }, [period, date, month]);

  const loadReport = async () => {
    setLoading(true);
    try {
      let res;
      if (period === 'daily') {
        res = await reportAPI.daily({ date });
      } else if (period === 'weekly') {
        res = await reportAPI.weekly({ weekStart: date });
      } else {
        const [y, m] = month.split('-');
        res = await reportAPI.monthly({ year: y, month: m });
      }
      setData(res.data.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  const summary = data?.summary || {};
  const chartData = period === 'daily'
    ? (data?.hourlyData || []).map(h => ({ name: `${h.hour}:00`, revenue: h.total, sales: h.count }))
    : period === 'weekly'
    ? (data?.dailyBreakdown || []).map(d => ({ name: d.dayName, revenue: d.revenue, sales: d.sales }))
    : (data?.weeklyBreakdown || []).map((w, i) => ({ name: `W${i + 1}`, revenue: w.revenue, sales: w.sales }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-slate-500 text-sm">Sales analytics and performance</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period tabs */}
          <div className="flex gap-1 bg-surface-900 p-1 rounded-xl border border-slate-800">
            {['daily', 'weekly', 'monthly'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
                  period === p ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}
              >
                {p}
              </button>
            ))}
          </div>

          {period === 'monthly' ? (
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="bg-surface-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          ) : (
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-surface-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-surface-900 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Revenue" value={`₵${(summary.revenue || 0).toFixed(2)}`} icon={DollarSign} color="indigo" />
            <StatCard label="Profit" value={`₵${(summary.profit || 0).toFixed(2)}`} icon={TrendingUp} color="emerald" />
            <StatCard label="Transactions" value={summary.totalSales || 0} icon={ShoppingCart} color="purple" />
            <StatCard label="Margin" value={`${(summary.margin || 0).toFixed(1)}%`} icon={Percent} color="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main chart */}
            <div className="lg:col-span-2 bg-surface-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="font-semibold text-white mb-1">Revenue Trend</h3>
              <p className="text-xs text-slate-500 mb-4">
                Total: ₵{(summary.revenue || 0).toFixed(2)} · {summary.totalSales || 0} transactions
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [n === 'revenue' ? `₵${v.toFixed(2)}` : v, n === 'revenue' ? 'Revenue' : 'Sales']} />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Summary panel */}
            <div className="bg-surface-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-white">Summary</h3>
              <div className="space-y-3">
                {[
                  { label: 'Revenue', value: `₵${(summary.revenue || 0).toFixed(2)}`, cls: 'text-white' },
                  { label: 'Cost of Goods', value: `₵${(summary.totalCost || 0).toFixed(2)}`, cls: 'text-slate-300' },
                  { label: 'Gross Profit', value: `₵${(summary.profit || 0).toFixed(2)}`, cls: 'text-emerald-400' },
                  { label: 'Tax Collected', value: `₵${(summary.taxCollected || 0).toFixed(2)}`, cls: 'text-slate-400' },
                  { label: 'Discounts Given', value: `₵${(summary.discountsGiven || 0).toFixed(2)}`, cls: 'text-amber-400' },
                  { label: 'Avg Order Value', value: `₵${(summary.averageOrderValue || 0).toFixed(2)}`, cls: 'text-slate-400' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-800 last:border-0">
                    <span className="text-sm text-slate-500">{label}</span>
                    <span className={clsx('text-sm font-semibold', cls)}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Best sellers */}
          {data?.bestSellers?.length > 0 && (
            <div className="bg-surface-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="font-semibold text-white mb-4">Best Selling Products</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left pb-2 text-slate-500 font-medium">#</th>
                      <th className="text-left pb-2 text-slate-500 font-medium">Product</th>
                      <th className="text-right pb-2 text-slate-500 font-medium">Qty Sold</th>
                      <th className="text-right pb-2 text-slate-500 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data.bestSellers.slice(0, 10).map((item, i) => (
                      <tr key={item.productId}>
                        <td className="py-2.5 text-slate-600 font-mono">{i + 1}</td>
                        <td className="py-2.5 text-white">{item.productName}</td>
                        <td className="py-2.5 text-slate-300 text-right">{item._sum?.quantity}</td>
                        <td className="py-2.5 text-indigo-400 font-semibold text-right">₵{Number(item._sum?.subtotal || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  const colors = {
    indigo: 'text-indigo-400 bg-indigo-900/20',
    emerald: 'text-emerald-400 bg-emerald-900/20',
    purple: 'text-purple-400 bg-purple-900/20',
    amber: 'text-amber-400 bg-amber-900/20',
  };
  return (
    <div className="bg-surface-900 border border-slate-800 rounded-2xl p-5">
      <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center mb-3', colors[color])}>
        <Icon size={16} />
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
