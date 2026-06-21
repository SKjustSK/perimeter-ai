import { type Request, type Response } from 'express';
import axios from 'axios';
import FormData from 'form-data';
import { QdrantClient } from '@qdrant/js-client-rest';
import prisma from '../config/prisma.js';

// Initialize Qdrant Client
const qdrantClient = new QdrantClient({ 
    url: process.env.QDRANT_URL || 'http://localhost:6333' 
});
// Frontend response shape
interface MatchResult {
    confidence: string;
    cameraId: string;
    jobId: string;
    frameNumber: number;
    boundingBox: [number, number, number, number];
}

export const searchTarget = async (req: Request, res: Response): Promise<any> => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Please upload a target image crop.' });
        }

        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });

        // Extract vector representation using Python service
        const inferenceEngineUrl = process.env.INFERENCE_ENGINE_URL || 'http://localhost:5001';
        const pythonResponse = await axios.post<{ vector: number[] }>(
            `${inferenceEngineUrl}/api/vectors/extract`, 
            formData, 
            { 
                headers: formData.getHeaders(),
                timeout: 10000 // 10 second timeout to prevent hanging if python service is offline
            }
        );

        const targetVector = pythonResponse.data.vector;

        // Search Qdrant for similar target vectors (returns only UUIDs and scores)
        const searchResult = await qdrantClient.search('targets', {
            vector: targetVector,
            limit: 200,            // Fetch more points to allow deduplication and prevent flooding
            score_threshold: 0.7 
        });

        if (searchResult.length === 0) {
            return res.status(200).json({ matches: [] });
        }

        // Extract UUIDs to fetch metadata from Postgres
        const qdrantIds = searchResult.map(hit => String(hit.id));
        const qdrantScoreMap = new Map<string, number>();
        searchResult.forEach(hit => {
            qdrantScoreMap.set(String(hit.id), hit.score);
        });

        // Fetch relational metadata
        const detections = await prisma.detection.findMany({
            where: {
                id: { in: qdrantIds }
            }
        });

        // Merge Qdrant scores with Postgres metadata and sort by score descending
        const rawMatches = detections.map(det => {
            const score = qdrantScoreMap.get(det.id) || 0;
            return {
                confidence: (score * 100).toFixed(2) + '%',
                score: score,
                cameraId: det.cameraId,
                jobId: det.jobId,
                frameNumber: det.frameNumber,
                timestampSeconds: det.timestampSeconds,
                detectedAt: det.detectedAt,
                boundingBox: det.bbox as [number, number, number, number],
                cropS3Key: det.cropS3Key
            };
        }).sort((a, b) => b.score - a.score);

        // Filter duplicates within the frame threshold window
        const FRAME_THRESHOLD = 150; 
        const uniqueMatches: typeof rawMatches = [];

        for (const current of rawMatches) {
            const isDuplicate = uniqueMatches.some(existing => 
                existing.cameraId === current.cameraId &&
                existing.jobId === current.jobId &&
                Math.abs(existing.frameNumber - current.frameNumber) < FRAME_THRESHOLD
            );

            if (!isDuplicate) {
                uniqueMatches.push(current);
            }

            if (uniqueMatches.length >= 10) {
                break;
            }
        }

        console.log(`[✓] Deduplicated ${rawMatches.length} raw hits down to ${uniqueMatches.length} unique events.`);
        return res.status(200).json({ matches: uniqueMatches });

    } catch (error: any) {
        console.error('[-] Search pipeline failed:', error.message);
        return res.status(500).json({ error: 'Internal pipeline search error.' });
    }
};