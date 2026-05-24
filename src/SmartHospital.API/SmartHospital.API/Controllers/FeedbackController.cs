using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Data;
using SmartHospital.API.DTOs;
using SmartHospital.API.Hubs;
using SmartHospital.API.Models;

namespace SmartHospital.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FeedbackController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<AlertHub> _alertHub;

    public FeedbackController(AppDbContext db, IHubContext<AlertHub> alertHub)
    {
        _db = db;
        _alertHub = alertHub;
    }

    [HttpGet("questionnaire/{hospitalId}")]
    public async Task<ActionResult<object>> GetQuestionnaire(int hospitalId)
    {
        var hospital = await _db.Hospitals
            .Include(h => h.Departments.Where(d => d.IsActive))
            .FirstOrDefaultAsync(h => h.Id == hospitalId);

        if (hospital == null) return NotFound();

        var questions = await _db.Questions
            .OrderBy(q => q.OrderIndex)
            .ToListAsync();

        var questionDtos = questions.Select(q => new QuestionDto(
            q.Id, q.Category, q.Type, q.TextRO, q.TextEN,
            q.OrderIndex, q.IsRequired, q.IsCorruptionAlert,
            q.OptionsJson, q.WizardStep
        )).ToList();

        var departments = hospital.Departments.Select(d => new
        {
            d.Id,
            d.Name,
            d.NameEN,
            d.Specialty
        });

        return new
        {
            HospitalId = hospital.Id,
            HospitalName = hospital.Name,
            HospitalNameEN = hospital.NameEN,
            Departments = departments,
            Questions = questionDtos,
            WizardSteps = questionDtos.Select(q => q.WizardStep).Distinct().OrderBy(s => s).ToList()
        };
    }

    [HttpPost("submit")]
    public async Task<ActionResult<FeedbackSubmissionResultDto>> Submit([FromBody] FeedbackSubmitDto dto)
    {
        var hospital = await _db.Hospitals.FindAsync(dto.HospitalId);
        if (hospital == null) return NotFound("Hospital not found");

        if (dto.DepartmentId.HasValue)
        {
            var dept = await _db.Departments.FindAsync(dto.DepartmentId.Value);
            if (dept == null || dept.HospitalId != dto.HospitalId)
                return BadRequest("Invalid department");
        }

        var accessToken = Guid.NewGuid().ToString("N")[..16];

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        var submission = new FeedbackSubmission
        {
            HospitalId = dto.HospitalId,
            DepartmentId = dto.DepartmentId,
            PatientGender = dto.PatientGender,
            PatientAge = dto.PatientAge,
            FilledBy = dto.FilledBy,
            SubmittedAt = DateTime.UtcNow,
            AccessToken = accessToken,
            IsAnonymous = dto.IsAnonymous,
            UserId = dto.IsAnonymous ? null : userId,
        };

        foreach (var answerDto in dto.Answers)
        {
            var question = await _db.Questions.FindAsync(answerDto.QuestionId);
            if (question == null) continue;

            submission.Answers.Add(new FeedbackAnswer
            {
                QuestionId = answerDto.QuestionId,
                RatingValue = answerDto.RatingValue,
                TextValue = answerDto.TextValue,
                SelectedOption = answerDto.SelectedOption,
            });

            // Check for corruption alert
            if (question.IsCorruptionAlert && answerDto.SelectedOption?.ToLower() == "da")
            {
                var alert = new AbuseAlert
                {
                    FeedbackSubmission = submission,
                    HospitalId = dto.HospitalId,
                    DepartmentId = dto.DepartmentId,
                    AlertType = AlertType.MoneyRequested,
                    CreatedAt = DateTime.UtcNow,
                };

                _db.AbuseAlerts.Add(alert);

                // Real-time notification
                await _alertHub.Clients.Group($"hospital-{dto.HospitalId}")
                    .SendAsync("NewAbuseAlert", new
                    {
                        HospitalId = dto.HospitalId,
                        DepartmentId = dto.DepartmentId,
                        AlertType = AlertType.MoneyRequested.ToString(),
                        CreatedAt = DateTime.UtcNow,
                    });
            }
        }

        _db.FeedbackSubmissions.Add(submission);
        await _db.SaveChangesAsync();

        return Ok(new FeedbackSubmissionResultDto(submission.Id, submission.SubmittedAt, accessToken));
    }

    [HttpGet("qr/{hospitalId}/{departmentId?}")]
    public ActionResult GetQrData(int hospitalId, int? departmentId)
    {
        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        var feedbackUrl = departmentId.HasValue
            ? $"{baseUrl}/feedback/{hospitalId}?dept={departmentId}"
            : $"{baseUrl}/feedback/{hospitalId}";

        return Ok(new { Url = feedbackUrl, HospitalId = hospitalId, DepartmentId = departmentId });
    }

    [Authorize]
    [HttpGet("my")]
    public async Task<ActionResult> GetMyFeedback()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null) return Unauthorized();

        var feedbacks = await _db.FeedbackSubmissions
            .Include(f => f.Hospital)
            .Include(f => f.Department)
            .Include(f => f.Answers)
                .ThenInclude(a => a.Question)
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.SubmittedAt)
            .ToListAsync();

        var result = feedbacks.Select(f => new
        {
            f.Id,
            f.SubmittedAt,
            hospitalName = f.Hospital.Name,
            hospitalNameEN = f.Hospital.NameEN,
            departmentName = f.Department?.Name,
            departmentNameEN = f.Department?.NameEN,
            averageRating = f.Answers.Where(a => a.RatingValue.HasValue).Select(a => a.RatingValue!.Value).DefaultIfEmpty(0).Average(),
            answers = f.Answers.Select(a => new
            {
                question = a.Question.TextRO,
                questionEN = a.Question.TextEN,
                a.RatingValue,
                a.TextValue,
                a.SelectedOption,
            }),
        });

        return Ok(result);
    }
}
