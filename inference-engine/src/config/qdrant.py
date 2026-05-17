import os
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams
from dotenv import load_dotenv

load_dotenv()

def get_qdrant_client():
    return QdrantClient(
        host=os.getenv("QDRANT_HOST", "localhost"),
        port=int(os.getenv("QDRANT_PORT", 6333))
    )

def init_qdrant_collection():
    client = get_qdrant_client()
    collection_name = os.getenv("COLLECTION_NAME", "targets")
    
    try:
        collections = client.get_collections().collections
        if not any(col.name == collection_name for col in collections):
            print(f"[*] Creating Qdrant collection: '{collection_name}' (Size: 512, Metric: Cosine)")
            # Create collection configured for 512-dimensional Re-ID embeddings
            client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=512, distance=Distance.COSINE),
            )
        else:
            print(f"[✓] Qdrant collection '{collection_name}' already exists.")
    except Exception as e:
        print(f"[-] Failed to connect or initialize Qdrant: {e}")