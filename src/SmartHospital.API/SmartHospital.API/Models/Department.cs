using System.ComponentModel.DataAnnotations;

namespace SmartHospital.API.Models;

public class Department
{
    public int Id { get; set; }

    public int HospitalId { get; set; }
    public Hospital Hospital { get; set; } = null!;

    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string NameEN { get; set; } = string.Empty;

    public DepartmentSpecialty Specialty { get; set; }

    public int? Floor { get; set; }
    public int BedsCount { get; set; }
    public int DoctorsCount { get; set; }
    public int NursesCount { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<FeedbackSubmission> FeedbackSubmissions { get; set; } = new List<FeedbackSubmission>();
}
