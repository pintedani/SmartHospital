using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Data;
using SmartHospital.API.Models;

namespace SmartHospital.API.Services.AI;

public class AiSummaryService
{
    private readonly IAiService _ai;
    private readonly AppDbContext _db;
    private readonly ILogger<AiSummaryService> _logger;

    public AiSummaryService(IAiService ai, AppDbContext db, ILogger<AiSummaryService> logger)
    {
        _ai = ai;
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Get or generate a monthly feedback summary for a hospital.
    /// Regenerates if new feedback exists since last summary.
    /// </summary>
    public async Task<AiSummary?> GetOrGenerateMonthlySummaryAsync(int hospitalId, string? userId)
    {
        if (!await _ai.IsEnabledAsync())
            return null;

        // Check latest summary
        int? hospId = hospitalId == 0 ? null : hospitalId;
        var latestSummary = await _db.AiSummaries
            .Where(s => s.HospitalId == hospId && s.SummaryType == "monthly_feedback")
            .OrderByDescending(s => s.GeneratedAt)
            .FirstOrDefaultAsync();

        // Check if we have new feedback since last summary
        var latestFeedbackDate = await _db.FeedbackSubmissions
            .Where(f => f.HospitalId == hospitalId || hospitalId == 0)
            .MaxAsync(f => (DateTime?)f.SubmittedAt);

        if (latestSummary != null && latestFeedbackDate.HasValue
            && latestSummary.LatestFeedbackDate >= latestFeedbackDate)
        {
            _logger.LogInformation("[AI] Summary up-to-date for hospital {HospitalId}", hospitalId);
            return latestSummary;
        }

        // Generate new summary
        return await GenerateMonthlySummaryAsync(hospitalId, userId);
    }

    /// <summary>
    /// Force a fresh regeneration of the monthly summary, ignoring cache.
    /// </summary>
    public async Task<AiSummary?> ForceRegenerateMonthlySummaryAsync(int hospitalId, string? userId)
    {
        if (!await _ai.IsEnabledAsync())
            return null;

        return await GenerateMonthlySummaryAsync(hospitalId, userId);
    }

    private async Task<AiSummary?> GenerateMonthlySummaryAsync(int hospitalId, string? userId)
    {
        _logger.LogInformation("[AI] >>> Generating monthly feedback summary for hospital {HospitalId}", hospitalId);

        // Get recent feedback with comments and alerts
        var feedbacksQuery = _db.FeedbackSubmissions
            .Include(f => f.Answers).ThenInclude(a => a.Question)
            .Include(f => f.Hospital)
            .Include(f => f.Department)
            .Include(f => f.AbuseAlerts)
            .Where(f => f.SubmittedAt >= DateTime.UtcNow.AddDays(-30));

        if (hospitalId > 0)
            feedbacksQuery = feedbacksQuery.Where(f => f.HospitalId == hospitalId);

        var feedbacks = await feedbacksQuery
            .OrderByDescending(f => f.SubmittedAt)
            .Take(100)
            .ToListAsync();

        if (feedbacks.Count == 0)
            return null;

        // Build context for LLM
        var summaryParts = feedbacks.Select(f =>
        {
            var avgRating = f.Answers.Where(a => a.RatingValue.HasValue).Select(a => a.RatingValue!.Value).DefaultIfEmpty(0).Average();
            var comments = f.Answers.Where(a => !string.IsNullOrEmpty(a.TextValue)).Select(a => a.TextValue).ToList();
            var hasCorruption = f.AbuseAlerts.Any();
            var dept = f.Department?.Name ?? "General";

            return $"[{f.SubmittedAt:dd/MM}] {f.Hospital.Name} - {dept} | Rating: {avgRating:F1}/4 | " +
                   (hasCorruption ? "⚠️ BANI SOLICITAȚI | " : "") +
                   (comments.Any() ? $"Comentarii: {string.Join("; ", comments.Take(2))}" : "Fără comentarii");
        }).ToList();

        var systemPrompt = @"Ești un analist AI pentru un sistem de feedback spitalicesc din România, județul Cluj.
Analizează feedback-urile de mai jos și generează un sumar structurat.
ACCENT SPECIAL pe cazurile unde pacienților li s-au solicitat bani (marcate cu ⚠️ BANI SOLICITAȚI).
Include obligatoriu o analiză pe secții/departamente cu problemele identificate la fiecare.

Răspunde STRICT în acest format JSON:
{
  ""summaryRO"": ""Sumar de 3-5 propoziții în română cu principalele constatări, accent pe probleme de integritate"",
  ""summaryEN"": ""Same summary in English"",
  ""keyIssues"": [""Issue 1"", ""Issue 2""],
  ""corruptionAlerts"": ""Detalii specifice despre cazurile de solicitare bani (sau 'Niciun caz identificat')"",
  ""sentiment"": ""positive|mixed|negative"",
  ""actionItems"": [""Recommended action 1"", ""Recommended action 2""],
  ""departmentIssues"": [{""department"": ""Nume secție"", ""issueRO"": ""Problemă identificată în română"", ""issueEN"": ""Issue identified in English"", ""rating"": 2.5}]
}";

        var userMessage = $"Feedback-uri din ultimele 30 zile ({feedbacks.Count} total, {feedbacks.Count(f => f.AbuseAlerts.Any())} cu alerte de corupție):\n\n" +
                          string.Join("\n", summaryParts);

        try
        {
            var response = await _ai.CompleteAsync(systemPrompt, userMessage);
            _logger.LogInformation("[AI] <<< Monthly summary response received");

            var parsed = ParseSummaryResponse(response);

            var metadata = JsonSerializer.Serialize(new
            {
                sentiment = parsed.sentiment,
                keyIssues = parsed.keyIssues,
                actionItems = parsed.actionItems,
                corruptionAlerts = parsed.corruptionAlerts,
                departmentIssues = parsed.departmentIssues,
            });

            var summary = new AiSummary
            {
                HospitalId = hospitalId == 0 ? null : hospitalId,
                SummaryType = "monthly_feedback",
                ContentRO = parsed.summaryRO,
                ContentEN = parsed.summaryEN,
                GeneratedAt = DateTime.UtcNow,
                GeneratedBy = userId,
                FeedbackCount = feedbacks.Count,
                LatestFeedbackDate = feedbacks.Max(f => f.SubmittedAt),
                MetadataJson = metadata,
            };

            // Store extra data in ContentRO as enriched text
            if (!string.IsNullOrEmpty(parsed.corruptionAlerts))
                summary.ContentRO += $"\n\n🚨 Alerte integritate: {parsed.corruptionAlerts}";
            if (parsed.actionItems.Any())
                summary.ContentRO += $"\n\n📋 Recomandări: {string.Join("; ", parsed.actionItems)}";
            if (!string.IsNullOrEmpty(parsed.corruptionAlerts))
                summary.ContentEN += $"\n\n🚨 Integrity alerts: {parsed.corruptionAlerts}";
            if (parsed.actionItems.Any())
                summary.ContentEN += $"\n\n📋 Recommendations: {string.Join("; ", parsed.actionItems)}";

            _db.AiSummaries.Add(summary);
            await _db.SaveChangesAsync();

            _logger.LogInformation("[AI] <<< Summary saved (id={Id}, feedbacks={Count})", summary.Id, feedbacks.Count);
            return summary;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI] Failed to generate monthly summary");
            return null;
        }
    }

