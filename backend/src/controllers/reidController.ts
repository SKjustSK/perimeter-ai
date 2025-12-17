import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../config/prisma.js';
import { analyzeFrame, analyzeVideoFile } from '../services/inferenceService.js';
import { upsertEmbedding, searchEmbedding } from '../services/qdrantService.js';

const uploadDir = process.env.SHARED_UPLOAD_DIR || '/shared-uploads';

// Ingest target person image and perform vector similarity search
export async function searchPerson(req: Request, res: Response): Promise<any> {
    if (!req.file) {
        return res.status(400).json({ error: 'No image provided for search' });
    }

    try {
        // Step 1: Get embedding of the query image from AI engine
        const aiResponse = await analyzeFrame(req.file.buffer, req.file.originalname, req.file.mimetype);
        if (aiResponse.status !== 'success' || !aiResponse.detections || aiResponse.detections.length === 0) {
            return res.status(400).json({ error: 'No person detected in the reference photo' });
        }

        const targetEmbedding = aiResponse.detections[0].embedding;

        // Step 2: Query Qdrant for closest ReID vectors
        const vectorMatches = await searchEmbedding(targetEmbedding, 10);
        
        if (vectorMatches.length === 0) {
            return res.json({ matches: [] });
        }

        // Step 3: Fetch matching detection logs from Postgres
        const detectionIds = vectorMatches.map(m => m.id as string);
        const detections = await prisma.detection.findMany({
            where: {
                id: { in: detectionIds }
            },
            include: {
                camera: true
            }
        });

        // Combine Qdrant score with Postgres metadata
        const results = vectorMatches.map(match => {
            const dbData = detections.find(d => d.id === match.id);
            if (!dbData) return null;
            return {
                id: dbData.id,
                timestamp: dbData.timestamp,
                bbox: dbData.bbox,
                score: match.score,
                camera: {
                    id: dbData.camera.id,
                    name: dbData.camera.name,
                    locationName: dbData.camera.locationName,
                    latitude: dbData.camera.latitude,
                    longitude: dbData.camera.longitude,
                }
            };
        }).filter(r => r !== null);

        // Sort by time/score logic or pure vector score
        res.json({ matches: results });
    } catch (error: any) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
}

// Handle .mp4 video ingestion for developer testing
export async function uploadVideo(req: Request, res: Response): Promise<any> {
    const cameraId = req.params.cameraId as string;

    if (!req.file) {
        return res.status(400).json({ error: 'No video file provided' });
    }

    try {
        // Ensure camera exists
        const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
        if (!camera) {
            return res.status(404).json({ error: 'Camera not found' });
        }

        // Ensure shared directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileExt = path.extname(req.file.originalname);
        const fileName = `${cameraId}_${Date.now()}${fileExt}`;
        const targetPath = path.join(uploadDir, fileName);

        // Save file to shared volume
        fs.writeFileSync(targetPath, req.file.buffer);

        // Trigger non-blocking async video analysis in Python
        // Return 202 immediately to frontend
        processVideoInBackground(targetPath, cameraId);

        res.status(202).json({
            message: 'Video upload accepted. Processing started in background.',
            file: fileName
        });
    } catch (error) {
        console.error('Video upload error:', error);
        res.status(500).json({ error: 'Failed to upload video' });
    }
}

// Helper to handle background analysis and insert records
async function processVideoInBackground(videoPath: string, cameraId: string) {
    try {
        console.log(`Sending video ${videoPath} to inference engine...`);
        const aiResponse = await analyzeVideoFile(videoPath);

        if (aiResponse.status !== 'success' || !aiResponse.detections) {
            console.log(`No detections returned for video: ${videoPath}`);
            return;
        }

        console.log(`Processing ${aiResponse.detections.length} detections for camera: ${cameraId}`);

        for (const det of aiResponse.detections) {
            // Save metadata to Postgres
            const detection = await prisma.detection.create({
                data: {
                    cameraId,
                    bbox: det.bbox,
                    timestamp: new Date(det.timestamp * 1000) // Convert epoch to JS Date
                }
            });

            // Upsert embedding vector into Qdrant mapping it to the Postgres UUID
            await upsertEmbedding(
                detection.id,
                cameraId,
                det.timestamp,
                det.embedding
            );
        }

        console.log(`Successfully completed video ingestion for: ${videoPath}`);
    } catch (error) {
        console.error(`Background video process failed for ${videoPath}:`, error);
    }
}
