using SmartHospital.API.Models;

namespace SmartHospital.API.DTOs;

// === Hospital DTOs ===
public record HospitalListDto(
    int Id, string Name, string NameEN, string City, string County,
    HospitalType Type, int TotalBeds, int TotalDoctors, int TotalNurses,
    double Latitude, double Longitude, double? AverageRating, int FeedbackCount
);

public record HospitalDetailDto(
    int Id, string Name, string NameEN, string Address, string City, string County,
    string? Phone, string? Email, string? Website, HospitalType Type,
    int TotalBeds, int TotalDoctors, int TotalNurses, int? YearFounded,
    double Latitude, double Longitude, string? Description, string? DescriptionEN,
    double? AverageRating, int FeedbackCount,
    List<DepartmentDto> Departments
);

public record HospitalCreateDto(
    string Name, string NameEN, string Address, string City, string County,
    string? Phone, string? Email, string? Website, HospitalType Type,
    int TotalBeds, int TotalDoctors, int TotalNurses, int? YearFounded,
    double Latitude, double Longitude, string? Description, string? DescriptionEN
);

public record HospitalUpdateDto(
    string Name, string NameEN, string Address, string City, string County,
    string? Phone, string? Email, string? Website, HospitalType Type,
    int TotalBeds, int TotalDoctors, int TotalNurses, int? YearFounded,
    double Latitude, double Longitude, string? Description, string? DescriptionEN,
    bool IsActive
);

// === Department DTOs ===
public record DepartmentDto(
    int Id, int HospitalId, string Name, string NameEN,
    DepartmentSpecialty Specialty, int? Floor, int BedsCount,
    int DoctorsCount, int NursesCount, double? AverageRating, int FeedbackCount
);

public record DepartmentCreateDto(
    int HospitalId, string Name, string NameEN,
    DepartmentSpecialty Specialty, int? Floor, int BedsCount,
    int DoctorsCount, int NursesCount, string? Description
);

public record DepartmentUpdateDto(
    string Name, string NameEN, DepartmentSpecialty Specialty,
    int? Floor, int BedsCount, int DoctorsCount, int NursesCount,
    string? Description, bool IsActive
);

// === Question DTOs ===
public record QuestionDto(
    int Id, QuestionCategory Category, QuestionType Type,
    string TextRO, string TextEN, int OrderIndex, bool IsRequired,
    bool IsCorruptionAlert, string? OptionsJson, int WizardStep
);

// === Feedback DTOs ===
public record FeedbackSubmitDto(
    int HospitalId, int? DepartmentId, PatientGender? PatientGender,
    int? PatientAge, FilledByType FilledBy, List<FeedbackAnswerDto> Answers,
    bool IsAnonymous = true
);

public record FeedbackAnswerDto(
    int QuestionId, int? RatingValue, string? TextValue, string? SelectedOption
);

public record FeedbackSubmissionResultDto(int Id, DateTime SubmittedAt, string AccessToken);

// === Analytics DTOs ===
public record AnalyticsOverviewDto(
    int TotalFeedback, double AverageSatisfaction, int AbuseAlerts, int UnreviewedAlerts,
    Dictionary<string, double> CategoryScores,
    List<TrendPointDto> WeeklyTrend
);

public record TrendPointDto(string Label, double Value, int Count);

public record DepartmentComparisonDto(
    int DepartmentId, string Name, string NameEN,
    double AverageSatisfaction, int FeedbackCount,
    Dictionary<string, double> CategoryScores
);

public record AbuseAlertDto(
    int Id, int HospitalId, string HospitalName, int? DepartmentId, string? DepartmentName,
    AlertType AlertType, DateTime CreatedAt, bool IsReviewed,
    string? ReviewedBy, DateTime? ReviewedAt, string? Notes
);

public record AlertReviewDto(string? Notes);

// === Auth DTOs ===
public record LoginDto(string Email, string Password);

public record LoginResponseDto(string Token, string Email, string FullName, ManagerRole Role, int? HospitalId, string? HospitalName);

// === Stats ===
public record HospitalStatsDto(
    int TotalFeedback, double AverageSatisfaction,
    Dictionary<string, double> CategoryScores,
    int AbuseAlertCount,
    List<TrendPointDto> MonthlyTrend,
    List<DepartmentComparisonDto> DepartmentComparison
);
