import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-me';

export async function register(username, password, groupName) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new Error('Username already taken');
  }

  let group = null;
  if (groupName) {
    group = await prisma.group.upsert({
      where: { name: groupName },
      update: {},
      create: { name: groupName },
    });
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      username,
      password: hash,
      groupId: group ? group.id : null,
    },
    select: {
      id: true,
      username: true,
      group: { select: { id: true, name: true, color: true } },
    },
  });

  const token = jwt.sign(
    {
      sub: user.id,
      username: user.username,
      groupId: user.group?.id ?? null,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  return { user, token };
}

export async function login(username, password) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  const userRecord = await prisma.user.findUnique({
    where: { username },
    include: { group: true },
  });

  if (!userRecord) {
    throw new Error('Invalid username or password');
  }

  const ok = await bcrypt.compare(password, userRecord.password);
  if (!ok) {
    throw new Error('Invalid username or password');
  }

  const token = jwt.sign(
    {
      sub: userRecord.id,
      username: userRecord.username,
      groupId: userRecord.group?.id ?? null,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  const { password: _pw, ...user } = userRecord;

  return { user, token };
}

