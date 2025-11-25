interface VotingResultsDisplayProps {
  votesWithNames: Array<{ voterName: string; targetName: string }>;
  voteCounts: Record<string, number>;
  eliminated: Array<{ userName: string; role: string }>;
  tie: boolean;
}

export function VotingResultsDisplay({ votesWithNames, voteCounts, eliminated, tie }: VotingResultsDisplayProps) {
  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: "2px solid var(--warning)",
      borderRadius: "var(--radius-lg)",
      padding: "1.5rem",
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
      maxHeight: "600px",
      overflowY: "auto",
      flexShrink: 0
    }}>
      <h3 style={{ margin: 0, color: "var(--warning)" }}>📊 Результаты голосования</h3>

      {/* Лог голосования */}
      <div>
        <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          КТО ЗА КОГО ПРОГОЛОСОВАЛ:
        </h4>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          maxHeight: "200px",
          overflowY: "auto",
          background: "var(--bg-tertiary)",
          padding: "0.75rem",
          borderRadius: "var(--radius)"
        }}>
          {votesWithNames.map((vote, index) => (
            <div key={index} style={{
              fontSize: "0.875rem",
              color: "var(--text-primary)"
            }}>
              <strong>{vote.voterName}</strong> → <span style={{ color: "var(--warning)" }}>{vote.targetName}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Подсчёт голосов */}
      <div>
        <h4 style={{ marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
          ПОДСЧЁТ ГОЛОСОВ:
        </h4>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          maxHeight: "300px",
          overflowY: "auto"
        }}>
          {Object.entries(voteCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([playerName, count]) => (
              <div key={playerName} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--bg-tertiary)",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius)",
                border: eliminated.some(e => e.userName === playerName) ? "2px solid var(--danger)" : "none"
              }}>
                <span style={{ color: "var(--text-primary)" }}>{playerName}</span>
                <span style={{
                  fontWeight: "bold",
                  fontSize: "1.25rem",
                  color: eliminated.some(e => e.userName === playerName) ? "var(--danger)" : "var(--warning)"
                }}>
                  {count} {count === 1 ? "голос" : count < 5 ? "голоса" : "голосов"}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Результат */}
      {tie ? (
        <div style={{
          background: "var(--info)",
          color: "var(--text-primary)",
          padding: "0.75rem",
          borderRadius: "var(--radius)",
          textAlign: "center",
          fontWeight: "bold"
        }}>
          🤝 Ничья! Никто не исключён
        </div>
      ) : eliminated.length > 0 ? (
        <div style={{
          background: "var(--danger)",
          color: "var(--text-primary)",
          padding: "0.75rem",
          borderRadius: "var(--radius)",
          textAlign: "center",
          fontWeight: "bold"
        }}>
          ☠️ Исключены: {eliminated.map(e => `${e.userName} (${e.role})`).join(", ")}
        </div>
      ) : null}
    </div>
  );
}

