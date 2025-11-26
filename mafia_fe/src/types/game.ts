// Типы для игрового цикла

export const GamePhase = {
  Lobby: "Lobby",
  IndividualSpeech: "IndividualSpeech",
  FreeDiscussion: "FreeDiscussion",
  Voting: "Voting",
  Night: "Night",
  GameOver: "GameOver"
} as const;

export type GamePhase = typeof GamePhase[keyof typeof GamePhase];

export const NightPhase = {
  Don: "Don",
  Mafia: "Mafia",
  Maniac: "Maniac",
  Sheriff: "Sheriff",
  Doctor: "Doctor",
  Prostitute: "Prostitute",
  Processing: "Processing"
} as const;

export type NightPhase = typeof NightPhase[keyof typeof NightPhase];

export interface GameState {
  phase: GamePhase;
  currentNightPhase?: NightPhase;
  dayNumber: number;
  phaseStartTime: string;
  phaseTimeSeconds: number;
  currentSpeakerId?: string;
  speakerOrder: string[];
  currentSpeakerIndex: number;
  currentVoterId?: string;
  voterOrder: string[];
  currentVoterIndex: number;
  isFirstCycle: boolean;
  winningTeam?: string;
}

export interface TimerUpdate {
  phase: string;
  timeLeft: number;
}

export interface SpeakerInfo {
  speakerId: string;
  speakerName: string;
  timeSeconds: number;
}

export interface VoterInfo {
  voterId: string;
  voterName: string;
  candidates?: Array<{ userId: string; userName: string }>; // Список живых игроков для голосования
  timeSeconds: number;
}

export interface VotingResults {
  votes: Record<string, string>;
  votesWithNames: Array<{ voterName: string; targetName: string }>;
  voteCounts: Record<string, number>;
  eliminated: Array<{
    userId: string;
    userName: string;
    role: string;
  }>;
  tie?: boolean;
}

export interface NightPhaseInfo {
  nightPhase: string;
  timeSeconds: number;
  aliveTargets?: Array<{ userId: string; userName: string }>; // Список живых игроков для выбора цели
}

export interface NightResults {
  killed: Array<{
    userId: string;
    userName: string;
    role: string;
  }>;
  saved: string[];
}

export interface CardRevealed {
  targetUserId?: string; // Кому показывать (если не указано, показывать всем)
  targetId: string;
  role: string;
  reason: string;
}

export interface GameOverData {
  winner: string;
  roles: Record<string, string>;
}

