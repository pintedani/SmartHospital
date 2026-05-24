using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Data;
using SmartHospital.API.DTOs;
using SmartHospital.API.Models;
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

    [HttpGet("feedbacks/{hospitalId}")]
    public async Task<ActionResult<object>> GetFeedbacks(int hospitalId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _db.FeedbackSubmissions
            .Where(f => hospitalId == 0 || f.HospitalId == hospitalId)
            .Include(f => f.Hospital)
            .Include(f => f.Department)
            .Include(f => f.Answers).ThenInclude(a => a.Question)
            .OrderByDescending(f => f.SubmittedAt);

        var totalCount = await query.CountAsync();
        var feedbacks = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return new
        {
            totalCount,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
            items = feedbacks.Select(f => new
            {
                f.Id,
                f.HospitalId,
                HospitalName = f.Hospital.Name,
                DepartmentName = f.Department?.Name,
                SubmittedAt = f.SubmittedAt,
                PatientGender = f.PatientGender?.ToString(),
                PatientAge = f.PatientAge,
                FilledBy = f.FilledBy.ToString(),
                f.IsAnonymous,
                AverageRating = f.Answers.Where(a => a.RatingValue.HasValue).Select(a => a.RatingValue!.Value).DefaultIfEmpty(0).Average(),
                AnswerCount = f.Answers.Count,
                HasAlert = _db.AbuseAlerts.Any(al => al.FeedbackSubmissionId == f.Id),
            }).ToList()
        };
    }

    [HttpGet("alerts/{hospitalId}")]
    public async Task<ActionResult> GetAlerts(int hospitalId)
    {
        var alerts = await _db.AbuseAlerts
            .Where(a => hospitalId == 0 || a.HospitalId == hospitalId)
            .Include(a => a.Hospital)
            .Include(a => a.FeedbackSubmission)
            .ThenInclude(f => f.Department)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        return Ok(alerts.Select(a => new
        {
            a.Id, a.HospitalId,
            HospitalName = a.Hospital.Name,
            a.DepartmentId,
            DepartmentName = a.FeedbackSubmission.Department?.Name,
            AlertType = a.AlertType.ToString(),
            Status = a.Status.ToString(),
            EscalationLevel = a.EscalationLevel.ToString(),
            a.TrackingCode,
            a.CreatedAt, a.IsReviewed,
            a.ReviewedBy, a.ReviewedAt,
            a.AcknowledgedBy, a.AcknowledgedAt,
            a.AssignedTo, a.ResolvedAt,
            a.ResolutionNotes, a.Notes, a.EscalatedAt,
        }).ToList());
    }

    [HttpPut("alerts/{id}/status")]
    public async Task<IActionResult> UpdateAlertStatus(int id, [FromBody] AlertStatusUpdateDto dto)
    {
        var alert = await _db.AbuseAlerts.FindAsync(id);
        if (alert == null) return NotFound();

        var userName = User.Identity?.Name ?? "Unknown";

        if (Enum.TryParse<AlertStatus>(dto.Status, out var newStatus))
        {
            alert.Status = newStatus;

            switch (newStatus)
            {
                case AlertStatus.Acknowledged:
                    alert.AcknowledgedBy = userName;
                    alert.AcknowledgedAt = DateTime.UtcNow;
                    break;
                case AlertStatus.Resolved:
                case AlertStatus.Closed:
                    alert.IsReviewed = true;
                    alert.ReviewedBy = userName;
                    alert.ReviewedAt = DateTime.UtcNow;
                    alert.ResolvedAt = DateTime.UtcNow;
                    alert.ResolutionNotes = dto.Notes;
                    break;
            }
        }

        if (!string.IsNullOrEmpty(dto.AssignedTo))
            alert.AssignedTo = dto.AssignedTo;
        if (!string.IsNullOrEmpty(dto.Notes))
            alert.Notes = dto.Notes;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("alerts/{id}/escalate")]
    public async Task<IActionResult> EscalateAlert(int id)
    {
        var alert = await _db.AbuseAlerts.FindAsync(id);
        if (alert == null) return NotFound();

        if (alert.EscalationLevel < EscalationLevel.Level3_External)
        {
            alert.EscalationLevel++;
            alert.EscalatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(new { alert.EscalationLevel, alert.EscalatedAt });
    }

    [HttpGet("alerts/{id}/track/{trackingCode}")]
    [AllowAnonymous]
    public async Task<ActionResult> TrackAlert(int id, string trackingCode)
    {
        var alert = await _db.AbuseAlerts
            .Where(a => a.Id == id && a.TrackingCode == trackingCode)
            .Select(a => new
            {
                a.Id, a.TrackingCode,
                Status = a.Status.ToString(),
                EscalationLevel = a.EscalationLevel.ToString(),
                a.CreatedAt, a.AcknowledgedAt, a.ResolvedAt,
                HasResolution = a.ResolutionNotes != null,
            })
            .FirstOrDefaultAsync();

        if (alert == null) return NotFound(new { message = "Invalid tracking code" });
        return Ok(alert);
    }

    [HttpPut("alerts/{id}/review")]
    public async Task<IActionResult> ReviewAlert(int id, [FromBody] AlertReviewDto dto)
    {
        var alert = await _db.AbuseAlerts.FindAsync(id);
        if (alert == null) return NotFound();

        alert.IsReviewed = true;
        alert.Status = AlertStatus.Acknowledged;
        alert.ReviewedBy = User.Identity?.Name;
        alert.ReviewedAt = DateTime.UtcNow;
        alert.AcknowledgedBy = User.Identity?.Name;
        alert.AcknowledgedAt = DateTime.UtcNow;
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

    /// <summary>
    /// Trend detection: week-over-week category scores per department.
    /// Returns changes like "Cardiology cleanliness dropped 20% this week".
    /// </summary>
    [HttpGet("trends/{hospitalId}")]
    public async Task<ActionResult> GetTrends(int hospitalId)
    {
        var now = DateTime.UtcNow;
        var thisWeekStart = now.AddDays(-(int)now.DayOfWeek);
        var lastWeekStart = thisWeekStart.AddDays(-7);

        var feedbacks = await _db.FeedbackSubmissions
            .Where(f => hospitalId == 0 || f.HospitalId == hospitalId)
            .Where(f => f.SubmittedAt >= lastWeekStart)
            .Include(f => f.Department)
            .Include(f => f.Answers).ThenInclude(a => a.Question)
            .ToListAsync();

        var thisWeek = feedbacks.Where(f => f.SubmittedAt >= thisWeekStart).ToList();
        var lastWeek = feedbacks.Where(f => f.SubmittedAt >= lastWeekStart && f.SubmittedAt < thisWeekStart).ToList();

        var trends = new List<object>();

        // Group by department
        var departments = feedbacks.Where(f => f.Department != null).Select(f => f.Department!).DistinctBy(d => d.Id).ToList();

        foreach (var dept in departments)
        {
            var thisWeekDept = thisWeek.Where(f => f.DepartmentId == dept.Id).SelectMany(f => f.Answers).ToList();
            var lastWeekDept = lastWeek.Where(f => f.DepartmentId == dept.Id).SelectMany(f => f.Answers).ToList();

            if (thisWeekDept.Count == 0 && lastWeekDept.Count == 0) continue;

            // Per category
            var categories = thisWeekDept.Concat(lastWeekDept)
                .Where(a => a.RatingValue.HasValue)
                .Select(a => a.Question.Category)
                .Distinct();

            foreach (var cat in categories)
            {
                var thisAvg = thisWeekDept.Where(a => a.Question.Category == cat && a.RatingValue.HasValue)
                    .Select(a => (double)a.RatingValue!.Value).DefaultIfEmpty(0).Average();
                var lastAvg = lastWeekDept.Where(a => a.Question.Category == cat && a.RatingValue.HasValue)
                    .Select(a => (double)a.RatingValue!.Value).DefaultIfEmpty(0).Average();

                if (lastAvg == 0 && thisAvg == 0) continue;

                var changePercent = lastAvg > 0 ? ((thisAvg - lastAvg) / lastAvg) * 100 : (thisAvg > 0 ? 100 : 0);

                // Only report significant changes (>10%)
                if (Math.Abs(changePercent) >= 10)
                {
                    trends.Add(new
                    {
                        DepartmentId = dept.Id,
                        DepartmentName = dept.Name,
                        Category = cat.ToString(),
                        ThisWeekScore = Math.Round(thisAvg, 2),
                        LastWeekScore = Math.Round(lastAvg, 2),
                        ChangePercent = Math.Round(changePercent, 1),
                        Direction = changePercent > 0 ? "up" : "down",
                        Severity = Math.Abs(changePercent) >= 30 ? "high" : Math.Abs(changePercent) >= 20 ? "medium" : "low",
                    });
                }
            }
        }

        return Ok(new
        {
            period = new { thisWeekStart, lastWeekStart, now },
            thisWeekFeedbackCount = thisWeek.Count,
            lastWeekFeedbackCount = lastWeek.Count,
            trends = trends.OrderByDescending(t => Math.Abs(((dynamic)t).ChangePercent)).ToList(),
        });
    }

    /// <summary>
    /// Accountability metrics: response times, recurrence, resolution rates.
    /// </summary>
    [HttpGet("accountability/{hospitalId}")]
    public async Task<ActionResult> GetAccountabilityMetrics(int hospitalId)
    {
        var alerts = await _db.AbuseAlerts
            .Where(a => hospitalId == 0 || a.HospitalId == hospitalId)
            .Include(a => a.FeedbackSubmission).ThenInclude(f => f.Department)
            .ToListAsync();

        var totalAlerts = alerts.Count;
        var resolvedAlerts = alerts.Count(a => a.Status == AlertStatus.Resolved || a.Status == AlertStatus.Closed);
        var openAlerts = alerts.Count(a => a.Status == AlertStatus.Open);
        var acknowledgedAlerts = alerts.Count(a => a.AcknowledgedAt.HasValue);

        // Average response time (creation → acknowledgment)
        var responseTimesHours = alerts
            .Where(a => a.AcknowledgedAt.HasValue)
            .Select(a => (a.AcknowledgedAt!.Value - a.CreatedAt).TotalHours)
            .ToList();
        var avgResponseTimeHours = responseTimesHours.Count > 0 ? responseTimesHours.Average() : 0;

        // Average resolution time (creation → resolution)
        var resolutionTimesHours = alerts
            .Where(a => a.ResolvedAt.HasValue)
            .Select(a => (a.ResolvedAt!.Value - a.CreatedAt).TotalHours)
            .ToList();
        var avgResolutionTimeHours = resolutionTimesHours.Count > 0 ? resolutionTimesHours.Average() : 0;

        // Resolution rate
        var resolutionRate = totalAlerts > 0 ? (double)resolvedAlerts / totalAlerts * 100 : 0;

        // Recurrence: same department + same alert type within 30 days
        var recurrentIssues = alerts
            .Where(a => a.DepartmentId.HasValue)
            .GroupBy(a => new { a.DepartmentId, a.AlertType })
            .Where(g => g.Count() > 1)
            .Select(g =>
            {
                var sorted = g.OrderBy(a => a.CreatedAt).ToList();
                var recurring = sorted.Zip(sorted.Skip(1), (prev, curr) => new { prev, curr })
                    .Any(pair => (pair.curr.CreatedAt - pair.prev.CreatedAt).TotalDays <= 30);
                return new { g.Key.DepartmentId, g.Key.AlertType, IsRecurrent = recurring, Count = g.Count() };
            })
            .Where(x => x.IsRecurrent)
            .ToList();

        // Overdue alerts (open for more than 48h without acknowledgment)
        var overdueAlerts = alerts
            .Where(a => a.Status == AlertStatus.Open && !a.AcknowledgedAt.HasValue
                && (DateTime.UtcNow - a.CreatedAt).TotalHours > 48)
            .Count();

        // Alerts per department
        var alertsByDepartment = alerts
            .Where(a => a.FeedbackSubmission.Department != null)
            .GroupBy(a => a.FeedbackSubmission.Department!.Name)
            .Select(g => new
            {
                Department = g.Key,
                Total = g.Count(),
                Open = g.Count(a => a.Status == AlertStatus.Open),
                Resolved = g.Count(a => a.Status == AlertStatus.Resolved || a.Status == AlertStatus.Closed),
                AvgResponseHours = g.Where(a => a.AcknowledgedAt.HasValue)
                    .Select(a => (a.AcknowledgedAt!.Value - a.CreatedAt).TotalHours)
                    .DefaultIfEmpty(0).Average(),
            })
            .OrderByDescending(x => x.Total)
            .ToList();

        return Ok(new
        {
            totalAlerts,
            openAlerts,
            resolvedAlerts,
            acknowledgedAlerts,
            overdueAlerts,
            resolutionRate = Math.Round(resolutionRate, 1),
            avgResponseTimeHours = Math.Round(avgResponseTimeHours, 1),
            avgResolutionTimeHours = Math.Round(avgResolutionTimeHours, 1),
            recurrentIssues = recurrentIssues.Select(r => new
            {
                DepartmentId = r.DepartmentId,
                AlertType = r.AlertType.ToString(),
                OccurrenceCount = r.Count,
            }).ToList(),
            alertsByDepartment,
        });
    }
}
