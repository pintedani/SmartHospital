using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Data;
using SmartHospital.API.DTOs;
using SmartHospital.API.Models;

namespace SmartHospital.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HospitalsController : ControllerBase
{
    private readonly AppDbContext _db;

    public HospitalsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<List<HospitalListDto>>> GetAll(
        [FromQuery] string? city,
        [FromQuery] string? county,
        [FromQuery] HospitalType? type,
        [FromQuery] string? search,
        [FromQuery] string sortBy = "name",
        [FromQuery] bool desc = false)
    {
        var query = _db.Hospitals.Where(h => h.IsActive).AsQueryable();

        if (!string.IsNullOrEmpty(city))
            query = query.Where(h => h.City.ToLower().Contains(city.ToLower()));
        if (!string.IsNullOrEmpty(county))
            query = query.Where(h => h.County.ToLower().Contains(county.ToLower()));
        if (type.HasValue)
            query = query.Where(h => h.Type == type.Value);
        if (!string.IsNullOrEmpty(search))
            query = query.Where(h => h.Name.ToLower().Contains(search.ToLower()) ||
                                     h.NameEN.ToLower().Contains(search.ToLower()));

        var hospitals = await query.ToListAsync();

        var result = new List<HospitalListDto>();
        foreach (var h in hospitals)
        {
            var feedbacks = await _db.FeedbackSubmissions
                .Where(f => f.HospitalId == h.Id)
                .ToListAsync();

            var avgRating = await GetAverageRating(h.Id);

            result.Add(new HospitalListDto(
                h.Id, h.Name, h.NameEN, h.City, h.County, h.Type,
                h.TotalBeds, h.TotalDoctors, h.TotalNurses,
                h.Latitude, h.Longitude, avgRating, feedbacks.Count
            ));
        }

        result = sortBy.ToLower() switch
        {
            "beds" => desc ? result.OrderByDescending(h => h.TotalBeds).ToList() : result.OrderBy(h => h.TotalBeds).ToList(),
            "doctors" => desc ? result.OrderByDescending(h => h.TotalDoctors).ToList() : result.OrderBy(h => h.TotalDoctors).ToList(),
            "rating" => desc ? result.OrderByDescending(h => h.AverageRating ?? 0).ToList() : result.OrderBy(h => h.AverageRating ?? 0).ToList(),
            "feedback" => desc ? result.OrderByDescending(h => h.FeedbackCount).ToList() : result.OrderBy(h => h.FeedbackCount).ToList(),
            _ => desc ? result.OrderByDescending(h => h.Name).ToList() : result.OrderBy(h => h.Name).ToList()
        };

        return result;
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<HospitalDetailDto>> GetById(int id)
    {
        var h = await _db.Hospitals
            .Include(x => x.Departments.Where(d => d.IsActive))
            .FirstOrDefaultAsync(x => x.Id == id);

        if (h == null) return NotFound();

        var departments = new List<DepartmentDto>();
        foreach (var d in h.Departments)
        {
            var deptAvg = await GetDepartmentAverageRating(d.Id);
            var deptCount = await _db.FeedbackSubmissions.CountAsync(f => f.DepartmentId == d.Id);
            departments.Add(new DepartmentDto(
                d.Id, d.HospitalId, d.Name, d.NameEN, d.Specialty,
                d.Floor, d.BedsCount, d.DoctorsCount, d.NursesCount,
                deptAvg, deptCount
            ));
        }

        var avgRating = await GetAverageRating(h.Id);
        var feedbackCount = await _db.FeedbackSubmissions.CountAsync(f => f.HospitalId == h.Id);

        return new HospitalDetailDto(
            h.Id, h.Name, h.NameEN, h.Address, h.City, h.County,
            h.Phone, h.Email, h.Website, h.Type,
            h.TotalBeds, h.TotalDoctors, h.TotalNurses, h.YearFounded,
            h.Latitude, h.Longitude, h.Description, h.DescriptionEN,
            avgRating, feedbackCount, departments
        );
    }

    [HttpGet("{id}/stats")]
    public async Task<ActionResult<HospitalStatsDto>> GetStats(int id)
    {
        var hospital = await _db.Hospitals.FindAsync(id);
        if (hospital == null) return NotFound();

        var feedbacks = await _db.FeedbackSubmissions
            .Where(f => f.HospitalId == id)
            .Include(f => f.Answers)
            .ThenInclude(a => a.Question)
            .ToListAsync();

        var avgSatisfaction = feedbacks.SelectMany(f => f.Answers)
            .Where(a => a.RatingValue.HasValue)
            .Select(a => (double)a.RatingValue!.Value)
            .DefaultIfEmpty(0)
            .Average();

        var categoryScores = feedbacks.SelectMany(f => f.Answers)
            .Where(a => a.RatingValue.HasValue)
            .GroupBy(a => a.Question.Category.ToString())
            .ToDictionary(g => g.Key, g => g.Average(a => (double)a.RatingValue!.Value));

        var abuseCount = await _db.AbuseAlerts.CountAsync(a => a.HospitalId == id);

        var monthlyTrend = feedbacks
            .GroupBy(f => f.SubmittedAt.ToString("yyyy-MM"))
            .OrderBy(g => g.Key)
            .Select(g => new TrendPointDto(
                g.Key,
                g.SelectMany(f => f.Answers).Where(a => a.RatingValue.HasValue)
                    .Select(a => (double)a.RatingValue!.Value).DefaultIfEmpty(0).Average(),
                g.Count()
            ))
            .ToList();

        var departments = await _db.Departments.Where(d => d.HospitalId == id && d.IsActive).ToListAsync();
        var deptComparison = new List<DepartmentComparisonDto>();
        foreach (var dept in departments)
        {
            var deptFeedbacks = feedbacks.Where(f => f.DepartmentId == dept.Id).ToList();
            if (deptFeedbacks.Count == 0) continue;

            var deptAvg = deptFeedbacks.SelectMany(f => f.Answers)
                .Where(a => a.RatingValue.HasValue)
                .Select(a => (double)a.RatingValue!.Value)
                .DefaultIfEmpty(0).Average();

            var deptCatScores = deptFeedbacks.SelectMany(f => f.Answers)
                .Where(a => a.RatingValue.HasValue)
                .GroupBy(a => a.Question.Category.ToString())
                .ToDictionary(g => g.Key, g => g.Average(a => (double)a.RatingValue!.Value));

            deptComparison.Add(new DepartmentComparisonDto(
                dept.Id, dept.Name, dept.NameEN, deptAvg, deptFeedbacks.Count, deptCatScores
            ));
        }

        return new HospitalStatsDto(
            feedbacks.Count, avgSatisfaction, categoryScores,
            abuseCount, monthlyTrend, deptComparison
        );
    }

    [Authorize]
    [HttpPost]
    public async Task<ActionResult<HospitalDetailDto>> Create([FromBody] HospitalCreateDto dto)
    {
        var hospital = new Hospital
        {
            Name = dto.Name,
            NameEN = dto.NameEN,
            Address = dto.Address,
            City = dto.City,
            County = dto.County,
            Phone = dto.Phone,
            Email = dto.Email,
            Website = dto.Website,
            Type = dto.Type,
            TotalBeds = dto.TotalBeds,
            TotalDoctors = dto.TotalDoctors,
            TotalNurses = dto.TotalNurses,
            YearFounded = dto.YearFounded,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            Description = dto.Description,
            DescriptionEN = dto.DescriptionEN,
        };

        _db.Hospitals.Add(hospital);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = hospital.Id }, null);
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] HospitalUpdateDto dto)
    {
        var hospital = await _db.Hospitals.FindAsync(id);
        if (hospital == null) return NotFound();

        hospital.Name = dto.Name;
        hospital.NameEN = dto.NameEN;
        hospital.Address = dto.Address;
        hospital.City = dto.City;
        hospital.County = dto.County;
        hospital.Phone = dto.Phone;
        hospital.Email = dto.Email;
        hospital.Website = dto.Website;
        hospital.Type = dto.Type;
        hospital.TotalBeds = dto.TotalBeds;
        hospital.TotalDoctors = dto.TotalDoctors;
        hospital.TotalNurses = dto.TotalNurses;
        hospital.YearFounded = dto.YearFounded;
        hospital.Latitude = dto.Latitude;
        hospital.Longitude = dto.Longitude;
        hospital.Description = dto.Description;
        hospital.DescriptionEN = dto.DescriptionEN;
        hospital.IsActive = dto.IsActive;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<double?> GetAverageRating(int hospitalId)
    {
        var ratings = await _db.FeedbackAnswers
            .Where(a => a.FeedbackSubmission.HospitalId == hospitalId
                && a.RatingValue.HasValue
                && a.Question.Type == QuestionType.Smiley)
            .Select(a => (double)a.RatingValue!.Value)
            .ToListAsync();

        return ratings.Count > 0 ? ratings.Average() : null;
    }

    private async Task<double?> GetDepartmentAverageRating(int departmentId)
    {
        var ratings = await _db.FeedbackAnswers
            .Where(a => a.FeedbackSubmission.DepartmentId == departmentId
                && a.RatingValue.HasValue
                && a.Question.Type == QuestionType.Smiley)
            .Select(a => (double)a.RatingValue!.Value)
            .ToListAsync();

        return ratings.Count > 0 ? ratings.Average() : null;
    }
}
