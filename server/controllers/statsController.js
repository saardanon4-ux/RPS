import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getUserStats(userId) {
  const uid = Number(userId);
  if (!uid || Number.isNaN(uid)) {
    throw new Error('Invalid user id');
  }

  const [asA, asB, winsAsWinner, draws] = await Promise.all([
    prisma.game.count({ where: { playerAId: uid } }),
    prisma.game.count({ where: { playerBId: uid } }),
    prisma.game.count({ where: { winnerId: uid } }),
    prisma.game.count({
      where: {
        OR: [{ playerAId: uid }, { playerBId: uid }],
        winnerId: null,
      },
    }),
  ]);

  const totalGames = asA + asB;
  const wins = winsAsWinner;
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

export async function getHeadToHeadSummaryForUser(userId) {
  const uid = Number(userId);
  if (!uid || Number.isNaN(uid)) {
    throw new Error('Invalid user id');
  }

  const games = await prisma.game.findMany({
    where: {
      OR: [{ playerAId: uid }, { playerBId: uid }],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      playerA: { select: { id: true, username: true, group: { select: { name: true, color: true } } } },
      playerB: { select: { id: true, username: true, group: { select: { name: true, color: true } } } },
    },
  });

  const byOpponent = new Map();

  for (const g of games) {
    const isA = g.playerAId === uid;
    const opponent = isA ? g.playerB : g.playerA;
    if (!opponent) continue;
    const oppId = opponent.id;
    if (!oppId) continue;

    let entry = byOpponent.get(oppId);
    if (!entry) {
      entry = {
        opponentId: oppId,
        opponentName: opponent.username,
        opponentGroupName: opponent.group?.name ?? null,
        opponentGroupColor: opponent.group?.color ?? null,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        lastPlayed: null,
      };
      byOpponent.set(oppId, entry);
    }

    entry.games += 1;
    if (!g.winnerId) {
      entry.draws += 1;
    } else if (g.winnerId === uid) {
      entry.wins += 1;
    } else if (g.winnerId === oppId) {
      entry.losses += 1;
    }

    const ts = g.createdAt instanceof Date ? g.createdAt : new Date(g.createdAt);
    if (!entry.lastPlayed || ts > entry.lastPlayed) {
      entry.lastPlayed = ts;
    }
  }

  const summary = Array.from(byOpponent.values()).map((e) => {
    const decided = e.wins + e.losses;
    const winPercentage = decided > 0 ? Number(((e.wins / decided) * 100).toFixed(2)) : 0;
    return { ...e, winPercentage };
  });

  summary.sort((a, b) => {
    if (b.games !== a.games) return b.games - a.games;
    if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
    return a.opponentName.localeCompare(b.opponentName, 'he');
  });

  return summary;
}

