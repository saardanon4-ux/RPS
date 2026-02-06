import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const defaultGroups = ['Team Alpha', 'Team Bravo', 'Command', 'Logistics'];

  for (const name of defaultGroups) {
    // Use upsert to avoid duplicates on repeated seeds
    await prisma.group.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('Seed complete: default groups ensured.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

