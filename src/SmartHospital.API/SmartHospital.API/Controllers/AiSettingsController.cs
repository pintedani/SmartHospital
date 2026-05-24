using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Data;
using SmartHospital.API.Models;
using SmartHospital.API.Services.AI;

namespace SmartHospital.API.Controllers;

[ApiController]
[Route("api/ai")]
public class AiSettingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAiService _aiService;
    private readonly IConfiguration _config;

    public AiSettingsController(AppDbContext db, IAiService aiService, IConfiguration config)
    {
        _db = db;
        _aiService = aiService;
        _config = config;
    }

    /// <summary>
    /// Public endpoint — returns only whether AI is enabled (no auth required)
    /// </summary>
    [HttpGet("status")]
    public async Task<ActionResult> GetStatus()
    {
        var enabled = await _aiService.IsEnabledAsync();
        return Ok(new { enabled });
    }

    /// <summary>
    /// Admin: get AI settings (masked key)
    /// </summary>
    [HttpGet("settings")]
    [Authorize]
    public async Task<ActionResult> GetSettings()
    {
        var settings = await _db.AppSettings
            .Where(s => s.Key.StartsWith("AI:"))
            .ToListAsync();

        var dict = settings.ToDictionary(s => s.Key, s => s.Value);

        // Check API key from DB first, then fall back to IConfiguration
        var apiKeyFromDb = dict.GetValueOrDefault("AI:ApiKey", "");
        var apiKeyFromConfig = _config["AI:ApiKey"] ?? "";
        var hasKey = !string.IsNullOrEmpty(apiKeyFromDb) || !string.IsNullOrEmpty(apiKeyFromConfig);

        var modelFromDb = dict.GetValueOrDefault("AI:Model", "");
        var modelFromConfig = _config["AI:Model"] ?? "";

        return Ok(new
        {
            enabled = dict.GetValueOrDefault("AI:Enabled", "false"),
            model = !string.IsNullOrEmpty(modelFromDb) ? modelFromDb : modelFromConfig,
            hasApiKey = hasKey,
            updatedAt = settings.MaxBy(s => s.UpdatedAt)?.UpdatedAt
        });
    }

    /// <summary>
    /// Admin: toggle AI on/off and update model
    /// </summary>
    [HttpPut("settings")]
    [Authorize]
    public async Task<ActionResult> UpdateSettings([FromBody] AiSettingsUpdateDto dto)
    {
        await UpsertSetting("AI:Enabled", dto.Enabled.ToString().ToLower());

        if (!string.IsNullOrEmpty(dto.Model))
            await UpsertSetting("AI:Model", dto.Model);

        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    /// <summary>
    /// Admin: test AI connection
    /// </summary>
    [HttpPost("test")]
    [Authorize]
    public async Task<ActionResult> TestConnection()
    {
        try
        {
            var response = await _aiService.CompleteAsync(
                "You are a test assistant. Respond with exactly: OK",
                "Say OK",
                HttpContext.RequestAborted);

            return Ok(new { success = true, response = response[..Math.Min(100, response.Length)] });
        }
        catch (Exception ex)
        {
            return Ok(new { success = false, error = ex.Message });
        }
    }

    private async Task UpsertSetting(string key, string value)
    {
        var existing = await _db.AppSettings.FindAsync(key);
        if (existing != null)
        {
            existing.Value = value;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _db.AppSettings.Add(new AppSetting { Key = key, Value = value, UpdatedAt = DateTime.UtcNow });
        }
    }

    public record AiSettingsUpdateDto(bool Enabled, string? Model = null);
}
