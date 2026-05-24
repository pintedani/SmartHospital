using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Data;
using SmartHospital.API.Models;

namespace SmartHospital.API.Services.AI;

public class AiRecommendationService : IRecommendationService
{
    private readonly IAiService _ai;
    private readonly RuleBasedRecommendationService _ruleBasedService;
    private readonly AppDbContext _db;
    private readonly ILogger<AiRecommendationService> _logger;

    public AiRecommendationService(
        IAiService ai,
        RuleBasedRecommendationService ruleBasedService,
        AppDbContext db,
        ILogger<AiRecommendationService> logger)
    {
        _ai = ai;
        _ruleBasedService = ruleBasedService;
        _db = db;
        _logger = logger;
    }

    public async Task<RecommendationResult> GetRecommendationsAsync(RecommendationRequest request)
    {
        // Only call AI if there's free-text input AND AI is enabled
        if (string.IsNullOrWhiteSpace(request.FreeText) || !await _ai.IsEnabledAsync())
        {
            _logger.LogInformation("[AI] Skipping LLM call (freeText={HasFreeText}, aiEnabled={AiEnabled})",
                !string.IsNullOrWhiteSpace(request.FreeText), await _ai.IsEnabledAsync());
            return await _ruleBasedService.GetRecommendationsAsync(request);
        }

        try
        {
            _logger.LogInformation("[AI] >>> Calling LLM for symptom analysis (freeText: \"{FreeText}\")", request.FreeText);
            return await GetAiRecommendationsAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[AI] Recommendation failed, falling back to rule-based");
            return await _ruleBasedService.GetRecommendationsAsync(request);
        }
    }

    private async Task<RecommendationResult> GetAiRecommendationsAsync(RecommendationRequest request)
    {
        var specialtyNames = Enum.GetNames<DepartmentSpecialty>();
        var symptomsText = string.Join(", ", request.Symptoms);

        var systemPrompt = $@"You are a medical triage assistant for a hospital system in Romania.
Given patient symptoms, determine:
1. The most relevant medical specialties from this exact list: {string.Join(", ", specialtyNames)}
2. Urgency level: Routine, Urgent, or Emergency
3. A brief explanation (2-3 sentences) of why these specialties are recommended
4. 2-3 follow-up questions that could help refine the recommendation

IMPORTANT: Only output valid JSON. No markdown, no explanation outside the JSON.
Respond ONLY in this exact JSON format:
{{
  ""specialties"": [""Cardiology"", ""InternalMedicine""],
  ""urgency"": ""Routine"",
  ""explanation"": ""Based on your symptoms..."",
  ""explanationRO"": ""Pe baza simptomelor dumneavoastră..."",
  ""followUpQuestions"": [""How long have you had these symptoms?"", ""Do you have a family history of heart disease?""],
  ""followUpQuestionsRO"": [""De cât timp aveți aceste simptome?"", ""Aveți antecedente familiale de boli cardiace?""]
}}";

        var userMessage = $"Patient symptoms: {symptomsText}";
        if (request.FreeText != null)
            userMessage += $"\nAdditional description: {request.FreeText}";

        var response = await _ai.CompleteAsync(systemPrompt, userMessage);

        _logger.LogInformation("[AI] <<< LLM response received. Parsing...");

        // Parse AI response
        var aiResult = ParseAiResponse(response);

        _logger.LogInformation("[AI] <<< Parsed: Specialties=[{Specialties}], Urgency={Urgency}, Explanation=\"{Explanation}\"",
            string.Join(", ", aiResult.Specialties), aiResult.Urgency, 
            aiResult.Explanation.Length > 100 ? aiResult.Explanation[..100] + "..." : aiResult.Explanation);

        // Map AI specialties to enum values
        var matchedSpecialties = new List<DepartmentSpecialty>();
        foreach (var name in aiResult.Specialties)
        {
            if (Enum.TryParse<DepartmentSpecialty>(name, true, out var specialty))
                matchedSpecialties.Add(specialty);
        }

        if (matchedSpecialties.Count == 0)
        {
            matchedSpecialties.Add(DepartmentSpecialty.InternalMedicine);
            matchedSpecialties.Add(DepartmentSpecialty.EmergencyMedicine);
        }

        var urgency = aiResult.Urgency switch
        {
            "Emergency" => UrgencyLevel.Emergency,
            "Urgent" => UrgencyLevel.Urgent,
            _ => UrgencyLevel.Routine
        };

        // Get hospital rankings (reuse existing DB logic)
        var hospitals = await GetRankedHospitals(matchedSpecialties, request.Latitude, request.Longitude);

        var urgencyMessage = urgency switch
        {
            UrgencyLevel.Emergency => "Situație de urgență! Vă rugăm apelați 112 sau mergeți la cea mai apropiată urgență.",
            UrgencyLevel.Urgent => "Consultație urgentă recomandată în 24-48 ore.",
            _ => "Programare de rutină recomandată."
        };

        return new RecommendationResult(
            urgency,
            urgencyMessage,
            matchedSpecialties,
            hospitals,
            AiExplanation: aiResult.Explanation,
            AiExplanationRO: aiResult.ExplanationRO,
            IsAiGenerated: true,
            FollowUpQuestions: aiResult.FollowUpQuestions,
            FollowUpQuestionsRO: aiResult.FollowUpQuestionsRO
        );
    }

