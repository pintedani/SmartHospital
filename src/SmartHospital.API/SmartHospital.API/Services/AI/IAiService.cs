namespace SmartHospital.API.Services.AI;

public interface IAiService
{
    Task<string> CompleteAsync(string systemPrompt, string userMessage, CancellationToken ct = default);
    Task<string> CompleteWithImageAsync(string systemPrompt, string userMessage, byte[] imageData, string mimeType, CancellationToken ct = default);
    Task<bool> IsEnabledAsync();
}
