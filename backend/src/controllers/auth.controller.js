import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DateTime, IANAZone } from 'luxon';
import prisma from '../lib/prisma.js';

/**
 * POST /api/auth/register
 * Body: { email, password, timezone }
 * Returns: 201 { id, email, timezone }
 */
export async function register(req, res) {
  const { email, password, timezone } = req.body;

  // Validate required fields
  if (!email || !password || !timezone) {
    return res.status(400).json({ error: 'email, password, and timezone are required' });
  }

  // Validate IANA timezone using Luxon
  if (!IANAZone.isValidZone(timezone)) {
    return res.status(400).json({ error: `"${timezone}" is not a valid IANA timezone` });
  }

  // Password minimum length
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: { email, passwordHash, timezone },
      select: { id: true, email: true, timezone: true },
    });
    return res.status(201).json(user);
  } catch (err) {
    // Prisma unique constraint violation on email
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: 200 { token }
 */
export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return res.status(200).json({ token });
}
