using Microsoft.AspNetCore.Mvc;
using SmartHospital.API.Services;

namespace SmartHospital.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RecommendationsController : ControllerBase
{
    private readonly IRecommendationService _service;

    public RecommendationsController(IRecommendationService service)
    {
        _service = service;
    }

    /// <summary>
    /// Get hospital recommendations based on symptoms.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<RecommendationResult>> GetRecommendations([FromBody] RecommendationRequestDto dto)
    {
        if (dto.Symptoms == null || dto.Symptoms.Count == 0)
            return BadRequest("At least one symptom is required.");

        var request = new RecommendationRequest(dto.Symptoms, dto.Latitude, dto.Longitude);
        var result = await _service.GetRecommendationsAsync(request);
        return Ok(result);
    }

    /// <summary>
    /// Get all available symptoms for the UI picker.
    /// </summary>
    [HttpGet("symptoms")]
    public ActionResult<List<SymptomCategoryDto>> GetSymptoms()
    {
        return Ok(AvailableSymptoms);
    }

    public record RecommendationRequestDto(List<string> Symptoms, double? Latitude = null, double? Longitude = null);

    public record SymptomCategoryDto(string Category, string CategoryRO, List<SymptomItemDto> Symptoms);
    public record SymptomItemDto(string Id, string NameEN, string NameRO);

