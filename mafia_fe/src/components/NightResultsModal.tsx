interface NightResultsModalProps {
  isOpen: boolean;
  killed: Array<{ userName: string; role: string }>;
  onClose: () => void;
}

export function NightResultsModal({ isOpen, killed, onClose }: NightResultsModalProps) {
  if (!isOpen) return null;

  const hasDeaths = killed && killed.length > 0;

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
          border: hasDeaths ? "3px solid var(--danger)" : "3px solid var(--success)",
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
          {hasDeaths ? "☠️" : "🌅"}
        </div>

        {/* Заголовок */}
        <h2
          style={{
            fontSize: "2rem",
            fontWeight: "700",
            textAlign: "center",
            marginBottom: "2rem",
            color: hasDeaths ? "var(--danger)" : "var(--success)",
            textShadow: "0 2px 10px rgba(0, 0, 0, 0.3)"
          }}
        >
          {hasDeaths ? "Результаты ночи" : "Спокойная ночь"}
        </h2>

        {/* Контент */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "2rem"
          }}
        >
          {hasDeaths ? (
            <div>
              <p
                style={{
                  fontSize: "1.25rem",
                  color: "var(--text-secondary)",
                  marginBottom: "1.5rem"
                }}
              >
                Этой ночью погибли:
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem"
                }}
              >
                {killed.map((victim, index) => (
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
                color: "var(--success)",
                fontWeight: "500"
              }}
            >
              Эта ночь прошла спокойно. Никто не погиб! 🎉
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
            background: hasDeaths ? "var(--danger)" : "var(--success)",
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