    /// <summary>
    /// Generate an AI analysis for a specific abuse alert.
    /// </summary>
    public async Task<AiSummary?> GenerateAlertAnalysisAsync(int alertId, string? userId)
    {
        if (!await _ai.IsEnabledAsync())
            return null;

        // Check if we already have one
        var existing = await _db.AiSummaries
            .Where(s => s.AlertId == alertId && s.SummaryType == "alert_analysis")
            .FirstOrDefaultAsync();
        if (existing != null)
            return existing;

        var alert = await _db.AbuseAlerts
            .Include(a => a.Hospital)
            .Include(a => a.FeedbackSubmission)
                .ThenInclude(f => f.Answers)
                .ThenInclude(a => a.Question)
            .Include(a => a.FeedbackSubmission)
                .ThenInclude(f => f.Department)
            .FirstOrDefaultAsync(a => a.Id == alertId);

        if (alert == null)
            return null;

        _logger.LogInformation("[AI] >>> Generating alert analysis for alert {AlertId}", alertId);

        var answers = alert.FeedbackSubmission.Answers.Select(a =>
            $"- {a.Question.TextRO}: {a.RatingValue?.ToString() ?? a.SelectedOption ?? a.TextValue ?? "N/A"}"
        ).ToList();

        var systemPrompt = @"Ești un analist AI pentru integritate spitalicească din România.
Un pacient a raportat că i s-au solicitat bani. Analizează răspunsurile complete din chestionar și generează:
1. Un sumar al situației
2. Gravitatea (scăzută/medie/ridicată/critică)
3. Recomandări de acțiune pentru management

Răspunde STRICT în JSON:
{
  ""summaryRO"": ""Analiza situației în română (3-4 propoziții)"",
  ""summaryEN"": ""Same in English"",
  ""severity"": ""low|medium|high|critical"",
  ""actionItems"": [""Action 1"", ""Action 2""]
}";

        var userMessage = $"Spital: {alert.Hospital.Name}\n" +
                          $"Secția: {alert.FeedbackSubmission.Department?.Name ?? "Necunoscută"}\n" +
                          $"Data: {alert.CreatedAt:dd/MM/yyyy}\n" +
                          $"Tip alertă: {alert.AlertType}\n\n" +
                          $"Răspunsuri chestionar:\n{string.Join("\n", answers)}";

        try
        {
            var response = await _ai.CompleteAsync(systemPrompt, userMessage);
            _logger.LogInformation("[AI] <<< Alert analysis response received for alert {AlertId}", alertId);

            var parsed = ParseSummaryResponse(response);

            var metadata = JsonSerializer.Serialize(new
            {
                severity = parsed.severity,
                actionItems = parsed.actionItems,
            });

            var summary = new AiSummary
            {
                HospitalId = alert.HospitalId,
                SummaryType = "alert_analysis",
                AlertId = alertId,
                ContentRO = parsed.summaryRO,
                ContentEN = parsed.summaryEN,
                GeneratedAt = DateTime.UtcNow,
                GeneratedBy = userId,
                FeedbackCount = 1,
                LatestFeedbackDate = alert.CreatedAt,
                MetadataJson = metadata,
            };

            if (parsed.actionItems.Any())
            {
                summary.ContentRO += $"\n\n📋 Recomandări: {string.Join("; ", parsed.actionItems)}";
                summary.ContentEN += $"\n\n📋 Recommendations: {string.Join("; ", parsed.actionItems)}";
            }

            _db.AiSummaries.Add(summary);
            await _db.SaveChangesAsync();

            return summary;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI] Failed to generate alert analysis for alert {AlertId}", alertId);
            return null;
        }
    }

    /// <summary>Get summary history for a hospital</summary>
    public async Task<List<AiSummary>> GetSummaryHistoryAsync(int hospitalId, int limit = 10)
    {
        int? hospId = hospitalId == 0 ? null : hospitalId;
        return await _db.AiSummaries
            .Where(s => s.HospitalId == hospId || hospId == null)
            .OrderByDescending(s => s.GeneratedAt)
            .Take(limit)
            .ToListAsync();
    }

    private (string summaryRO, string summaryEN, string? corruptionAlerts, List<string> actionItems, string? sentiment, List<string> keyIssues, string? severity, List<Dictionary<string, object>> departmentIssues) ParseSummaryResponse(string response)
    {
        try
        {
            var json = response.Trim();
            if (json.StartsWith("```"))
            {
                var firstNl = json.IndexOf('\n');
                var lastFence = json.LastIndexOf("```");
                if (firstNl > 0 && lastFence > firstNl)
                    json = json[(firstNl + 1)..lastFence].Trim();
            }

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var summaryRO = root.TryGetProperty("summaryRO", out var sro) ? sro.GetString() ?? "" : "";
            var summaryEN = root.TryGetProperty("summaryEN", out var sen) ? sen.GetString() ?? "" : "";
            var corruption = root.TryGetProperty("corruptionAlerts", out var ca) ? ca.GetString() : null;
            var actions = root.TryGetProperty("actionItems", out var ai)
                ? ai.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList()
                : new List<string>();
            var sentiment = root.TryGetProperty("sentiment", out var st) ? st.GetString() : null;
            var keyIssues = root.TryGetProperty("keyIssues", out var ki)
                ? ki.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList()
                : new List<string>();
            var severity = root.TryGetProperty("severity", out var sv) ? sv.GetString() : null;
            var departmentIssues = new List<Dictionary<string, object>>();
            if (root.TryGetProperty("departmentIssues", out var di) && di.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in di.EnumerateArray())
                {
                    var dict = new Dictionary<string, object>();
                    if (item.TryGetProperty("department", out var dept)) dict["department"] = dept.GetString() ?? "";
                    if (item.TryGetProperty("issueRO", out var iro)) dict["issueRO"] = iro.GetString() ?? "";
                    if (item.TryGetProperty("issueEN", out var ien)) dict["issueEN"] = ien.GetString() ?? "";
                    if (item.TryGetProperty("rating", out var rat)) dict["rating"] = rat.GetDouble();
                    departmentIssues.Add(dict);
                }
            }

            return (summaryRO, summaryEN, corruption, actions, sentiment, keyIssues, severity, departmentIssues);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "[AI] Failed to parse summary JSON, using raw response");
            return (response, response, null, new List<string>(), null, new List<string>(), null, new List<Dictionary<string, object>>());
        }
    }
}
