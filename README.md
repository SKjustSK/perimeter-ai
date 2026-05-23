# Perimeter AI

Perimeter AI is a modern, distributed CCTV Surveillance Person Re-Identification (Re-ID) system. It allows security operators to register cameras on an interactive map, upload surveillance footage, detect and extract human targets, and perform vector-similarity searches to locate specific individuals across the camera network.

---

## 🚀 Features

### 1. Camera Registry & Geolocation Map
- **Interactive Leaflet Dashboard**: View registered cameras as custom geolocated pins on a map.
- **Recenter & Focus**: Instantly pan and zoom to target cameras, and view status information (e.g. coordinates, latitude, longitude).
- **Camera Registry Form**: Add and register new cameras on the network with precise geographic coordinates.

### 2. Video Surveillance Pipeline
- **S3-Backed Video Storage**: Stream uploads directly to local S3 storage (MinIO) using secure presigned URLs.
- **Job Status Tracker**: Track upload states dynamically (`idle` -> `presigning` -> `uploading` -> `queueing` -> `success`) and poll the worker status in real-time.
- **Queue-Based Execution**: Distribute processing tasks via a Redis-backed job queue.

### 3. Person Detection & Re-Identification Engine
- **YOLOv8 Detection**: High-performance human detection and crop extraction from incoming video feeds.
- **OSNet Feature Extraction**: Extract distinct 512-dimensional vector embeddings of clothing, appearance, and physical characteristics.
- **Vector Database Storage**: Insert extracted vectors along with metadata (camera ID, timestamp, frame number) into a Qdrant vector index.

### 4. Vector Target Search
- **Drag-and-Drop Image Query**: Upload a cropped image of a person to run a search.
- **Cosine Similarity Querying**: Query Qdrant with the crop's feature vector to retrieve the nearest matching frames across all cameras.
- **Cross-Camera Tracking**: Match results display confidence ratings, matching camera locations, and frame thumbnails. Clicking a match highlights and pans the map directly to the corresponding camera.

### 5. Unified System Operations
- **One-Click System Reset**: Clear all jobs, camera tables, and the Qdrant vector database, then automatically seed default camera locations.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Frontend** | React, Vite, TypeScript, Tailwind CSS, Leaflet | Viewport-sized, responsive dashboard layout and mapping interface. |
| **Core API** | Express, TypeScript, Prisma, PostgreSQL | Manages cameras, jobs metadata, presigned URLs, and coordinates DB schema. |
| **Inference Engine** | FastAPI, Python 3.12, PyTorch, Ultralytics | Runs deep learning models (YOLOv8 & OSNet) and extracts feature embeddings. |
| **Vector DB** | Qdrant | Stores and queries high-dimensional person embeddings. |
| **Message Broker** | Redis | Implements the background worker video-processing queue. |
| **Object Storage** | MinIO (S3 compatible) | Local cloud storage for uploaded surveillance footage. |

---

## 📦 How to Setup

### Method 1: Running with Docker (Recommended)
You can run the entire infrastructure, API, frontend, and ML worker stack with a single command:

```bash
docker compose up --build
```

- **Frontend**: Available at [http://localhost](http://localhost) (port 80).
- **Core API**: Runs on [http://localhost:3000](http://localhost:3000).
- **Inference API**: Runs on [http://localhost:5001](http://localhost:5001).
- **MinIO Console**: Runs on [http://localhost:9001](http://localhost:9001) (`minioadmin` / `minioadmin`).
- **Qdrant Dashboard**: Runs on [http://localhost:6333/dashboard](http://localhost:6333/dashboard).

---

### Method 2: Manual Local Development

If you prefer to run services individually, follow the steps below:

#### Prerequisites
- Node.js v22+
- Python 3.12+
- PostgreSQL, Redis, MinIO, and Qdrant running locally

#### 1. Setup Environment Variables
Copy the `.env.example` configurations:
```bash
cp core-api/.env.example core-api/.env
cp inference-engine/.env.example inference-engine/.env
cp frontend/.env.example frontend/.env
```

#### 2. Run the Core API
```bash
cd core-api
npm install
npx prisma db push
npx prisma db seed # Seeds default cameras
npm run dev
```

#### 3. Run the Inference Engine
Create and activate a virtual environment, install requirements, and start the app:
```bash
cd inference-engine
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install --no-build-isolation -r requirements-github.txt
python main.py
```

> [!IMPORTANT]
> The `--no-build-isolation` flag is required when installing `torchreid` to allow `pip` to access pre-installed numpy packages during wheel compilation.

#### 4. Run the Frontend
```bash
cd frontend
npm install
npm run dev
```
The frontend dev server will start at [http://localhost:5173](http://localhost:5173).
