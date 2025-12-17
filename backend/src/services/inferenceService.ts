import axios from 'axios';
import FormData from 'form-data';

const inferenceApiUrl = process.env.INFERENCE_API_URL || 'http://localhost:8000';

export async function analyzeFrame(imageBuffer: Buffer, originalName: string, mimeType: string) {
    const formData = new FormData();
    formData.append('image', imageBuffer, {
        filename: originalName || 'frame.jpg',
        contentType: mimeType || 'image/jpeg',
    });

    const response = await axios.post(`${inferenceApiUrl}/api/v1/analyze-frame`, formData, {
        headers: formData.getHeaders(),
    });

    return response.data;
}

export async function analyzeVideoFile(videoPath: string) {
    const response = await axios.post(`${inferenceApiUrl}/api/v1/analyze-video`, {
        video_path: videoPath
    });
    return response.data;
}
