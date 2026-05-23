using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Data;
using SmartHospital.API.DTOs;
using SmartHospital.API.Models;

namespace SmartHospital.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DepartmentsController : ControllerBase
{
    private readonly AppDbContext _db;

    public DepartmentsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<List<DepartmentDto>>> GetByHospital([FromQuery] int hospitalId)
    {
        var departments = await _db.Departments
            .Where(d => d.HospitalId == hospitalId && d.IsActive)
            .ToListAsync();

        var result = new List<DepartmentDto>();
        foreach (var d in departments)
        {
            var avgRating = await _db.FeedbackAnswers
                .Where(a => a.FeedbackSubmission.DepartmentId == d.Id && a.RatingValue.HasValue)
                .Select(a => (double)a.RatingValue!.Value)
                .DefaultIfEmpty()
                .AverageAsync();

            var count = await _db.FeedbackSubmissions.CountAsync(f => f.DepartmentId == d.Id);

            result.Add(new DepartmentDto(
                d.Id, d.HospitalId, d.Name, d.NameEN, d.Specialty,
                d.Floor, d.BedsCount, d.DoctorsCount, d.NursesCount,
                avgRating > 0 ? avgRating : null, count
            ));
        }

        return result;
    }

    [Authorize]
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] DepartmentCreateDto dto)
    {
        var hospital = await _db.Hospitals.FindAsync(dto.HospitalId);
        if (hospital == null) return NotFound("Hospital not found");

        var dept = new Department
        {
            HospitalId = dto.HospitalId,
            Name = dto.Name,
            NameEN = dto.NameEN,
            Specialty = dto.Specialty,
            Floor = dto.Floor,
            BedsCount = dto.BedsCount,
            DoctorsCount = dto.DoctorsCount,
            NursesCount = dto.NursesCount,
            Description = dto.Description,
        };

        _db.Departments.Add(dept);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetByHospital), new { hospitalId = dept.HospitalId }, null);
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] DepartmentUpdateDto dto)
    {
        var dept = await _db.Departments.FindAsync(id);
        if (dept == null) return NotFound();

        dept.Name = dto.Name;
        dept.NameEN = dto.NameEN;
        dept.Specialty = dto.Specialty;
        dept.Floor = dto.Floor;
        dept.BedsCount = dto.BedsCount;
        dept.DoctorsCount = dto.DoctorsCount;
        dept.NursesCount = dto.NursesCount;
        dept.Description = dto.Description;
        dept.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return NoContent();
    }
}
