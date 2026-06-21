import { type Request, type Response } from 'express';
import { PutObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import prisma from '../config/prisma.js';
import redisClient from '../config/redis.js';
import s3Client from '../config/s3.js';
import { sseEmitter } from '../config/sseEmitter.js';

export const getUploadUrl = async (req: Request, res: Response): Promise<void> => {
  const { fileName, cameraId } = req.body;

  if (!fileName || !cameraId) {
    res.status(400).json({ error: 'Missing fileName or cameraId' });
    return;
  }

  try {
    const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
    if (!camera) {
      res.status(404).json({ error: 'Camera registry not found' });
      return;
    }

    const bucketName = process.env.STORAGE_BUCKET || 'surveillance-videos';

    // Ensure storage bucket exists in MinIO (critical after a docker volume wipe)
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        console.log(`[*] Bucket ${bucketName} not found. Auto-creating in MinIO...`);
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
        console.log(`[+] Bucket ${bucketName} created successfully.`);
      } else {
        console.warn('[-] S3 bucket health check returned error:', err.message);
      }
    }

    const s3Key = `uploads/${cameraId}/${Date.now()}-${fileName}`;
    
    // Create database job record and generate signed upload URL
    const job = await prisma.job.create({
      data: { status: 'PENDING', s3Key, cameraId }
    });

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ContentType: 'video/mp4',
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    res.status(200).json({ jobId: job.id, uploadUrl, s3Key });
  } catch (error) {
    console.error('[-] Error generating upload URL:', error);
    res.status(500).json({ error: 'Failed to initialize upload layer' });
  }
};

export const processVideo = async (req: Request, res: Response): Promise<void> => {
  const { jobId } = req.body;

  if (!jobId) {
    res.status(400).json({ error: 'Missing jobId' });
    return;
  }

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      res.status(404).json({ error: 'Job entry not found' });
      return;
    }

    // Update job status to QUEUED and push payload to Redis queue
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status: 'QUEUED' }
    });

    const taskPayload = {
      job_id: updatedJob.id,
      s3_key: updatedJob.s3Key,
      camera_id: updatedJob.cameraId
    };

    await redisClient.rPush('video_jobs', JSON.stringify(taskPayload));

    res.status(202).json({ message: 'Job successfully appended to queue.', jobId: updatedJob.id });
  } catch (error) {
    console.error('[-] Error queueing video process:', error);
    res.status(500).json({ error: 'Failed to dispatch job onto task broker' });
  }
};

export const getJobStatus = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;

  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Invalid job ID' });
    return;
  }

  try {
    const job = await prisma.job.findUnique({
      where: { id }
    });

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.status(200).json(job);
  } catch (error) {
    console.error('[-] Error fetching job status:', error);
    res.status(500).json({ error: 'Failed to retrieve job status' });
  }
};

export const getJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobs = await prisma.job.findMany({
      include: { camera: true },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(jobs);
  } catch (error) {
    console.error('[-] Error fetching jobs list:', error);
    res.status(500).json({ error: 'Failed to retrieve jobs list' });
  }
};

export const streamJobUpdates = (req: Request, res: Response): void => {
  // SSE headers — disable all buffering so events flush to the browser instantly
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx proxy buffering
  res.flushHeaders();

  // Attach to the process-wide EventEmitter (backed by one shared Redis subscriber).
  // No new Redis connections are created — N tabs cost the same as 1 tab.
  const handler = (message: string) => res.write(`data: ${message}\n\n`);
  sseEmitter.on('job:update', handler);

  // Keepalive comment every 30s — prevents proxies/LBs from closing the idle stream.
  // SSE comment lines (starting with ':') are silently ignored by EventSource.
  const keepalive = setInterval(() => res.write(': keepalive\n\n'), 30_000);

  // Clean up when the browser tab closes or navigates away
  req.on('close', () => {
    clearInterval(keepalive);
    sseEmitter.off('job:update', handler);
    console.log('[-] SSE client disconnected');
  });

  console.log('[+] SSE client connected');
};