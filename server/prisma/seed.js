import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Teams and their kit asset prefix (stored in 'color' field)
const teams = [
  // 8. White & Red (ירושלים וב"ש)
  { name: 'הפועל ירושלים', color: 'whiteandred' },
  { name: 'הפועל באר שבע', color: 'whiteandred' },
  // 1. Red (ת"א וסכנין)
  { name: 'הפועל תל אביב', color: 'red' },
  { name: 'בני סכנין', color: 'red' },
  // 2. Blue (פ"ת וק"ש)
  { name: 'הפועל פתח תקווה', color: 'blue' },
  { name: 'עירוני קריית שמונה', color: 'blue' },
  // 3. Green (חיפה)
  { name: 'מכבי חיפה', color: 'green' },
  // 4. Yellow (נתניה ומכבי ת"א)
  { name: 'מכבי נתניה', color: 'yellow' },
  { name: 'מכבי תל אביב', color: 'yellow' },
  // 5. Light Blue (ריינה וטבריה)
  { name: 'מכבי בני ריינה', color: 'lightblue' },
  { name: 'עירוני טבריה', color: 'lightblue' },
  // 6. Black & Red (חיפה ואשדוד)
  { name: 'הפועל חיפה', color: 'blackandred' },
  { name: 'מ.ס אשדוד', color: 'blackandred' },
  // 7. Black & Yellow (בית"ר)
  { name: 'בית"ר ירושלים', color: 'blackandyellow' },
];

async function main() {
  console.log('🗑️  Cleaning database...');
  await prisma.game.deleteMany();
  await prisma.user.deleteMany();
  await prisma.group.deleteMany();

  console.log('🌱 Seeding teams with Asset Prefixes...');
  for (const team of teams) {
    await prisma.group.create({
      data: {
        name: team.name,
        color: team.color,
        totalWins: 0,
        totalLosses: 0,
      },
    });
  }

  console.log(`✅ Database seeded with ${teams.length} teams!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
