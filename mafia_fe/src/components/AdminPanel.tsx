import { useState, useEffect } from "react";

interface AdminPanelProps {
  roomId: string;
  userId: string;
  gameStatus: string;
  playerCount: number;
  apiUrl: string;
  onStatusChange: (newStatus: string) => void;
}

interface RoleCount {
  [key: string]: number;
}

interface RoleInfo {
  name: string;
  value: string;
  description: string;
  team: "good" | "evil" | "neutral";
}

const AVAILABLE_ROLES: RoleInfo[] = [
  { name: "Мирный житель", value: "Citizen", description: "Обычный игрок, его цель выжить", team: "good" },
  { name: "Доктор", value: "Doctor", description: "Задача каждую ночь лечить потенциальных жертв мафии", team: "good" },
  { name: "Шериф", value: "Sheriff", description: "Главный враг мафии, ведь он может проверить документы, и тем самым обнаруживать мафию", team: "good" },
  { name: "Бессмертный", value: "Immortal", description: "Его нельзя убить ночью, но на голосовании он не защищён", team: "good" },
  { name: "Путана", value: "Prostitute", description: "Ночью забирает одного игрока к себе. Если его пытались убить - он выживает. Однако если убьют путану, то игрок тоже умрёт", team: "good" },
  { name: "Вор", value: "Thief", description: "Крадёт у игрока все его инструменты и голос. Ночью его действия не считаются, а так же днём он не может голосовать", team: "good" },
  { name: "Наблюдатель", value: "Spy", description: "Мирный игрок, которому не спится. Просыпается вместе с мафией, и эмитирует что он тоже мафия", team: "good" },
  { name: "Охотник", value: "Hunter", description: "Мирный житель с немирными целями. Охотится на мафию и может убивать ночью. Но от ошибок никто не застрахован", team: "good" },
  { name: "Дон мафии", value: "Don", description: "Главарь мафии, который может искать шерифа. Так же его голос считается за 2", team: "evil" },
  { name: "Мафия", value: "Mafia", description: "Само зло. Цель - сделать так, чтобы в живых остались только члены мафии", team: "evil" },
  { name: "Ниндзя", value: "Ninja", description: "Играет за мафию. В свой ход кидает сюрикен на жертву. Если на игроке 2 сюрикена, то он умирает", team: "evil" },
  { name: "Маньяк", value: "Maniac", description: "Настоящий псих одиночка. Все ему враги и он враг всем. Если останется 1 на 1 с мафией/мирным, то он победил", team: "neutral" },
];

// Минимальная конфигурация для разного количества игроков
const getDefaultRoles = (playerCount: number): RoleCount => {
  if (playerCount < 4) {
    return {
      Citizen: Math.max(1, playerCount - 1),
      Mafia: 1,
    };
  } else if (playerCount <= 6) {
    return {
      Citizen: playerCount - 2,
      Mafia: 1,
      Sheriff: 1,
    };
  } else if (playerCount <= 9) {
    return {
      Citizen: playerCount - 3,
      Mafia: 2,
      Sheriff: 1,
    };
  } else {
    return {
      Citizen: playerCount - 4,
      Mafia: 2,
      Don: 1,
      Sheriff: 1,
    };
  }
};

