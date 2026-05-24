using System.ComponentModel.DataAnnotations;

namespace SmartHospital.API.Models;

public class AiSummary
{
    public int Id { get; set; }

    public int? HospitalId { get; set; }
    public Hospital? Hospital { get; set; }

    /// <summary>Type: "monthly_feedback", "alert_analysis"</summary>
    [MaxLength(50)]
    public string SummaryType { get; set; } = "monthly_feedback";

    /// <summary>Related alert ID (for alert_analysis type)</summary>
    public int? AlertId { get; set; }

    [MaxLength(5000)]
    public string ContentRO { get; set; } = "";

    [MaxLength(5000)]
    public string ContentEN { get; set; } = "";

    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    /// <summary>User who triggered the generation</summary>
    [MaxLength(200)]
    public string? GeneratedBy { get; set; }

    /// <summary>Number of feedbacks analyzed for this summary</summary>
    public int FeedbackCount { get; set; }

    /// <summary>Latest feedback date considered</summary>
    public DateTime? LatestFeedbackDate { get; set; }

    /// <summary>Structured metadata (JSON): sentiment, severity, keyIssues, actionItems</summary>
    [MaxLength(5000)]
    public string? MetadataJson { get; set; }
}
