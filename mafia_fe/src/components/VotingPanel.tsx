import { useState } from "react";

interface VotingPanelProps {
  candidates: Array<{ userId: string; userName: string }>;
  currentUserId: string;
  isMyTurn: boolean;
  onVote: (targetId: string) => void;
}

export function VotingPanel({ candidates, currentUserId, isMyTurn, onVote }: VotingPanelProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const handleVote = () => {
    if (selectedTarget && !hasVoted) {
      onVote(selectedTarget);
      setHasVoted(true);
    }
  };

  if (!isMyTurn) {
    return (
      <div style={{
        background: "var(--bg-secondary)",
        border: "2px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "2rem",
        textAlign: "center"
      }}>
        <div style={{ fontSize: "1.25rem", color: "var(--text-secondary)" }}>
          {hasVoted ? "Вы проголосовали ✓" : "Ожидание вашего хода..."}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: "2px solid var(--warning)",
      borderRadius: "var(--radius-lg)",
      padding: "2rem",
      boxShadow: "0 4px 20px rgba(251, 191, 36, 0.3)"
    }}>
      <h3 style={{
        margin: "0 0 1.5rem 0",
        fontSize: "1.5rem",
        color: "var(--warning)",
        textAlign: "center"
      }}>
        Выберите игрока для голосования
      </h3>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "1rem",
        marginBottom: "1.5rem"
      }}>
        {candidates.map((candidate) => (
          <button
            key={candidate.userId}
            onClick={() => setSelectedTarget(candidate.userId)}
            disabled={hasVoted}
            style={{
              padding: "1rem",
              background: selectedTarget === candidate.userId 
                ? "var(--warning)" 
                : "var(--bg-tertiary)",
              color: selectedTarget === candidate.userId 
                ? "var(--bg-primary)" 
                : "var(--text-primary)",
              border: `2px solid ${selectedTarget === candidate.userId ? "var(--warning)" : "var(--border)"}`,
              borderRadius: "var(--radius)",
              cursor: hasVoted ? "not-allowed" : "pointer",
              fontWeight: selectedTarget === candidate.userId ? "600" : "normal",
              transition: "all 0.2s",
              opacity: hasVoted ? 0.5 : 1
            }}
          >
            {candidate.userName}
            {candidate.userId === currentUserId && " (вы)"}
          </button>
        ))}
      </div>

      <button
        onClick={handleVote}
        disabled={!selectedTarget || hasVoted}
        className="btn-primary"
        style={{
          width: "100%",
          padding: "1rem",
          fontSize: "1.125rem",
          fontWeight: "600"
        }}
      >
        {hasVoted ? "Голос учтён ✓" : "Проголосовать"}
      </button>
    </div>
  );
}

