import { useEffect } from "react";

interface VotingResultsModalProps {
  isOpen: boolean;
  eliminated: Array<{ userName: string; role: string }>;
  tie: boolean;
  onClose: () => void;
}

export function VotingResultsModal({ isOpen, eliminated, tie, onClose }: VotingResultsModalProps) {
  // Автоматическое закрытие через 4 секунды
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      
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
          padding: "3rem",
          maxWidth: "600px",
          width: "90%",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
          border: tie ? "3px solid var(--warning)" : hasEliminated ? "3px solid var(--danger)" : "3px solid var(--info)",
          animation: "slideIn 0.4s ease-out",
          position: "relative"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Иконка */}
        <div
          style={{
            fontSize: "5rem",
            textAlign: "center",
            marginBottom: "1.5rem",
            animation: "scaleIn 0.5s ease-out"
          }}
        >
          {tie ? "🤝" : hasEliminated ? "⚖️" : "🗳️"}
        </div>

        {/* Заголовок */}
        <h2
          style={{
            fontSize: "2rem",
            fontWeight: "700",
            textAlign: "center",
            marginBottom: "2rem",
            color: tie ? "var(--warning)" : hasEliminated ? "var(--danger)" : "var(--info)",
            textShadow: "0 2px 10px rgba(0, 0, 0, 0.3)"
          }}
        >
          {tie ? "Ничья!" : hasEliminated ? "Результаты голосования" : "Голосование завершено"}
        </h2>

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
                fontSize: "1.5rem",
                color: "var(--warning)",
                fontWeight: "500"
              }}
            >
              Голоса разделились поровну. Никто не был исключён! 🤷
            </p>
          ) : hasEliminated ? (
            <div>
              <p
                style={{
                  fontSize: "1.25rem",
                  color: "var(--text-secondary)",
                  marginBottom: "1.5rem"
                }}
              >
                Город принял решение:
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem"
                }}
              >
                {eliminated.map((victim, index) => (
                  <div
                    key={index}
                    style={{
                      background: "var(--bg-primary)",
                      padding: "1.5rem",
                      borderRadius: "var(--radius-lg)",
                      border: "2px solid var(--danger)",
                      animation: `slideInLeft 0.5s ease-out ${index * 0.1}s both`
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: "600",
                        color: "var(--text-primary)",
                        marginBottom: "0.5rem"
                      }}
                    >
                      {victim.userName}
                    </div>
                    <div
                      style={{
                        fontSize: "1.125rem",
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
                fontSize: "1.5rem",
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
