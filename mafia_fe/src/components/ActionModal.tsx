import { useState } from "react";

/**
 * ActionModal - универсальное модальное окно для всех игровых действий
 * (голосование, ночные действия, выбор цели и т.д.)
 * 
 * Это заменяет старые компоненты VotingPanel и NightActionPanel
 */

interface ActionModalProps {
  isOpen: boolean;  // Показывать ли модальное окно
  title: string;    // Заголовок ("Голосование", "Лечение", и т.д.)
  description: string;  // Описание действия
  players: Array<{ userId: string; userName: string; isCurrentUser?: boolean }>;  // Список игроков для выбора
  extraActions?: Array<{ id: string; label: string; type: "success" | "danger" }>;  // Дополнительные кнопки (например, "Вылечить себя")
  onAction: (targetId?: string, actionType?: string) => void;  // Callback при выборе
  actionButtonText?: string;  // Текст кнопки подтверждения
  isMyTurn: boolean;  // Это мой ход? Если нет - кнопки будут disabled
}

export function ActionModal({
  isOpen,
  title,
  description,
  players,
  extraActions,
  onAction,
  actionButtonText = "Подтвердить",
  isMyTurn
}: ActionModalProps) {
  // State для выбранной цели (игрока)
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  // State для выбранного дополнительного действия (например, "heal_self")
  const [selectedExtraAction, setSelectedExtraAction] = useState<string | null>(null);
  // Флаг что действие уже выполнено (для блокировки повторных нажатий)
  const [hasActed, setHasActed] = useState(false);

  // Если модалка не открыта - не рендерим ничего
  if (!isOpen) return null;

  // Обработчик нажатия кнопки "Подтвердить"
  const handleAction = () => {
    if (hasActed) return;  // Если уже действовали - игнорируем

    // Если выбрано дополнительное действие (например, "Вылечить себя")
    if (selectedExtraAction) {
      onAction(undefined, selectedExtraAction);
    } 
    // Если выбран игрок
    else if (selectedTarget) {
      onAction(selectedTarget);
    }
    setHasActed(true);  // Помечаем что действие выполнено
  };

  // Можно нажать кнопку только если что-то выбрано
  const canSubmit = selectedTarget || selectedExtraAction;

  return (
    // Полноэкранный оверлей (затемненный фон)
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.8)",  // Полупрозрачный черный
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,  // Поверх всего
      padding: "2rem"
    }}>
      {/* Само модальное окно */}
      <div style={{
        background: "var(--bg-secondary)",
        border: isMyTurn ? "3px solid var(--warning)" : "3px solid var(--border)",  // Желтая рамка если мой ход
        borderRadius: "var(--radius-lg)",
        padding: "2rem",
        maxWidth: "600px",
        width: "100%",
        maxHeight: "80vh",
        overflowY: "auto",  // Прокрутка если контент не влезает
        boxShadow: isMyTurn ? "0 8px 40px rgba(251, 191, 36, 0.4)" : "0 8px 40px rgba(0, 0, 0, 0.5)"  // Свечение если мой ход
      }}>
        {/* Заголовок */}
        <h3 style={{
          margin: "0 0 0.5rem 0",
          fontSize: "1.5rem",
          color: isMyTurn ? "var(--warning)" : "var(--text-primary)",  // Желтый если мой ход
          textAlign: "center"
        }}>
          {title}
        </h3>

        {/* Описание действия */}
        <p style={{
          margin: "0 0 1.5rem 0",
          color: "var(--text-secondary)",
          textAlign: "center",
          fontSize: "0.875rem"
        }}>
          {description}
        </p>

        {/* Если не мой ход - показываем информационный блок */}
        {!isMyTurn && (
          <div style={{
            padding: "1rem",
            background: "var(--bg-tertiary)",
            borderRadius: "var(--radius)",
            marginBottom: "1.5rem",
            textAlign: "center",
            color: "var(--text-secondary)"
          }}>
            {hasActed ? "Вы уже сделали выбор ✓" : "Ожидание вашего хода..."}
          </div>
        )}

        {/* Дополнительные действия (например, "Вылечить себя" для Доктора/Маньяка) */}
        {extraActions && extraActions.length > 0 && (
          <div style={{ 
            display: "grid",
            gridTemplateColumns: extraActions.length === 1 ? "1fr" : "repeat(2, 1fr)",  // 1 или 2 колонки
            gap: "1rem",
            marginBottom: "1.5rem"
          }}>
            {extraActions.map((action) => (
              <button
                key={action.id}
                onClick={() => {
                  setSelectedExtraAction(action.id);
                  setSelectedTarget(null);  // Сбрасываем выбор игрока
                }}
                disabled={hasActed || !isMyTurn}  // Блокируем если уже действовали или не наш ход
                style={{
                  padding: "1rem",
                  background: selectedExtraAction === action.id 
                    ? (action.type === "success" ? "var(--success)" : "var(--danger)")  // Зеленый или красный если выбрано
                    : "var(--bg-tertiary)",
                  color: selectedExtraAction === action.id ? "white" : "var(--text-primary)",
                  border: `2px solid ${selectedExtraAction === action.id 
                    ? (action.type === "success" ? "var(--success)" : "var(--danger)")
                    : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  cursor: (hasActed || !isMyTurn) ? "not-allowed" : "pointer",
                  fontWeight: selectedExtraAction === action.id ? "600" : "normal",
                  transition: "all 0.2s",
                  opacity: (hasActed || !isMyTurn) ? 0.5 : 1
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Список игроков для выбора */}
        {players.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",  // Адаптивная сетка
            gap: "1rem",
            marginBottom: "1.5rem",
            maxHeight: "300px",
            overflowY: "auto",  // Прокрутка если много игроков
            padding: "0.5rem"
          }}>
            {players.map((player) => (
              <button
                key={player.userId}
                onClick={() => {
                  setSelectedTarget(player.userId);
                  setSelectedExtraAction(null);  // Сбрасываем дополнительное действие
                }}
                disabled={hasActed || !isMyTurn}
                style={{
                  padding: "1rem",
                  background: selectedTarget === player.userId 
                    ? "var(--warning)"  // Желтый если выбран
                    : "var(--bg-tertiary)",
                  color: selectedTarget === player.userId 
                    ? "var(--bg-primary)" 
                    : "var(--text-primary)",
                  border: `2px solid ${selectedTarget === player.userId ? "var(--warning)" : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  cursor: (hasActed || !isMyTurn) ? "not-allowed" : "pointer",
                  fontWeight: selectedTarget === player.userId ? "600" : "normal",
                  transition: "all 0.2s",
                  opacity: (hasActed || !isMyTurn) ? 0.5 : 1
                }}
              >
                {player.userName}
                {player.isCurrentUser && " (вы)"}
              </button>
            ))}
          </div>
        )}

        {/* Кнопка подтверждения */}
        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={handleAction}
            disabled={hasActed || !canSubmit || !isMyTurn}  // Блокируем если ничего не выбрано или не наш ход
            className="btn-primary"
            style={{
              flex: 1,
              padding: "1rem",
              fontSize: "1.125rem",
              fontWeight: "600"
            }}
          >
            {hasActed ? "Выбор сделан ✓" : actionButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}

