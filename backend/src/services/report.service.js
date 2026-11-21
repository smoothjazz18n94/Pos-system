const { prisma } = require('../config/database');

const getDailySales = async (branchId, date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return getSalesReport(branchId, start, end);
};

const getSalesReport = async (branchId, startDate, endDate) => {
  const where = {
    status: 'COMPLETED',
    createdAt: { gte: startDate, lte: endDate },
  };
  if (branchId) where.branchId = branchId;

  const [sales, totals] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        items: { include: { product: { select: { name: true, categoryId: true } } } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sale.aggregate({
      where,
      _sum: { total: true, taxAmount: true, discountAmount: true },
      _count: { id: true },
      _avg: { total: true },
    }),
  ]);

  // Payment method breakdown
  const paymentBreakdown = await prisma.sale.groupBy({
    by: ['paymentMethod'],
    where,
    _sum: { total: true },
    _count: { id: true },
  });

  // Best-selling products
  const bestSellers = await prisma.saleItem.groupBy({
    by: ['productId', 'productName'],
    where: {
      sale: { ...where },
    },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 10,
  });

  // Hourly distribution (for daily report)
  const hourlyData = Array(24).fill(0).map((_, h) => ({ hour: h, count: 0, total: 0 }));
  sales.forEach(sale => {
    const hour = new Date(sale.createdAt).getHours();
    hourlyData[hour].count++;
    hourlyData[hour].total += Number(sale.total);
  });

  // Calculate profit (revenue - cost)
  let totalCost = 0;
  for (const sale of sales) {
    for (const item of sale.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { costPrice: true },
      });
      if (product?.costPrice) {
        totalCost += Number(product.costPrice) * item.quantity;
      }
    }
  }

  const revenue = Number(totals._sum.total || 0);
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return {
    summary: {
      totalSales: totals._count.id,
      revenue,
      taxCollected: Number(totals._sum.taxAmount || 0),
      discountsGiven: Number(totals._sum.discountAmount || 0),
      averageOrderValue: Number(totals._avg.total || 0),
      totalCost,
      profit,
      margin: Math.round(margin * 100) / 100,
    },
    paymentBreakdown,
    bestSellers,
    hourlyData,
    sales,
  };
};

const getWeeklyReport = async (branchId, weekStart) => {
  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const report = await getSalesReport(branchId, start, end);

  // Daily breakdown for the week
  const dailyBreakdown = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const where = {
      status: 'COMPLETED',
      createdAt: { gte: day, lte: dayEnd },
    };
    if (branchId) where.branchId = branchId;

    const agg = await prisma.sale.aggregate({
      where,
      _sum: { total: true },
      _count: { id: true },
    });

    dailyBreakdown.push({
      date: day.toISOString().split('T')[0],
      dayName: day.toLocaleDateString('en', { weekday: 'short' }),
      sales: agg._count.id,
      revenue: Number(agg._sum.total || 0),
    });
  }

  return { ...report, dailyBreakdown, period: { start, end } };
};

const getMonthlyReport = async (branchId, year, month) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const report = await getSalesReport(branchId, start, end);

  // Weekly breakdown
  const weeklyBreakdown = [];
  let weekStart = new Date(start);
  while (weekStart <= end) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd > end) weekEnd.setTime(end.getTime());

    const where = {
      status: 'COMPLETED',
      createdAt: { gte: weekStart, lte: weekEnd },
    };
    if (branchId) where.branchId = branchId;

    const agg = await prisma.sale.aggregate({
      where,
      _sum: { total: true },
      _count: { id: true },
    });

    weeklyBreakdown.push({
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      sales: agg._count.id,
      revenue: Number(agg._sum.total || 0),
    });

    weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() + 1);
  }

  return { ...report, weeklyBreakdown, period: { start, end, year, month } };
};

const getLowStockAlerts = async (branchId) => {
  const inventoryItems = await prisma.inventory.findMany({
    where: branchId ? { branchId } : {},
    include: {
      product: { select: { name: true, sku: true, barcode: true, isActive: true } },
      branch: { select: { name: true } },
    },
  });

  return inventoryItems
    .filter(item => item.product.isActive && item.quantity <= item.lowStockAlert)
    .map(item => ({
      ...item,
      isOutOfStock: item.quantity === 0,
      urgency: item.quantity === 0 ? 'critical' : item.quantity <= item.lowStockAlert / 2 ? 'high' : 'medium',
    }))
    .sort((a, b) => a.quantity - b.quantity);
};

module.exports = { getDailySales, getWeeklyReport, getMonthlyReport, getLowStockAlerts, getSalesReport };
