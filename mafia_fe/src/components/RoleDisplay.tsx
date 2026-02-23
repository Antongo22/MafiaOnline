import { useState, useEffect } from "react";
import { rolesService, type RoleInfo } from "../services/rolesService";
import type { User } from "../services/chatService";
import { GamePhase } from "../types/game";

interface RoleDisplayProps {
  myRole: string | null;
  revealedRoles: { [key: string]: string };
  gameStatus: string;
  users: User[];
  currentSpeakerId?: string;
  currentVoterId?: string;
  gamePhase?: string;
  userId?: string | null;
  isAdmin?: boolean;
  onKick?: (userId: string) => void;
}

const ROLE_EMOJI: { [key: string]: string } = {
  Citizen: "👤",
  Doctor: "⚕️",
  Sheriff: "🎖️",
  Immortal: "💎",
  Prostitute: "💋",
  Thief: "🥷",
  Spy: "👁️",
  Hunter: "🏹",
  Don: "🎩",
  Mafia: "🔫",
  Ninja: "⚔️",
  Maniac: "🔪",
};

const getTeamColor = (team?: string) => {
  switch (team) {
    case "Good": return { bg: "#10b98115", border: "#10b981", text: "#10b981", light: "#10b98133" };
    case "Evil": return { bg: "#ef444415", border: "#ef4444", text: "#ef4444", light: "#ef444433" };
    case "Neutral": return { bg: "#a855f715", border: "#a855f7", text: "#a855f7", light: "#a855f733" };
    default: return { bg: "var(--bg-tertiary)", border: "var(--border)", text: "var(--text-secondary)", light: "var(--bg-secondary)" };
  }
};

const getTeamName = (team: string) => {
  switch (team) {
    case "Good": return "Мирные";
    case "Evil": return "Мафия";
    case "Neutral": return "Нейтрал";
    default: return "Неизвестно";
  }
};

