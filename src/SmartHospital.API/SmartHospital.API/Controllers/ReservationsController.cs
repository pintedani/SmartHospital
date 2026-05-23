using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Data;
using SmartHospital.API.Models;

namespace SmartHospital.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReservationsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ReservationsController(AppDbContext context)
    {
        _context = context;
    }

    // GET api/reservations/slots?departmentId=1&date=2026-06-01
    [HttpGet("slots")]
    public async Task<IActionResult> GetAvailableSlots([FromQuery] int departmentId, [FromQuery] DateOnly date)
    {
        var dayOfWeek = date.DayOfWeek;

        var configs = await _context.SlotConfigurations
            .Where(s => s.DepartmentId == departmentId && s.DayOfWeek == dayOfWeek && s.IsActive)
            .ToListAsync();

        if (!configs.Any())
            return Ok(new List<object>());

        // Get existing reservations for this dept+date (exclude cancelled)
        var existingReservations = await _context.Reservations
            .Where(r => r.DepartmentId == departmentId
                        && r.AppointmentDate == date
                        && r.Status != ReservationStatus.Cancelled)
            .ToListAsync();

        var slots = new List<object>();
        foreach (var config in configs)
        {
            var current = config.StartTime;
            while (current < config.EndTime)
            {
                var booked = existingReservations.Count(r => r.AppointmentTime == current);
                slots.Add(new
                {
                    time = current.ToString("HH:mm"),
                    available = config.MaxPatientsPerSlot - booked,
                    maxCapacity = config.MaxPatientsPerSlot,
                    isFull = booked >= config.MaxPatientsPerSlot
                });
                current = current.AddMinutes(config.SlotDurationMinutes);
            }
        }

        return Ok(slots);
    }

    // GET api/reservations/departments?hospitalId=1
    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments([FromQuery] int hospitalId)
    {
        var departments = await _context.Departments
            .Where(d => d.HospitalId == hospitalId && d.IsActive)
            .Select(d => new { d.Id, d.Name, d.NameEN, d.Specialty })
            .ToListAsync();

        return Ok(departments);
    }

    // POST api/reservations
    [HttpPost]
    public async Task<IActionResult> CreateReservation([FromBody] CreateReservationRequest request)
    {
        // Validate department belongs to hospital
        var department = await _context.Departments
            .FirstOrDefaultAsync(d => d.Id == request.DepartmentId && d.HospitalId == request.HospitalId);

        if (department == null)
            return BadRequest(new { error = "Invalid department or hospital" });

        var date = DateOnly.Parse(request.AppointmentDate);
        var time = TimeOnly.Parse(request.AppointmentTime);

        // Validate slot availability
        var dayOfWeek = date.DayOfWeek;
        var config = await _context.SlotConfigurations
            .FirstOrDefaultAsync(s => s.DepartmentId == request.DepartmentId
                                      && s.DayOfWeek == dayOfWeek
                                      && s.IsActive
                                      && s.StartTime <= time
                                      && s.EndTime > time);

        if (config == null)
            return BadRequest(new { error = "No slot configuration found for this time" });

        var booked = await _context.Reservations.CountAsync(r =>
            r.DepartmentId == request.DepartmentId
            && r.AppointmentDate == date
            && r.AppointmentTime == time
            && r.Status != ReservationStatus.Cancelled);

        if (booked >= config.MaxPatientsPerSlot)
            return BadRequest(new { error = "This time slot is fully booked" });

        var reservation = new Reservation
        {
            HospitalId = request.HospitalId,
            DepartmentId = request.DepartmentId,
            PatientName = request.PatientName,
            PatientPhone = request.PatientPhone,
            PatientEmail = request.PatientEmail,
            PatientCNP = request.PatientCNP,
            AppointmentDate = date,
            AppointmentTime = time,
            Notes = request.Notes,
            AccessCode = GenerateAccessCode(),
            Status = ReservationStatus.Pending,
            CreatedAt = DateTime.UtcNow,
        };

        _context.Reservations.Add(reservation);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            reservation.Id,
            reservation.AccessCode,
            reservation.Status,
            reservation.AppointmentDate,
            appointmentTime = reservation.AppointmentTime.ToString("HH:mm"),
            hospitalName = (await _context.Hospitals.FindAsync(reservation.HospitalId))?.Name,
            departmentName = department.Name,
        });
    }

    // GET api/reservations/status/{accessCode}
    [HttpGet("status/{accessCode}")]
    public async Task<IActionResult> GetReservationStatus(string accessCode)
    {
        var reservation = await _context.Reservations
            .Include(r => r.Hospital)
            .Include(r => r.Department)
            .FirstOrDefaultAsync(r => r.AccessCode == accessCode);

        if (reservation == null)
            return NotFound(new { error = "Reservation not found" });

        return Ok(new
        {
            reservation.Id,
            reservation.AccessCode,
            reservation.PatientName,
            reservation.PatientPhone,
            reservation.PatientEmail,
            appointmentDate = reservation.AppointmentDate.ToString("yyyy-MM-dd"),
            appointmentTime = reservation.AppointmentTime.ToString("HH:mm"),
            reservation.Status,
            reservation.Notes,
            reservation.CancellationReason,
            reservation.CreatedAt,
            reservation.ConfirmedAt,
            hospitalName = reservation.Hospital.Name,
            hospitalNameEN = reservation.Hospital.NameEN,
            departmentName = reservation.Department.Name,
            departmentNameEN = reservation.Department.NameEN,
        });
    }

    // PUT api/reservations/{id}/cancel
    [HttpPut("{id}/cancel")]
    public async Task<IActionResult> CancelReservation(int id, [FromBody] CancelRequest? request)
    {
        var reservation = await _context.Reservations.FindAsync(id);
        if (reservation == null)
            return NotFound();

        reservation.Status = ReservationStatus.Cancelled;
        reservation.CancellationReason = request?.Reason;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Reservation cancelled" });
    }

    // GET api/reservations/manage?hospitalId=1&date=2026-06-01&status=Pending
    [Authorize]
    [HttpGet("manage")]
    public async Task<IActionResult> GetReservationsForManagement(
        [FromQuery] int? hospitalId,
        [FromQuery] string? date,
        [FromQuery] string? status)
    {
        var query = _context.Reservations
            .Include(r => r.Hospital)
            .Include(r => r.Department)
            .AsQueryable();

        if (hospitalId.HasValue && hospitalId > 0)
            query = query.Where(r => r.HospitalId == hospitalId);

        if (!string.IsNullOrEmpty(date) && DateOnly.TryParse(date, out var d))
            query = query.Where(r => r.AppointmentDate == d);

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<ReservationStatus>(status, out var s))
            query = query.Where(r => r.Status == s);

        var reservations = await query
            .OrderByDescending(r => r.AppointmentDate)
            .ThenBy(r => r.AppointmentTime)
            .Take(200)
            .Select(r => new
            {
                r.Id,
                r.AccessCode,
                r.PatientName,
                r.PatientPhone,
                r.PatientEmail,
                appointmentDate = r.AppointmentDate.ToString("yyyy-MM-dd"),
                appointmentTime = r.AppointmentTime.ToString("HH:mm"),
                r.Status,
                r.Notes,
                r.CancellationReason,
                r.CreatedAt,
                r.ConfirmedAt,
                hospitalName = r.Hospital.Name,
                departmentName = r.Department.Name,
                departmentSpecialty = r.Department.Specialty,
            })
            .ToListAsync();

        return Ok(reservations);
    }

    // PUT api/reservations/{id}/confirm
    [Authorize]
    [HttpPut("{id}/confirm")]
    public async Task<IActionResult> ConfirmReservation(int id)
    {
        var reservation = await _context.Reservations.FindAsync(id);
        if (reservation == null)
            return NotFound();

        reservation.Status = ReservationStatus.Confirmed;
        reservation.ConfirmedAt = DateTime.UtcNow;
        reservation.ConfirmedBy = User.Identity?.Name;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Reservation confirmed" });
    }

    // PUT api/reservations/{id}/complete
    [Authorize]
    [HttpPut("{id}/complete")]
    public async Task<IActionResult> CompleteReservation(int id)
    {
        var reservation = await _context.Reservations.FindAsync(id);
        if (reservation == null)
            return NotFound();

        reservation.Status = ReservationStatus.Completed;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Reservation completed" });
    }

    // PUT api/reservations/{id}/noshow
    [Authorize]
    [HttpPut("{id}/noshow")]
    public async Task<IActionResult> MarkNoShow(int id)
    {
        var reservation = await _context.Reservations.FindAsync(id);
        if (reservation == null)
            return NotFound();

        reservation.Status = ReservationStatus.NoShow;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Marked as no-show" });
    }

    // GET api/reservations/stats?hospitalId=1
    [Authorize]
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats([FromQuery] int? hospitalId)
    {
        var query = _context.Reservations.AsQueryable();
        if (hospitalId.HasValue && hospitalId > 0)
            query = query.Where(r => r.HospitalId == hospitalId);

        var today = DateOnly.FromDateTime(DateTime.Today);
        var total = await query.CountAsync();
        var pending = await query.CountAsync(r => r.Status == ReservationStatus.Pending);
        var confirmed = await query.CountAsync(r => r.Status == ReservationStatus.Confirmed);
        var todayCount = await query.CountAsync(r => r.AppointmentDate == today);
        var upcoming = await query.CountAsync(r => r.AppointmentDate >= today
                                                    && r.Status != ReservationStatus.Cancelled);

        return Ok(new { total, pending, confirmed, todayCount, upcoming });
    }

    private static string GenerateAccessCode()
    {
        var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Range(0, 8).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }
}

public class CreateReservationRequest
{
    public int HospitalId { get; set; }
    public int DepartmentId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string PatientPhone { get; set; } = string.Empty;
    public string? PatientEmail { get; set; }
    public string? PatientCNP { get; set; }
    public string AppointmentDate { get; set; } = string.Empty;
    public string AppointmentTime { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public class CancelRequest
{
    public string? Reason { get; set; }
}
