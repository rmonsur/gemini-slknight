/**
 * auditorAgent.ts — Forensic Accountant (Stage 3)
 * 
 * Uses Gemini Vision for document OCR and entity extraction.
 * Extracts loan data from uploaded document images.
 */

import { getVisionModel } from '../config/gemini.js';
import { parseJSON } from '../utils/cleanJSON.js';
import type { UserRecord, AgentResponse, VisionExtraction } from '../types/index.js';

// Extraction prompt for Vision model
const EXTRACTION_PROMPT = `
You are a financial document analyst. Extract loan information from this document image.

Extract and return as JSON:
{
  "servicerName": "Name of loan servicer",
  "accountNumberLast4": "Last 4 digits of account",
  "interestRate": 0.0XX (as decimal),
  "principalBalance": XXXXX (number),
  "monthlyPayment": XXX (number),
  "dueDate": "YYYY-MM-DD",
  "loanType": "SUBSIDIZED" | "UNSUBSIDIZED" | "PRIVATE",
  "confidence": 0.XX (your confidence in extraction accuracy)
}

If you cannot extract a field, set it to null.
Return ONLY valid JSON, no explanation.
`;

// Fallback for extraction failures
const fallbackExtraction = {
    servicerName: undefined,
    accountNumberLast4: undefined,
    interestRate: undefined,
    principalBalance: undefined,
    monthlyPayment: undefined,
    dueDate: undefined,
    loanType: undefined,
    confidence: 0,
};

/**
 * Process an image and extract loan data
 */
export const extractFromImage = async (
    imageBase64: string,
    mimeType: string = 'image/jpeg'
): Promise<VisionExtraction['extractedData'] & { confidence: number }> => {
    try {
        const model = getVisionModel();

        const result = await model.generateContent([
            EXTRACTION_PROMPT,
            {
                inlineData: {
                    data: imageBase64,
                    mimeType,
                },
            },
        ]);

        const responseText = result.response.text();
        return parseJSON(responseText, fallbackExtraction);
    } catch (error) {
        console.error('[AuditorAgent] Vision extraction error:', error);
        return fallbackExtraction;
    }
};

/**
 * Main auditor agent function
 */
export const auditorAgent = async (
    user: UserRecord,
    input?: unknown
): Promise<AgentResponse> => {
    try {
        // Input should contain image data for processing
        const imageData = input as { base64?: string; mimeType?: string } | undefined;

        if (!imageData?.base64) {
            return {
                success: true,
                message: 'Ready to scan documents. Upload an image to begin.',
                extractedData: {},
            };
        }

        console.log('[AuditorAgent] Processing document for user:', user.userId);

        const extracted = await extractFromImage(
            imageData.base64,
            imageData.mimeType || 'image/jpeg'
        );

        return {
            success: true,
            message: `Document processed with ${Math.round((extracted.confidence || 0) * 100)}% confidence`,
            extractedData: extracted,
        };
    } catch (error) {
        console.error('[AuditorAgent] Error:', error);
        return {
            success: false,
            message: 'Failed to process document',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
};

export default auditorAgent;
