import { type Request, type Response } from 'express';
import { QdrantClient } from '@qdrant/js-client-rest';
import prisma from '../config/prisma.js';

const qdrantClient = new QdrantClient({ 
  url: process.env.QDRANT_URL || 'http://localhost:6333' 
});

export const createCamera = async (req: Request, res: Response): Promise<void> => {
  const { name, location, latitude, longitude } = req.body;

  if (!name || !location || latitude === undefined || longitude === undefined) {
    res.status(400).json({ error: 'Missing required fields: name, location, latitude, longitude' });
    return;
  }

  try {
    const camera = await prisma.camera.create({
      data: { 
        name, 
        location, 
        latitude: parseFloat(latitude), 
        longitude: parseFloat(longitude) 
      }
    });
    res.status(201).json(camera);
  } catch (error) {
    console.error('[-] Error creating camera:', error);
    res.status(500).json({ error: 'Failed to register camera in database' });
  }
};

export const getCameras = async (req: Request, res: Response): Promise<void> => {
  try {
    const cameras = await prisma.camera.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(cameras);
  } catch (error) {
    console.error('[-] Error fetching cameras:', error);
    res.status(500).json({ error: 'Failed to fetch cameras from database' });
  }
};

export const resetDatabase = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Clear database records (Jobs first due to foreign key constraints)
    await prisma.job.deleteMany({});
    await prisma.camera.deleteMany({});

    // 2. Clear and recreate Qdrant collection
    try {
      await qdrantClient.deleteCollection('targets');
      await qdrantClient.createCollection('targets', {
        vectors: {
          size: 512,
          distance: 'Cosine'
        }
      });
      console.log('[+] Qdrant collection targets reset successfully.');
    } catch (qdrantError: any) {
      console.warn('[-] Failed to reset Qdrant collection:', qdrantError.message);
    }

    // 3. Re-seed default cameras
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
      await prisma.camera.create({
        data: cameraData
      });
    }

    res.status(200).json({ message: 'System reset successfully completed.' });
  } catch (error) {
    console.error('[-] Error resetting database:', error);
    res.status(500).json({ error: 'Failed to complete system reset' });
  }
};