using Mafia.Models;
// using Mafia.Services; // Avoid circular dependency if ParticipantInfo is in Services namesapce

namespace Mafia.Services;

public interface IVideoCallService
{
    Task CreateRoomAsync(string roomName, string creatorName);
    Task MuteUserAudioAsync(string roomName, string participantIdentity, bool muted);
    Task MuteUserVideoAsync(string roomName, string participantIdentity, bool muted);
    Task MuteAllAudioAsync(string roomName, string? exceptUser = null);
    Task UnmuteAllAudioAsync(string roomName);
    Task MuteAllVideoAsync(string roomName);
    Task UnmuteAllVideoAsync(string roomName);
    Task<List<ParticipantInfo>> GetParticipantsAsync(string roomName);
}
