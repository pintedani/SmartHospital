using System.ComponentModel.DataAnnotations;

namespace SmartHospital.API.Models;

public class AbuseAlert
{
    public int Id { get; set; }

    public int FeedbackSubmissionId { get; set; }
    public FeedbackSubmission FeedbackSubmission { get; set; } = null!;

    public int HospitalId { get; set; }
    public Hospital Hospital { get; set; } = null!;

    public int? DepartmentId { get; set; }

    public AlertType AlertType { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsReviewed { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }
}
