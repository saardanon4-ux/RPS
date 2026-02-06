import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Save result of a completed game.
 * @param {number} playerAId - User id of player A.
 * @param {number} playerBId - User id of player B.
 * @param {number|null} winnerId - User id of winner, or null for draw.
 */
export async function saveGameResult(playerAId, playerBId, winnerId) {
  const a = Number(playerAId);
  const b = Number(playerBId);
  const w = winnerId == null ? null : Number(winnerId);

  if (!a || !b || Number.isNaN(a) || Number.isNaN(b)) {
    throw new Error('Invalid player ids for game result');
  }

  return prisma.$transaction(async (tx) => {
    const game = await tx.game.create({
      data: {
        playerAId: a,
        playerBId: b,
        winnerId: w,
      },
    });

    // Load minimal user info for stats updates
    const users = await tx.user.findMany({
      where: { id: { in: [a, b] } },
      select: { id: true, groupId: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));
    const userA = userMap.get(a);
    const userB = userMap.get(b);

    const ops = [];

    if (w == null) {
      // Draw: record the game only, do not update wins/losses.
    } else {
      const winnerUser = userMap.get(w);
      const loserId = w === a ? b : a;
      const loserUser = userMap.get(loserId);

      if (winnerUser) {
        ops.push(
          tx.user.update({
            where: { id: winnerUser.id },
            data: { wins: { increment: 1 } },
          }),
        );
        if (winnerUser.groupId != null) {
          ops.push(
            tx.group.update({
              where: { id: winnerUser.groupId },
              data: { totalWins: { increment: 1 } },
            }),
          );
        }
      }

      if (loserUser) {
        ops.push(
          tx.user.update({
            where: { id: loserUser.id },
            data: { losses: { increment: 1 } },
          }),
        );
        if (loserUser.groupId != null) {
          ops.push(
            tx.group.update({
              where: { id: loserUser.groupId },
              data: { totalLosses: { increment: 1 } },
            }),
          );
        }
      }
    }

    if (ops.length > 0) {
      await Promise.all(ops);
    }

    return game;
  });
}

