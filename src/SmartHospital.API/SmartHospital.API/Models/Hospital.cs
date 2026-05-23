using System.ComponentModel.DataAnnotations;

namespace SmartHospital.API.Models;

public class Hospital
{
    public int Id { get; set; }

    [Required, MaxLength(300)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(300)]
    public string NameEN { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string Address { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string City { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string County { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Phone { get; set; }

    [MaxLength(100)]
    public string? Email { get; set; }

    [MaxLength(200)]
    public string? Website { get; set; }

    public HospitalType Type { get; set; }

    public int TotalBeds { get; set; }
    public int TotalDoctors { get; set; }
    public int TotalNurses { get; set; }
    public int? YearFounded { get; set; }

    public double Latitude { get; set; }
    public double Longitude { get; set; }

    [MaxLength(500)]
    public string? LogoUrl { get; set; }

    [MaxLength(2000)]
    public string? Description { get; set; }

    [MaxLength(2000)]
    public string? DescriptionEN { get; set; }

    public bool IsActive { get; set; } = true;

    public ICollection<Department> Departments { get; set; } = new List<Department>();
    public ICollection<FeedbackSubmission> FeedbackSubmissions { get; set; } = new List<FeedbackSubmission>();
    public ICollection<AbuseAlert> AbuseAlerts { get; set; } = new List<AbuseAlert>();
}
