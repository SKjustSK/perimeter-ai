import os
import torch
import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from torchreid.utils import FeatureExtractor

app = FastAPI(title="Perimeter AI Core Engine API")

# The API's OSNet instance is intentionally pinned to CPU.
# The video worker (engine.py) uses the GPU for batch frame processing.
# Keeping these on separate compute resources eliminates GPU contention:
# search queries never compete with an active video pipeline for GPU time.
# Single-image inference on CPU is ~80ms — imperceptible for interactive search.
print("[*] Loading OSNet into API memory space (CPU)...")
osnet_extractor = FeatureExtractor(
    model_name='osnet_x1_0',
    model_path='',
    device='cpu'  # intentionally CPU — GPU reserved for the video worker
)
print("[✓] API OSNet instance loaded on: CPU")

# Existing Health Check Route
@app.get("/health")
async def health_check():
    return {"status": "HEALTHY", "device": "cpu"}

# Vector Extraction Route for Synchronous Searches
@app.post("/api/vectors/extract")
async def extract_vector(file: UploadFile = File(...)):
    """
    Accepts a cropped image file of a person, extracts their 
    512-dimensional embedding, and returns it.
    """
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file format.")
            
        # Convert BGR to RGB for Torchreid alignment
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        with torch.no_grad():
            embedding_tensor = osnet_extractor([img_rgb])
            embedding_vector = embedding_tensor[0].cpu().numpy().tolist()
            
        return {"vector": embedding_vector}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vector extraction failed: {str(e)}")

def run_api_server():
    """Target function executed by the daemon thread in main.py"""
    port = int(os.getenv("ENGINE_API_PORT", 5001))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")