export function RoleDisplay({
  myRole,
  revealedRoles,
  gameStatus,
  users,
  currentSpeakerId,
  currentVoterId,
  gamePhase,
  userId,
  isAdmin,
  onKick
}: RoleDisplayProps) {
  const [roles, setRoles] = useState<RoleInfo[]>([]);

  useEffect(() => {
    const loadRoles = async () => {
      const rolesData = await rolesService.getRoles();
      setRoles(rolesData);
    };
    loadRoles();
  }, []);

  const getRoleInfo = (roleValue: string): RoleInfo | undefined => {
    return roles.find(r => r.roleValue === roleValue);
  };

  const getRoleEmoji = (roleValue: string): string => {
    return ROLE_EMOJI[roleValue] || "👤";
  };

  // 1. Показываем карточку СОБСТВЕННОЙ роли отдельным блоком, если игра идет
  const renderMyRoleCard = () => {
    if (gameStatus !== "InProgress" || !myRole) return null;

    const roleInfo = getRoleInfo(myRole);
    if (!roleInfo) return null;
    const colors = getTeamColor(roleInfo.team);

    return (
      <div className="card" style={{
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        marginBottom: "1.5rem",
        animation: "slideDown 0.5s ease-out",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{
          position: "absolute",
          top: "-20px",
          right: "-20px",
          fontSize: "8rem",
          opacity: 0.1,
          transform: "rotate(15deg)",
          pointerEvents: "none"
        }}>
          {getRoleEmoji(myRole)}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", position: "relative", zIndex: 1 }}>
          <div style={{
            fontSize: "3.5rem",
            background: colors.light,
            width: "80px",
            height: "80px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-lg)",
            border: `1px solid ${colors.border}44`
          }}>
            {getRoleEmoji(myRole)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem 0.75rem", marginBottom: "0.25rem" }}>
              <h2 style={{
                margin: 0,
                fontSize: "1.5rem",
                fontWeight: "800",
                color: "var(--text-primary)",
                lineHeight: "1.15",
                minWidth: 0,
                overflowWrap: "anywhere",
                wordBreak: "break-word"
              }}>
                {roleInfo.name}
              </h2>
              <span style={{
                padding: "0.25rem 0.6rem",
                background: colors.border,
                color: "white",
                borderRadius: "2rem",
                fontSize: "0.65rem",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                {getTeamName(roleInfo.team)}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.4" }}>
              {roleInfo.description}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {renderMyRoleCard()}

      <div className="card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.125rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>👥 Участники и роли</span>
          </h3>
          <span className="badge" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
            {users.length}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {users.map((user) => {
            const isCurrentUser = user.id === userId;
            const isDead = !user.isAlive;
            const revealedRole = revealedRoles[user.id];
            // Показываем роль: если раскрыта, если это я сам, или если игра закончена
            const displayRole = revealedRole || (isCurrentUser ? myRole : null);
            const roleInfo = displayRole ? getRoleInfo(displayRole) : null;
            const colors = getTeamColor(roleInfo?.team);

            const isActiveSpeaker = gamePhase === GamePhase.IndividualSpeech && user.id === currentSpeakerId;
            const isActiveVoter = gamePhase === GamePhase.Voting && user.id === currentVoterId;
            const isHighlighted = isActiveSpeaker || isActiveVoter;

            return (
              <div
                key={user.id}
                style={{
                  padding: "0.75rem 1rem",
                  background: isHighlighted ? "var(--warning)15" : (displayRole ? colors.bg : "var(--bg-tertiary)"),
                  border: isHighlighted
                    ? "2px solid var(--warning)"
                    : `1px solid ${displayRole ? colors.border : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  opacity: (isDead && gameStatus !== "Finished") ? 0.6 : 1,
                  transition: "all 0.3s ease",
                  position: "relative",
                  boxShadow: isHighlighted ? "0 0 15px var(--warning)44" : "none"
                }}
              >
                {/* Эмодзи роли или стандартный аватар */}
                <div style={{
                  fontSize: "1.5rem",
                  width: "40px",
                  height: "40px",
                  background: displayRole ? colors.light : "var(--bg-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  border: `1px solid ${displayRole ? colors.border : "var(--border)"}44`
                }}>
                  {/* Показываем эмодзи роли, если она известна (особенно после игры), иначе статус (мертв/жив) */}
                  {(displayRole && (gameStatus === "Finished" || !isDead || revealedRole))
                    ? getRoleEmoji(displayRole)
                    : (isDead ? "💀" : "👤")}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{
                      fontWeight: "600",
                      fontSize: "0.95rem",
                      color: (isDead && gameStatus !== "Finished") ? "var(--text-secondary)" : "var(--text-primary)",
                      textDecoration: (isDead && gameStatus !== "Finished") ? "line-through" : "none"
                    }}>
                      {user.name}
                    </span>
                    {isCurrentUser && <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>(Вы)</span>}
                    {user.status === "Admin" && <span title="Администратор">👑</span>}
                  </div>

                  {displayRole && roleInfo && (
                    <div style={{
                      fontSize: "0.75rem",
                      color: colors.text,
                      fontWeight: "500",
                      marginTop: "0.1rem"
                    }}>
                      {roleInfo.name}
                    </div>
                  )}
                </div>

                {/* Индикаторы статуса */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {isActiveSpeaker && (
                    <span className="badge badge-warning" style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
                      🎤 Говорит
                    </span>
                  )}
                  {isActiveVoter && (
                    <span className="badge badge-warning" style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
                      🗳️ Голосует
                    </span>
                  )}
                  {isDead && (
                    <span style={{ fontSize: "0.75rem", color: "var(--danger)", fontWeight: "bold" }}>
                      ВЫБЫЛ
                    </span>
                  )}
                  {/* Кнопка кика - показываем всегда для админа (кроме самого себя) */}
                  {isAdmin && !isCurrentUser && onKick && (
                    <button
                      onClick={() => onKick(user.id)}
                      className="btn-danger btn-sm"
                      style={{
                        padding: "0.3rem 0.6rem",
                        fontSize: "0.85rem",
                        borderRadius: "var(--radius-sm)",
                        minWidth: "32px",
                        lineHeight: "1",
                        fontWeight: "bold",
                        background: "var(--danger)",
                        color: "white",
                        border: "none",
                        boxShadow: "0 2px 4px rgba(239, 68, 68, 0.3)"
                      }}
                      title="Исключить игрока"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
