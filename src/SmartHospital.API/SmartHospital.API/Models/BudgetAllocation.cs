using System.ComponentModel.DataAnnotations;

namespace SmartHospital.API.Models;

public class BudgetAllocation
{
    public int Id { get; set; }

    public int HospitalId { get; set; }
    public Hospital Hospital { get; set; } = null!;

    public int DepartmentId { get; set; }
    public Department Department { get; set; } = null!;

    public int Year { get; set; }
    public int Month { get; set; }

    /// <summary>Total monthly budget in RON (plafon lunar)</summary>
    public decimal TotalBudgetRON { get; set; }

    /// <summary>Consumed budget in RON so far this month</summary>
    public decimal ConsumedBudgetRON { get; set; }

    /// <summary>Maximum cases contracted for this month (DRG)</summary>
    public int MaxCases { get; set; }

    /// <summary>Cases used so far</summary>
    public int UsedCases { get; set; }

    public BudgetStatus Status { get; set; } = BudgetStatus.Available;

    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
}

public enum BudgetStatus
{
    Available,
    Limited,
    Exhausted
}
