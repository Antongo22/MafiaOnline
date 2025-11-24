interface RoleDisplayProps {
  myRole: string | null;
  revealedRoles: { [key: string]: string };
  gameStatus: string;
}

interface RoleInfo {
  name: string;
  description: string;
  team: "Good" | "Evil" | "Neutral";
  emoji: string;
}

const ROLE_INFO: { [key: string]: RoleInfo } = {
  Citizen: { 
    name: "Мирный житель", 
    description: "Обычный игрок, его цель выжить", 
    team: "Good",
    emoji: "👤"
  },
  Doctor: { 
    name: "Доктор", 
    description: "Задача каждую ночь лечить потенциальных жертв мафии", 
    team: "Good",
    emoji: "⚕️"
  },
  Sheriff: { 
    name: "Шериф", 
    description: "Главный враг мафии, ведь он может проверить документы, и тем самым обнаруживать мафию", 
    team: "Good",
    emoji: "🎖️"
  },
  Immortal: { 
    name: "Бессмертный", 
    description: "Его нельзя убить ночью, но на голосовании он не защищён", 
    team: "Good",
    emoji: "💎"
  },
  Prostitute: { 
    name: "Путана", 
    description: "Ночью забирает одного игрока к себе. Если его пытались убить - он выживает. Однако если убьют путану, то игрок тоже умрёт", 
    team: "Good",
    emoji: "💋"
  },
  Thief: { 
    name: "Вор", 
    description: "Крадёт у игрока все его инструменты и голос. Ночью его действия не считаются, а так же днём он не может голосовать", 
    team: "Good",
    emoji: "🥷"
  },
  Spy: { 
    name: "Наблюдатель", 
    description: "Мирный игрок, которому не спится. Просыпается вместе с мафией, и эмитирует что он тоже мафия", 
    team: "Good",
    emoji: "👁️"
  },
  Hunter: { 
    name: "Охотник", 
    description: "Мирный житель с немирными целями. Охотится на мафию и может убивать ночью. Но от ошибок никто не застрахован", 
    team: "Good",
    emoji: "🏹"
  },
  Don: { 
    name: "Дон мафии", 
    description: "Главарь мафии, который может искать шерифа. Так же его голос считается за 2", 
    team: "Evil",
    emoji: "🎩"
  },
  Mafia: { 
    name: "Мафия", 
    description: "Само зло. Цель - сделать так, чтобы в живых остались только члены мафии", 
    team: "Evil",
    emoji: "🔫"
  },
  Ninja: { 
    name: "Ниндзя", 
    description: "Играет за мафию. В свой ход кидает сюрикен на жертву. Если на игроке 2 сюрикена, то он умирает", 
    team: "Evil",
    emoji: "⚔️"
  },
  Maniac: { 
    name: "Маньяк", 
    description: "Настоящий псих одиночка. Все ему враги и он враг всем. Если останется 1 на 1 с мафией/мирным, то он победил", 
    team: "Neutral",
    emoji: "🔪"
  },
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
  // Показываем роль игрока во время игры
  if (gameStatus === "InProgress" && myRole) {
    const roleInfo = ROLE_INFO[myRole];
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
          <div style={{ fontSize: "4rem" }}>{roleInfo.emoji}</div>
          
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
            const roleInfo = ROLE_INFO[role];
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
                <div style={{ fontSize: "2rem" }}>{roleInfo.emoji}</div>
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
