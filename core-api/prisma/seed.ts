import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[*] Starting database seed...');

  const dummyCameras = [
    {
      name: 'Main Entrance Camera',
      location: 'Gate 1',
      latitude: 40.7128,
      longitude: -74.0060,
    },
    {
      name: 'Lobby Camera',
      location: 'Building A Lobby',
      latitude: 40.7130,
      longitude: -74.0055,
    },
    {
      name: 'Loading Dock Camera',
      location: 'Back Alley',
      latitude: 40.7125,
      longitude: -74.0065,
    }
  ];

  for (const cameraData of dummyCameras) {
    // We use create instead of upsert since the model doesn't have a unique constraint on name/location out of the box
    // But to prevent duplicating thousands of cameras on repeated seed runs, we can check if it exists by name first
    const existingCamera = await prisma.camera.findFirst({
      where: { name: cameraData.name }
    });

    if (existingCamera) {
      console.log(`[~] Camera already exists: ${cameraData.name} (Skipping)`);
    } else {
      const camera = await prisma.camera.create({
        data: cameraData
      });
      console.log(`[+] Created camera: ${camera.name} (${camera.id})`);
    }
  }

  console.log('[✓] Database seed complete!');
}

main()
  .catch((e) => {
    console.error('[-] Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
