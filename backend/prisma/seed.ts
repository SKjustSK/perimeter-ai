import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL || 'postgresql://admin:password@localhost:5435/perimeter?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const cameras = [
    {
      id: "997b686e-bdf7-4b68-80f0-c518d6e3f280",
      name: "IIITK Main Gate",
      locationName: "IIIT Kota Main Gate Entrance",
      latitude: 25.0499,
      longitude: 75.8321,
    },
    {
      id: "7ef33f5f-f8c6-43a9-b36d-5de2d59cf59f",
      name: "Academic Block",
      locationName: "IIIT Kota Academic Complex Lobby",
      latitude: 25.0505,
      longitude: 75.8330,
    },
    {
      id: "0d9c49a3-5f0a-4fb8-9e58-9a999cb84f67",
      name: "Hostel A Gate",
      locationName: "Hostel A Entrance Lounge",
      latitude: 25.0485,
      longitude: 75.8315,
    },
    {
      id: "44448c74-ddc8-4ace-aeef-25ffd809e0e9",
      name: "Student Cafeteria",
      locationName: "IIIT Kota Canteen Entrance",
      latitude: 25.0492,
      longitude: 75.8328,
    }
  ];

  console.log("Seeding IIIT Kota camera locations...");

  for (const cam of cameras) {
    await prisma.camera.upsert({
      where: { id: cam.id },
      update: {
        name: cam.name,
        locationName: cam.locationName,
        latitude: cam.latitude,
        longitude: cam.longitude,
      },
      create: cam,
    });
  }

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    pool.end();
  });
