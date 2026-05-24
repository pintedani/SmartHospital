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
Analizează feedback-urile și generează un raport structurat bazat pe clasificarea problemelor și tendințe.

ABORDARE:
1. CLASIFICĂ fiecare problemă identificată pe categorii: Calitate servicii, Infrastructură, Integritate/Corupție, Comunicare, Timp așteptare, Neglijență, Drepturi pacient
2. EVALUEAZĂ severitatea fiecărei probleme: low, medium, high, critical
3. DETECTEAZĂ tendințe și recurență (aceleași probleme repetitive pe aceeași secție = RED FLAG)
4. IDENTIFICĂ cazuri de integritate (bani solicitați, cadouri, comportament inadecvat)
5. PROPUNE acțiuni concrete cu nivel de escalare (departament → management → extern)

Răspunde STRICT în acest format JSON:
{
  ""summaryRO"": ""Sumar de 3-5 propoziții cu accent pe probleme identificate și tendințe, nu pe sentiment generic"",
  ""summaryEN"": ""Same in English"",
  ""issueClassification"": [
    {""category"": ""Calitate servicii|Infrastructura|Integritate|Comunicare|Timp asteptare|Neglijenta|Drepturi pacient"", ""severity"": ""low|medium|high|critical"", ""department"": ""Nume"", ""descriptionRO"": ""..."", ""descriptionEN"": ""..."", ""isRecurrent"": false}
  ],
  ""keyIssues"": [""Issue 1"", ""Issue 2""],
  ""corruptionAlerts"": ""Detalii specifice despre cazurile de solicitare bani (sau 'Niciun caz identificat')"",
  ""overallSeverity"": ""low|medium|high|critical"",
  ""actionItems"": [{""action"": ""Acțiune concretă"", ""priority"": ""immediate|short-term|long-term"", ""escalationLevel"": ""department|management|external""}],
  ""departmentIssues"": [{""department"": ""Nume secție"", ""issueRO"": ""Problemă"", ""issueEN"": ""Issue"", ""rating"": 2.5, ""trend"": ""improving|stable|declining""}],
  ""accountabilityFlags"": [""Aspect care necesită urmărire""]
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
                overallSeverity = parsed.overallSeverity,
                issueClassification = parsed.issueClassification,
                keyIssues = parsed.keyIssues,
                actionItems = parsed.actionItems,
                corruptionAlerts = parsed.corruptionAlerts,
                departmentIssues = parsed.departmentIssues,
                accountabilityFlags = parsed.accountabilityFlags,
                // Keep backward compat
                sentiment = parsed.overallSeverity == "low" ? "positive" : parsed.overallSeverity == "critical" ? "negative" : "mixed",
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
                summary.ContentRO += $"\n\n📋 Recomandări: {string.Join("; ", parsed.actionItems.Select(a => a.TryGetProperty("action", out var act) ? act.GetString() : a.ToString()))}";
            if (!string.IsNullOrEmpty(parsed.corruptionAlerts))
                summary.ContentEN += $"\n\n🚨 Integrity alerts: {parsed.corruptionAlerts}";
            if (parsed.actionItems.Any())
                summary.ContentEN += $"\n\n📋 Recommendations: {string.Join("; ", parsed.actionItems.Select(a => a.TryGetProperty("action", out var act) ? act.GetString() : a.ToString()))}";

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
                severity = parsed.severity ?? parsed.overallSeverity,
                actionItems = parsed.actionItems,
                issueClassification = parsed.issueClassification,
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
                var actionTexts = parsed.actionItems.Select(a => a.TryGetProperty("action", out var act) ? act.GetString() : a.ToString()).ToList();
                summary.ContentRO += $"\n\n📋 Recomandări: {string.Join("; ", actionTexts)}";
                summary.ContentEN += $"\n\n📋 Recommendations: {string.Join("; ", actionTexts)}";
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

    private (string summaryRO, string summaryEN, string? corruptionAlerts, List<JsonElement> actionItems,
        string? overallSeverity, List<string> keyIssues, string? severity,
        List<Dictionary<string, object>> departmentIssues,
        List<JsonElement> issueClassification, List<string> accountabilityFlags) ParseSummaryResponse(string response)
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

            // actionItems can be strings or objects
            var actionItems = new List<JsonElement>();
            if (root.TryGetProperty("actionItems", out var ai) && ai.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in ai.EnumerateArray())
                    actionItems.Add(item.Clone());
            }

            var overallSeverity = root.TryGetProperty("overallSeverity", out var os) ? os.GetString() : null;
            var severity = root.TryGetProperty("severity", out var sv) ? sv.GetString() : overallSeverity;
            var keyIssues = root.TryGetProperty("keyIssues", out var ki)
                ? ki.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList()
                : new List<string>();

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
                    if (item.TryGetProperty("trend", out var tr)) dict["trend"] = tr.GetString() ?? "stable";
                    departmentIssues.Add(dict);
                }
            }

            // Issue classification (new)
            var issueClassification = new List<JsonElement>();
            if (root.TryGetProperty("issueClassification", out var ic) && ic.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in ic.EnumerateArray())
                    issueClassification.Add(item.Clone());
            }

            // Accountability flags
            var accountabilityFlags = root.TryGetProperty("accountabilityFlags", out var af)
                ? af.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList()
                : new List<string>();

            return (summaryRO, summaryEN, corruption, actionItems, overallSeverity, keyIssues, severity, departmentIssues, issueClassification, accountabilityFlags);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "[AI] Failed to parse summary JSON, using raw response");
            return (response, response, null, new List<JsonElement>(), null, new List<string>(), null, new List<Dictionary<string, object>>(), new List<JsonElement>(), new List<string>());
        }
    }
}
