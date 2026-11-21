const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, role, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

const login = async (email, password) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { branch: { select: { id: true, name: true } } },
  });

  if (!user || !user.isActive) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  const { accessToken, refreshToken } = generateTokens(user.id, user.role);

  // Store refresh token hash
  const refreshHash = await bcrypt.hash(refreshToken, 8);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: refreshHash, lastLogin: new Date() },
  });

  logger.info(`User logged in: ${user.email}`);

  const { password: _, refreshToken: __, ...userWithoutSensitive } = user;
  return { user: userWithoutSensitive, accessToken, refreshToken };
};

const refreshAccessToken = async (refreshToken) => {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
  }

  if (decoded.type !== 'refresh') {
    throw new AppError('Invalid token type', 401, 'INVALID_TOKEN');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || !user.isActive || !user.refreshToken) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
  }

  const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
  if (!isValid) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.role);
  const refreshHash = await bcrypt.hash(newRefreshToken, 8);
  await prisma.user.update({ where: { id: user.id }, data: { refreshToken: refreshHash } });

  return { accessToken, refreshToken: newRefreshToken };
};

const logout = async (userId) => {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
};

const createUser = async ({ email, password, firstName, lastName, role, branchId }) => {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new AppError('Email already registered', 409, 'DUPLICATE_ENTRY');
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      role,
      branchId,
    },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, isActive: true, branchId: true, createdAt: true,
    },
  });

  return user;
};

module.exports = { login, refreshAccessToken, logout, createUser, generateTokens };
