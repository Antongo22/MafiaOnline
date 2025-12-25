import { useState } from "react";
import type { User } from "../services/chatService";

interface NightActionPanelProps {
  users: User[];
  currentUserId: string;
  nightPhase: string;
  onAction: (targetId?: string, actionType?: string) => void;
  canAct: boolean;
}

const ACTION_DESCRIPTIONS: Record<string, { title: string; description: string; needsTarget: boolean }> = {
  Don: {
    title: "Поиск шерифа",
    description: "Выберите игрока для проверки. Если это шериф, его карта откроется для вас.",
    needsTarget: true
  },
  Mafia: {
    title: "Выбор жертвы",
    description: "Проголосуйте за игрока, которого мафия убьёт этой ночью.",
    needsTarget: true
  },
  Maniac: {
    title: "Действие маньяка",
    description: "Убейте игрока или вылечите себя (1 раз за игру).",
    needsTarget: false
  },
  Sheriff: {
    title: "Проверка игрока",
    description: "Выберите игрока для проверки. Если он мафия, его карта откроется для вас.",
    needsTarget: true
  },
  Doctor: {
    title: "Лечение",
    description: "Выберите игрока для лечения. Можете вылечить себя.",
    needsTarget: true
  },
  Prostitute: {
    title: "Забрать игрока",
    description: "Заберите игрока к себе. Если его пытаются убить, он выживет. Если убьют вас, он умрёт с вами.",
    needsTarget: true
  }
};

export function NightActionPanel({
  users,
  currentUserId,
  nightPhase,
  onAction,
  canAct
}: NightActionPanelProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [actionType, setActionType] = useState<string | null>(null);
  const [hasActed, setHasActed] = useState(false);

  const aliveUsers = users.filter(u => 
    u.status !== "Leave" && 
    u.isAlive !== false &&
    u.id !== currentUserId // Для большинства ролей нельзя выбрать себя
  );

  const actionInfo = ACTION_DESCRIPTIONS[nightPhase];

  if (!canAct || !actionInfo) {
    return (
      <div style={{
        background: "var(--bg-secondary)",
        border: "2px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "2rem",
        textAlign: "center"
      }}>
        <div style={{ fontSize: "1.25rem", color: "var(--text-secondary)" }}>
          {hasActed ? "Действие выполнено ✓" : "Не ваш ход..."}
        </div>
      </div>
    );
  }

  const handleAction = () => {
    if (hasActed) return;

    if (nightPhase === "Maniac" && actionType === "heal_self") {
      onAction(undefined, "heal_self");
      setHasActed(true);
    } else if (nightPhase === "Doctor" && actionType === "heal_self") {
      onAction(currentUserId, undefined);
      setHasActed(true);
    } else if (selectedTarget) {
      onAction(selectedTarget, undefined);
      setHasActed(true);
    }
  };

  return (
    <div style={{
      background: "var(--bg-secondary)",
      border: "2px solid var(--danger)",
      borderRadius: "var(--radius-lg)",
      padding: "2rem",
      boxShadow: "0 4px 20px rgba(239, 68, 68, 0.3)"
    }}>
      <h3 style={{
        margin: "0 0 0.5rem 0",
        fontSize: "1.5rem",
        color: "var(--danger)",
        textAlign: "center"
      }}>
        {actionInfo.title}
      </h3>

      <p style={{
        margin: "0 0 1.5rem 0",
        color: "var(--text-secondary)",
        textAlign: "center",
        fontSize: "0.875rem"
      }}>
        {actionInfo.description}
      </p>

      {/* Особые действия для маньяка */}
      {nightPhase === "Maniac" && (
        <div style={{ marginBottom: "1.5rem", display: "flex", gap: "1rem" }}>
          <button
            onClick={() => setActionType("kill")}
            disabled={hasActed}
            style={{
              flex: 1,
              padding: "1rem",
              background: actionType === "kill" ? "var(--danger)" : "var(--bg-tertiary)",
              color: actionType === "kill" ? "white" : "var(--text-primary)",
              border: `2px solid ${actionType === "kill" ? "var(--danger)" : "var(--border)"}`,
              borderRadius: "var(--radius)",
              cursor: hasActed ? "not-allowed" : "pointer",
              fontWeight: actionType === "kill" ? "600" : "normal",
              opacity: hasActed ? 0.5 : 1
            }}
          >
            Убить игрока
          </button>
          <button
            onClick={() => {
              setActionType("heal_self");
              setSelectedTarget(null);
            }}
            disabled={hasActed}
            style={{
              flex: 1,
              padding: "1rem",
              background: actionType === "heal_self" ? "var(--success)" : "var(--bg-tertiary)",
              color: actionType === "heal_self" ? "white" : "var(--text-primary)",
              border: `2px solid ${actionType === "heal_self" ? "var(--success)" : "var(--border)"}`,
              borderRadius: "var(--radius)",
              cursor: hasActed ? "not-allowed" : "pointer",
              fontWeight: actionType === "heal_self" ? "600" : "normal",
              opacity: hasActed ? 0.5 : 1
            }}
          >
            Вылечить себя
          </button>
        </div>
      )}

      {/* Особые действия для доктора */}
      {nightPhase === "Doctor" && (
        <div style={{ marginBottom: "1.5rem" }}>
          <button
            onClick={() => {
              setActionType("heal_self");
              setSelectedTarget(null);
            }}
            disabled={hasActed}
            style={{
              width: "100%",
              padding: "1rem",
              background: actionType === "heal_self" ? "var(--success)" : "var(--bg-tertiary)",
              color: actionType === "heal_self" ? "white" : "var(--text-primary)",
              border: `2px solid ${actionType === "heal_self" ? "var(--success)" : "var(--border)"}`,
              borderRadius: "var(--radius)",
              cursor: hasActed ? "not-allowed" : "pointer",
              fontWeight: actionType === "heal_self" ? "600" : "normal",
              opacity: hasActed ? 0.5 : 1
            }}
          >
            Вылечить себя
          </button>
        </div>
      )}

      {/* Выбор цели (если нужен) */}
      {(actionInfo.needsTarget || (nightPhase === "Maniac" && actionType === "kill")) && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem"
        }}>
          {aliveUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => {
                setSelectedTarget(user.id);
                if (nightPhase === "Maniac") setActionType("kill");
              }}
              disabled={hasActed}
              style={{
                padding: "1rem",
                background: selectedTarget === user.id 
                  ? "var(--danger)" 
                  : "var(--bg-tertiary)",
                color: selectedTarget === user.id 
                  ? "white" 
                  : "var(--text-primary)",
                border: `2px solid ${selectedTarget === user.id ? "var(--danger)" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                cursor: hasActed ? "not-allowed" : "pointer",
                fontWeight: selectedTarget === user.id ? "600" : "normal",
                transition: "all 0.2s",
                opacity: hasActed ? 0.5 : 1
              }}
            >
              {user.name}
              {user.status === "Admin" && " 👑"}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={handleAction}
        disabled={
          hasActed || 
          (actionInfo.needsTarget && !selectedTarget && actionType !== "heal_self") ||
          (nightPhase === "Maniac" && !actionType)
        }
        className="btn-primary"
        style={{
          width: "100%",
          padding: "1rem",
          fontSize: "1.125rem",
          fontWeight: "600",
          background: "var(--danger)"
        }}
      >
        {hasActed ? "Действие выполнено ✓" : "Выполнить действие"}
      </button>
    </div>
  );
}

