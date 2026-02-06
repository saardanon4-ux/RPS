import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const teams = [
  { name: 'Maccabi Haifa', color: '#006633' },       // Green
  { name: 'Maccabi Tel Aviv', color: '#FEE500' },    // Yellow
  { name: "Hapoel Be'er Sheva", color: '#E61B23' },  // Red
  { name: 'Beitar Jerusalem', color: '#333333' },    // Black/Yellow (Dark base)
  { name: 'Hapoel Tel Aviv', color: '#D81E05' },     // Red
  { name: 'Maccabi Netanya', color: '#FFD700' },     // Yellow
  { name: 'Hapoel Haifa', color: '#FF0000' },        // Red
  { name: 'Bnei Sakhnin', color: '#A61015' },        // Red
  { name: 'Maccabi Petah Tikva', color: '#005DAA' }, // Blue
  { name: 'Hapoel Jerusalem', color: '#D4001F' },    // Red/Black
  { name: 'Hapoel Hadera', color: '#BF1E2D' },       // Red
  { name: 'Maccabi Bnei Reineh', color: '#FFCC00' }, // Yellow/Blue
  { name: 'Ironi Kiryat Shmona', color: '#0054A6' }, // Blue
  { name: 'Ironi Tiberias', color: '#0000FF' },      // Blue
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

