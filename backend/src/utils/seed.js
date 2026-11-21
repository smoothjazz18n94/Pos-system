require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Create main branch
  const branch = await prisma.branch.upsert({
    where: { id: 'branch-main-001' },
    update: {},
    create: {
      id: 'branch-main-001',
      name: 'Main Branch',
      address: '123 Main Street, Accra',
      phone: '+233 24 000 0001',
      email: 'main@myshop.com',
    },
  });

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@myshop.com' },
    update: {},
    create: {
      email: 'admin@myshop.com',
      password: adminPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: 'ADMIN',
      branchId: branch.id,
    },
  });

  // Cashier
  const cashierPassword = await bcrypt.hash('cashier123!', 12);
  await prisma.user.upsert({
    where: { email: 'cashier@myshop.com' },
    update: {},
    create: {
      email: 'cashier@myshop.com',
      password: cashierPassword,
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'CASHIER',
      branchId: branch.id,
    },
  });

  // Categories
  const categories = await Promise.all([
    prisma.category.upsert({ where: { name: 'Beverages' }, update: {}, create: { name: 'Beverages', color: '#3B82F6', icon: '🥤' } }),
    prisma.category.upsert({ where: { name: 'Snacks' }, update: {}, create: { name: 'Snacks', color: '#F59E0B', icon: '🍿' } }),
    prisma.category.upsert({ where: { name: 'Electronics' }, update: {}, create: { name: 'Electronics', color: '#8B5CF6', icon: '📱' } }),
    prisma.category.upsert({ where: { name: 'Food' }, update: {}, create: { name: 'Food', color: '#10B981', icon: '🍞' } }),
  ]);

  // Sample products
  const products = [
    { name: 'Coca Cola 500ml', sku: 'BEV-001', barcode: '5449000000996', price: 3.50, costPrice: 2.00, categoryId: categories[0].id, taxRate: 5 },
    { name: 'Pepsi 500ml', sku: 'BEV-002', barcode: '5449000000997', price: 3.50, costPrice: 2.00, categoryId: categories[0].id, taxRate: 5 },
    { name: 'Water 1.5L', sku: 'BEV-003', barcode: '5449000000998', price: 2.00, costPrice: 0.80, categoryId: categories[0].id, taxRate: 0 },
    { name: 'Lays Chips 100g', sku: 'SNK-001', barcode: '5449000000999', price: 5.00, costPrice: 3.00, categoryId: categories[1].id, taxRate: 5 },
    { name: 'Digestive Biscuits', sku: 'SNK-002', barcode: '5449000001000', price: 4.50, costPrice: 2.50, categoryId: categories[1].id, taxRate: 5 },
    { name: 'Bread Loaf', sku: 'FOD-001', barcode: '5449000001001', price: 6.00, costPrice: 3.50, categoryId: categories[3].id, taxRate: 0 },
    { name: 'USB Charger', sku: 'ELC-001', barcode: '5449000001002', price: 25.00, costPrice: 12.00, categoryId: categories[2].id, taxRate: 15 },
  ];

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: { ...p, branchId: branch.id },
    });

    await prisma.inventory.upsert({
      where: { productId_branchId: { productId: product.id, branchId: branch.id } },
      update: {},
      create: {
        productId: product.id,
        branchId: branch.id,
        quantity: Math.floor(Math.random() * 90) + 10,
        lowStockAlert: 10,
      },
    });
  }

  console.log('✅ Seed complete!');
  console.log('📧 Admin: admin@myshop.com / admin123!');
  console.log('📧 Cashier: cashier@myshop.com / cashier123!');

  await prisma.$disconnect();
}

seed().catch(e => {
  console.error('Seed failed:', e);
  process.exit(1);
});
