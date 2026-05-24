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
    public AlertStatus Status { get; set; } = AlertStatus.Open;
    public EscalationLevel EscalationLevel { get; set; } = EscalationLevel.Level1_Department;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Case tracking
    [MaxLength(20)]
    public string TrackingCode { get; set; } = string.Empty;

    // Legacy field (kept for backward compat)
    public bool IsReviewed { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }

    // Case lifecycle
    public string? AcknowledgedBy { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
    public string? AssignedTo { get; set; }
    public DateTime? ResolvedAt { get; set; }

    [MaxLength(2000)]
    public string? ResolutionNotes { get; set; }

    [MaxLength(1000)]
    public string? Notes { get; set; }

    // Auto-escalation tracking
    public DateTime? EscalatedAt { get; set; }
}