export function AdminPanel({ roomId, userId, gameStatus, playerCount, apiUrl, onStatusChange }: AdminPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleCounts, setRoleCounts] = useState<RoleCount>({});
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);

  // Инициализируем роли при изменении количества игроков
  useEffect(() => {
    if (gameStatus === "Waiting") {
      setRoleCounts(getDefaultRoles(playerCount));
    }
  }, [playerCount, gameStatus]);

  const totalRoles = Object.values(roleCounts).reduce((sum, count) => sum + count, 0);

  const handleRoleChange = (role: string, delta: number) => {
    setRoleCounts(prev => ({
      ...prev,
      [role]: Math.max(0, (prev[role] || 0) + delta)
    }));
  };

  const handleStartGame = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/Game/start?roomId=${roomId}&adminId=${userId}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      onStatusChange(result.status);
      
      // Инициализируем роли после старта
      setRoleCounts(getDefaultRoles(playerCount));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start game");
    } finally {
      setLoading(false);
    }
  };

  const handleDistributeRoles = async () => {
    if (totalRoles !== playerCount) {
      setError(`Количество ролей (${totalRoles}) должно равняться количеству игроков (${playerCount})`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Сначала сохраняем роли
      const selectResponse = await fetch(`${apiUrl}/api/Game/select-roles?roomId=${roomId}&adminId=${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roleCounts),
      });
      if (!selectResponse.ok) throw new Error(await selectResponse.text());
      
      // Затем раздаем их
      const distributeResponse = await fetch(`${apiUrl}/api/Game/distribute-roles?roomId=${roomId}&adminId=${userId}`, {
        method: "POST",
      });
      if (!distributeResponse.ok) throw new Error(await distributeResponse.text());
      
      const result = await distributeResponse.json();
      onStatusChange(result.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to distribute roles");
    } finally {
      setLoading(false);
    }
  };

  const handleFinishGame = async () => {
    if (!window.confirm("Завершить игру?")) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/Game/finish?roomId=${roomId}&adminId=${userId}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      onStatusChange(result.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish game");
    } finally {
      setLoading(false);
    }
  };

  const handleResetGame = async () => {
    if (!window.confirm("Начать новую игру? Игроки со статусом 'Вышел' будут удалены.")) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/Game/reset?roomId=${roomId}&adminId=${userId}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      onStatusChange(result.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset game");
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (team: string) => {
    switch (team) {
      case "good": return "#10b981";
      case "evil": return "#ef4444";
      case "neutral": return "#f59e0b";
      default: return "var(--text-primary)";
    }
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span>👑</span>
        <span>Панель управления</span>
      </h3>

      {error && (
        <div style={{
          padding: "0.75rem",
          background: "var(--danger-light)",
          color: "var(--danger)",
          border: "1px solid var(--danger)",
          borderRadius: "var(--radius)",
          fontSize: "0.875rem",
        }}>
          {error}
        </div>
      )}

      {gameStatus === "Created" && (
        <>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Набор игроков завершен. Начните игру для выбора ролей.
          </p>
          <button
            onClick={handleStartGame}
            disabled={loading || playerCount < 2}
            className="btn-primary w-full"
          >
            {loading ? "..." : "🎮 Начать игру"}
          </button>
          {playerCount < 2 && (
            <p style={{ margin: 0, color: "var(--warning)", fontSize: "0.75rem", textAlign: "center" }}>
              Нужно минимум 2 игрока
            </p>
          )}
        </>
      )}

      {gameStatus === "Waiting" && (
        <>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Выберите роли для игры. Всего игроков: <strong>{playerCount}</strong>
          </p>

          <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            gap: "0.5rem",
            maxHeight: "400px",
            overflowY: "auto",
            paddingRight: "0.5rem"
          }}>
            {AVAILABLE_ROLES.map(role => {
              const count = roleCounts[role.value] || 0;
              const isHovered = hoveredRole === role.value;
              
              return (
                <div key={role.value}>
                  <div 
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.75rem",
                      background: count > 0 ? "var(--bg-hover)" : "var(--bg-tertiary)",
                      borderRadius: "var(--radius)",
                      border: `1px solid ${count > 0 ? getRoleColor(role.team) : "var(--border)"}`,
                      position: "relative",
                      cursor: "help",
                    }}
                    onMouseEnter={() => setHoveredRole(role.value)}
                    onMouseLeave={() => setHoveredRole(null)}
                  >
                    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                      <span style={{ 
                        fontSize: "0.875rem", 
                        fontWeight: "500",
                        color: count > 0 ? getRoleColor(role.team) : "inherit"
                      }}>
                        {role.name}
                      </span>
                      {count > 0 && (
                        <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginTop: "2px" }}>
                          {role.team === "good" ? "Мирные" : role.team === "evil" ? "Мафия" : "Нейтрал"}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <button
                        onClick={() => handleRoleChange(role.value, -1)}
                        disabled={loading || count === 0}
                        className="btn-secondary btn-sm"
                        style={{ padding: "0.25rem 0.5rem", minWidth: "30px" }}
                      >
                        −
                      </button>
                      <span style={{
                        minWidth: "30px",
                        textAlign: "center",
                        fontWeight: "600",
                        color: count > 0 ? getRoleColor(role.team) : "var(--text-muted)"
                      }}>
                        {count}
                      </span>
                      <button
                        onClick={() => handleRoleChange(role.value, 1)}
                        disabled={loading}
                        className="btn-secondary btn-sm"
                        style={{ padding: "0.25rem 0.5rem", minWidth: "30px" }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  
                  {/* Подсказка при наведении */}
                  {isHovered && (
                    <div style={{
                      marginTop: "0.25rem",
                      padding: "0.5rem",
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      animation: "fadeIn 0.2s ease-out"
                    }}>
                      {role.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{
            padding: "0.75rem",
            background: totalRoles === playerCount ? "var(--success-light)" : "var(--warning)",
            color: totalRoles === playerCount ? "var(--success)" : "var(--text-primary)",
            borderRadius: "var(--radius)",
            textAlign: "center",
            fontSize: "0.875rem",
            fontWeight: "500"
          }}>
            Всего ролей: {totalRoles} / {playerCount}
          </div>

          <button
            onClick={handleDistributeRoles}
            disabled={loading || totalRoles !== playerCount}
            className="btn-primary w-full"
          >
            {loading ? "..." : "🎲 Раздать роли и начать"}
          </button>
        </>
      )}

      {gameStatus === "InProgress" && (
        <>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Игра в процессе. Роли розданы.
          </p>
          <button
            onClick={handleFinishGame}
            disabled={loading}
            className="btn-danger w-full"
          >
            {loading ? "..." : "🏁 Завершить игру"}
          </button>
        </>
      )}

      {gameStatus === "Finished" && (
        <>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Игра завершена. Роли всех игроков раскрыты.
          </p>
          <button
            onClick={handleResetGame}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "..." : "🔄 Играть заново"}
          </button>
        </>
      )}
    </div>
  );
}
