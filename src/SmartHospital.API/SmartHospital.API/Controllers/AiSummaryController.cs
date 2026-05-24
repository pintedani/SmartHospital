using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartHospital.API.Services.AI;

namespace SmartHospital.API.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize]
public class AiSummaryController : ControllerBase
{
    private readonly AiSummaryService _summaryService;

    public AiSummaryController(AiSummaryService summaryService)
    {
        _summaryService = summaryService;
    }

    /// <summary>
    /// Get or generate monthly feedback summary for a hospital.
    /// Will auto-regenerate if new feedback exists.
    /// </summary>
    [HttpGet("summary/{hospitalId}")]
    public async Task<IActionResult> GetMonthlySummary(int hospitalId)
    {
        var userId = User.FindFirstValue(ClaimTypes.Email);
        var summary = await _summaryService.GetOrGenerateMonthlySummaryAsync(hospitalId, userId);

        if (summary == null)
            return Ok(new { available = false, message = "AI not enabled or no feedback available" });

        return Ok(new
        {
            available = true,
            summary.Id,
            summary.ContentRO,
            summary.ContentEN,
            summary.GeneratedAt,
            summary.GeneratedBy,
            summary.FeedbackCount,
            summary.LatestFeedbackDate,
            summary.MetadataJson,
        });
    }

    /// <summary>
    /// Force regeneration of the monthly feedback summary, ignoring cache.
    /// </summary>
    [HttpPost("summary/{hospitalId}/regenerate")]
    public async Task<IActionResult> RegenerateMonthlySummary(int hospitalId)
    {
        var userId = User.FindFirstValue(ClaimTypes.Email);
        var summary = await _summaryService.ForceRegenerateMonthlySummaryAsync(hospitalId, userId);

        if (summary == null)
            return Ok(new { available = false, message = "AI not enabled or no feedback available" });

        return Ok(new
        {
            available = true,
            summary.Id,
            summary.ContentRO,
            summary.ContentEN,
            summary.GeneratedAt,
            summary.GeneratedBy,
            summary.FeedbackCount,
            summary.LatestFeedbackDate,
            summary.MetadataJson,
        });
    }

    /// <summary>
    /// Generate AI analysis for a specific abuse alert.
    /// </summary>
    [HttpGet("alert-analysis/{alertId}")]
    public async Task<IActionResult> GetAlertAnalysis(int alertId)
    {
        var userId = User.FindFirstValue(ClaimTypes.Email);
        var summary = await _summaryService.GenerateAlertAnalysisAsync(alertId, userId);

        if (summary == null)
            return Ok(new { available = false, message = "AI not enabled or alert not found" });

        return Ok(new
        {
            available = true,
            summary.Id,
            summary.ContentRO,
            summary.ContentEN,
            summary.GeneratedAt,
            summary.GeneratedBy,
            summary.MetadataJson,
        });
    }

    /// <summary>
    /// Get AI summary history for a hospital.
    /// </summary>
    [HttpGet("summary-history/{hospitalId}")]
    public async Task<IActionResult> GetSummaryHistory(int hospitalId)
    {
        var history = await _summaryService.GetSummaryHistoryAsync(hospitalId);

        return Ok(history.Select(s => new
        {
            s.Id,
            s.SummaryType,
            s.AlertId,
            s.ContentRO,
            s.ContentEN,
            s.GeneratedAt,
            s.GeneratedBy,
            s.FeedbackCount,
        }));
    }
}
