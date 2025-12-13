import { useState, useEffect } from "react";
import { gameService } from "../services/gameService";

interface AdminPanelProps {
  roomId: string;
  userId: string;
  gameStatus: string;
  playerCount: number;
  apiUrl: string;
  onStatusChange: (newStatus: string) => void;
  gameCycleStarted?: boolean;
  isPaused?: boolean;
}

interface RoleCount {
  [key: string]: number;
}

interface RoleInfo {
  roleValue: string;
  name: string;
  description: string;
  team: string;
  isUnique: boolean;
}

// Минимальная конфигурация для разного количества игроков
const getDefaultRoles = (playerCount: number): RoleCount => {
  if (playerCount < 4) {
    // Минимум 4 игрока, но на всякий случай оставляем обработку
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

const getTeamColor = (team: string) => {
  switch (team) {
    case "Good": return "#10b981"; // зеленый
    case "Evil": return "#ef4444"; // красный
    case "Neutral": return "#a855f7"; // фиолетовый
    default: return "var(--text-primary)";
  }
};

const getTeamName = (team: string) => {
  switch (team) {
    case "Good": return "Мирные";
    case "Evil": return "Мафия";
    case "Neutral": return "Нейтрал";
    default: return "";
  }
};

export function AdminPanel({ roomId, userId, gameStatus, playerCount, apiUrl, onStatusChange, gameCycleStarted, isPaused }: AdminPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleCounts, setRoleCounts] = useState<RoleCount>({});
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<RoleInfo[]>([]);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  // Загружаем доступные роли с backend
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/Game/available-roles`);
        if (response.ok) {
          const roles: RoleInfo[] = await response.json();
          setAvailableRoles(roles);
        }
      } catch (err) {
        console.error("Failed to fetch roles:", err);
      }
    };
    fetchRoles();
  }, [apiUrl]);

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

  const handleMouseEnter = (roleValue: string, event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredRole(roleValue);
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };

  const handleMouseLeave = () => {
    setHoveredRole(null);
    setTooltipPosition(null);
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

  const handleStartGameCycle = async () => {
    if (!window.confirm("Начать игровой цикл? Игра автоматически пройдёт все фазы.")) return;

    setLoading(true);
    setError(null);

    try {
      await gameService.startGameCycle(roomId, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start game cycle");
    } finally {
      setLoading(false);
    }
  };

  const handlePauseGame = async () => {
    setLoading(true);
    setError(null);

    try {
      await gameService.pauseGame(roomId, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pause game");
    } finally {
      setLoading(false);
    }
  };

  const handleResumeGame = async () => {
    setLoading(true);
    setError(null);

    try {
      await gameService.resumeGame(roomId, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume game");
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

  const hoveredRoleInfo = availableRoles.find(r => r.roleValue === hoveredRole);

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
            disabled={loading || playerCount < 4}
            className="btn-primary w-full"
          >
            {loading ? "..." : "🎮 Начать игру"}
          </button>
          {playerCount < 4 && (
            <p style={{ margin: 0, color: "var(--warning)", fontSize: "0.75rem", textAlign: "center" }}>
              Нужно минимум 4 игрока
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
            overflowX: "hidden",
            paddingRight: "0.5rem"
          }}>
            {availableRoles.map(role => {
              const count = roleCounts[role.roleValue] || 0;
              const teamColor = getTeamColor(role.team);
              
              return (
                <div 
                  key={role.roleValue}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 1rem",
                    background: count > 0 ? "var(--bg-hover)" : "var(--bg-tertiary)",
                    borderRadius: "var(--radius)",
                    border: `1px solid ${count > 0 ? teamColor : "var(--border)"}`,
                    position: "relative",
                    cursor: "help"
                  }}
                  onMouseEnter={(e) => handleMouseEnter(role.roleValue, e)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                    <span style={{ 
                      fontSize: "0.875rem", 
                      fontWeight: "500",
                      color: count > 0 ? teamColor : "inherit",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}>
                      {role.name}
                    </span>
                    {count > 0 && (
                      <span style={{ fontSize: "0.625rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        {getTeamName(role.team)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <button
                      onClick={() => handleRoleChange(role.roleValue, -1)}
                      disabled={loading || count === 0}
                      className="btn-secondary btn-sm"
                      style={{ padding: "0.375rem 0.75rem", minWidth: "36px", fontSize: "1rem" }}
                    >
                      −
                    </button>
                    <span style={{
                      minWidth: "40px",
                      textAlign: "center",
                      fontWeight: "600",
                      fontSize: "1rem",
                      color: count > 0 ? teamColor : "var(--text-muted)"
                    }}>
                      {count}
                    </span>
                    <button
                      onClick={() => handleRoleChange(role.roleValue, 1)}
                      disabled={loading || (role.isUnique && count >= 1)}
                      className="btn-secondary btn-sm"
                      style={{ padding: "0.375rem 0.75rem", minWidth: "36px", fontSize: "1rem" }}
                      title={role.isUnique && count >= 1 ? "Эта роль уникальная (макс. 1)" : ""}
                    >
                      +
                    </button>
                  </div>
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
            {gameCycleStarted 
              ? isPaused 
                ? "⏸️ Игра на паузе" 
                : "▶️ Игра в процессе. Следите за фазами игры." 
              : "Игра в процессе. Роли розданы."}
          </p>
          
          {!gameCycleStarted && (
            <button
              onClick={handleStartGameCycle}
              disabled={loading}
              className="btn-primary w-full"
              style={{ marginBottom: "0.5rem" }}
            >
              {loading ? "..." : "▶️ Начать игровой цикл"}
            </button>
          )}
          
          {gameCycleStarted && (
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <button
                onClick={isPaused ? handleResumeGame : handlePauseGame}
                disabled={loading}
                className={isPaused ? "btn-primary" : "btn-secondary"}
                style={{ flex: 1 }}
              >
                {loading ? "..." : isPaused ? "▶️ Продолжить" : "⏸️ Пауза"}
              </button>
            </div>
          )}
          
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

      {/* Всплывающая подсказка */}
      {hoveredRole && hoveredRoleInfo && tooltipPosition && (
        <div style={{
          position: "fixed",
          left: `${tooltipPosition.x}px`,
          top: `${tooltipPosition.y}px`,
          transform: "translate(-50%, -100%)",
          padding: "0.75rem 1rem",
          background: "var(--bg-primary)",
          border: `2px solid ${getTeamColor(hoveredRoleInfo.team)}`,
          borderRadius: "var(--radius)",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
          zIndex: 9999,
          maxWidth: "300px",
          pointerEvents: "none",
          animation: "fadeIn 0.15s ease-out"
        }}>
          <div style={{
            fontSize: "0.875rem",
            fontWeight: "600",
            color: getTeamColor(hoveredRoleInfo.team),
            marginBottom: "0.25rem"
          }}>
            {hoveredRoleInfo.name}
          </div>
          <div style={{
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            lineHeight: "1.4"
          }}>
            {hoveredRoleInfo.description}
          </div>
          {/* Стрелка вниз */}
          <div style={{
            position: "absolute",
            bottom: "-8px",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: `8px solid ${getTeamColor(hoveredRoleInfo.team)}`
          }} />
        </div>
      )}
    </div>
  );
}
