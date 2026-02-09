export type TileType =
    | 'TODAY' | 'DOCUMENT_SCAN' | 'IDR_ENROLLMENT' | 'REFINANCING' | 'GRANT_APPLICATION'
    | 'AGGRESSIVE_PAYOFF' | 'PSLF' | 'COACH' | 'CALL_SERVICER' | 'DEBT_FREE';

export type MazeTaskType =
    | 'DOCUMENT_SCANNER' | 'LETTER_WRITER' | 'CALL_SIMULATOR' | 'HAWK_DOVE_DEBATE'
    | 'COACH_CHAT' | 'EXTERNAL_LINK' | 'FUTURE_SELF' | 'CALCULATOR';

export interface MazeTile {
    milestoneId: string;
    tileType: TileType;
    position: { row: number; col: number };
    requiredTask: {
        type: MazeTaskType;
        instruction: string;
        reason: string;
    };
    unlocksNext: string[];
}

export interface MazeBlueprint {
    tiles: MazeTile[];
    reasoning: string;
    totalTiles: number;
}
