namespace Mafia.DTOs;

/// <summary>
/// Информация о роли для отображения на клиенте
/// </summary>
public class RolesDTO
{
    /// <summary>
    /// Значение роли (enum в виде строки)
    /// </summary>
    public string RoleValue { get; set; } = string.Empty;
    
    /// <summary>
    /// Название роли для отображения
    /// </summary>
    public string Name { get; set; } = string.Empty;
    
    /// <summary>
    /// Описание роли
    /// </summary>
    public string Description { get; set; } = string.Empty;
    
    /// <summary>
    /// Команда роли
    /// </summary>
    public string Team { get; set; } = string.Empty;
    
    /// <summary>
    /// Является ли роль уникальной (может быть только одна в игре)
    /// </summary>
    public bool IsUnique { get; set; }
}