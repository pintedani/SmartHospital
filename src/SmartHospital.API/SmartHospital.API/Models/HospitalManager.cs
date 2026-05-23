using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;

namespace SmartHospital.API.Models;

public class HospitalManager : IdentityUser
{
    [Required, MaxLength(200)]
    public string FullName { get; set; } = string.Empty;

    public int? HospitalId { get; set; }
    public Hospital? Hospital { get; set; }

    public ManagerRole Role { get; set; } = ManagerRole.Viewer;
}
