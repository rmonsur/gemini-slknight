/**
 * TypeScript type definitions for SLKnight
 */

// Lifecycle stages
export type LifecycleStage =
    | 'STAGE_1_SIMULATOR'
    | 'STAGE_2_COACH'
    | 'STAGE_3_AUDITOR'
    | 'STAGE_4_OPTIMIZER';

export type UserStatus =
    | 'PRE_COLLEGE'
    | 'IN_SCHOOL'
    | 'GRACE_PERIOD'
    | 'REPAYMENT_MESSY'
    | 'REPAYMENT_OPTIMIZED';

export type EmployerType = 'PRIVATE' | 'GOVERNMENT' | 'NON_PROFIT';
export type LoanType = 'SUBSIDIZED' | 'UNSUBSIDIZED' | 'PRIVATE';
export type LoanSource = 'MANUAL' | 'VISION_SCAN';
export type LifestylePreference = 'FRUGAL' | 'BALANCED' | 'LUXURY';
export type RiskTolerance = 'LOW' | 'MEDIUM' | 'HIGH';
export type ThemeMood = 'OPTIMISTIC' | 'NEUTRAL' | 'CRISIS' | 'CYBERPUNK';

// Loan record
export interface Loan {
    id: string;
    balance: number;
    rate: number;
    type: LoanType;
    source: LoanSource;
    extractedAt?: string;
    servicerName?: string;
    monthlyPayment?: number;
    dueDate?: string;
}

// User profile
export interface UserProfile {
    status: UserStatus;
    major?: string;
    school?: string;
    gradDate?: string;
    targetCity?: string;
    mobile?: string;
    email?: string;
    job?: {
        title: string;
        employerType: EmployerType;
        income: number;
    };
    familySize: number;
    willingnessToRelocate: boolean;
}

// User financials
export interface UserFinancials {
    totalDebt: number;
    servicer?: string;
    loans: Loan[];
}

// User preferences
export interface UserPreferences {
    lifestylePreference: LifestylePreference;
    riskTolerance: RiskTolerance;
    careerAmbition?: string;
}

// Generative UI state
export interface GenerativeState {
    currentTheme: ThemeMood;
    mapRegionInterest: string[];
    enable3D: boolean;
    lastAgentOutput: Record<string, unknown>;
    dataIntegrityScore: number;
}

// Notification
export interface Notification {
    id: string;
    type: 'POLICY_CHANGE' | 'OPPORTUNITY' | 'SYSTEM';
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
}

// Full user record (Golden Record)
export interface UserRecord {
    userId: string;
    lifecycleStage: LifecycleStage;
    isDemo: boolean;
    profile: UserProfile;
    financials: UserFinancials;
    preferences: UserPreferences;
    generativeState: GenerativeState;
    notifications: Notification[];
    createdAt: string;
    updatedAt: string;
}

// Design system output from Gemini
export interface DesignSystem {
    primaryColor: string;
    secondaryColor: string;
    fontHeader: string;
    fontBody: string;
    mood: ThemeMood;
    backgroundGradient: [string, string];
}

// Scenario for simulator
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

// Offer/opportunity
export interface Offer {
    id: string;
    type: 'RELOCATION_GRANT' | 'REFINANCE' | 'FORGIVENESS' | 'POLICY_CHANGE';
    title: string;
    value: number;
    source: string;
    coordinates?: [number, number];
    eligibility?: string;
}

// Agent response structure
export interface AgentResponse {
    success: boolean;
    designSystem?: DesignSystem;
    scenarios?: Scenario[];
    offers?: Offer[];
    message?: string;
    extractedData?: Record<string, unknown>;
    error?: string;
}

// Vision extraction result
export interface VisionExtraction {
    documentId: string;
    uploadedAt: string;
    imageUrl: string;
    extractionStatus: 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED';
    extractedData?: {
        servicerName?: string;
        accountNumberLast4?: string;
        interestRate?: number;
        principalBalance?: number;
        monthlyPayment?: number;
        dueDate?: string;
        loanType?: LoanType;
    };
    confidence?: number;
    rawText?: string;
}

// =====================================================
// MAZE BLUEPRINT TYPES — Isometric Gamified Freedom Path
// =====================================================

// Tile types for the maze - maps to pre-loaded artwork
export type TileType =
    | 'TODAY'
    | 'DOCUMENT_SCAN'
    | 'IDR_ENROLLMENT'
    | 'REFINANCING'
    | 'GRANT_APPLICATION'
    | 'AGGRESSIVE_PAYOFF'
    | 'PSLF'
    | 'COACH'
    | 'CALL_SERVICER'
    | 'DEBT_FREE';

// Task types that can be assigned to tiles
export type MazeTaskType =
    | 'DOCUMENT_SCANNER'
    | 'LETTER_WRITER'
    | 'CALL_SIMULATOR'
    | 'HAWK_DOVE_DEBATE'
    | 'COACH_CHAT'
    | 'EXTERNAL_LINK'
    | 'FUTURE_SELF'
    | 'CALCULATOR';

// Individual tile in the maze
export interface MazeTile {
    milestoneId: string;
    tileType: TileType;
    position: { row: number; col: number };
    requiredTask: {
        type: MazeTaskType;
        instruction: string;  // Personalized: "Scan your Nelnet statement"
        reason: string;       // Why Gemini chose this
    };
    unlocksNext: string[];  // milestoneIds that unlock when this tile completes
}

// Complete maze blueprint generated by Gemini
export interface MazeBlueprint {
    tiles: MazeTile[];
    reasoning: string;  // Gemini explains its tile selection and ordering logic
    totalTiles: number;
}

// =====================================================
// FREEDOM PATH TYPES — "Reverse Engineer Your Freedom"
// =====================================================

// Tool types for milestone actions
export type ActionToolType =
    | 'CALL_SIMULATOR'
    | 'LETTER_WRITER'
    | 'DOCUMENT_SCANNER'
    | 'LINK'
    | 'CALCULATOR';

// Individual action item on a milestone
export interface MilestoneAction {
    id: string;
    title: string;
    impact: string; // e.g., "Saves $137/year"
    tool: ActionToolType;
    toolData?: {
        letterType?: string;
        servicer?: string;
        objective?: string;
        url?: string;
        deadline?: string;
    };
}

// Decision point for Hawk vs Dove debate
export interface DecisionPoint {
    question: string;
    hawkPosition: string;
    dovePosition: string;
}

// Financial snapshot at a milestone
export interface MilestoneFinancials {
    balance: number;
    monthlyPayment: number;
    interestPaidToDate?: number;
}

// Individual milestone on the Freedom Path
export interface Milestone {
    id: string;
    date: string; // ISO date string
    title: string;
    narrative: string;
    financialSnapshot: MilestoneFinancials;
    decisionPoint?: DecisionPoint;
    actions?: MilestoneAction[];
    isToday?: boolean;
}

// Optimal outcome at the end of the Freedom Path
export interface OptimalOutcome {
    debtFreeDate: string;
    totalInterestPaid: number;
    qualityOfLifeScore: number;
    strategyName: string;
    narrativeSummary: string;
    totalSaved: number; // vs status quo
}

// Complete Freedom Path (now includes mazeBlueprint)
export interface FreedomPath {
    optimalOutcome: OptimalOutcome;
    milestones: Milestone[];
    mazeBlueprint: MazeBlueprint;  // Gemini's game design for the isometric maze
    generatedAt: string;
}

// Freedom Path API response
export interface FreedomPathResponse {
    success: boolean;
    freedomPath?: FreedomPath;
    error?: string;
}

