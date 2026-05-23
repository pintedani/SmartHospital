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
    }
}
