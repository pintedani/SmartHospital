using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Data;
using SmartHospital.API.Models;

namespace SmartHospital.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BudgetController : ControllerBase
{
    private readonly AppDbContext _context;

    public BudgetController(AppDbContext context)
    {
        _context = context;
    }

    // GET api/budget/hospital/{hospitalId}
    [HttpGet("hospital/{hospitalId}")]
    public async Task<IActionResult> GetHospitalBudget(int hospitalId)
    {
        var now = DateTime.UtcNow;
        var allocations = await _context.BudgetAllocations
            .Include(b => b.Department)
            .Where(b => b.HospitalId == hospitalId && b.Year == now.Year && b.Month == now.Month)
            .ToListAsync();

        if (!allocations.Any())
            return Ok(new { status = "Unknown", departments = Array.Empty<object>() });

        var totalBudget = allocations.Sum(a => a.TotalBudgetRON);
        var totalConsumed = allocations.Sum(a => a.ConsumedBudgetRON);
        var overallPercentage = totalBudget > 0 ? (double)(totalConsumed / totalBudget * 100) : 0;

        string overallStatus;
        if (overallPercentage >= 90)
            overallStatus = "Exhausted";
        else if (overallPercentage >= 70)
            overallStatus = "Limited";
        else
            overallStatus = "Available";

        var daysInMonth = DateTime.DaysInMonth(now.Year, now.Month);
        var daysRemaining = daysInMonth - now.Day;

        var departments = allocations.Select(a =>
        {
            var pct = a.TotalBudgetRON > 0 ? (double)(a.ConsumedBudgetRON / a.TotalBudgetRON * 100) : 0;
            var dailyRate = now.Day > 0 ? (double)a.ConsumedBudgetRON / now.Day : 0;
            var estimatedDaysLeft = dailyRate > 0 ? (int)((double)(a.TotalBudgetRON - a.ConsumedBudgetRON) / dailyRate) : daysRemaining;

            return new
            {
                departmentId = a.DepartmentId,
                departmentName = a.Department.Name,
                departmentNameEN = a.Department.NameEN,
                totalBudget = a.TotalBudgetRON,
                consumed = a.ConsumedBudgetRON,
                percentage = Math.Round(pct, 1),
                maxCases = a.MaxCases,
                usedCases = a.UsedCases,
                status = a.Status.ToString(),
                estimatedDaysLeft = Math.Max(0, Math.Min(estimatedDaysLeft, daysRemaining)),
                lastUpdated = a.LastUpdated,
            };
        }).OrderByDescending(d => d.percentage).ToList();

        return Ok(new
        {
            hospitalId,
            year = now.Year,
            month = now.Month,
            totalBudget,
            totalConsumed,
            overallPercentage = Math.Round(overallPercentage, 1),
            overallStatus,
            daysRemaining,
            departments,
        });
    }

    // GET api/budget/summary — traffic-light summary for all hospitals
    [HttpGet("summary")]
    public async Task<IActionResult> GetAllHospitalsBudgetSummary()
    {
        var now = DateTime.UtcNow;
        var raw = await _context.BudgetAllocations
            .Where(b => b.Year == now.Year && b.Month == now.Month)
            .ToListAsync();

        var allocations = raw
            .GroupBy(b => b.HospitalId)
            .Select(g => new
            {
                hospitalId = g.Key,
                totalBudget = g.Sum(a => a.TotalBudgetRON),
                totalConsumed = g.Sum(a => a.ConsumedBudgetRON),
            })
            .ToList();

        var result = allocations.Select(a =>
        {
            var pct = a.totalBudget > 0 ? (double)(a.totalConsumed / a.totalBudget * 100) : 0;
            string status;
            if (pct >= 90) status = "Exhausted";
            else if (pct >= 70) status = "Limited";
            else status = "Available";

            return new
            {
                a.hospitalId,
                percentage = Math.Round(pct, 1),
                status,
            };
        }).ToList();

        return Ok(result);
    }
}
