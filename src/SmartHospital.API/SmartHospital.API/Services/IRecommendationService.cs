using SmartHospital.API.Models;

namespace SmartHospital.API.Services;

/// <summary>
/// Interface for recommendation engines. Swap implementation to switch
/// from rule-based to LLM-based recommendations.
/// </summary>
public interface IRecommendationService
{
    Task<RecommendationResult> GetRecommendationsAsync(RecommendationRequest request);
}

public record RecommendationRequest(
    List<string> Symptoms,
    double? Latitude = null,
    double? Longitude = null
);

public record RecommendationResult(
    UrgencyLevel Urgency,
    string UrgencyMessage,
    List<DepartmentSpecialty> MatchedSpecialties,
    List<HospitalRecommendation> Hospitals
);

public record HospitalRecommendation(
    int Id,
    string Name,
    string NameEN,
    string Address,
    string City,
    string Type,
    string? Website,
    string? Phone,
    double Latitude,
    double Longitude,
    double? Distance,
    double? AverageRating,
    int FeedbackCount,
    double Score,
    List<MatchedDepartmentInfo> MatchedDepartments
);

public record MatchedDepartmentInfo(
    int Id,
    string Name,
    string NameEN,
    string Specialty
);

public enum UrgencyLevel
{
    Routine,
    Urgent,
    Emergency
}
