namespace Mafia.DTOs;

/// <summary>
/// Модель информации о роли в игре
/// </summary>
public class RolesDTO
{
    /// <summary>
    /// Значение роли (enum в виде строки)
    /// </summary>
    public string RoleValue { get; set; }
    
    /// <summary>
    /// Название роли
    /// </summary>
    public string Name { get; set; }
    
    /// <summary>
    /// Описание роли и её способностей
    /// </summary>
    public string Description { get; set; }
    
    /// <summary>
    /// Команда, к которой принадлежит роль
    /// </summary>
    public string Team { get; set; }
    
    /// <summary>
    /// Является ли роль уникальной (может быть только одна в игре)
    /// </summary>
    public bool IsUnique { get; set; }
}