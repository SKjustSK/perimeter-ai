import { QdrantClient } from '@qdrant/js-client-rest';

const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';

const qdrant = new QdrantClient({ url: qdrantUrl });

export default qdrant;
