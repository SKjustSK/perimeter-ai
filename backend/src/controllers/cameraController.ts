import type { Request, Response } from 'express';
import prisma from '../config/prisma.js';

export async function createCamera(req: Request, res: Response) {
    const { name, locationName, latitude, longitude, streamUrl } = req.body;
    try {
        const camera = await prisma.camera.create({
            data: {
                name,
                locationName,
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                streamUrl,
            }
        });
        res.status(201).json(camera);
    } catch (error) {
        console.error('Create camera error:', error);
        res.status(500).json({ error: 'Failed to create camera' });
    }
}

export async function getCameras(req: Request, res: Response) {
    try {
        const cameras = await prisma.camera.findMany({
            include: {
                _count: {
                    select: { detections: true }
                }
            }
        });
        res.json(cameras);
    } catch (error) {
        console.error('Get cameras error:', error);
        res.status(500).json({ error: 'Failed to fetch cameras' });
    }
}
