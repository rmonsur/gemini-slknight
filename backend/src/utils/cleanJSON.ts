/**
 * cleanJSON.ts — Robust JSON parser for Gemini API outputs
 * 
 * Gemini sometimes returns JSON wrapped in markdown code fences,
 * or with trailing/leading text. This utility extracts and parses
 * valid JSON from messy AI outputs.
 */

/**
 * Extract JSON from a string that may contain markdown fences or extra text
 */
export const extractJSON = (text: string): string => {
    // Remove markdown code fences
    let cleaned = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

    // Try to find JSON object or array boundaries
    const jsonStart = cleaned.search(/[\[{]/);
    const jsonEndBracket = cleaned.lastIndexOf(']');
    const jsonEndBrace = cleaned.lastIndexOf('}');
    const jsonEnd = Math.max(jsonEndBracket, jsonEndBrace);

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }

    return cleaned;
};

/**
 * Parse JSON with fallback handling for common Gemini output issues
 */
export const parseJSON = <T>(text: string, fallback: T): T => {
    try {
        const extracted = extractJSON(text);
        return JSON.parse(extracted) as T;
    } catch (error) {
        console.warn('JSON parse failed, attempting repair...', error);

        // Attempt common repairs
        try {
            const repaired = repairJSON(text);
            return JSON.parse(repaired) as T;
        } catch {
            console.error('JSON repair failed, returning fallback');
            return fallback;
        }
    }
};

/**
 * Attempt to repair common JSON issues
 */
const repairJSON = (text: string): string => {
    let repaired = extractJSON(text);

    // Fix trailing commas before closing brackets
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

    // Fix unquoted keys (simple cases)
    repaired = repaired.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    // Fix single quotes to double quotes
    repaired = repaired.replace(/'/g, '"');

    return repaired;
};

/**
 * Safely parse Gemini response with type validation
 */
export const safeParseGeminiResponse = <T>(
    response: string,
    validator: (data: unknown) => data is T,
    fallback: T
): T => {
    const parsed = parseJSON(response, null);

    if (parsed !== null && validator(parsed)) {
        return parsed;
    }

    console.warn('Validation failed for Gemini response, using fallback');
    return fallback;
};

export default parseJSON;
