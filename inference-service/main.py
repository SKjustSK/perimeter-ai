from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from contextlib import asynccontextmanager
import numpy as np
import cv2
import os
import re

YOLO_MODEL_NAME = "yolov8n.pt"
REID_ONNX_PATH  = "models/reid_resnet18.onnx"


def export_reid_onnx_if_needed() -> bool:
    if os.path.exists(REID_ONNX_PATH):
        return True
    try:
        import torch
        import torchvision.models as models
        os.makedirs(os.path.dirname(REID_ONNX_PATH), exist_ok=True)
        print("[ReID] Exporting pretrained ResNet18 backbone to ONNX...")
        fe = torch.nn.Sequential(*list(models.resnet18(
            weights=models.ResNet18_Weights.DEFAULT).children())[:-1])
        fe.eval()
        torch.onnx.export(fe, torch.randn(1, 3, 256, 128), REID_ONNX_PATH,
                          export_params=True, opset_version=12,
                          input_names=["input"], output_names=["output"],
                          dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}})
        return True
    except Exception as e:
        print(f"[ReID] FATAL: {e}")
        return False


class ReIDInferenceEngine:
    def __init__(self):
        import onnxruntime as ort
        if not export_reid_onnx_if_needed():
            raise RuntimeError("ReID model init failed.")
        from ultralytics import YOLO
        self.yolo_model   = YOLO(YOLO_MODEL_NAME)
        self.reid_session = ort.InferenceSession(REID_ONNX_PATH, providers=["CPUExecutionProvider"])
        print("=" * 52)
        print("  Perimeter AI Inference Engine — READY")
        print("  Mode: YOLOv8n + ResNet18 ReID")
        print("=" * 52)

    def detect_persons(self, frame: np.ndarray) -> list:
        results = self.yolo_model(frame, classes=[0], verbose=False)
        return [(list(map(int, box.xyxy[0].tolist())), box.conf[0].item())
                for r in results for box in r.boxes]

    def extract_embedding(self, crop: np.ndarray) -> list:
        crop_f = cv2.resize(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB), (128, 256)).astype(np.float32) / 255.0
        mean, std = np.array([0.485, 0.456, 0.406]), np.array([0.229, 0.224, 0.225])
        inp  = ((crop_f - mean) / std).transpose(2, 0, 1)[np.newaxis, :].astype(np.float32)
        feat = self.reid_session.run(None, {self.reid_session.get_inputs()[0].name: inp})[0][0].flatten()
        norm = np.linalg.norm(feat)
        return (feat / norm if norm > 0 else feat).tolist()


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
    return {"status": "ok", "engine_loaded": engine is not None}


@app.post("/api/v1/analyze-frame")
async def analyze_frame(image: UploadFile = File(...)):
    global engine
    if engine is None:
        return {"status": "error", "message": "Engine not loaded"}
    frame = cv2.imdecode(np.frombuffer(await image.read(), np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        return {"status": "error", "message": "Failed to decode image"}
    detections = []
    for bbox, conf in engine.detect_persons(frame):
        x1, y1, x2, y2 = bbox
        if (x2 - x1) <= 0 or (y2 - y1) <= 0:
            continue
        try:
            detections.append({"bbox": [x1,y1,x2,y2], "confidence": round(conf, 3),
                                "embedding": engine.extract_embedding(frame[y1:y2, x1:x2])})
        except Exception as e:
            print(f"[frame] {e}")
    return {"status": "success", "detections": detections}


@app.post("/api/v1/analyze-video")
async def analyze_video(body: VideoAnalysisRequest):
    global engine
    if engine is None:
        return {"status": "error", "message": "Engine not loaded"}
    if not os.path.exists(body.video_path):
        return {"status": "error", "message": f"Not found: {body.video_path}"}
    match      = re.search(r"_(\d+)\.[^.]+$", os.path.basename(body.video_path))
    start_time = int(match.group(1)) / 1000.0 if match else os.path.getmtime(body.video_path)
    cap        = cv2.VideoCapture(body.video_path)
    fps        = cap.get(cv2.CAP_PROP_FPS) or 30.0
    interval   = max(1, int(round(fps / 2)))
    detections, fc = [], 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if fc % interval == 0:
            ts = start_time + fc / fps
            for bbox, conf in engine.detect_persons(frame):
                x1, y1, x2, y2 = bbox
                if (x2-x1) <= 0 or (y2-y1) <= 0:
                    continue
                try:
                    detections.append({"bbox": [x1,y1,x2,y2], "confidence": round(conf, 2),
                                       "embedding": engine.extract_embedding(frame[y1:y2, x1:x2]),
                                       "timestamp": ts})
                except Exception as e:
                    print(f"[video] fc={fc}: {e}")
        fc += 1
    cap.release()
    return {"status": "success", "detections": detections}
