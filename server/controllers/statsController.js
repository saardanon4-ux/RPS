import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getUserStats(userId) {
  const uid = Number(userId);
  if (!uid || Number.isNaN(uid)) {
    throw new Error('Invalid user id');
  }

  const [asA, asB, winsAsWinner] = await Promise.all([
    prisma.game.count({ where: { playerAId: uid } }),
    prisma.game.count({ where: { playerBId: uid } }),
    prisma.game.count({ where: { winnerId: uid } }),
  ]);

  const totalGames = asA + asB;
  const wins = winsAsWinner;
  const draws = await prisma.game.count({
    where: {
      OR: [{ playerAId: uid }, { playerBId: uid }],
      winnerId: null,
    },
  });

  const losses = totalGames - wins - draws;
  const winRate = totalGames > 0 ? Number(((wins / totalGames) * 100).toFixed(2)) : 0;

  // Current streak: iterate games ordered by createdAt desc until break in pattern
  const recentGames = await prisma.game.findMany({
    where: {
      OR: [{ playerAId: uid }, { playerBId: uid }],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  let streak = 0;
  let lastType = null; // 'win' | 'loss' | 'draw'

  for (const g of recentGames) {
    let type = 'draw';
    if (g.winnerId === uid) type = 'win';
    else if (g.winnerId && g.winnerId !== uid) type = 'loss';

    if (!lastType) {
      lastType = type;
      streak = 1;
    } else if (type === lastType) {
      streak += 1;
    } else {
      break;
    }
  }

  return {
    totalGames,
    wins,
    losses,
    draws,
    winRate,
    currentStreak: {
      type: lastType,
      count: streak,
    },
  };
}

export async function getHeadToHead(player1Id, player2Id) {
  const a = Number(player1Id);
  const b = Number(player2Id);
  if (!a || !b || Number.isNaN(a) || Number.isNaN(b)) {
    throw new Error('Invalid player ids');
  }

  const games = await prisma.game.findMany({
    where: {
      OR: [
        { playerAId: a, playerBId: b },
        { playerAId: b, playerBId: a },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  let wins = 0;
  let losses = 0;
  let draws = 0;

  for (const g of games) {
    if (!g.winnerId) {
      draws += 1;
    } else if (g.winnerId === a) {
      wins += 1;
    } else if (g.winnerId === b) {
      losses += 1;
    }
  }

  return {
    gamesPlayed: games.length,
    wins,
    losses,
    draws,
  };
}

