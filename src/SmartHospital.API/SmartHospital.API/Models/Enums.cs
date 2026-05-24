namespace SmartHospital.API.Models;

public enum HospitalType
{
    General,
    Emergency,
    Specialized,
    Pediatric,
    Oncologic,
    Cardiac,
    Rehabilitation,
    Pneumology,
    Infectious,
    Psychiatry,
    Municipal,
    University,
    Military
}

public enum DepartmentSpecialty
{
    Cardiology,
    Neurology,
    Orthopedics,
    GeneralSurgery,
    InternalMedicine,
    Pediatrics,
    Oncology,
    Radiology,
    EmergencyMedicine,
    Anesthesiology,
    Dermatology,
    ENT,
    Ophthalmology,
    Urology,
    Gynecology,
    Gastroenterology,
    Pulmonology,
    Nephrology,
    Endocrinology,
    Rheumatology,
    Psychiatry,
    Rehabilitation,
    InfectiousDiseases,
    Hematology,
    PlasticSurgery,
    NeurologicalSurgery,
    CardiacSurgery,
    ThoracicSurgery,
    VascularSurgery,
    ICU,
    Neonatology,
    Laboratory,
    Pathology,
    Pharmacy,
    PhysicalTherapy,
    Nutrition,
    Other
}

public enum QuestionCategory
{
    OverallSatisfaction,
    StaffEvaluation,
    Admission,
    PatientRights,
    Services,
    MedicalInformation,
    Transport,
    Medication,
    CareQuality,
    Corruption,
    RightsRespect,
    GeneralComments
}

public enum QuestionType
{
    Smiley,
    Rating,
    YesNo,
    YesPartialNo,
    MultipleChoice,
    FreeText
}

public enum PatientGender
{
    Male,
    Female
}

public enum FilledByType
{
    Patient,
    Relative,
    Caregiver
}

public enum AlertType
{
    MoneyRequested,
    GiftsRequested,
    InappropriateBehavior,
    Negligence,
    Other
}

public enum AlertStatus
{
    Open,
    Acknowledged,
    Investigating,
    ActionTaken,
    Resolved,
    Closed
}

public enum EscalationLevel
{
    Level1_Department,
    Level2_Management,
    Level3_External
}

public enum ManagerRole
{
    Admin,
    Manager,
    Viewer,
    Patient
}
