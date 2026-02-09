import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!API_KEY) {
    throw new Error('GOOGLE_AI_API_KEY is not set in environment variables');
}

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(API_KEY);

// Model configurations for different use cases
export const ModelConfig = {
    PRO: 'gemini-3-pro-preview',     // Reasoning, scenario generation, policy analysis
    FLASH: 'gemini-3-flash-preview', // Low-latency chat
    VISION: 'gemini-3-pro-preview',  // Document OCR (Pro supports image input)
} as const;

// Get a configured model instance
export const getModel = (modelType: keyof typeof ModelConfig): GenerativeModel => {
    return genAI.getGenerativeModel({ model: ModelConfig[modelType] });
};

// Convenience exports for each model type
export const getProModel = (): GenerativeModel => getModel('PRO');
export const getFlashModel = (): GenerativeModel => getModel('FLASH');
export const getVisionModel = (): GenerativeModel => getModel('VISION');

// Export the client for advanced usage
export { genAI };

export default genAI;
