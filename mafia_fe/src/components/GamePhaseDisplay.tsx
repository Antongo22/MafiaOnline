import { GamePhase } from "../types/game";

interface GamePhaseDisplayProps {
  phase: GamePhase;
  timeLeft: number;
  currentSpeakerName?: string;
  currentVoterName?: string;
  nightPhase?: string;
  dayNumber: number;
  isMyTurn?: boolean;
  winningTeam?: string;
}

const PHASE_NAMES: Record<GamePhase, string> = {
  [GamePhase.Lobby]: "Лобби",
  [GamePhase.IndividualSpeech]: "Индивидуальные выступления",
  [GamePhase.FreeDiscussion]: "Свободное обсуждение",
  [GamePhase.Voting]: "Голосование",
  [GamePhase.TieBreaker]: "Разрешение ничьей",
  [GamePhase.Night]: "Ночь",
  [GamePhase.GameOver]: "Игра окончена"
};

const NIGHT_PHASE_NAMES: Record<string, string> = {
  Don: "Дон ищет шерифа",
  Mafia: "Мафия выбирает жертву",
  Maniac: "Маньяк действует",
  Sheriff: "Шериф проверяет игрока",
  Doctor: "Доктор лечит",
  Prostitute: "Путана забирает игрока"
};

const TEAM_NAMES: Record<string, string> = {
  Good: "Мирные жители",
  Evil: "Мафия",
  Neutral: "Маньяк",
  Draw: "Ничья - никого не осталось"
};

export function GamePhaseDisplay({
  phase,
  timeLeft,
  currentSpeakerName,
  currentVoterName,
  nightPhase,
  dayNumber,
  isMyTurn,
  winningTeam
}: GamePhaseDisplayProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getPhaseColor = (): string => {
    // Если это мой ход - зелёный цвет
    if (isMyTurn) {
      return "var(--success)";
    }
    
    switch (phase) {
      case GamePhase.IndividualSpeech:
      case GamePhase.FreeDiscussion:
        return "var(--info)";
      case GamePhase.Voting:
      case GamePhase.TieBreaker:
        return "var(--warning)";
      case GamePhase.Night:
        return "var(--danger)";
      case GamePhase.GameOver:
        return "var(--success)";
      default:
        return "var(--text-secondary)";
    }
  };

  if (phase === GamePhase.Lobby) {
    return null;
  }

  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: `2px solid ${getPhaseColor()}`,
      borderRadius: "var(--radius-lg)",
      padding: "1.5rem",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "1rem",
      boxShadow: `0 4px 20px ${getPhaseColor()}40`
    }}>
      {/* День */}
      <div style={{
        fontSize: "0.875rem",
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "1px"
      }}>
        День {dayNumber}
      </div>

      {/* Фаза */}
      <div style={{
        fontSize: "1.75rem",
        fontWeight: "bold",
        color: getPhaseColor(),
        textAlign: "center"
      }}>
        {phase === GamePhase.Night && nightPhase
          ? NIGHT_PHASE_NAMES[nightPhase] || nightPhase
          : PHASE_NAMES[phase]}
      </div>

      {/* Текущий спикер/голосующий */}
      {currentSpeakerName && (
        <div style={{
          fontSize: "1rem",
          color: "var(--text-primary)",
          textAlign: "center"
        }}>
          Говорит: <strong>{currentSpeakerName}</strong>
        </div>
      )}

      {currentVoterName && (
        <div style={{
          fontSize: "1rem",
          color: "var(--text-primary)",
          textAlign: "center"
        }}>
          Голосует: <strong>{currentVoterName}</strong>
        </div>
      )}

      {/* Таймер или Победитель */}
      {phase === GamePhase.GameOver && winningTeam ? (
        <div style={{
          fontSize: "2.5rem",
          fontWeight: "bold",
          color: "var(--success)",
          textAlign: "center",
          padding: "1rem",
          background: "var(--bg-tertiary)",
          borderRadius: "var(--radius)",
          animation: "pulse 2s infinite"
        }}>
          🎉 Победили: {TEAM_NAMES[winningTeam] || winningTeam}!
        </div>
      ) : (
        <>
          <div style={{
            fontSize: "3rem",
            fontWeight: "bold",
            color: timeLeft <= 5 ? "var(--danger)" : "var(--text-primary)",
            fontFamily: "monospace",
            animation: timeLeft <= 5 ? "pulse 1s infinite" : "none"
          }}>
            {formatTime(timeLeft)}
          </div>

          {/* Индикатор прогресса */}
          <div style={{
            width: "100%",
            height: "8px",
            background: "var(--bg-tertiary)",
            borderRadius: "4px",
            overflow: "hidden"
          }}>
            <div style={{
              width: `${(timeLeft / 30) * 100}%`, // Примерно, нужно знать общее время
              height: "100%",
              background: getPhaseColor(),
              transition: "width 1s linear"
            }} />
          </div>
        </>
      )}
    </div>
  );
}

