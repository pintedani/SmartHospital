using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Data;
using SmartHospital.API.Models;

namespace SmartHospital.API.Services;

/// <summary>
/// Rule-based recommendation engine using static symptom-to-specialty mappings.
/// To switch to LLM: create a new class implementing IRecommendationService,
/// inject your HTTP client + API key, and register it in Program.cs instead.
/// </summary>
public class RuleBasedRecommendationService : IRecommendationService
{
    private readonly AppDbContext _db;

    public RuleBasedRecommendationService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<RecommendationResult> GetRecommendationsAsync(RecommendationRequest request)
    {
        var symptoms = request.Symptoms.Select(s => s.ToLowerInvariant().Trim()).ToList();

        // Map symptoms to specialties
        var matchedSpecialties = new HashSet<DepartmentSpecialty>();
        var urgency = UrgencyLevel.Routine;

        foreach (var symptom in symptoms)
        {
            foreach (var mapping in SymptomMappings)
            {
                if (mapping.Keywords.Any(k => symptom.Contains(k) || k.Contains(symptom)))
                {
                    foreach (var specialty in mapping.Specialties)
                        matchedSpecialties.Add(specialty);

                    if (mapping.Urgency > urgency)
                        urgency = mapping.Urgency;
                }
            }
        }

        // Fallback if nothing matched
        if (matchedSpecialties.Count == 0)
        {
            matchedSpecialties.Add(DepartmentSpecialty.InternalMedicine);
            matchedSpecialties.Add(DepartmentSpecialty.EmergencyMedicine);
        }

        // Query hospitals with matching departments
        var hospitals = await _db.Hospitals
            .Where(h => h.IsActive)
            .Include(h => h.Departments.Where(d => d.IsActive && matchedSpecialties.Contains(d.Specialty)))
            .Include(h => h.FeedbackSubmissions).ThenInclude(f => f.Answers)
            .Where(h => h.Departments.Any(d => d.IsActive && matchedSpecialties.Contains(d.Specialty)))
            .ToListAsync();

        // Rank hospitals
        var recommendations = hospitals.Select(h =>
        {
            var matchCount = h.Departments.Count(d => matchedSpecialties.Contains(d.Specialty));
            var allRatings = h.FeedbackSubmissions
                .SelectMany(f => f.Answers)
                .Where(a => a.RatingValue.HasValue)
                .Select(a => (double)a.RatingValue!.Value)
                .ToList();
            var avgRating = allRatings.Count > 0 ? allRatings.Average() : (double?)null;
            var feedbackCount = h.FeedbackSubmissions.Count;
            var distance = (request.Latitude.HasValue && request.Longitude.HasValue)
                ? CalculateDistance(request.Latitude.Value, request.Longitude.Value, h.Latitude, h.Longitude)
                : (double?)null;

            // Score: specialty match (40%) + rating (30%) + proximity (30%)
            var matchScore = (double)matchCount / matchedSpecialties.Count * 40.0;
            var ratingScore = (avgRating ?? 2.5) / 4.0 * 30.0;
            var distanceScore = distance.HasValue
                ? Math.Max(0, 30.0 - distance.Value * 3.0) // penalize distance (km)
                : 15.0; // neutral if no location

            var totalScore = matchScore + ratingScore + distanceScore;

            return new HospitalRecommendation(
                h.Id, h.Name, h.NameEN ?? h.Name, h.Address, h.City,
                h.Type.ToString(),
                h.Website != null ? (h.Website.StartsWith("http") ? h.Website : $"https://{h.Website}") : null,
                h.Phone,
                h.Latitude, h.Longitude,
                distance.HasValue ? Math.Round(distance.Value, 1) : null,
                avgRating.HasValue ? Math.Round(avgRating.Value, 2) : null,
                feedbackCount,
                Math.Round(totalScore, 1),
                h.Departments
                    .Where(d => matchedSpecialties.Contains(d.Specialty))
                    .Select(d => new MatchedDepartmentInfo(d.Id, d.Name, d.NameEN ?? d.Name, d.Specialty.ToString()))
                    .ToList()
            );
        })
        .OrderByDescending(r => r.Score)
        .ToList();

        var urgencyMessage = urgency switch
        {
            UrgencyLevel.Emergency => "EMERGENCY: Seek immediate medical attention! Call 112.",
            UrgencyLevel.Urgent => "These symptoms require prompt medical attention. Visit a doctor today.",
            _ => "Schedule a visit with a specialist at your convenience."
        };

        return new RecommendationResult(
            urgency,
            urgencyMessage,
            matchedSpecialties.ToList(),
            recommendations
        );
    }