    private static readonly List<SymptomCategoryDto> AvailableSymptoms = new()
    {
        new("Emergency", "Urgenta", new()
        {
            new("chest_pain", "Chest pain", "Durere in piept"),
            new("severe_bleeding", "Severe bleeding", "Sangerare severa"),
            new("loss_of_consciousness", "Loss of consciousness", "Pierderea cunostintei"),
            new("difficulty_breathing", "Difficulty breathing", "Dificultate in respiratie"),
            new("allergic_reaction", "Severe allergic reaction", "Reactie alergica severa"),
            new("poisoning", "Poisoning", "Intoxicatie"),
            new("stroke_symptoms", "Stroke symptoms (face drooping, arm weakness, speech difficulty)", "Simptome AVC"),
        }),
        new("Cardiovascular", "Cardiovascular", new()
        {
            new("palpitations", "Palpitations", "Palpitatii"),
            new("swollen_legs", "Swollen legs", "Picioare umflate"),
            new("high_blood_pressure", "High blood pressure", "Tensiune arteriala mare"),
            new("varicose_veins", "Varicose veins", "Varice"),
        }),
        new("Neurological", "Neurologic", new()
        {
            new("headache", "Headache", "Durere de cap"),
            new("severe_headache", "Severe/sudden headache", "Durere de cap severa"),
            new("dizziness", "Dizziness", "Ameteala"),
            new("numbness", "Numbness/tingling", "Amorteala/furnicaturi"),
            new("seizure", "Seizures", "Convulsii"),
            new("tremor", "Tremor", "Tremur"),
            new("memory_problems", "Memory problems", "Probleme de memorie"),
        }),
        new("Respiratory", "Respirator", new()
        {
            new("cough", "Cough", "Tuse"),
            new("shortness_of_breath", "Shortness of breath", "Lipsa de aer"),
            new("wheezing", "Wheezing", "Respiratie suieratoare"),
            new("asthma", "Asthma", "Astm"),
        }),
        new("Musculoskeletal", "Musculo-scheletal", new()
        {
            new("joint_pain", "Joint pain", "Durere articulara"),
            new("back_pain", "Back pain", "Durere de spate"),
            new("knee_pain", "Knee pain", "Durere de genunchi"),
            new("shoulder_pain", "Shoulder pain", "Durere de umar"),
            new("fracture", "Suspected fracture", "Suspiciune de fractura"),
            new("muscle_weakness", "Muscle weakness", "Slabiciune musculara"),
        }),
        new("Gastrointestinal", "Gastrointestinal", new()
        {
            new("abdominal_pain", "Abdominal pain", "Durere abdominala"),
            new("severe_abdominal_pain", "Severe abdominal pain", "Durere abdominala severa"),
            new("nausea", "Nausea/vomiting", "Greata/varsaturi"),
            new("diarrhea", "Diarrhea", "Diareea"),
            new("constipation", "Constipation", "Constipatie"),
            new("heartburn", "Heartburn/acid reflux", "Arsuri stomacale"),
            new("blood_in_stool", "Blood in stool", "Sange in scaun"),
            new("bloating", "Bloating", "Balonare"),
        }),
        new("Dermatological", "Dermatologic", new()
        {
            new("skin_rash", "Skin rash", "Eruptie cutanata"),
            new("itching", "Itching", "Mancarime"),
            new("acne", "Acne", "Acnee"),
            new("burn", "Burn", "Arsura"),
            new("wound", "Wound/injury", "Rana/leziune"),
            new("mole_changes", "Mole changes", "Modificari ale alunitelor"),
            new("hair_loss", "Hair loss", "Caderea parului"),
        }),
        new("Urological", "Urologic", new()
        {
            new("painful_urination", "Painful urination", "Urinare dureroasa"),
            new("frequent_urination", "Frequent urination", "Urinare frecventa"),
            new("blood_in_urine", "Blood in urine", "Sange in urina"),
            new("kidney_pain", "Kidney pain", "Durere de rinichi"),
            new("kidney_stone", "Kidney stone symptoms", "Simptome piatra la rinichi"),
        }),
        new("Gynecological", "Ginecologic", new()
        {
            new("pelvic_pain", "Pelvic pain", "Durere pelviana"),
            new("irregular_periods", "Irregular periods", "Menstruatie neregulata"),
            new("pregnancy", "Pregnancy concerns", "Probleme legate de sarcina"),
            new("menstrual_pain", "Severe menstrual pain", "Durere menstruala severa"),
        }),
        new("Mental Health", "Sanatate mintala", new()
        {
            new("anxiety", "Anxiety", "Anxietate"),
            new("depression", "Depression", "Depresie"),
            new("insomnia", "Insomnia", "Insomnie"),
            new("panic_attack", "Panic attacks", "Atacuri de panica"),
        }),
        new("Eye & ENT", "Ochi si ORL", new()
        {
            new("eye_pain", "Eye pain", "Durere de ochi"),
            new("blurred_vision", "Blurred vision", "Vedere incetosata"),
            new("sudden_vision_loss", "Sudden vision loss", "Pierdere brusca a vederii"),
            new("hearing_loss", "Hearing loss", "Pierderea auzului"),
            new("ear_pain", "Ear pain", "Durere de ureche"),
            new("sore_throat", "Sore throat", "Durere in gat"),
            new("nosebleed", "Nosebleed", "Sangerare nazala"),
            new("tinnitus", "Tinnitus (ringing in ears)", "Tinitus (zgomot in urechi)"),
        }),
        new("Endocrine", "Endocrin", new()
        {
            new("weight_gain", "Unexplained weight gain", "Crestere inexplicabila in greutate"),
            new("weight_loss", "Unexplained weight loss", "Scadere inexplicabila in greutate"),
            new("diabetes", "Diabetes symptoms", "Simptome de diabet"),
            new("thyroid", "Thyroid problems", "Probleme de tiroida"),
            new("fatigue", "Chronic fatigue", "Oboseala cronica"),
        }),
        new("Pediatric", "Pediatric", new()
        {
            new("child_fever", "Child with fever", "Copil cu febra"),
            new("child_rash", "Child with rash", "Copil cu eruptie cutanata"),
            new("child_cough", "Child with persistent cough", "Copil cu tuse persistenta"),
            new("growth_concerns", "Growth/development concerns", "Probleme de crestere/dezvoltare"),
        }),
        new("Oncology", "Oncologie", new()
        {
            new("lump", "Unexplained lump", "Umflatura inexplicabila"),
            new("night_sweats", "Night sweats", "Transpiratii nocturne"),
        }),
        new("General", "General", new()
        {
            new("fever", "Fever", "Febra"),
            new("high_fever", "High fever (>39°C)", "Febra mare (>39°C)"),
            new("chills", "Chills", "Frisoane"),
            new("swollen_lymph_nodes", "Swollen lymph nodes", "Ganglioni limfatici umflati"),
        }),
    };
}