    private AiParsedResult ParseAiResponse(string response)
    {
        try
        {
            // Strip markdown code fences if present
            var json = response.Trim();
            if (json.StartsWith("```"))
            {
                var firstNewline = json.IndexOf('\n');
                var lastFence = json.LastIndexOf("```");
                if (firstNewline > 0 && lastFence > firstNewline)
                    json = json[(firstNewline + 1)..lastFence].Trim();
            }

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var specialties = root.GetProperty("specialties")
                .EnumerateArray()
                .Select(x => x.GetString() ?? "")
                .Where(x => !string.IsNullOrEmpty(x))
                .ToList();

            var urgency = root.TryGetProperty("urgency", out var u) ? u.GetString() ?? "Routine" : "Routine";
            var explanation = root.TryGetProperty("explanation", out var e) ? e.GetString() ?? "" : "";
            var explanationRO = root.TryGetProperty("explanationRO", out var ero) ? ero.GetString() ?? "" : "";

            var followUp = root.TryGetProperty("followUpQuestions", out var fq)
                ? fq.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList()
                : new List<string>();

            var followUpRO = root.TryGetProperty("followUpQuestionsRO", out var fqro)
                ? fqro.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList()
                : new List<string>();

            return new AiParsedResult(specialties, urgency, explanation, explanationRO, followUp, followUpRO);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Failed to parse AI response: {Response}", response[..Math.Min(200, response.Length)]);
            return new AiParsedResult(new List<string>(), "Routine", "", "", new List<string>(), new List<string>());
        }
    }

    private async Task<List<HospitalRecommendation>> GetRankedHospitals(
        List<DepartmentSpecialty> specialties, double? lat, double? lng)
    {
        var hospitals = await _db.Hospitals
            .Where(h => h.IsActive)
            .Include(h => h.Departments.Where(d => d.IsActive && specialties.Contains(d.Specialty)))
            .Include(h => h.FeedbackSubmissions).ThenInclude(f => f.Answers)
            .Where(h => h.Departments.Any(d => d.IsActive && specialties.Contains(d.Specialty)))
            .ToListAsync();

        return hospitals.Select(h =>
        {
            var matchCount = h.Departments.Count(d => specialties.Contains(d.Specialty));
            var avgRating = h.FeedbackSubmissions.Any()
                ? h.FeedbackSubmissions.SelectMany(f => f.Answers)
                    .Where(a => a.RatingValue.HasValue)
                    .Select(a => a.RatingValue!.Value)
                    .DefaultIfEmpty(0)
                    .Average()
                : (double?)null;

            double? distance = null;
            if (lat.HasValue && lng.HasValue && h.Latitude != 0 && h.Longitude != 0)
                distance = CalculateDistance(lat.Value, lng.Value, h.Latitude, h.Longitude);

            var matchScore = (double)matchCount / specialties.Count * 40;
            var ratingScore = (avgRating ?? 2.5) / 4.0 * 30;
            var distanceScore = distance.HasValue ? Math.Max(0, 30 - (distance.Value / 2)) : 15;

            return new HospitalRecommendation(
                h.Id, h.Name, h.NameEN, h.Address, h.City, h.Type.ToString(),
                h.Website, h.Phone, h.Latitude, h.Longitude, distance,
                avgRating, h.FeedbackSubmissions.Count,
                matchScore + ratingScore + distanceScore,
                h.Departments.Where(d => specialties.Contains(d.Specialty))
                    .Select(d => new MatchedDepartmentInfo(d.Id, d.Name, d.NameEN ?? d.Name, d.Specialty.ToString()))
                    .ToList()
            );
        }).OrderByDescending(r => r.Score).ToList();
    }

    private static double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private record AiParsedResult(
        List<string> Specialties,
        string Urgency,
        string Explanation,
        string ExplanationRO,
        List<string> FollowUpQuestions,
        List<string> FollowUpQuestionsRO
    );
}
