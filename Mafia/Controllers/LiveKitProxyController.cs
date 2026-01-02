using Microsoft.AspNetCore.Mvc;
using System.Text;
using System.Text.Json;

namespace Mafia.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LiveKitProxyController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<LiveKitProxyController> _logger;

    public LiveKitProxyController(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<LiveKitProxyController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    private string GetLiveKitApiUrl()
    {
        return _configuration["LiveKit:ApiUrl"] ?? "https://calls.trexon.ru/api";
    }

    [HttpPost("participants/{roomId}/mute-audio")]
    public async Task<IActionResult> MuteAudio(string roomId, [FromBody] MuteRequest request)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var apiUrl = GetLiveKitApiUrl();
            
            // Для каждого имени отправляем отдельный запрос
            foreach (var name in request.Names)
            {
                var url = $"{apiUrl}/participants/{roomId}/mute-audio";
                var payload = new { participant_identity = name, muted = request.Mute };
                
                var content = new StringContent(
                    JsonSerializer.Serialize(payload),
                    Encoding.UTF8,
                    "application/json");

                var response = await client.PostAsync(url, content);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"LiveKit API error for {name}: {response.StatusCode} - {responseBody}");
                }
            }

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying mute-audio request to LiveKit");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("participants/{roomId}/mute-video")]
    public async Task<IActionResult> MuteVideo(string roomId, [FromBody] MuteRequest request)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var apiUrl = GetLiveKitApiUrl();
            
            // Для каждого имени отправляем отдельный запрос
            foreach (var name in request.Names)
            {
                var url = $"{apiUrl}/participants/{roomId}/mute-video";
                var payload = new { participant_identity = name, muted = request.Mute };
                
                var content = new StringContent(
                    JsonSerializer.Serialize(payload),
                    Encoding.UTF8,
                    "application/json");

                var response = await client.PostAsync(url, content);
                var responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"LiveKit API error for {name}: {response.StatusCode} - {responseBody}");
                }
            }

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying mute-video request to LiveKit");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("participants/{roomId}")]
    public async Task<IActionResult> GetParticipants(string roomId)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            var apiUrl = GetLiveKitApiUrl();
            var url = $"{apiUrl}/participants/{roomId}";
            
            client.DefaultRequestHeaders.Remove("X-API-Key");
            client.DefaultRequestHeaders.Add("X-API-Key", "dev_key_12345");

            var response = await client.GetAsync(url);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError($"LiveKit API error: {response.StatusCode} - {responseBody}");
                return StatusCode((int)response.StatusCode, responseBody);
            }

            return Ok(responseBody);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying get-participants request to LiveKit");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    public class MuteRequest
    {
        public List<string> Names { get; set; } = new();
        public bool Mute { get; set; }
    }
}
