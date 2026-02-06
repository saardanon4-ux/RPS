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

  return prisma.game.create({
    data: {
      playerAId: a,
      playerBId: b,
      winnerId: w,
    },
  });
}

