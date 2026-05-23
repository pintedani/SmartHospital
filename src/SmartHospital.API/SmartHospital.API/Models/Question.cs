using System.ComponentModel.DataAnnotations;

namespace SmartHospital.API.Models;

public class Question
{
    public int Id { get; set; }

    public QuestionCategory Category { get; set; }
    public QuestionType Type { get; set; }

    [Required, MaxLength(500)]
    public string TextRO { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string TextEN { get; set; } = string.Empty;

    public int OrderIndex { get; set; }
    public bool IsRequired { get; set; } = true;
    public bool IsCorruptionAlert { get; set; }

    /// <summary>
    /// JSON-serialized options for MultipleChoice questions, e.g. ["Option A","Option B"]
    /// </summary>
    [MaxLength(2000)]
    public string? OptionsJson { get; set; }

    public int WizardStep { get; set; }

    public ICollection<FeedbackAnswer> Answers { get; set; } = new List<FeedbackAnswer>();
}
