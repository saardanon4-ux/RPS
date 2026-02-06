import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const teams = [
  { name: 'מכבי חיפה', color: '#006633' },          // Green
  { name: 'מכבי תל אביב', color: '#FEE500' },       // Yellow
  { name: 'הפועל באר שבע', color: '#E61B23' },      // Red
  { name: 'בית"ר ירושלים', color: '#333333' },      // Black/Yellow (Dark base)
  { name: 'הפועל תל אביב', color: '#D81E05' },      // Red
  { name: 'מכבי נתניה', color: '#FFD700' },         // Yellow
  { name: 'הפועל חיפה', color: '#FF0000' },         // Red
  { name: 'בני סכנין', color: '#A61015' },          // Red
  { name: 'מכבי פתח תקווה', color: '#005DAA' },    // Blue
  { name: 'הפועל ירושלים', color: '#D4001F' },      // Red/Black
  { name: 'הפועל חדרה', color: '#BF1E2D' },         // Red
  { name: 'מכבי בני ריינה', color: '#FFCC00' },    // Yellow/Blue
  { name: 'עירוני קרית שמונה', color: '#0054A6' }, // Blue
  { name: 'עירוני טבריה', color: '#0000FF' },       // Blue
];

async function main() {
  for (const team of teams) {
    // Upsert each team by name, updating color if it changed
    await prisma.group.upsert({
      where: { name: team.name },
      update: { color: team.color },
      create: { name: team.name, color: team.color },
    });
  }

  console.log('Seed complete: Israeli Premier League groups ensured.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

