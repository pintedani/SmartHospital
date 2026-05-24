using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Data;

namespace SmartHospital.API.Services.AI;

public class AnthropicAiService : IAiService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AnthropicAiService> _logger;

    // Rate limiting: max 60 calls/hour
    private static readonly object _rateLock = new();
    private static readonly Queue<DateTime> _callTimestamps = new();
    private const int MaxCallsPerHour = 60;

    public AnthropicAiService(
        HttpClient httpClient,
        IConfiguration config,
        IServiceScopeFactory scopeFactory,
        ILogger<AnthropicAiService> logger)
    {
        _httpClient = httpClient;
        _config = config;
        _scopeFactory = scopeFactory;
        _logger = logger;

        var baseUrl = _config["AI:BaseUrl"] ?? "";
        if (!string.IsNullOrEmpty(baseUrl))
        {
            _httpClient.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
        }

        var apiKey = _config["AI:ApiKey"] ?? "";
        if (!string.IsNullOrEmpty(apiKey))
        {
            _httpClient.DefaultRequestHeaders.Add("x-api-key", apiKey);
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        }

        _httpClient.Timeout = TimeSpan.FromSeconds(30);
    }

    public async Task<bool> IsEnabledAsync()
    {
        // Check DB setting first (admin toggle)
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var setting = await db.AppSettings.FindAsync("AI:Enabled");
        if (setting != null)
            return setting.Value.Equals("true", StringComparison.OrdinalIgnoreCase);

        // Fallback to config
        return _config.GetValue<bool>("AI:Enabled");
    }

    public async Task<string> CompleteAsync(string systemPrompt, string userMessage, CancellationToken ct = default)
    {
        if (!CheckRateLimit())
            throw new InvalidOperationException("AI rate limit exceeded (max 60 calls/hour)");

        // Sanitize PII from user message
        var sanitizedMessage = SanitizePii(userMessage);

        var model = _config["AI:Model"] ?? "glm-5";

        var requestBody = new
        {
            model,
            max_tokens = 1024,
            messages = new[]
            {
                new { role = "user", content = sanitizedMessage }
            },
            system = systemPrompt
        };

        var json = JsonSerializer.Serialize(requestBody);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        _logger.LogInformation("[AI] >>> REQUEST to {BaseUrl}v1/messages", _httpClient.BaseAddress);
        _logger.LogInformation("[AI] >>> Model: {Model}", model);
        _logger.LogInformation("[AI] >>> System prompt: {Prompt}", systemPrompt[..Math.Min(150, systemPrompt.Length)] + "...");
        _logger.LogInformation("[AI] >>> User message: {Message}", sanitizedMessage);

        try
        {
            var response = await _httpClient.PostAsync("v1/messages", content, ct);
            var responseBody = await response.Content.ReadAsStringAsync(ct);

            _logger.LogInformation("[AI] <<< Status: {Status}", response.StatusCode);
            _logger.LogInformation("[AI] <<< Response: {Body}", responseBody[..Math.Min(500, responseBody.Length)]);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[AI] <<< ERROR: {Status} - {Body}", response.StatusCode, responseBody);
                throw new HttpRequestException($"AI API returned {response.StatusCode}");
            }

            // Parse Anthropic-style response
            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            // Try Anthropic format: { content: [{ type: "text", text: "..." }] }
            if (root.TryGetProperty("content", out var contentArr) && contentArr.ValueKind == JsonValueKind.Array)
            {
                // Find the text-type block (skip thinking blocks)
                foreach (var block in contentArr.EnumerateArray())
                {
                    var blockType = block.TryGetProperty("type", out var tp) ? tp.GetString() : null;
                    if (blockType == "text" && block.TryGetProperty("text", out var textProp))
                    {
                        var result = textProp.GetString() ?? "";
                        _logger.LogInformation("[AI] <<< Parsed text: {Text}", result[..Math.Min(300, result.Length)]);
                        return result;
                    }
                }
                // Fallback: try first block with text property
                var firstBlock = contentArr.EnumerateArray().FirstOrDefault();
                if (firstBlock.TryGetProperty("text", out var fallbackText))
                    return fallbackText.GetString() ?? "";
            }

            // Try OpenAI format: { choices: [{ message: { content: "..." } }] }
            if (root.TryGetProperty("choices", out var choices) && choices.ValueKind == JsonValueKind.Array)
            {
                var first = choices.EnumerateArray().FirstOrDefault();
                if (first.TryGetProperty("message", out var msg) && msg.TryGetProperty("content", out var c))
                    return c.GetString() ?? "";
            }

            _logger.LogWarning("[AI] Unexpected response format: {Body}", responseBody);
            return responseBody;
        }
        catch (TaskCanceledException)
        {
            _logger.LogWarning("[AI] <<< TIMEOUT after 30s");
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI] <<< EXCEPTION: {Message}", ex.Message);
            throw;
        }
    }

    private static bool CheckRateLimit()
    {
        lock (_rateLock)
        {
            var now = DateTime.UtcNow;
            while (_callTimestamps.Count > 0 && (now - _callTimestamps.Peek()).TotalHours >= 1)
                _callTimestamps.Dequeue();

            if (_callTimestamps.Count >= MaxCallsPerHour)
                return false;

            _callTimestamps.Enqueue(now);
            return true;
        }
    }

    private static string SanitizePii(string input)
    {
        if (string.IsNullOrEmpty(input)) return input;

        // Remove Romanian CNP (13-digit number)
        input = System.Text.RegularExpressions.Regex.Replace(input, @"\b[1-8]\d{12}\b", "[REDACTED]");
        // Remove phone numbers
        input = System.Text.RegularExpressions.Regex.Replace(input, @"\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{3,4}\b", "[REDACTED]");
        // Remove email addresses
        input = System.Text.RegularExpressions.Regex.Replace(input, @"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "[REDACTED]");

        return input;
    }
}
