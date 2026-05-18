import json
import time
import os
import cv2
import numpy as np
import uuid
import torch
from ultralytics import YOLO
from torchreid.utils import FeatureExtractor
from dotenv import load_dotenv

from src.config.redis_client import get_redis_client
from src.config.db import update_job_status
from src.config.s3_client import get_s3_client
from src.config.qdrant import get_qdrant_client, init_qdrant_collection
from qdrant_client.http.models import PointStruct

load_dotenv()

print("[*] Booting AI Models into memory...")
device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"[*] Inference engine utilizing device: {device.upper()}")

# 1. Initialize YOLOv8 (Human detector)
yolo_model = YOLO('yolov8n.pt') 

# 2. Initialize OSNet (Feature / Re-ID vector extractor)
osnet = FeatureExtractor(
    model_name='osnet_x1_0',
    model_path='', # Leaves empty to let torchreid download default pre-trained weights
    device=device
)

def start_worker_loop():
    # Ensure Qdrant collection is ready before polling
    init_qdrant_collection()
    
    r = get_redis_client()
    s3 = get_s3_client()
    q_client = get_qdrant_client()
    
    queue_name = os.getenv("QUEUE_NAME", "video_jobs")
    bucket_name = os.getenv("STORAGE_BUCKET", "surveillance-videos")
    collection_name = os.getenv("COLLECTION_NAME", "targets")
    
    print(f"[*] Vision Worker Active. Listening for tasks on Redis queue: '{queue_name}'...")
    
    while True:
        job_id = None
        try:
            # Blocking pop from Redis queue
            result = r.blpop(queue_name, timeout=0)
            if result is None: 
                continue
                
            _, message_body = result
            task = json.loads(message_body)
            job_id = task['job_id']
            s3_key = task['s3_key']
            camera_id = task.get('camera_id', 'unknown')
            
            print(f"\n[+] Processing Job: {job_id} | Video Source: {s3_key}")
            update_job_status(job_id, "PROCESSING")
            
            local_video_path = f"/tmp/{job_id}.mp4"
            
            try:
                s3.download_file(bucket_name, s3_key, local_video_path)
                
                # Initialize capture
                cap = cv2.VideoCapture(local_video_path)
                if not cap.isOpened():
                    raise ValueError(f"OpenCV failed to open video file: {local_video_path}")
                
                prev_gray = None
                frame_count = 0
                points_to_upload = []
                
                while True:
                    ret, frame = cap.read()
                    if not ret: 
                        break
                        
                    frame_count += 1
                    # Process every 5th frame to downsample video
                    if frame_count % 5 != 0: 
                        continue 
                    
                    # Convert to grayscale for motion detection check
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    if prev_gray is not None:
                        # Skip frames with low pixel difference (no significant motion)
                        if np.mean(cv2.absdiff(prev_gray, gray)) < 3.0:
                            continue 
                    prev_gray = gray
                    
                    # Run YOLOv8 human detector (class 0 is person)
                    results = yolo_model(frame, classes=[0], verbose=False)
                    
                    frame_crops = []
                    frame_boxes = []
                    
                    for box in results[0].boxes.xyxy:
                        x1, y1, x2, y2 = map(int, box)
                        h, w = frame.shape[:2]
                        x1, y1 = max(0, x1), max(0, y1)
                        x2, y2 = min(w, x2), min(h, y2)
                        
                        person_crop = frame[y1:y2, x1:x2]
                        # Ignore crops that are too small for embedding extraction
                        if person_crop.shape[0] < 60 or person_crop.shape[1] < 30: 
                            continue
                            
                        # Convert BGR to RGB for OSNet alignment
                        person_crop_rgb = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
                        
                        frame_crops.append(person_crop_rgb)
                        frame_boxes.append((x1, y1, x2, y2))
                        
                    if frame_crops:
                        # Extract 512-dimensional feature embeddings in a batch
                        with torch.no_grad():
                            embedding_tensors = osnet(frame_crops)
                            
                        for i, box in enumerate(frame_boxes):
                            embedding_vector = embedding_tensors[i].cpu().numpy().tolist()
                            points_to_upload.append(
                                PointStruct(
                                    id=str(uuid.uuid4()),
                                    vector=embedding_vector,
                                    payload={
                                        "job_id": job_id,
                                        "camera_id": camera_id,
                                        "frame_number": frame_count,
                                        "bbox": list(box)
                                    }
                                )
                            )
                
                # Push vectors to database if any targets were detected
                if points_to_upload:
                    q_client.upsert(collection_name=collection_name, points=points_to_upload)
                    print(f"[+] Successfully pushed {len(points_to_upload)} vector points to Qdrant.")
                else:
                    print("[-] No valid targets identified in video sample.")
                    
                update_job_status(job_id, "COMPLETED")
                print(f"[✓] Finalized Job Execution: {job_id}")

            finally:
                # Release video capture and remove local video file
                if 'cap' in locals() and cap.isOpened():
                    cap.release()
                if os.path.exists(local_video_path): 
                    os.remove(local_video_path)
                    print(f"[*] Cleaned up local file: {local_video_path}")
            
        except Exception as e:
            print(f"[-] Critical execution failure: {e}")
            if job_id: 
                update_job_status(job_id, "FAILED", error_log=str(e))
        
        time.sleep(0.1)