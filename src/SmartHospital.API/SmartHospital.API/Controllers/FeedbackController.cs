using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Data;
using SmartHospital.API.DTOs;
using SmartHospital.API.Hubs;
using SmartHospital.API.Models;
using SmartHospital.API.Services.AI;

namespace SmartHospital.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FeedbackController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHubContext<AlertHub> _alertHub;
    private readonly IAiService _ai;

    public FeedbackController(AppDbContext db, IHubContext<AlertHub> alertHub, IAiService ai)
    {
        _db = db;
        _alertHub = alertHub;
        _ai = ai;
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

    /// <summary>
    /// Scan a physical feedback form image using AI vision and extract answers.
    /// </summary>
    [HttpPost("scan/{hospitalId}")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10MB max
    public async Task<ActionResult> ScanFeedbackForm(int hospitalId, IFormFile image)
    {
        if (image == null || image.Length == 0)
            return BadRequest("No image provided");

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif" };
        if (!allowedTypes.Contains(image.ContentType.ToLower()))
            return BadRequest("Unsupported image format. Use JPEG, PNG, WebP or GIF.");

        if (!await _ai.IsEnabledAsync())
            return Ok(new { success = false, message = "AI is not enabled" });

        var questions = await _db.Questions.OrderBy(q => q.OrderIndex).ToListAsync();
        var hospital = await _db.Hospitals
            .Include(h => h.Departments.Where(d => d.IsActive))
            .FirstOrDefaultAsync(h => h.Id == hospitalId);
        if (hospital == null) return NotFound("Hospital not found");

        // Build question context for the AI
        var questionContext = string.Join("\n", questions.Select(q =>
            $"[Q{q.Id}] ({q.Type}) {q.TextRO} | Options: {q.OptionsJson ?? "N/A"} | WizardStep: {q.WizardStep}"));

        var departmentList = string.Join(", ", hospital.Departments.Select(d => $"{d.Id}={d.Name}"));

        var systemPrompt = @"Ești un asistent AI pentru un sistem spitalicesc. Analizezi textul extras prin OCR din formulare de feedback completate de pacienți.
Extrage răspunsurile din textul formularului scanat și mapează-le la întrebările din sistem.

IMPORTANT: Răspunde STRICT în format JSON valid. Nu adăuga text suplimentar.";

        var userMessage = $@"Analizează textul extras prin OCR din formularul de feedback completat și extrage răspunsurile.

Întrebările din sistem (mapează răspunsurile la aceste ID-uri):
{questionContext}

Departamente disponibile: {departmentList}

Răspunde STRICT în acest format JSON:
{{
  ""success"": true,
  ""patientGender"": ""Male"" sau ""Female"" sau null,
  ""patientAge"": număr sau null,
  ""departmentId"": ID departament sau null,
  ""filledBy"": ""Patient"" sau ""Relative"" sau ""Caregiver"",
  ""answers"": [
    {{ ""questionId"": ID, ""ratingValue"": 1-4 sau null, ""textValue"": ""text"" sau null, ""selectedOption"": ""opțiune"" sau null }}
  ],
  ""confidence"": 0.0-1.0,
  ""notes"": ""Observații despre calitatea scanării sau probleme identificate""
}}

Dacă nu poți citi formularul clar, returnează {{ ""success"": false, ""message"": ""Motivul"" }}.";

        try
        {
            using var memoryStream = new MemoryStream();
            await image.CopyToAsync(memoryStream);
            var imageBytes = memoryStream.ToArray();

            // Use OCR to extract text from image, then pass to text AI
            var tessDataPath = Path.Combine(AppContext.BaseDirectory, "tessdata");
            string ocrText;
            using (var engine = new Tesseract.TesseractEngine(tessDataPath, "ron+eng", Tesseract.EngineMode.Default))
            using (var pix = Tesseract.Pix.LoadFromMemory(imageBytes))
            using (var page = engine.Process(pix))
            {
                ocrText = page.GetText();
            }

            if (string.IsNullOrWhiteSpace(ocrText))
                return Ok(new { success = false, message = "Nu s-a putut extrage text din imagine. Încercați o imagine mai clară." });

            var fullPrompt = $"{userMessage}\n\n--- TEXT EXTRAS DIN FORMULAR (OCR) ---\n{ocrText}";
            var response = await _ai.CompleteAsync(systemPrompt, fullPrompt);

            // Parse the JSON response
            var jsonResponse = response.Trim();
            if (jsonResponse.StartsWith("```"))
            {
                var firstNl = jsonResponse.IndexOf('\n');
                var lastFence = jsonResponse.LastIndexOf("```");
                if (firstNl > 0 && lastFence > firstNl)
                    jsonResponse = jsonResponse[(firstNl + 1)..lastFence].Trim();
            }

            using var doc = JsonDocument.Parse(jsonResponse);
            var root = doc.RootElement;

            if (root.TryGetProperty("success", out var successProp) && !successProp.GetBoolean())
            {
                var msg = root.TryGetProperty("message", out var msgProp) ? msgProp.GetString() : "Could not read form";
                return Ok(new { success = false, message = msg });
            }

            // Return parsed data for frontend confirmation
            return Ok(new
            {
                success = true,
                parsed = JsonSerializer.Deserialize<JsonElement>(jsonResponse),
                hospitalId,
                hospitalName = hospital.Name,
            });
        }
        catch (JsonException)
        {
            return Ok(new { success = false, message = "AI returned invalid response format" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { success = false, message = $"Scan failed: {ex.Message}" });
        }
    }
}
