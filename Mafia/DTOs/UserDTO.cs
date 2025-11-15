using Mafia.Enums;

namespace Mafia.DTOs;

public class UserDTO
{
    public string Id { get; init; }
    public string Name { get; init; }
    public UserStatus Status { get; init; }
}