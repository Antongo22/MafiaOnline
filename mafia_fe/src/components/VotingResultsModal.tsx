import { useEffect } from "react";

interface VotingResultsModalProps {
  isOpen: boolean;
  eliminated: Array<{ userName: string; role: string }>;
  tie: boolean;
  onClose: () => void;
  votesWithNames?: Array<{ voterName: string; targetName: string }>;
  voteCounts?: Record<string, number>;
}

export function VotingResultsModal({ isOpen, eliminated, tie, onClose, votesWithNames, voteCounts }: VotingResultsModalProps) {
  // Автоматическое закрытие через 8 секунд (увеличили, чтобы успели прочитать)
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasEliminated = eliminated && eliminated.length > 0;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        animation: "fadeIn 0.3s ease-in-out"
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)",
          borderRadius: "var(--radius-xl)",
          padding: "2.5rem",
          maxWidth: "600px",
          width: "95%",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
          border: tie ? "3px solid var(--warning)" : hasEliminated ? "3px solid var(--danger)" : "3px solid var(--info)",
          animation: "slideIn 0.4s ease-out",
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Иконка */}
        <div
          style={{
            fontSize: "3rem",
            textAlign: "center",
            marginBottom: "1rem",
            animation: "scaleIn 0.5s ease-out"
          }}
        >
          {tie ? "🤝" : hasEliminated ? "⚖️" : "🗳️"}
        </div>

        {/* Заголовок */}
        <h2
          style={{
            fontSize: "1.75rem",
            fontWeight: "700",
            textAlign: "center",
            marginBottom: "1.5rem",
            color: tie ? "var(--warning)" : hasEliminated ? "var(--danger)" : "var(--info)",
            textShadow: "0 2px 10px rgba(0, 0, 0, 0.3)"
          }}
        >
          {tie ? "Ничья!" : hasEliminated ? "Результаты голосования" : "Голосование завершено"}
        </h2>

        {/* Детальный лог голосования */}
        {votesWithNames && votesWithNames.length > 0 && (
          <div style={{
            background: "rgba(0, 0, 0, 0.2)",
            padding: "1rem",
            borderRadius: "var(--radius)",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
            maxHeight: "200px",
            overflowY: "auto"
          }}>
            <div style={{ fontWeight: "bold", marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.8rem", textTransform: "uppercase" }}>
              Кто за кого:
            </div>
            {votesWithNames.map((v, i) => (
              <div key={i} style={{ marginBottom: "0.2rem" }}>
                <strong>{v.voterName}</strong> → <span style={{ color: "var(--warning)" }}>{v.targetName}</span>
              </div>
            ))}
          </div>
        )}

        {/* Подсчёт по весам */}
        {voteCounts && Object.keys(voteCounts).length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontWeight: "bold", marginBottom: "0.5rem", color: "var(--text-secondary)", fontSize: "0.8rem", textTransform: "uppercase" }}>
              Итоги голосования:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {Object.entries(voteCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                <div key={name} style={{
                  padding: "0.3rem 0.7rem",
                  background: "var(--bg-primary)",
                  borderRadius: "20px",
                  border: "1px solid var(--border)",
                  fontSize: "0.9rem"
                }}>
                  {name}: <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Контент */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "2rem"
          }}
        >
          {tie ? (
            <p
              style={{
                fontSize: "1.25rem",
                color: "var(--warning)",
                fontWeight: "500"
              }}
            >
              Голоса разделились поровну. Город переходит к разрешению ничьей! ⚖️
            </p>
          ) : hasEliminated ? (
            <div>
              <p
                style={{
                  fontSize: "1.1rem",
                  color: "var(--text-secondary)",
                  marginBottom: "1rem"
                }}
              >
                Город принял решение:
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem"
                }}
              >
                {eliminated.map((victim, index) => (
                  <div
                    key={index}
                    style={{
                      background: "var(--bg-primary)",
                      padding: "1rem",
                      borderRadius: "var(--radius-lg)",
                      border: "2px solid var(--danger)",
                      animation: `slideInLeft 0.5s ease-out ${index * 0.1}s both`
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: "600",
                        color: "var(--text-primary)"
                      }}
                    >
                      {victim.userName}
                    </div>
                    <div
                      style={{
                        fontSize: "1rem",
                        color: "var(--danger)",
                        fontWeight: "500"
                      }}
                    >
                      Роль: {victim.role}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p
              style={{
                fontSize: "1.25rem",
                color: "var(--info)",
                fontWeight: "500"
              }}
            >
              Голосование завершено без исключений 📊
            </p>
          )}
        </div>

        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="btn-primary"
          style={{
            width: "100%",
            padding: "1rem",
            fontSize: "1.25rem",
            fontWeight: "600",
            background: tie ? "var(--warning)" : hasEliminated ? "var(--danger)" : "var(--info)",
            border: "none"
          }}
        >
          Продолжить
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideIn {
          from {
            transform: translateY(-50px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0);
          }
          to {
            transform: scale(1);
          }
        }

        @keyframes slideInLeft {
          from {
            transform: translateX(-30px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
