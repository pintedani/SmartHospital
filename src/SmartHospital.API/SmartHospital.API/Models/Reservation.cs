using System.ComponentModel.DataAnnotations;

namespace SmartHospital.API.Models;

public class Reservation
{
    public int Id { get; set; }

    public int HospitalId { get; set; }
    public Hospital Hospital { get; set; } = null!;

    public int DepartmentId { get; set; }
    public Department Department { get; set; } = null!;

    [Required, MaxLength(200)]
    public string PatientName { get; set; } = string.Empty;

    [Required, MaxLength(20)]
    public string PatientPhone { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? PatientEmail { get; set; }

    [MaxLength(50)]
    public string? PatientCNP { get; set; }

    public DateOnly AppointmentDate { get; set; }
    public TimeOnly AppointmentTime { get; set; }

    public ReservationStatus Status { get; set; } = ReservationStatus.Pending;

    [Required, MaxLength(10)]
    public string AccessCode { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Notes { get; set; }

    [MaxLength(500)]
    public string? CancellationReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ConfirmedAt { get; set; }
    public string? ConfirmedBy { get; set; }
}

public enum ReservationStatus
{
    Pending,
    Confirmed,
    Cancelled,
    Completed,
    NoShow
}
