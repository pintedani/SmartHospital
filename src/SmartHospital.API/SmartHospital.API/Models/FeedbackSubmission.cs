using System.ComponentModel.DataAnnotations;

namespace SmartHospital.API.Models;

public class FeedbackSubmission
{
    public int Id { get; set; }

    public int HospitalId { get; set; }
    public Hospital Hospital { get; set; } = null!;

    public int? DepartmentId { get; set; }
    public Department? Department { get; set; }

    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

    public PatientGender? PatientGender { get; set; }
    public int? PatientAge { get; set; }
    public FilledByType FilledBy { get; set; } = FilledByType.Patient;

    [MaxLength(100)]
    public string? AccessToken { get; set; }

    public ICollection<FeedbackAnswer> Answers { get; set; } = new List<FeedbackAnswer>();
    public ICollection<AbuseAlert> AbuseAlerts { get; set; } = new List<AbuseAlert>();
}
