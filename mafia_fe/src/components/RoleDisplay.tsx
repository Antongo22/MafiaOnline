import { useState, useEffect } from "react";
import { rolesService, type RoleInfo } from "../services/rolesService";

interface RoleDisplayProps {
  myRole: string | null;
  revealedRoles: { [key: string]: string };
  gameStatus: string;
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

const getTeamColor = (team: string) => {
  switch (team) {
    case "Good": return { bg: "#10b98133", border: "#10b981", text: "#10b981" };
    case "Evil": return { bg: "#ef444433", border: "#ef4444", text: "#ef4444" };
    case "Neutral": return { bg: "#a855f733", border: "#a855f7", text: "#a855f7" };
    default: return { bg: "var(--bg-secondary)", border: "var(--border)", text: "var(--text-primary)" };
  }
};

const getTeamName = (team: string) => {
  switch (team) {
    case "Good": return "Мирные жители";
    case "Evil": return "Мафия";
    case "Neutral": return "Нейтральный";
    default: return "Неизвестно";
  }
};

export function RoleDisplay({ myRole, revealedRoles, gameStatus }: RoleDisplayProps) {
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
    return ROLE_EMOJI[roleValue] || "❓";
  };

  // Показываем роль игрока во время игры
  if (gameStatus === "InProgress" && myRole) {
    const roleInfo = getRoleInfo(myRole);
    if (!roleInfo) return null;
    
    const colors = getTeamColor(roleInfo.team);
    
    return (
      <div className="card" style={{ 
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        animation: "fadeIn 0.5s ease-out"
      }}>
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "1rem",
          alignItems: "center",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "4rem" }}>{getRoleEmoji(myRole)}</div>
          
          <div>
            <h2 style={{ 
              margin: 0, 
              color: colors.text,
              fontSize: "1.5rem",
              fontWeight: "700"
            }}>
              {roleInfo.name}
            </h2>
            <div style={{
              marginTop: "0.25rem",
              padding: "0.25rem 0.75rem",
              background: colors.border,
              color: "white",
              borderRadius: "1rem",
              fontSize: "0.75rem",
              fontWeight: "500",
              display: "inline-block"
            }}>
              {getTeamName(roleInfo.team)}
            </div>
          </div>
          
          <p style={{ 
            margin: 0, 
            color: "var(--text-primary)",
            fontSize: "0.95rem",
            lineHeight: "1.6",
            maxWidth: "500px"
          }}>
            {roleInfo.description}
          </p>
          
          <div style={{
            padding: "0.75rem 1rem",
            background: "var(--bg-primary)",
            borderRadius: "var(--radius)",
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)"
          }}>
            🤫 Держите свою роль в секрете!
          </div>
        </div>
      </div>
    );
  }
  
  // Показываем все роли после окончания игры
  if (gameStatus === "Finished" && Object.keys(revealedRoles).length > 0) {
    return (
      <div className="card">
        <h3 style={{ margin: "0 0 1rem 0" }}>🎭 Роли игроков</h3>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: "0.75rem"
        }}>
          {Object.entries(revealedRoles).map(([playerName, role]) => {
            const roleInfo = getRoleInfo(role);
            if (!roleInfo) return null;
            
            const colors = getTeamColor(roleInfo.team);
            
            return (
              <div
                key={playerName}
                style={{
                  padding: "0.75rem",
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "var(--radius)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  animation: "fadeIn 0.3s ease-out"
                }}
              >
                <div style={{ fontSize: "2rem" }}>{getRoleEmoji(role)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontWeight: "600",
                    fontSize: "0.875rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}>
                    {playerName}
                  </div>
                  <div style={{ 
                    fontSize: "0.75rem",
                    color: colors.text,
                    fontWeight: "500"
                  }}>
                    {roleInfo.name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  
  return null;
}
