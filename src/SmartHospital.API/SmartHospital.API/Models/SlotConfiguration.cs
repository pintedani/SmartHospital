using System.ComponentModel.DataAnnotations;

namespace SmartHospital.API.Models;

public class SlotConfiguration
{
    public int Id { get; set; }

    public int DepartmentId { get; set; }
    public Department Department { get; set; } = null!;

    public DayOfWeek DayOfWeek { get; set; }

    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }

    public int SlotDurationMinutes { get; set; } = 30;
    public int MaxPatientsPerSlot { get; set; } = 2;

    public bool IsActive { get; set; } = true;
}
