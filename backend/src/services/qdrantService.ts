import qdrant from '../config/qdrant.js';

const COLLECTION_NAME = 'reid_embeddings';

export async function initQdrant() {
    try {
        const collections = await qdrant.getCollections();
        const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

        if (!exists) {
            console.log(`Creating Qdrant collection: ${COLLECTION_NAME}`);
            await qdrant.createCollection(COLLECTION_NAME, {
                vectors: {
                    size: 512,
                    distance: 'Cosine',
                }
            });
            console.log(`Collection ${COLLECTION_NAME} created successfully.`);
        } else {
            console.log(`Qdrant collection ${COLLECTION_NAME} already exists.`);
        }
    } catch (error) {
        console.error('Failed to initialize Qdrant:', error);
    }
}

export async function upsertEmbedding(detectionId: string, cameraId: string, timestamp: number, embedding: number[]) {
    await qdrant.upsert(COLLECTION_NAME, {
        wait: true,
        points: [
            {
                id: detectionId, // Qdrant points can take a UUID string directly as ID
                vector: embedding,
                payload: {
                    detection_id: detectionId,
                    camera_id: cameraId,
                    timestamp: timestamp
                }
            }
        ]
    });
}

export async function searchEmbedding(embedding: number[], limit: number = 5) {
    const results = await qdrant.search(COLLECTION_NAME, {
        vector: embedding,
        limit: limit,
    });
    return results;
}
