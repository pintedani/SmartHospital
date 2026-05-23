using System.ComponentModel.DataAnnotations;

namespace SmartHospital.API.Models;

public class FeedbackAnswer
{
    public int Id { get; set; }

    public int FeedbackSubmissionId { get; set; }
    public FeedbackSubmission FeedbackSubmission { get; set; } = null!;

    public int QuestionId { get; set; }
    public Question Question { get; set; } = null!;

    public int? RatingValue { get; set; }

    [MaxLength(2000)]
    public string? TextValue { get; set; }

    [MaxLength(500)]
    public string? SelectedOption { get; set; }
}
