using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Models;

namespace SmartHospital.API.Data;

public class AppDbContext : IdentityDbContext<HospitalManager>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Hospital> Hospitals => Set<Hospital>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<FeedbackSubmission> FeedbackSubmissions => Set<FeedbackSubmission>();
    public DbSet<FeedbackAnswer> FeedbackAnswers => Set<FeedbackAnswer>();
    public DbSet<AbuseAlert> AbuseAlerts => Set<AbuseAlert>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<SlotConfiguration> SlotConfigurations => Set<SlotConfiguration>();
    public DbSet<BudgetAllocation> BudgetAllocations => Set<BudgetAllocation>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Hospital>(e =>
        {
            e.HasIndex(h => h.City);
            e.HasIndex(h => h.County);
            e.HasIndex(h => h.Type);
        });

        builder.Entity<Department>(e =>
        {
            e.HasOne(d => d.Hospital)
                .WithMany(h => h.Departments)
                .HasForeignKey(d => d.HospitalId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<FeedbackSubmission>(e =>
        {
            e.HasOne(f => f.Hospital)
                .WithMany(h => h.FeedbackSubmissions)
                .HasForeignKey(f => f.HospitalId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(f => f.Department)
                .WithMany(d => d.FeedbackSubmissions)
                .HasForeignKey(f => f.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasIndex(f => f.SubmittedAt);
        });

        builder.Entity<FeedbackAnswer>(e =>
        {
            e.HasOne(a => a.FeedbackSubmission)
                .WithMany(f => f.Answers)
                .HasForeignKey(a => a.FeedbackSubmissionId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(a => a.Question)
                .WithMany(q => q.Answers)
                .HasForeignKey(a => a.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<AbuseAlert>(e =>
        {
            e.HasOne(a => a.FeedbackSubmission)
                .WithMany(f => f.AbuseAlerts)
                .HasForeignKey(a => a.FeedbackSubmissionId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(a => a.Hospital)
                .WithMany(h => h.AbuseAlerts)
                .HasForeignKey(a => a.HospitalId)
                .OnDelete(DeleteBehavior.NoAction);

            e.HasIndex(a => a.IsReviewed);
            e.HasIndex(a => a.CreatedAt);
        });

        builder.Entity<Question>(e =>
        {
            e.HasIndex(q => q.Category);
            e.HasIndex(q => q.WizardStep);
        });

        builder.Entity<HospitalManager>(e =>
        {
            e.HasOne(m => m.Hospital)
                .WithMany()
                .HasForeignKey(m => m.HospitalId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<Reservation>(e =>
        {
            e.HasOne(r => r.Hospital)
                .WithMany()
                .HasForeignKey(r => r.HospitalId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(r => r.Department)
                .WithMany()
                .HasForeignKey(r => r.DepartmentId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(r => r.AccessCode).IsUnique();
            e.HasIndex(r => r.AppointmentDate);
            e.HasIndex(r => new { r.DepartmentId, r.AppointmentDate, r.AppointmentTime });
        });

        builder.Entity<SlotConfiguration>(e =>
        {
            e.HasOne(s => s.Department)
                .WithMany()
                .HasForeignKey(s => s.DepartmentId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(s => new { s.DepartmentId, s.DayOfWeek });
        });

        builder.Entity<BudgetAllocation>(e =>
        {
            e.HasOne(b => b.Hospital)
                .WithMany()
                .HasForeignKey(b => b.HospitalId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(b => b.Department)
                .WithMany()
                .HasForeignKey(b => b.DepartmentId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(b => new { b.HospitalId, b.Year, b.Month });
            e.HasIndex(b => new { b.DepartmentId, b.Year, b.Month });
        });
    }
}
