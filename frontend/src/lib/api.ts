/**
 * api.ts — Frontend API client for SLKnight backend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

// Types from backend
export interface DesignSystem {
    primaryColor: string;
    secondaryColor: string;
    fontHeader: string;
    fontBody: string;
    mood: 'OPTIMISTIC' | 'NEUTRAL' | 'CRISIS' | 'CYBERPUNK';
    backgroundGradient: [string, string];
}

export interface Scenario {
    id: string;
    label: string;
    narrative: string;
    debtFreeDate: string;
    monthlyPayment: number;
    totalInterestPaid: number;
    qualityOfLifeScore: number;
    chartData: {
        labels: string[];
        balances: number[];
    };
}

export interface Offer {
    id: string;
    type: 'RELOCATION_GRANT' | 'REFINANCE' | 'FORGIVENESS' | 'POLICY_CHANGE';
    title: string;
    value: number;
    source: string;
    coordinates?: [number, number];
    eligibility?: string;
}

export interface SimulatorResponse {
    success: boolean;
    designSystem: DesignSystem;
    scenarios: Scenario[];
    offers: Offer[];
}

export interface GeoJSONResponse {
    success: boolean;
    geoJSON: {
        type: 'FeatureCollection';
        features: Array<{
            type: 'Feature';
            properties: {
                id: string;
                title: string;
                value: number;
                type: string;
                source: string;
            };
            geometry: {
                type: 'Point';
                coordinates: [number, number];
            };
        }>;
    };
}

// API functions

export async function getSimulatorScenarios(): Promise<SimulatorResponse> {
    const res = await fetch(`${API_BASE}/api/simulator/scenarios`);
    if (!res.ok) throw new Error('Failed to fetch scenarios');
    return res.json();
}

export async function getOpportunities(): Promise<{ success: boolean; offers: Offer[] }> {
    const res = await fetch(`${API_BASE}/api/optimizer/opportunities`);
    if (!res.ok) throw new Error('Failed to fetch opportunities');
    return res.json();
}

export async function getMapData(): Promise<GeoJSONResponse> {
    const res = await fetch(`${API_BASE}/api/optimizer/map-data`);
    if (!res.ok) throw new Error('Failed to fetch map data');
    return res.json();
}

export async function createScanSession(): Promise<{
    success: boolean;
    sessionId: string;
    uploadUrl: string;
}> {
    const res = await fetch(`${API_BASE}/api/scan/session`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to create session');
    return res.json();
}

export async function chatWithCoach(message: string): Promise<{
    success: boolean;
    message: string;
}> {
    const res = await fetch(`${API_BASE}/api/coach/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error('Failed to chat');
    return res.json();
}

export interface ScannedDocument {
    documentId: string;
    uploadedAt: string;
    extractionStatus: 'COMPLETE' | 'PROCESSING' | 'FAILED';
    extractedData: {
        servicerName: string;
        accountNumberLast4: string;
        interestRate: number;
        principalBalance: number;
        monthlyPayment: number;
        loanType: string;
    };
    confidence: number;
}

export async function getScannedDocuments(): Promise<{
    success: boolean;
    documents: ScannedDocument[];
}> {
    const res = await fetch(`${API_BASE}/api/scan/documents`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
}

export async function generateSimulatorScenarios(params: {
    monthlyPayment: number;
    targetCity: string;
    willingnessToRelocate: boolean;
}): Promise<SimulatorResponse> {
    const res = await fetch(`${API_BASE}/api/simulator/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to generate scenarios');
    return res.json();
}

export async function switchStage(stage: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/api/simulator/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
    });
    if (!res.ok) throw new Error('Failed to switch stage');
    return res.json();
}