    private static double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371; // Earth radius in km
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }

    // ──────────────────────────────────────────────────────────────────
    // SYMPTOM MAPPINGS - Edit here to adjust rules, or replace this
    // entire service with an LLM-based implementation.
    // ──────────────────────────────────────────────────────────────────

    private static readonly List<SymptomMapping> SymptomMappings = new()
    {
        // ─── EMERGENCY ───
        new("chest pain", new[] { DepartmentSpecialty.Cardiology, DepartmentSpecialty.EmergencyMedicine, DepartmentSpecialty.CardiacSurgery }, UrgencyLevel.Emergency),
        new("severe bleeding", new[] { DepartmentSpecialty.EmergencyMedicine, DepartmentSpecialty.GeneralSurgery }, UrgencyLevel.Emergency),
        new("loss of consciousness", new[] { DepartmentSpecialty.EmergencyMedicine, DepartmentSpecialty.Neurology, DepartmentSpecialty.ICU }, UrgencyLevel.Emergency),
        new("difficulty breathing", new[] { DepartmentSpecialty.EmergencyMedicine, DepartmentSpecialty.Pulmonology }, UrgencyLevel.Emergency),
        new("stroke symptoms", new[] { DepartmentSpecialty.Neurology, DepartmentSpecialty.EmergencyMedicine, DepartmentSpecialty.ICU }, UrgencyLevel.Emergency),
        new("allergic reaction", new[] { DepartmentSpecialty.EmergencyMedicine, DepartmentSpecialty.ICU }, UrgencyLevel.Emergency),
        new("poisoning", new[] { DepartmentSpecialty.EmergencyMedicine, DepartmentSpecialty.ICU }, UrgencyLevel.Emergency),
        new("heart attack", new[] { DepartmentSpecialty.Cardiology, DepartmentSpecialty.EmergencyMedicine, DepartmentSpecialty.ICU }, UrgencyLevel.Emergency),

        // ─── URGENT ───
        new("high fever", new[] { DepartmentSpecialty.InternalMedicine, DepartmentSpecialty.InfectiousDiseases, DepartmentSpecialty.EmergencyMedicine }, UrgencyLevel.Urgent),
        new("fracture", new[] { DepartmentSpecialty.Orthopedics, DepartmentSpecialty.EmergencyMedicine }, UrgencyLevel.Urgent),
        new("broken bone", new[] { DepartmentSpecialty.Orthopedics, DepartmentSpecialty.EmergencyMedicine }, UrgencyLevel.Urgent),
        new("severe abdominal pain", new[] { DepartmentSpecialty.Gastroenterology, DepartmentSpecialty.GeneralSurgery, DepartmentSpecialty.EmergencyMedicine }, UrgencyLevel.Urgent),
        new("blood in stool", new[] { DepartmentSpecialty.Gastroenterology, DepartmentSpecialty.GeneralSurgery }, UrgencyLevel.Urgent),
        new("blood in urine", new[] { DepartmentSpecialty.Urology, DepartmentSpecialty.Nephrology }, UrgencyLevel.Urgent),
        new("seizure", new[] { DepartmentSpecialty.Neurology, DepartmentSpecialty.EmergencyMedicine }, UrgencyLevel.Urgent),
        new("severe headache", new[] { DepartmentSpecialty.Neurology, DepartmentSpecialty.NeurologicalSurgery }, UrgencyLevel.Urgent),
        new("sudden vision loss", new[] { DepartmentSpecialty.Ophthalmology, DepartmentSpecialty.Neurology, DepartmentSpecialty.EmergencyMedicine }, UrgencyLevel.Urgent),

        // ─── CARDIOVASCULAR ───
        new("palpitations", new[] { DepartmentSpecialty.Cardiology }, UrgencyLevel.Routine),
        new("swollen legs", new[] { DepartmentSpecialty.Cardiology, DepartmentSpecialty.VascularSurgery }, UrgencyLevel.Routine),
        new("high blood pressure", new[] { DepartmentSpecialty.Cardiology, DepartmentSpecialty.InternalMedicine }, UrgencyLevel.Routine),
        new("varicose veins", new[] { DepartmentSpecialty.VascularSurgery }, UrgencyLevel.Routine),

        // ─── NEUROLOGICAL ───
        new("headache", new[] { DepartmentSpecialty.Neurology }, UrgencyLevel.Routine),
        new("dizziness", new[] { DepartmentSpecialty.Neurology, DepartmentSpecialty.ENT }, UrgencyLevel.Routine),
        new("numbness", new[] { DepartmentSpecialty.Neurology }, UrgencyLevel.Routine),
        new("tingling", new[] { DepartmentSpecialty.Neurology }, UrgencyLevel.Routine),
        new("memory problems", new[] { DepartmentSpecialty.Neurology, DepartmentSpecialty.Psychiatry }, UrgencyLevel.Routine),
        new("tremor", new[] { DepartmentSpecialty.Neurology }, UrgencyLevel.Routine),

        // ─── RESPIRATORY ───
        new("cough", new[] { DepartmentSpecialty.Pulmonology, DepartmentSpecialty.InternalMedicine }, UrgencyLevel.Routine),
        new("shortness of breath", new[] { DepartmentSpecialty.Pulmonology, DepartmentSpecialty.Cardiology }, UrgencyLevel.Urgent),
        new("wheezing", new[] { DepartmentSpecialty.Pulmonology }, UrgencyLevel.Routine),
        new("asthma", new[] { DepartmentSpecialty.Pulmonology }, UrgencyLevel.Routine),
        new("snoring", new[] { DepartmentSpecialty.Pulmonology, DepartmentSpecialty.ENT }, UrgencyLevel.Routine),

        // ─── MUSCULOSKELETAL ───
        new("joint pain", new[] { DepartmentSpecialty.Orthopedics, DepartmentSpecialty.Rheumatology }, UrgencyLevel.Routine),
        new("back pain", new[] { DepartmentSpecialty.Orthopedics, DepartmentSpecialty.Rehabilitation, DepartmentSpecialty.PhysicalTherapy }, UrgencyLevel.Routine),
        new("muscle weakness", new[] { DepartmentSpecialty.Neurology, DepartmentSpecialty.Rehabilitation }, UrgencyLevel.Routine),
        new("knee pain", new[] { DepartmentSpecialty.Orthopedics }, UrgencyLevel.Routine),
        new("shoulder pain", new[] { DepartmentSpecialty.Orthopedics, DepartmentSpecialty.PhysicalTherapy }, UrgencyLevel.Routine),
        new("sprain", new[] { DepartmentSpecialty.Orthopedics, DepartmentSpecialty.EmergencyMedicine }, UrgencyLevel.Routine),

        // ─── GASTROINTESTINAL ───
        new("abdominal pain", new[] { DepartmentSpecialty.Gastroenterology, DepartmentSpecialty.InternalMedicine }, UrgencyLevel.Routine),
        new("nausea", new[] { DepartmentSpecialty.Gastroenterology, DepartmentSpecialty.InternalMedicine }, UrgencyLevel.Routine),
        new("vomiting", new[] { DepartmentSpecialty.Gastroenterology, DepartmentSpecialty.EmergencyMedicine }, UrgencyLevel.Routine),
        new("diarrhea", new[] { DepartmentSpecialty.Gastroenterology, DepartmentSpecialty.InfectiousDiseases }, UrgencyLevel.Routine),
        new("constipation", new[] { DepartmentSpecialty.Gastroenterology }, UrgencyLevel.Routine),
        new("heartburn", new[] { DepartmentSpecialty.Gastroenterology }, UrgencyLevel.Routine),
        new("bloating", new[] { DepartmentSpecialty.Gastroenterology }, UrgencyLevel.Routine),

        // ─── DERMATOLOGICAL ───
        new("skin rash", new[] { DepartmentSpecialty.Dermatology }, UrgencyLevel.Routine),
        new("itching", new[] { DepartmentSpecialty.Dermatology }, UrgencyLevel.Routine),
        new("acne", new[] { DepartmentSpecialty.Dermatology }, UrgencyLevel.Routine),
        new("wound", new[] { DepartmentSpecialty.GeneralSurgery, DepartmentSpecialty.Dermatology }, UrgencyLevel.Routine),
        new("burn", new[] { DepartmentSpecialty.EmergencyMedicine, DepartmentSpecialty.PlasticSurgery }, UrgencyLevel.Urgent),
        new("mole changes", new[] { DepartmentSpecialty.Dermatology, DepartmentSpecialty.Oncology }, UrgencyLevel.Routine),
        new("hair loss", new[] { DepartmentSpecialty.Dermatology, DepartmentSpecialty.Endocrinology }, UrgencyLevel.Routine),

        // ─── UROLOGICAL ───
        new("painful urination", new[] { DepartmentSpecialty.Urology }, UrgencyLevel.Routine),
        new("frequent urination", new[] { DepartmentSpecialty.Urology, DepartmentSpecialty.Endocrinology }, UrgencyLevel.Routine),
        new("kidney pain", new[] { DepartmentSpecialty.Nephrology, DepartmentSpecialty.Urology }, UrgencyLevel.Urgent),
        new("kidney stone", new[] { DepartmentSpecialty.Urology, DepartmentSpecialty.EmergencyMedicine }, UrgencyLevel.Urgent),

        // ─── GYNECOLOGICAL ───
        new("pelvic pain", new[] { DepartmentSpecialty.Gynecology }, UrgencyLevel.Routine),
        new("irregular periods", new[] { DepartmentSpecialty.Gynecology, DepartmentSpecialty.Endocrinology }, UrgencyLevel.Routine),
        new("pregnancy", new[] { DepartmentSpecialty.Gynecology }, UrgencyLevel.Routine),
        new("menstrual pain", new[] { DepartmentSpecialty.Gynecology }, UrgencyLevel.Routine),

        // ─── MENTAL HEALTH ───
        new("anxiety", new[] { DepartmentSpecialty.Psychiatry }, UrgencyLevel.Routine),
        new("depression", new[] { DepartmentSpecialty.Psychiatry }, UrgencyLevel.Routine),
        new("insomnia", new[] { DepartmentSpecialty.Psychiatry, DepartmentSpecialty.Neurology }, UrgencyLevel.Routine),
        new("panic attack", new[] { DepartmentSpecialty.Psychiatry, DepartmentSpecialty.EmergencyMedicine }, UrgencyLevel.Urgent),
        new("suicidal thoughts", new[] { DepartmentSpecialty.Psychiatry, DepartmentSpecialty.EmergencyMedicine }, UrgencyLevel.Emergency),

        // ─── EYE / ENT ───
        new("eye pain", new[] { DepartmentSpecialty.Ophthalmology }, UrgencyLevel.Routine),
        new("blurred vision", new[] { DepartmentSpecialty.Ophthalmology }, UrgencyLevel.Routine),
        new("hearing loss", new[] { DepartmentSpecialty.ENT }, UrgencyLevel.Routine),
        new("ear pain", new[] { DepartmentSpecialty.ENT }, UrgencyLevel.Routine),
        new("sore throat", new[] { DepartmentSpecialty.ENT, DepartmentSpecialty.InternalMedicine }, UrgencyLevel.Routine),
        new("nosebleed", new[] { DepartmentSpecialty.ENT }, UrgencyLevel.Routine),
        new("tinnitus", new[] { DepartmentSpecialty.ENT, DepartmentSpecialty.Neurology }, UrgencyLevel.Routine),

        // ─── ENDOCRINE / METABOLIC ───
        new("weight gain", new[] { DepartmentSpecialty.Endocrinology, DepartmentSpecialty.Nutrition }, UrgencyLevel.Routine),
        new("weight loss", new[] { DepartmentSpecialty.Endocrinology, DepartmentSpecialty.Oncology }, UrgencyLevel.Routine),
        new("diabetes", new[] { DepartmentSpecialty.Endocrinology, DepartmentSpecialty.InternalMedicine }, UrgencyLevel.Routine),
        new("thyroid", new[] { DepartmentSpecialty.Endocrinology }, UrgencyLevel.Routine),
        new("fatigue", new[] { DepartmentSpecialty.InternalMedicine, DepartmentSpecialty.Endocrinology }, UrgencyLevel.Routine),

        // ─── PEDIATRIC ───
        new("child fever", new[] { DepartmentSpecialty.Pediatrics }, UrgencyLevel.Urgent),
        new("child rash", new[] { DepartmentSpecialty.Pediatrics, DepartmentSpecialty.Dermatology }, UrgencyLevel.Routine),
        new("growth concerns", new[] { DepartmentSpecialty.Pediatrics, DepartmentSpecialty.Endocrinology }, UrgencyLevel.Routine),
        new("child cough", new[] { DepartmentSpecialty.Pediatrics, DepartmentSpecialty.Pulmonology }, UrgencyLevel.Routine),

        // ─── ONCOLOGY ───
        new("lump", new[] { DepartmentSpecialty.Oncology, DepartmentSpecialty.GeneralSurgery }, UrgencyLevel.Urgent),
        new("unexplained weight loss", new[] { DepartmentSpecialty.Oncology, DepartmentSpecialty.InternalMedicine }, UrgencyLevel.Urgent),
        new("night sweats", new[] { DepartmentSpecialty.Hematology, DepartmentSpecialty.Oncology, DepartmentSpecialty.InfectiousDiseases }, UrgencyLevel.Routine),

        // ─── INFECTIOUS ───
        new("fever", new[] { DepartmentSpecialty.InternalMedicine, DepartmentSpecialty.InfectiousDiseases }, UrgencyLevel.Routine),
        new("chills", new[] { DepartmentSpecialty.InternalMedicine, DepartmentSpecialty.InfectiousDiseases }, UrgencyLevel.Routine),
        new("swollen lymph nodes", new[] { DepartmentSpecialty.InfectiousDiseases, DepartmentSpecialty.Hematology }, UrgencyLevel.Routine),
    };

    private record SymptomMapping(string Keyword, DepartmentSpecialty[] Specialties, UrgencyLevel Urgency)
    {
        public string[] Keywords => Keyword.Split(',').Select(k => k.Trim().ToLowerInvariant()).ToArray();
    }
}
