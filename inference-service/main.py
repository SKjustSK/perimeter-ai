from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from contextlib import asynccontextmanager
import numpy as np
import cv2
import os
import re

YOLO_WEIGHTS_PATH = "models/yolov8n_custom.pt"
REID_ONNX_PATH    = "models/osnet_x1_0_reid.onnx"


class ReIDInferenceEngine:
    def __init__(self):
        self.use_fallback = True
        self.yolo_model   = None
        self.reid_session = None

        if os.path.exists(YOLO_WEIGHTS_PATH) and os.path.exists(REID_ONNX_PATH):
            try:
                import onnxruntime as ort
                from ultralytics import YOLO
                self.yolo_model   = YOLO(YOLO_WEIGHTS_PATH)
                self.reid_session = ort.InferenceSession(
                    REID_ONNX_PATH, providers=["CPUExecutionProvider"]
                )
                self.use_fallback = False
                print("DL models loaded — production mode.")
            except Exception as e:
                print(f"Model load failed: {e}. Using ESM fallback.")
        else:
            print("No custom weights found. Running in Embedded Simulation Mode (ESM).")

    def detect_persons(self, frame: np.ndarray, prev_frame=None) -> list:
        if self.use_fallback:
            h, w = frame.shape[:2]
            return [([10, 10, min(w - 10, 120), min(h - 10, 220)], 0.82)]
        results = self.yolo_model(frame, classes=[0], verbose=False)
        out = []
        for r in results:
            for box in r.boxes:
                out.append((list(map(int, box.xyxy[0].tolist())), box.conf[0].item()))
        return out

    def extract_embedding(self, crop: np.ndarray) -> list:
        if self.use_fallback:
            # TODO: replace with real ONNX inference once model is trained
            rng  = np.random.default_rng(seed=int(crop.mean()))
            fake = rng.standard_normal(512).astype(np.float32)
            fake /= np.linalg.norm(fake)
            return fake.tolist()
        crop_rgb     = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        crop_resized = cv2.resize(crop_rgb, (128, 256))
        crop_f       = crop_resized.astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        inp  = ((crop_f - mean) / std).transpose(2, 0, 1)[np.newaxis, :]
        out  = self.reid_session.run(None, {self.reid_session.get_inputs()[0].name: inp})
        feat = out[0][0].flatten()
        return (feat / np.linalg.norm(feat)).tolist()


engine: ReIDInferenceEngine | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    engine = ReIDInferenceEngine()
    yield


app = FastAPI(title="Perimeter AI — Inference Service", lifespan=lifespan)


class VideoAnalysisRequest(BaseModel):
    video_path: str


@app.get("/health")
async def health():
    return {"status": "ok", "fallback_mode": engine.use_fallback if engine else True}


@app.post("/api/v1/analyze-frame")
async def analyze_frame(image: UploadFile = File(...)):
    global engine
    if engine is None:
        return {"status": "error", "message": "Engine not initialised"}
    contents = await image.read()
    frame    = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        return {"status": "error", "message": "Failed to decode image"}
    detections = []
    for bbox, conf in engine.detect_persons(frame):
        x1, y1, x2, y2 = bbox
        if (x2 - x1) <= 0 or (y2 - y1) <= 0:
            continue
        try:
            detections.append({"bbox": bbox, "confidence": round(conf, 3),
                                "embedding": engine.extract_embedding(frame[y1:y2, x1:x2])})
        except Exception as e:
            print(f"Embedding error: {e}")
    return {"status": "success", "detections": detections}


@app.post("/api/v1/analyze-video")
async def analyze_video(body: VideoAnalysisRequest):
    global engine
    if engine is None:
        return {"status": "error", "message": "Engine not initialised"}
    if not os.path.exists(body.video_path):
        return {"status": "error", "message": f"Not found: {body.video_path}"}
    basename   = os.path.basename(body.video_path)
    match      = re.search(r"_(\d+)\.[^.]+$", basename)
    start_time = int(match.group(1)) / 1000.0 if match else os.path.getmtime(body.video_path)
    cap = cv2.VideoCapture(body.video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    interval = max(1, int(round(fps / 2)))
    detections, frame_count, prev_frame = [], 0, None
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_count % interval == 0:
            ts  = start_time + frame_count / fps
            raw = engine.detect_persons(frame, prev_frame)
            for bbox, conf in raw:
                x1, y1, x2, y2 = bbox
                if (x2 - x1) <= 0 or (y2 - y1) <= 0:
                    continue
                try:
                    detections.append({"bbox": bbox, "confidence": round(conf, 2),
                                       "embedding": engine.extract_embedding(frame[y1:y2, x1:x2]),
                                       "timestamp": ts})
                except Exception as e:
                    print(f"Frame {frame_count}: {e}")
            prev_frame = frame.copy()
        frame_count += 1
    cap.release()
    return {"status": "success", "detections": detections}
