using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Data;
using SmartHospital.API.DTOs;
using SmartHospital.API.Services;

namespace SmartHospital.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AnalyticsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PdfReportService _pdfService;

    public AnalyticsController(AppDbContext db, PdfReportService pdfService)
    {
        _db = db;
        _pdfService = pdfService;
    }

    [HttpGet("overview/{hospitalId}")]
    public async Task<ActionResult<AnalyticsOverviewDto>> GetOverview(int hospitalId)
    {
        if (hospitalId == 0) return await GetOverviewAll();
        
        var hospital = await _db.Hospitals.FindAsync(hospitalId);
        if (hospital == null) return NotFound();

        var feedbacks = await _db.FeedbackSubmissions
            .Where(f => f.HospitalId == hospitalId)
            .Include(f => f.Answers)
            .ThenInclude(a => a.Question)
            .ToListAsync();

        var allAnswers = feedbacks.SelectMany(f => f.Answers).ToList();

        var avgSatisfaction = allAnswers
            .Where(a => a.RatingValue.HasValue)
            .Select(a => (double)a.RatingValue!.Value)
            .DefaultIfEmpty(0)
            .Average();

        var categoryScores = allAnswers
            .Where(a => a.RatingValue.HasValue)
            .GroupBy(a => a.Question.Category.ToString())
            .ToDictionary(g => g.Key, g => g.Average(a => (double)a.RatingValue!.Value));

        var totalAlerts = await _db.AbuseAlerts.CountAsync(a => a.HospitalId == hospitalId);
        var unreviewedAlerts = await _db.AbuseAlerts.CountAsync(a => a.HospitalId == hospitalId && !a.IsReviewed);

        var weeklyTrend = feedbacks
            .Where(f => f.SubmittedAt >= DateTime.UtcNow.AddDays(-90))
            .GroupBy(f =>
            {
                var startOfWeek = f.SubmittedAt.Date.AddDays(-(int)f.SubmittedAt.DayOfWeek);
                return startOfWeek.ToString("yyyy-MM-dd");
            })
            .OrderBy(g => g.Key)
            .Select(g => new TrendPointDto(
                g.Key,
                g.SelectMany(f => f.Answers).Where(a => a.RatingValue.HasValue)
                    .Select(a => (double)a.RatingValue!.Value).DefaultIfEmpty(0).Average(),
                g.Count()
            ))
            .ToList();

        return new AnalyticsOverviewDto(
            feedbacks.Count, avgSatisfaction, totalAlerts, unreviewedAlerts,
            categoryScores, weeklyTrend
        );
    }

    private async Task<ActionResult<AnalyticsOverviewDto>> GetOverviewAll()
    {
        var feedbacks = await _db.FeedbackSubmissions
            .Include(f => f.Answers)
            .ThenInclude(a => a.Question)
            .ToListAsync();

        var allAnswers = feedbacks.SelectMany(f => f.Answers).ToList();

        var avgSatisfaction = allAnswers
            .Where(a => a.RatingValue.HasValue)
            .Select(a => (double)a.RatingValue!.Value)
            .DefaultIfEmpty(0)
            .Average();

        var categoryScores = allAnswers
            .Where(a => a.RatingValue.HasValue)
            .GroupBy(a => a.Question.Category.ToString())
            .ToDictionary(g => g.Key, g => g.Average(a => (double)a.RatingValue!.Value));

        var totalAlerts = await _db.AbuseAlerts.CountAsync();
        var unreviewedAlerts = await _db.AbuseAlerts.CountAsync(a => !a.IsReviewed);

        var weeklyTrend = feedbacks
            .Where(f => f.SubmittedAt >= DateTime.UtcNow.AddDays(-90))
            .GroupBy(f =>
            {
                var startOfWeek = f.SubmittedAt.Date.AddDays(-(int)f.SubmittedAt.DayOfWeek);
                return startOfWeek.ToString("yyyy-MM-dd");
            })
            .OrderBy(g => g.Key)
            .Select(g => new TrendPointDto(
                g.Key,
                g.SelectMany(f => f.Answers).Where(a => a.RatingValue.HasValue)
                    .Select(a => (double)a.RatingValue!.Value).DefaultIfEmpty(0).Average(),
                g.Count()
            ))
            .ToList();

        return new AnalyticsOverviewDto(
            feedbacks.Count, avgSatisfaction, totalAlerts, unreviewedAlerts,
            categoryScores, weeklyTrend
        );
    }

    [HttpGet("departments/{hospitalId}")]
    public async Task<ActionResult<List<DepartmentComparisonDto>>> GetDepartmentComparison(int hospitalId)
    {
        var departments = await _db.Departments
            .Where(d => (hospitalId == 0 || d.HospitalId == hospitalId) && d.IsActive)
            .ToListAsync();

        var result = new List<DepartmentComparisonDto>();

        foreach (var dept in departments)
        {
            var feedbacks = await _db.FeedbackSubmissions
                .Where(f => f.DepartmentId == dept.Id)
                .Include(f => f.Answers)
                .ThenInclude(a => a.Question)
                .ToListAsync();

            if (feedbacks.Count == 0) continue;

            var allAnswers = feedbacks.SelectMany(f => f.Answers).ToList();

            var avgSatisfaction = allAnswers
                .Where(a => a.RatingValue.HasValue)
                .Select(a => (double)a.RatingValue!.Value)
                .DefaultIfEmpty(0).Average();

            var catScores = allAnswers
                .Where(a => a.RatingValue.HasValue)
                .GroupBy(a => a.Question.Category.ToString())
                .ToDictionary(g => g.Key, g => g.Average(a => (double)a.RatingValue!.Value));

            result.Add(new DepartmentComparisonDto(
                dept.Id, dept.Name, dept.NameEN, avgSatisfaction, feedbacks.Count, catScores
            ));
        }

        return result;
    }

    [HttpGet("alerts/{hospitalId}")]
    public async Task<ActionResult<List<AbuseAlertDto>>> GetAlerts(int hospitalId)
    {
        var alerts = await _db.AbuseAlerts
            .Where(a => hospitalId == 0 || a.HospitalId == hospitalId)
            .Include(a => a.Hospital)
            .Include(a => a.FeedbackSubmission)
            .ThenInclude(f => f.Department)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        return alerts.Select(a => new AbuseAlertDto(
            a.Id, a.HospitalId, a.Hospital.Name,
            a.DepartmentId, a.FeedbackSubmission.Department?.Name,
            a.AlertType, a.CreatedAt, a.IsReviewed,
            a.ReviewedBy, a.ReviewedAt, a.Notes
        )).ToList();
    }

    [HttpPut("alerts/{id}/review")]
    public async Task<IActionResult> ReviewAlert(int id, [FromBody] AlertReviewDto dto)
    {
        var alert = await _db.AbuseAlerts.FindAsync(id);
        if (alert == null) return NotFound();

        alert.IsReviewed = true;
        alert.ReviewedBy = User.Identity?.Name;
        alert.ReviewedAt = DateTime.UtcNow;
        alert.Notes = dto.Notes;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("alerts/{id}/feedback")]
    public async Task<ActionResult<object>> GetAlertFeedback(int id)
    {
        var alert = await _db.AbuseAlerts
            .Include(a => a.FeedbackSubmission)
            .ThenInclude(f => f.Answers)
            .ThenInclude(a => a.Question)
            .Include(a => a.FeedbackSubmission)
            .ThenInclude(f => f.Department)
            .Include(a => a.Hospital)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (alert == null) return NotFound();

        var submission = alert.FeedbackSubmission;

        return new
        {
            AlertId = alert.Id,
            AlertType = alert.AlertType.ToString(),
            HospitalName = alert.Hospital.Name,
            DepartmentName = submission.Department?.Name,
            SubmittedAt = submission.SubmittedAt,
            PatientGender = submission.PatientGender?.ToString(),
            PatientAge = submission.PatientAge,
            FilledBy = submission.FilledBy.ToString(),
            Answers = submission.Answers
                .OrderBy(a => a.Question.OrderIndex)
                .Select(a => new
                {
                    QuestionTextRO = a.Question.TextRO,
                    QuestionTextEN = a.Question.TextEN,
                    QuestionType = a.Question.Type.ToString(),
                    QuestionCategory = a.Question.Category.ToString(),
                    a.RatingValue,
                    a.TextValue,
                    a.SelectedOption,
                    a.Question.IsCorruptionAlert,
                })
                .ToList()
        };
    }

    [HttpGet("report/{hospitalId}/pdf")]
    public async Task<IActionResult> DownloadPdfReport(int hospitalId)
    {
        var hospital = await _db.Hospitals
            .Include(h => h.Departments.Where(d => d.IsActive))
            .FirstOrDefaultAsync(h => h.Id == hospitalId);

        if (hospital == null) return NotFound();

        // Build HospitalDetailDto
        var departments = hospital.Departments.Select(d => new DepartmentDto(
            d.Id, d.HospitalId, d.Name, d.NameEN, d.Specialty,
            d.Floor, d.BedsCount, d.DoctorsCount, d.NursesCount, null, 0
        )).ToList();

        var avgRating = await _db.FeedbackAnswers
            .Where(a => a.FeedbackSubmission.HospitalId == hospitalId && a.RatingValue.HasValue)
            .Select(a => (double)a.RatingValue!.Value)
            .DefaultIfEmpty(0).AverageAsync();

        var feedbackCount = await _db.FeedbackSubmissions.CountAsync(f => f.HospitalId == hospitalId);

        var hospitalDto = new HospitalDetailDto(
            hospital.Id, hospital.Name, hospital.NameEN, hospital.Address,
            hospital.City, hospital.County, hospital.Phone, hospital.Email,
            hospital.Website, hospital.Type, hospital.TotalBeds,
            hospital.TotalDoctors, hospital.TotalNurses, hospital.YearFounded,
            hospital.Latitude, hospital.Longitude, hospital.Description,
            hospital.DescriptionEN, avgRating > 0 ? avgRating : null, feedbackCount,
            departments
        );

        // Build stats
        var feedbacks = await _db.FeedbackSubmissions
            .Where(f => f.HospitalId == hospitalId)
            .Include(f => f.Answers).ThenInclude(a => a.Question)
            .ToListAsync();

        var allAnswers = feedbacks.SelectMany(f => f.Answers).ToList();

        var categoryScores = allAnswers
            .Where(a => a.RatingValue.HasValue)
            .GroupBy(a => a.Question.Category.ToString())
            .ToDictionary(g => g.Key, g => g.Average(a => (double)a.RatingValue!.Value));

        var abuseCount = await _db.AbuseAlerts.CountAsync(a => a.HospitalId == hospitalId);

        var monthlyTrend = feedbacks
            .GroupBy(f => f.SubmittedAt.ToString("yyyy-MM"))
            .OrderBy(g => g.Key)
            .Select(g => new TrendPointDto(
                g.Key,
                g.SelectMany(f => f.Answers).Where(a => a.RatingValue.HasValue)
                    .Select(a => (double)a.RatingValue!.Value).DefaultIfEmpty(0).Average(),
                g.Count()
            )).ToList();

        var deptComparison = new List<DepartmentComparisonDto>();
        foreach (var dept in hospital.Departments)
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
            deptComparison.Add(new DepartmentComparisonDto(dept.Id, dept.Name, dept.NameEN, deptAvg, deptFeedbacks.Count, deptCatScores));
        }

        var statsDto = new HospitalStatsDto(
            feedbacks.Count, avgRating > 0 ? avgRating : 0, categoryScores,
            abuseCount, monthlyTrend, deptComparison
        );

        var pdfBytes = _pdfService.GenerateHospitalReport(hospitalDto, statsDto);

        return File(pdfBytes, "application/pdf", $"SmartHospital_Report_{hospital.Name.Replace(" ", "_")}.pdf");
    }

    [HttpGet("export/{hospitalId}/csv")]
    public async Task<IActionResult> ExportCsv(int hospitalId)
    {
        var feedbacks = await _db.FeedbackSubmissions
            .Where(f => f.HospitalId == hospitalId)
            .Include(f => f.Answers).ThenInclude(a => a.Question)
            .Include(f => f.Department)
            .OrderByDescending(f => f.SubmittedAt)
            .ToListAsync();

        var csv = new System.Text.StringBuilder();
        csv.AppendLine("SubmissionId,Date,Department,Gender,Age,FilledBy,QuestionCategory,Question,Rating,SelectedOption,TextValue");

        foreach (var f in feedbacks)
        {
            foreach (var a in f.Answers)
            {
                csv.AppendLine(string.Join(",",
                    f.Id,
                    f.SubmittedAt.ToString("yyyy-MM-dd"),
                    EscapeCsv(f.Department?.Name ?? "N/A"),
                    f.PatientGender?.ToString() ?? "N/A",
                    f.PatientAge?.ToString() ?? "N/A",
                    f.FilledBy.ToString(),
                    a.Question.Category.ToString(),
                    EscapeCsv(a.Question.TextEN),
                    a.RatingValue?.ToString() ?? "",
                    EscapeCsv(a.SelectedOption ?? ""),
                    EscapeCsv(a.TextValue ?? "")
                ));
            }
        }

        return File(System.Text.Encoding.UTF8.GetBytes(csv.ToString()), "text/csv",
            $"SmartHospital_Export_{hospitalId}.csv");
    }

    private static string EscapeCsv(string value)
    {
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}
