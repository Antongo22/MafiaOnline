namespace Mafia.Helpers;

/// <summary>
/// Вспомогательный класс для валидации входных данных
/// </summary>
public static class ValidationHelper
{
    /// <summary>
    /// Проверяет, что строка не пустая
    /// </summary>
    public static void ValidateNotEmpty(string? value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"Параметр '{paramName}' не может быть пустым", paramName);
        }
    }

    /// <summary>
    /// Проверяет, что объект не null
    /// </summary>
    public static void ValidateNotNull(object? value, string paramName)
    {
        if (value == null)
        {
            throw new ArgumentNullException(paramName, $"Параметр '{paramName}' не может быть null");
        }
    }

    /// <summary>
    /// Проверяет, что коллекция не пустая
    /// </summary>
    public static void ValidateNotEmpty<T>(IEnumerable<T>? collection, string paramName)
    {
        if (collection == null || !collection.Any())
        {
            throw new ArgumentException($"Коллекция '{paramName}' не может быть пустой", paramName);
        }
    }

    /// <summary>
    /// Проверяет, что число положительное
    /// </summary>
    public static void ValidatePositive(int value, string paramName)
    {
        if (value <= 0)
        {
            throw new ArgumentException($"Параметр '{paramName}' должен быть положительным числом", paramName);
        }
    }

    /// <summary>
    /// Проверяет минимальную длину строки
    /// </summary>
    public static void ValidateMinLength(string? value, int minLength, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Trim().Length < minLength)
        {
            throw new ArgumentException($"Параметр '{paramName}' должен содержать минимум {minLength} символа(ов)", paramName);
        }
    }
}
