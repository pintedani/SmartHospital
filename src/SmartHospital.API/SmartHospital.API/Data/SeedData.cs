using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SmartHospital.API.Models;

namespace SmartHospital.API.Data;

public static class SeedData
{
    public static async Task InitializeAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<HospitalManager>>();

        await context.Database.EnsureCreatedAsync();

        if (!context.Hospitals.Any())
        {
            var hospitals = GetHospitals();
            context.Hospitals.AddRange(hospitals);
            await context.SaveChangesAsync();
        }

        if (!context.Questions.Any())
        {
            var questions = GetQuestions();
            context.Questions.AddRange(questions);
            await context.SaveChangesAsync();
        }

        if (!context.FeedbackSubmissions.Any())
        {
            await SeedDemoFeedbackAsync(context);
        }

        if ((await userManager.FindByEmailAsync("admin@smarthospital.ro")) == null)
        {
            await SeedUsersAsync(userManager, context);
        }

        if (!context.SlotConfigurations.Any())
        {
            await SeedSlotConfigurationsAsync(context);
        }

        if (!context.BudgetAllocations.Any())
        {
            await SeedBudgetAllocationsAsync(context);
        }
    }

    private static List<Hospital> GetHospitals()
    {
        return new List<Hospital>
        {
            new()
            {
                Name = "Spitalul Clinic Judetean de Urgenta Cluj-Napoca",
                NameEN = "Cluj County Emergency Clinical Hospital",
                Address = "Str. Clinicilor nr. 3-5",
                City = "Cluj-Napoca",
                County = "Cluj",
                Phone = "0264-592771",
                Email = "secretariat@scju-cluj.ro",
                Website = "www.scju-cluj.ro",
                Type = HospitalType.Emergency,
                TotalBeds = 1100,
                TotalDoctors = 450,
                TotalNurses = 800,
                YearFounded = 1912,
                Latitude = 46.7712,
                Longitude = 23.5897,
                Description = "Cel mai mare spital din judetul Cluj, ofera servicii medicale de urgenta si specializate in peste 30 de sectii.",
                DescriptionEN = "The largest hospital in Cluj County, providing emergency and specialized medical services in over 30 departments.",
                Departments = new List<Department>
                {
                    new() { Name = "Cardiologie", NameEN = "Cardiology", Specialty = DepartmentSpecialty.Cardiology, Floor = 2, BedsCount = 60, DoctorsCount = 15, NursesCount = 25 },
                    new() { Name = "Neurologie", NameEN = "Neurology", Specialty = DepartmentSpecialty.Neurology, Floor = 3, BedsCount = 50, DoctorsCount = 12, NursesCount = 20 },
                    new() { Name = "Chirurgie Generala", NameEN = "General Surgery", Specialty = DepartmentSpecialty.GeneralSurgery, Floor = 4, BedsCount = 80, DoctorsCount = 20, NursesCount = 30 },
                    new() { Name = "Medicina Interna", NameEN = "Internal Medicine", Specialty = DepartmentSpecialty.InternalMedicine, Floor = 1, BedsCount = 70, DoctorsCount = 18, NursesCount = 28 },
                    new() { Name = "Ortopedie", NameEN = "Orthopedics", Specialty = DepartmentSpecialty.Orthopedics, Floor = 5, BedsCount = 55, DoctorsCount = 14, NursesCount = 22 },
                    new() { Name = "Urologie", NameEN = "Urology", Specialty = DepartmentSpecialty.Urology, Floor = 6, BedsCount = 40, DoctorsCount = 10, NursesCount = 16 },
                    new() { Name = "ORL", NameEN = "ENT", Specialty = DepartmentSpecialty.ENT, Floor = 3, BedsCount = 35, DoctorsCount = 8, NursesCount = 14 },
                    new() { Name = "Oftalmologie", NameEN = "Ophthalmology", Specialty = DepartmentSpecialty.Ophthalmology, Floor = 2, BedsCount = 30, DoctorsCount = 8, NursesCount = 12 },
                    new() { Name = "ATI", NameEN = "ICU", Specialty = DepartmentSpecialty.ICU, Floor = 1, BedsCount = 40, DoctorsCount = 15, NursesCount = 35 },
                    new() { Name = "UPU - Urgente", NameEN = "Emergency Department", Specialty = DepartmentSpecialty.EmergencyMedicine, Floor = 0, BedsCount = 50, DoctorsCount = 25, NursesCount = 40 },
                }
            },
            new()
            {
                Name = "Spitalul Clinic de Recuperare Cluj-Napoca",
                NameEN = "Clinical Rehabilitation Hospital Cluj-Napoca",
                Address = "Str. Viilor nr. 46-50",
                City = "Cluj-Napoca",
                County = "Cluj",
                Phone = "0264-207021",
                Email = "secretariat@scr-cluj.ro",
                Website = "www.scr-cluj.ro",
                Type = HospitalType.Rehabilitation,
                TotalBeds = 435,
                TotalDoctors = 120,
                TotalNurses = 250,
                YearFounded = 1965,
                Latitude = 46.7580,
                Longitude = 23.5750,
                Description = "Spital specializat in recuperare medicala, neurologie si reumatologie, cu traditie de peste 50 de ani.",
                DescriptionEN = "Hospital specialized in medical rehabilitation, neurology and rheumatology, with over 50 years of tradition.",
                Departments = new List<Department>
                {
                    new() { Name = "Recuperare Medicala I", NameEN = "Medical Rehabilitation I", Specialty = DepartmentSpecialty.Rehabilitation, Floor = 1, BedsCount = 60, DoctorsCount = 12, NursesCount = 20 },
                    new() { Name = "Recuperare Medicala II", NameEN = "Medical Rehabilitation II", Specialty = DepartmentSpecialty.Rehabilitation, Floor = 2, BedsCount = 55, DoctorsCount = 10, NursesCount = 18 },
                    new() { Name = "Neurologie", NameEN = "Neurology", Specialty = DepartmentSpecialty.Neurology, Floor = 3, BedsCount = 50, DoctorsCount = 12, NursesCount = 22 },
                    new() { Name = "Reumatologie", NameEN = "Rheumatology", Specialty = DepartmentSpecialty.Rheumatology, Floor = 2, BedsCount = 40, DoctorsCount = 8, NursesCount = 15 },
                    new() { Name = "Fizioterapie", NameEN = "Physical Therapy", Specialty = DepartmentSpecialty.PhysicalTherapy, Floor = 0, BedsCount = 30, DoctorsCount = 6, NursesCount = 12 },
                    new() { Name = "Cardiologie", NameEN = "Cardiology", Specialty = DepartmentSpecialty.Cardiology, Floor = 4, BedsCount = 45, DoctorsCount = 10, NursesCount = 18 },
                }
            },
            new()
            {
                Name = "Spitalul Clinic de Boli Infectioase Cluj-Napoca",
                NameEN = "Clinical Hospital of Infectious Diseases Cluj-Napoca",
                Address = "Str. Iuliu Moldovan nr. 23",
                City = "Cluj-Napoca",
                County = "Cluj",
                Phone = "0264-597178",
                Email = "secretariat@scbi-cluj.ro",
                Website = "www.scbi-cluj.ro",
                Type = HospitalType.Infectious,
                TotalBeds = 200,
                TotalDoctors = 65,
                TotalNurses = 130,
                YearFounded = 1950,
                Latitude = 46.7690,
                Longitude = 23.6020,
                Description = "Spital de referinta pentru bolile infectioase din Transilvania, cu laboratoare moderne de microbiologie.",
                DescriptionEN = "Reference hospital for infectious diseases in Transylvania, with modern microbiology laboratories.",
                Departments = new List<Department>
                {
                    new() { Name = "Boli Infectioase Adulti I", NameEN = "Adult Infectious Diseases I", Specialty = DepartmentSpecialty.InfectiousDiseases, Floor = 1, BedsCount = 50, DoctorsCount = 12, NursesCount = 22 },
                    new() { Name = "Boli Infectioase Adulti II", NameEN = "Adult Infectious Diseases II", Specialty = DepartmentSpecialty.InfectiousDiseases, Floor = 2, BedsCount = 45, DoctorsCount = 10, NursesCount = 20 },
                    new() { Name = "Boli Infectioase Copii", NameEN = "Pediatric Infectious Diseases", Specialty = DepartmentSpecialty.Pediatrics, Floor = 3, BedsCount = 35, DoctorsCount = 8, NursesCount = 16 },
                    new() { Name = "ATI", NameEN = "ICU", Specialty = DepartmentSpecialty.ICU, Floor = 1, BedsCount = 15, DoctorsCount = 6, NursesCount = 14 },
                }
            },
            new()
            {
                Name = "Spitalul Clinic Municipal Cluj-Napoca",
                NameEN = "Municipal Clinical Hospital Cluj-Napoca",
                Address = "Str. Tabacarilor nr. 11",
                City = "Cluj-Napoca",
                County = "Cluj",
                Phone = "0264-431590",
                Email = "secretariat@scm-cluj.ro",
                Website = "www.scm-cluj.ro",
                Type = HospitalType.Municipal,
                TotalBeds = 520,
                TotalDoctors = 180,
                TotalNurses = 350,
                YearFounded = 1930,
                Latitude = 46.7750,
                Longitude = 23.5850,
                Description = "Spital municipal cu profil multidisciplinar, deservind comunitatea urbana Cluj-Napoca.",
                DescriptionEN = "Municipal hospital with multidisciplinary profile, serving the urban community of Cluj-Napoca.",
                Departments = new List<Department>
                {
                    new() { Name = "Medicina Interna", NameEN = "Internal Medicine", Specialty = DepartmentSpecialty.InternalMedicine, Floor = 1, BedsCount = 65, DoctorsCount = 16, NursesCount = 28 },
                    new() { Name = "Chirurgie Generala", NameEN = "General Surgery", Specialty = DepartmentSpecialty.GeneralSurgery, Floor = 2, BedsCount = 55, DoctorsCount = 14, NursesCount = 24 },
                    new() { Name = "Ginecologie", NameEN = "Gynecology", Specialty = DepartmentSpecialty.Gynecology, Floor = 3, BedsCount = 45, DoctorsCount = 12, NursesCount = 20 },
                    new() { Name = "Pediatrie", NameEN = "Pediatrics", Specialty = DepartmentSpecialty.Pediatrics, Floor = 4, BedsCount = 40, DoctorsCount = 10, NursesCount = 18 },
                    new() { Name = "Dermatologie", NameEN = "Dermatology", Specialty = DepartmentSpecialty.Dermatology, Floor = 2, BedsCount = 30, DoctorsCount = 8, NursesCount = 14 },
                    new() { Name = "Gastroenterologie", NameEN = "Gastroenterology", Specialty = DepartmentSpecialty.Gastroenterology, Floor = 3, BedsCount = 35, DoctorsCount = 8, NursesCount = 16 },
                    new() { Name = "Neonatologie", NameEN = "Neonatology", Specialty = DepartmentSpecialty.Neonatology, Floor = 4, BedsCount = 25, DoctorsCount = 8, NursesCount = 18 },
                }
            },
            new()
            {
                Name = "Institutul Oncologic Prof. Dr. Ion Chiricuta Cluj-Napoca",
                NameEN = "Prof. Dr. Ion Chiricuta Oncology Institute Cluj-Napoca",
                Address = "Str. Republicii nr. 34-36",
                City = "Cluj-Napoca",
                County = "Cluj",
                Phone = "0264-598361",
                Email = "secretariat@iocn.ro",
                Website = "www.iocn.ro",
                Type = HospitalType.Oncologic,
                TotalBeds = 620,
                TotalDoctors = 250,
                TotalNurses = 450,
                YearFounded = 1929,
                Latitude = 46.7700,
                Longitude = 23.5920,
                Description = "Cel mai important institut oncologic din Romania, cu cercetare de varf si tratamente complexe pentru toate tipurile de cancer.",
                DescriptionEN = "The most important oncology institute in Romania, with cutting-edge research and complex treatments for all types of cancer.",
                Departments = new List<Department>
                {
                    new() { Name = "Oncologie Medicala", NameEN = "Medical Oncology", Specialty = DepartmentSpecialty.Oncology, Floor = 1, BedsCount = 80, DoctorsCount = 25, NursesCount = 40 },
                    new() { Name = "Chirurgie Oncologica", NameEN = "Oncological Surgery", Specialty = DepartmentSpecialty.GeneralSurgery, Floor = 2, BedsCount = 70, DoctorsCount = 22, NursesCount = 35 },
                    new() { Name = "Radioterapie", NameEN = "Radiotherapy", Specialty = DepartmentSpecialty.Radiology, Floor = 0, BedsCount = 50, DoctorsCount = 15, NursesCount = 25 },
                    new() { Name = "Hematologie", NameEN = "Hematology", Specialty = DepartmentSpecialty.Hematology, Floor = 3, BedsCount = 45, DoctorsCount = 12, NursesCount = 22 },
                    new() { Name = "Chirurgie Plastica", NameEN = "Plastic Surgery", Specialty = DepartmentSpecialty.PlasticSurgery, Floor = 4, BedsCount = 30, DoctorsCount = 8, NursesCount = 14 },
                    new() { Name = "ATI", NameEN = "ICU", Specialty = DepartmentSpecialty.ICU, Floor = 1, BedsCount = 25, DoctorsCount = 10, NursesCount = 22 },
                    new() { Name = "Laborator Anatomie Patologica", NameEN = "Pathological Anatomy Lab", Specialty = DepartmentSpecialty.Pathology, Floor = 0, BedsCount = 0, DoctorsCount = 8, NursesCount = 6 },
                }
            },
            new()
            {
                Name = "Institutul Inimii Niculae Stancioiu Cluj-Napoca",
                NameEN = "Niculae Stancioiu Heart Institute Cluj-Napoca",
                Address = "Str. Motilor nr. 19-21",
                City = "Cluj-Napoca",
                County = "Cluj",
                Phone = "0264-591942",
                Email = "secretariat@institutul-inimii.ro",
                Website = "www.institutul-inimii.ro",
                Type = HospitalType.Cardiac,
                TotalBeds = 350,
                TotalDoctors = 150,
                TotalNurses = 280,
                YearFounded = 1994,
                Latitude = 46.7680,
                Longitude = 23.5870,
                Description = "Centru de excelenta pentru chirurgie cardiovasculara si cardiologie interventionala, realizand peste 3000 de proceduri anual.",
                DescriptionEN = "Center of excellence for cardiovascular surgery and interventional cardiology, performing over 3000 procedures annually.",
                Departments = new List<Department>
                {
                    new() { Name = "Cardiologie", NameEN = "Cardiology", Specialty = DepartmentSpecialty.Cardiology, Floor = 2, BedsCount = 70, DoctorsCount = 25, NursesCount = 40 },
                    new() { Name = "Chirurgie Cardiovasculara", NameEN = "Cardiovascular Surgery", Specialty = DepartmentSpecialty.CardiacSurgery, Floor = 3, BedsCount = 50, DoctorsCount = 20, NursesCount = 35 },
                    new() { Name = "Cardiologie Interventionala", NameEN = "Interventional Cardiology", Specialty = DepartmentSpecialty.Cardiology, Floor = 1, BedsCount = 40, DoctorsCount = 15, NursesCount = 25 },
                    new() { Name = "ATI Cardiac", NameEN = "Cardiac ICU", Specialty = DepartmentSpecialty.ICU, Floor = 3, BedsCount = 30, DoctorsCount = 12, NursesCount = 28 },
                    new() { Name = "Chirurgie Vasculara", NameEN = "Vascular Surgery", Specialty = DepartmentSpecialty.VascularSurgery, Floor = 4, BedsCount = 35, DoctorsCount = 10, NursesCount = 18 },
                }
            },
            new()
            {
                Name = "Spitalul Clinic de Urgenta pentru Copii Cluj-Napoca",
                NameEN = "Children's Emergency Clinical Hospital Cluj-Napoca",
                Address = "Str. Motilor nr. 68",
                City = "Cluj-Napoca",
                County = "Cluj",
                Phone = "0264-532244",
                Email = "secretariat@scuc-cluj.ro",
                Website = "www.scuc-cluj.ro",
                Type = HospitalType.Pediatric,
                TotalBeds = 400,
                TotalDoctors = 160,
                TotalNurses = 300,
                YearFounded = 1920,
                Latitude = 46.7720,
                Longitude = 23.5810,
                Description = "Principalul spital pediatric din Transilvania, oferind servicii medicale si chirurgicale complete pentru copii.",
                DescriptionEN = "The main pediatric hospital in Transylvania, providing complete medical and surgical services for children.",
                Departments = new List<Department>
                {
                    new() { Name = "Pediatrie I", NameEN = "Pediatrics I", Specialty = DepartmentSpecialty.Pediatrics, Floor = 1, BedsCount = 50, DoctorsCount = 14, NursesCount = 24 },
                    new() { Name = "Pediatrie II", NameEN = "Pediatrics II", Specialty = DepartmentSpecialty.Pediatrics, Floor = 2, BedsCount = 45, DoctorsCount = 12, NursesCount = 22 },
                    new() { Name = "Chirurgie Pediatrica", NameEN = "Pediatric Surgery", Specialty = DepartmentSpecialty.GeneralSurgery, Floor = 3, BedsCount = 40, DoctorsCount = 12, NursesCount = 20 },
                    new() { Name = "Ortopedie Pediatrica", NameEN = "Pediatric Orthopedics", Specialty = DepartmentSpecialty.Orthopedics, Floor = 4, BedsCount = 35, DoctorsCount = 8, NursesCount = 16 },
                    new() { Name = "Neonatologie", NameEN = "Neonatology", Specialty = DepartmentSpecialty.Neonatology, Floor = 1, BedsCount = 30, DoctorsCount = 10, NursesCount = 20 },
                    new() { Name = "ATI Pediatrica", NameEN = "Pediatric ICU", Specialty = DepartmentSpecialty.ICU, Floor = 2, BedsCount = 20, DoctorsCount = 8, NursesCount = 18 },
                    new() { Name = "UPU Copii", NameEN = "Pediatric Emergency", Specialty = DepartmentSpecialty.EmergencyMedicine, Floor = 0, BedsCount = 25, DoctorsCount = 12, NursesCount = 20 },
                }
            },
            new()
            {
                Name = "Spitalul Clinic de Pneumoftiziologie Leon Daniello Cluj-Napoca",
                NameEN = "Leon Daniello Clinical Hospital of Pneumology Cluj-Napoca",
                Address = "Str. B.P. Hasdeu nr. 6",
                City = "Cluj-Napoca",
                County = "Cluj",
                Phone = "0264-597453",
                Email = "secretariat@pneumo-leon.ro",
                Website = "www.pneumo-leon.ro",
                Type = HospitalType.Pneumology,
                TotalBeds = 280,
                TotalDoctors = 80,
                TotalNurses = 160,
                YearFounded = 1932,
                Latitude = 46.7650,
                Longitude = 23.5950,
                Description = "Spital specializat in pneumologie, alergologie si chirurgie toracica, centru regional de referinta.",
                DescriptionEN = "Hospital specialized in pneumology, allergology and thoracic surgery, regional reference center.",
                Departments = new List<Department>
                {
                    new() { Name = "Pneumologie I", NameEN = "Pneumology I", Specialty = DepartmentSpecialty.Pulmonology, Floor = 1, BedsCount = 50, DoctorsCount = 12, NursesCount = 20 },
                    new() { Name = "Pneumologie II", NameEN = "Pneumology II", Specialty = DepartmentSpecialty.Pulmonology, Floor = 2, BedsCount = 45, DoctorsCount = 10, NursesCount = 18 },
                    new() { Name = "Chirurgie Toracica", NameEN = "Thoracic Surgery", Specialty = DepartmentSpecialty.ThoracicSurgery, Floor = 3, BedsCount = 35, DoctorsCount = 8, NursesCount = 14 },
                    new() { Name = "Alergologie", NameEN = "Allergology", Specialty = DepartmentSpecialty.InternalMedicine, Floor = 2, BedsCount = 25, DoctorsCount = 6, NursesCount = 12 },
                    new() { Name = "ATI", NameEN = "ICU", Specialty = DepartmentSpecialty.ICU, Floor = 1, BedsCount = 15, DoctorsCount = 6, NursesCount = 14 },
                }
            },
            new()
            {
                Name = "Spitalul Clinic de Neurochirurgie Cluj-Napoca",
                NameEN = "Clinical Hospital of Neurosurgery Cluj-Napoca",
                Address = "Str. Victor Babes nr. 43",
                City = "Cluj-Napoca",
                County = "Cluj",
                Phone = "0264-597256",
                Email = "secretariat@neurochirurgie-cluj.ro",
                Type = HospitalType.Specialized,
                TotalBeds = 180,
                TotalDoctors = 70,
                TotalNurses = 140,
                YearFounded = 1955,
                Latitude = 46.7670,
                Longitude = 23.5980,
                Description = "Centru de referinta pentru neurochirurgie si neurologie din nord-vestul Romaniei.",
                DescriptionEN = "Reference center for neurosurgery and neurology in northwestern Romania.",
                Departments = new List<Department>
                {
                    new() { Name = "Neurochirurgie", NameEN = "Neurosurgery", Specialty = DepartmentSpecialty.NeurologicalSurgery, Floor = 2, BedsCount = 55, DoctorsCount = 15, NursesCount = 25 },
                    new() { Name = "Neurologie", NameEN = "Neurology", Specialty = DepartmentSpecialty.Neurology, Floor = 1, BedsCount = 45, DoctorsCount = 12, NursesCount = 22 },
                    new() { Name = "ATI", NameEN = "ICU", Specialty = DepartmentSpecialty.ICU, Floor = 2, BedsCount = 20, DoctorsCount = 8, NursesCount = 18 },
                }
            },
            new()
            {
                Name = "Spitalul Clinic CF Cluj-Napoca",
                NameEN = "Railway Clinical Hospital Cluj-Napoca",
                Address = "Str. Republicii nr. 18",
                City = "Cluj-Napoca",
                County = "Cluj",
                Phone = "0264-432230",
                Email = "secretariat@spitalcfcluj.ro",
                Website = "www.spitalcfcluj.ro",
                Type = HospitalType.General,
                TotalBeds = 300,
                TotalDoctors = 100,
                TotalNurses = 200,
                YearFounded = 1870,
                Latitude = 46.7730,
                Longitude = 23.5960,
                Description = "Spital general cu traditie, initial destinat angajatilor CF, acum deschis tuturor pacientilor.",
                DescriptionEN = "Traditional general hospital, initially for railway employees, now open to all patients.",
                Departments = new List<Department>
                {
                    new() { Name = "Medicina Interna", NameEN = "Internal Medicine", Specialty = DepartmentSpecialty.InternalMedicine, Floor = 1, BedsCount = 50, DoctorsCount = 12, NursesCount = 22 },
                    new() { Name = "Chirurgie", NameEN = "Surgery", Specialty = DepartmentSpecialty.GeneralSurgery, Floor = 2, BedsCount = 40, DoctorsCount = 10, NursesCount = 18 },
                    new() { Name = "Neurologie", NameEN = "Neurology", Specialty = DepartmentSpecialty.Neurology, Floor = 3, BedsCount = 35, DoctorsCount = 8, NursesCount = 16 },
                    new() { Name = "Endocrinologie", NameEN = "Endocrinology", Specialty = DepartmentSpecialty.Endocrinology, Floor = 2, BedsCount = 25, DoctorsCount = 6, NursesCount = 12 },
                    new() { Name = "Nefrologie", NameEN = "Nephrology", Specialty = DepartmentSpecialty.Nephrology, Floor = 3, BedsCount = 30, DoctorsCount = 8, NursesCount = 14 },
                }
            },
            new()
            {
                Name = "Spitalul Militar de Urgenta Dr. Constantin Papilian Cluj-Napoca",
                NameEN = "Dr. Constantin Papilian Military Emergency Hospital Cluj-Napoca",
                Address = "Str. General Traian Mosoiu nr. 22",
                City = "Cluj-Napoca",
                County = "Cluj",
                Phone = "0264-598012",
                Type = HospitalType.Military,
                TotalBeds = 250,
                TotalDoctors = 90,
                TotalNurses = 180,
                YearFounded = 1919,
                Latitude = 46.7740,
                Longitude = 23.5830,
                Description = "Spital militar cu servicii medicale complete, deschis si populatiei civile.",
                DescriptionEN = "Military hospital with complete medical services, also open to civilian population.",
                Departments = new List<Department>
                {
                    new() { Name = "Medicina Interna", NameEN = "Internal Medicine", Specialty = DepartmentSpecialty.InternalMedicine, Floor = 1, BedsCount = 40, DoctorsCount = 10, NursesCount = 18 },
                    new() { Name = "Chirurgie", NameEN = "Surgery", Specialty = DepartmentSpecialty.GeneralSurgery, Floor = 2, BedsCount = 35, DoctorsCount = 8, NursesCount = 16 },
                    new() { Name = "Ortopedie", NameEN = "Orthopedics", Specialty = DepartmentSpecialty.Orthopedics, Floor = 3, BedsCount = 30, DoctorsCount = 8, NursesCount = 14 },
                    new() { Name = "Dermatologie", NameEN = "Dermatology", Specialty = DepartmentSpecialty.Dermatology, Floor = 2, BedsCount = 20, DoctorsCount = 5, NursesCount = 10 },
                    new() { Name = "Psihiatrie", NameEN = "Psychiatry", Specialty = DepartmentSpecialty.Psychiatry, Floor = 4, BedsCount = 25, DoctorsCount = 6, NursesCount = 12 },
                }
            },
            new()
            {
                Name = "Spitalul Clinic de Psihiatrie Dr. Gheorghe Preda Cluj-Napoca",
                NameEN = "Dr. Gheorghe Preda Clinical Psychiatry Hospital Cluj-Napoca",
                Address = "Str. Victor Babes nr. 43",
                City = "Cluj-Napoca",
                County = "Cluj",
                Phone = "0264-597204",
                Type = HospitalType.Psychiatry,
                TotalBeds = 320,
                TotalDoctors = 75,
                TotalNurses = 180,
                YearFounded = 1945,
                Latitude = 46.7660,
                Longitude = 23.5990,
                Description = "Centru de referinta pentru psihiatrie si sanatate mintala din nord-vestul Romaniei.",
                DescriptionEN = "Reference center for psychiatry and mental health in northwestern Romania.",
                Departments = new List<Department>
                {
                    new() { Name = "Psihiatrie Acuti", NameEN = "Acute Psychiatry", Specialty = DepartmentSpecialty.Psychiatry, Floor = 1, BedsCount = 60, DoctorsCount = 14, NursesCount = 24 },
                    new() { Name = "Psihiatrie Cronici", NameEN = "Chronic Psychiatry", Specialty = DepartmentSpecialty.Psychiatry, Floor = 2, BedsCount = 70, DoctorsCount = 10, NursesCount = 22 },
                    new() { Name = "Psihiatrie Pediatrica", NameEN = "Child Psychiatry", Specialty = DepartmentSpecialty.Psychiatry, Floor = 3, BedsCount = 30, DoctorsCount = 6, NursesCount = 14 },
                    new() { Name = "Centru de Sanatate Mintala", NameEN = "Mental Health Center", Specialty = DepartmentSpecialty.Psychiatry, Floor = 0, BedsCount = 0, DoctorsCount = 8, NursesCount = 10 },
                }
            },
        };
    }

    private static List<Question> GetQuestions()
    {
        return new List<Question>
        {
            // Step 1: Basic info is collected via form fields, not questions

            // Step 2: Overall Satisfaction (WizardStep = 1)
            new()
            {
                Category = QuestionCategory.OverallSatisfaction,
                Type = QuestionType.Smiley,
                TextRO = "Cat de multumit(a) sunteti de serviciile medicale oferite de spital (impresie generala la externare)?",
                TextEN = "How satisfied are you with the medical services provided by the hospital (overall impression upon discharge)?",
                OrderIndex = 1,
                IsRequired = true,
                WizardStep = 1,
                OptionsJson = "[\"Foarte multumit\",\"Multumit\",\"Nemultumit\",\"Foarte nemultumit\"]"
            },

            // Step 3: Staff Evaluation (WizardStep = 2)
            new()
            {
                Category = QuestionCategory.StaffEvaluation,
                Type = QuestionType.Rating,
                TextRO = "Cum evaluati activitatea si implicarea medicului de salon?",
                TextEN = "How would you evaluate the activity and involvement of the ward doctor?",
                OrderIndex = 2,
                IsRequired = true,
                WizardStep = 2,
                OptionsJson = "[\"Foarte bun\",\"Bun\",\"Nesatisfacator\"]"
            },
            new()
            {
                Category = QuestionCategory.StaffEvaluation,
                Type = QuestionType.Rating,
                TextRO = "Cum evaluati activitatea si implicarea asistentelor medicale?",
                TextEN = "How would you evaluate the activity and involvement of the nurses?",
                OrderIndex = 3,
                IsRequired = true,
                WizardStep = 2,
                OptionsJson = "[\"Foarte bun\",\"Bun\",\"Nesatisfacator\"]"
            },
            new()
            {
                Category = QuestionCategory.StaffEvaluation,
                Type = QuestionType.Rating,
                TextRO = "Cum evaluati activitatea si implicarea infirmierelor/brancardierilor?",
                TextEN = "How would you evaluate the activity and involvement of the orderlies/stretcher staff?",
                OrderIndex = 4,
                IsRequired = true,
                WizardStep = 2,
                OptionsJson = "[\"Foarte bun\",\"Bun\",\"Nesatisfacator\"]"
            },

            // Step 4: Admission & Services (WizardStep = 3)
            new()
            {
                Category = QuestionCategory.Admission,
                Type = QuestionType.MultipleChoice,
                TextRO = "La internare, ati fost insotit(a) la sectie de catre:",
                TextEN = "Upon admission, were you accompanied to the ward by:",
                OrderIndex = 5,
                IsRequired = true,
                WizardStep = 3,
                OptionsJson = "[\"Personal medical\",\"Apartinatori (familie, prieteni, vecini)\",\"Am mers singur(a)\"]"
            },
            new()
            {
                Category = QuestionCategory.PatientRights,
                Type = QuestionType.YesNo,
                TextRO = "La internare, ati fost informat(a) clar, pe intelesul dumneavoastra, despre drepturile de care beneficiati in calitate de pacient?",
                TextEN = "Upon admission, were you clearly informed, in a way you could understand, about your rights as a patient?",
                OrderIndex = 6,
                IsRequired = true,
                WizardStep = 3
            },
            new()
            {
                Category = QuestionCategory.PatientRights,
                Type = QuestionType.YesNo,
                TextRO = "La internare, ati fost informat(a) clar, pe intelesul dumneavoastra, despre regulamentul de ordine interioara si obligatiile dumneavoastra ca pacient?",
                TextEN = "Upon admission, were you clearly informed, in a way you could understand, about the hospital's internal rules and your responsibilities as a patient?",
                OrderIndex = 7,
                IsRequired = true,
                WizardStep = 3
            },

            // Step 5: Services Rating (WizardStep = 4)
            new()
            {
                Category = QuestionCategory.Services,
                Type = QuestionType.Rating,
                TextRO = "Cum apreciati conditiile de cazare si calitatea lenjeriei de pat?",
                TextEN = "How would you rate the accommodation conditions and quality of bed linen?",
                OrderIndex = 8,
                IsRequired = true,
                WizardStep = 4,
                OptionsJson = "[\"Foarte bun\",\"Bun\",\"Nesatisfacator\"]"
            },
            new()
            {
                Category = QuestionCategory.Services,
                Type = QuestionType.Rating,
                TextRO = "Cum apreciati curatenia?",
                TextEN = "How would you rate the cleanliness?",
                OrderIndex = 9,
                IsRequired = true,
                WizardStep = 4,
                OptionsJson = "[\"Foarte bun\",\"Bun\",\"Nesatisfacator\"]"
            },
            new()
            {
                Category = QuestionCategory.Services,
                Type = QuestionType.Rating,
                TextRO = "Cum apreciati calitatea hranei si serviciul de distribuire a mesei?",
                TextEN = "How would you rate the food quality and meal distribution service?",
                OrderIndex = 10,
                IsRequired = true,
                WizardStep = 4,
                OptionsJson = "[\"Foarte bun\",\"Bun\",\"Nesatisfacator\"]"
            },
            new()
            {
                Category = QuestionCategory.Services,
                Type = QuestionType.Rating,
                TextRO = "Cum apreciati timpul si informatiile oferite de medicul de salon in cadrul consultatiei?",
                TextEN = "How would you rate the time and information provided by the ward doctor during your consultation?",
                OrderIndex = 11,
                IsRequired = true,
                WizardStep = 4,
                OptionsJson = "[\"Foarte bun\",\"Bun\",\"Nesatisfacator\"]"
            },
            new()
            {
                Category = QuestionCategory.Services,
                Type = QuestionType.Rating,
                TextRO = "Cum apreciati comunicarea generala cu personalul spitalului?",
                TextEN = "How would you rate the overall communication with hospital staff?",
                OrderIndex = 12,
                IsRequired = true,
                WizardStep = 4,
                OptionsJson = "[\"Foarte bun\",\"Bun\",\"Nesatisfacator\"]"
            },

            // Step 6: Medical Info (WizardStep = 5)
            new()
            {
                Category = QuestionCategory.MedicalInformation,
                Type = QuestionType.YesPartialNo,
                TextRO = "Ati fost informat(a), pe intelesul dumneavoastra, despre boala, tratamentul, riscurile operatorii, prognosticul si data aproximativa a externarii?",
                TextEN = "Were you informed, in a way you could understand, about your illness, treatment, surgical risks, prognosis, and approximate discharge date?",
                OrderIndex = 13,
                IsRequired = true,
                WizardStep = 5
            },
            new()
            {
                Category = QuestionCategory.Transport,
                Type = QuestionType.MultipleChoice,
                TextRO = "Pentru investigatii in alte sectii sau unitati sanitare, ati fost insotit(a) de:",
                TextEN = "For investigations in other departments or healthcare units, were you accompanied by:",
                OrderIndex = 14,
                IsRequired = true,
                WizardStep = 5,
                OptionsJson = "[\"Personal medical\",\"Apartinatori (familie)\",\"Am mers singur(a)\"]"
            },
            new()
            {
                Category = QuestionCategory.Transport,
                Type = QuestionType.MultipleChoice,
                TextRO = "Pe durata internarii, la deplasarea pentru consultatii, tratamente sau analize, ati fost multumit(a) de conditiile de transport sau sprijinul oferit de personalul spitalului?",
                TextEN = "During hospitalization, when going for consultations, treatments, or tests, were you satisfied with the transport conditions or support provided by the hospital staff?",
                OrderIndex = 15,
                IsRequired = true,
                WizardStep = 5,
                OptionsJson = "[\"Da, intotdeauna\",\"Da, uneori\",\"Nu\",\"Am fost asistat(a) doar de apartinatori\",\"Nu se aplica, m-am deplasat singur(a)\"]"
            },

            // Step 7: Medication (WizardStep = 5 continued)
            new()
            {
                Category = QuestionCategory.Medication,
                Type = QuestionType.YesPartialNo,
                TextRO = "Ati fost instruit(a) privind modul de administrare a medicamentelor pe cale orala (comprimate, pastile)?",
                TextEN = "Were you instructed on how to take oral medication (tablets, pills)?",
                OrderIndex = 16,
                IsRequired = true,
                WizardStep = 5
            },
            new()
            {
                Category = QuestionCategory.Medication,
                Type = QuestionType.YesPartialNo,
                TextRO = "Medicamentele pe cale orala (comprimate, pastile) v-au fost administrate de asistenta medicala?",
                TextEN = "Was oral medication (tablets, pills) administered by the nurse?",
                OrderIndex = 17,
                IsRequired = true,
                WizardStep = 5
            },
            new()
            {
                Category = QuestionCategory.Medication,
                Type = QuestionType.MultipleChoice,
                TextRO = "A fost nevoie sa achizitionati medicamente sau materiale sanitare pe durata internarii?",
                TextEN = "Did you need to purchase medication or other medical supplies during hospitalization?",
                OrderIndex = 18,
                IsRequired = true,
                WizardStep = 5,
                OptionsJson = "[\"Nu a fost nevoie sa cumpar nimic\",\"Am cumparat medicamente\",\"Am cumparat materiale sanitare\"]"
            },

            // Step 8: Care Quality & Corruption (WizardStep = 6)
            new()
            {
                Category = QuestionCategory.CareQuality,
                Type = QuestionType.YesNo,
                TextRO = "Ati fost multumit(a) de ingrijirile acordate in timpul zilei?",
                TextEN = "Were you satisfied with the care provided during the day?",
                OrderIndex = 19,
                IsRequired = true,
                WizardStep = 6
            },
            new()
            {
                Category = QuestionCategory.CareQuality,
                Type = QuestionType.YesNo,
                TextRO = "Ati fost multumit(a) de ingrijirile acordate in timpul noptii?",
                TextEN = "Were you satisfied with the care provided during the night?",
                OrderIndex = 20,
                IsRequired = true,
                WizardStep = 6
            },
            new()
            {
                Category = QuestionCategory.CareQuality,
                Type = QuestionType.YesNo,
                TextRO = "Ati fost multumit(a) de ingrijirile acordate in timpul sarbatorilor?",
                TextEN = "Were you satisfied with the care provided during holidays?",
                OrderIndex = 21,
                IsRequired = true,
                WizardStep = 6
            },
            new()
            {
                Category = QuestionCategory.Corruption,
                Type = QuestionType.YesNo,
                TextRO = "Vi s-au solicitat bani sau atentii de catre medici sau asistente?",
                TextEN = "Were you asked for money or gifts by doctors or nurses?",
                OrderIndex = 22,
                IsRequired = true,
                IsCorruptionAlert = true,
                WizardStep = 6
            },

            // Step 9: Final Questions (WizardStep = 7)
            new()
            {
                Category = QuestionCategory.OverallSatisfaction,
                Type = QuestionType.MultipleChoice,
                TextRO = "Daca ar fi nevoie sa fiti internat(a) din nou, ati alege acest spital?",
                TextEN = "If you needed to be hospitalized again, would you choose this hospital?",
                OrderIndex = 23,
                IsRequired = true,
                WizardStep = 7,
                OptionsJson = "[\"Cu siguranta da\",\"Probabil da\",\"Cu siguranta nu\"]"
            },
            new()
            {
                Category = QuestionCategory.RightsRespect,
                Type = QuestionType.YesPartialNo,
                TextRO = "Considerati ca drepturile dumneavoastra ca pacient, afisate in regulamentul de la sectie, au fost respectate pe durata internarii?",
                TextEN = "Do you believe that your patient rights, as stated in the regulations displayed in your ward, were respected during your hospitalization?",
                OrderIndex = 24,
                IsRequired = true,
                WizardStep = 7
            },
            new()
            {
                Category = QuestionCategory.RightsRespect,
                Type = QuestionType.FreeText,
                TextRO = "Daca ati raspuns Partial sau Nu, va rugam precizati care drept considerati ca nu a fost respectat:",
                TextEN = "If your answer is \"Partially\" or \"No, never\", please specify which right you believe was violated:",
                OrderIndex = 25,
                IsRequired = false,
                WizardStep = 7
            },
            new()
            {
                Category = QuestionCategory.GeneralComments,
                Type = QuestionType.FreeText,
                TextRO = "Ce v-a placut in mod deosebit?",
                TextEN = "What did you particularly like?",
                OrderIndex = 26,
                IsRequired = false,
                WizardStep = 7
            },
            new()
            {
                Category = QuestionCategory.GeneralComments,
                Type = QuestionType.FreeText,
                TextRO = "Ce nu v-a placut / ce v-a deranjat?",
                TextEN = "What did you dislike / what bothered you?",
                OrderIndex = 27,
                IsRequired = false,
                WizardStep = 7
            },
            new()
            {
                Category = QuestionCategory.GeneralComments,
                Type = QuestionType.FreeText,
                TextRO = "Alte comentarii / sugestii de imbunatatire:",
                TextEN = "Other comments / suggestions for improvement:",
                OrderIndex = 28,
                IsRequired = false,
                WizardStep = 7
            },
        };
    }

    private static async Task SeedDemoFeedbackAsync(AppDbContext context)
    {
        var hospitals = context.Hospitals.ToList();
        var questions = context.Questions.ToList();
        var rng = new Random(42);

        var smileyOptions = new[] { "Foarte multumit", "Multumit", "Nemultumit", "Foarte nemultumit" };
        var ratingOptions = new[] { "Foarte bun", "Bun", "Nesatisfacator" };

        foreach (var hospital in hospitals)
        {
            var departments = context.Departments.Where(d => d.HospitalId == hospital.Id).ToList();
            int feedbackCount = rng.Next(30, 80);

            for (int i = 0; i < feedbackCount; i++)
            {
                var dept = departments.Count > 0 ? departments[rng.Next(departments.Count)] : null;
                var daysAgo = rng.Next(1, 180);
                var submission = new FeedbackSubmission
                {
                    HospitalId = hospital.Id,
                    DepartmentId = dept?.Id,
                    SubmittedAt = DateTime.UtcNow.AddDays(-daysAgo),
                    PatientGender = rng.Next(2) == 0 ? PatientGender.Male : PatientGender.Female,
                    PatientAge = rng.Next(18, 85),
                    FilledBy = rng.Next(10) < 7 ? FilledByType.Patient : (rng.Next(2) == 0 ? FilledByType.Relative : FilledByType.Caregiver),
                    AccessToken = Guid.NewGuid().ToString("N")[..16],
                };

                var answers = new List<FeedbackAnswer>();
                foreach (var q in questions)
                {
                    var answer = new FeedbackAnswer { QuestionId = q.Id };

                    switch (q.Type)
                    {
                        case QuestionType.Smiley:
                            var sIdx = WeightedRandom(rng, new[] { 40, 35, 18, 7 });
                            answer.SelectedOption = smileyOptions[sIdx];
                            answer.RatingValue = 4 - sIdx;
                            break;
                        case QuestionType.Rating:
                            var rIdx = WeightedRandom(rng, new[] { 45, 40, 15 });
                            answer.SelectedOption = ratingOptions[rIdx];
                            answer.RatingValue = 3 - rIdx;
                            break;
                        case QuestionType.YesNo:
                            if (q.IsCorruptionAlert)
                            {
                                bool corrupt = rng.Next(100) < 5;
                                answer.SelectedOption = corrupt ? "Da" : "Nu";
                                answer.RatingValue = corrupt ? 0 : 1;
                            }
                            else
                            {
                                bool yes = rng.Next(100) < 80;
                                answer.SelectedOption = yes ? "Da" : "Nu";
                                answer.RatingValue = yes ? 1 : 0;
                            }
                            break;
                        case QuestionType.YesPartialNo:
                            var pIdx = WeightedRandom(rng, new[] { 60, 30, 10 });
                            answer.SelectedOption = new[] { "Da, intotdeauna", "Da, partial", "Nu, niciodata" }[pIdx];
                            answer.RatingValue = 2 - pIdx;
                            break;
                        case QuestionType.MultipleChoice:
                            if (q.OptionsJson != null)
                            {
                                var opts = System.Text.Json.JsonSerializer.Deserialize<string[]>(q.OptionsJson)!;
                                answer.SelectedOption = opts[rng.Next(opts.Length)];
                            }
                            break;
                        case QuestionType.FreeText:
                            if (rng.Next(100) < 30)
                                answer.TextValue = GetRandomComment(rng);
                            break;
                    }

                    answers.Add(answer);
                }

                submission.Answers = answers;
                context.FeedbackSubmissions.Add(submission);

                // Create abuse alerts for corruption answers
                var corruptionAnswer = answers.FirstOrDefault(a =>
                {
                    var q = questions.First(qq => qq.Id == a.QuestionId);
                    return q.IsCorruptionAlert && a.SelectedOption == "Da";
                });

                if (corruptionAnswer != null)
                {
                    context.AbuseAlerts.Add(new AbuseAlert
                    {
                        FeedbackSubmission = submission,
                        HospitalId = hospital.Id,
                        DepartmentId = dept?.Id,
                        AlertType = AlertType.MoneyRequested,
                        CreatedAt = submission.SubmittedAt,
                        IsReviewed = rng.Next(100) < 60,
                        ReviewedBy = rng.Next(100) < 60 ? "admin@smarthospital.ro" : null,
                        ReviewedAt = rng.Next(100) < 60 ? submission.SubmittedAt.AddDays(rng.Next(1, 7)) : null,
                    });
                }
            }
        }

        await context.SaveChangesAsync();
    }

    private static int WeightedRandom(Random rng, int[] weights)
    {
        int total = weights.Sum();
        int r = rng.Next(total);
        int cumulative = 0;
        for (int i = 0; i < weights.Length; i++)
        {
            cumulative += weights[i];
            if (r < cumulative) return i;
        }
        return weights.Length - 1;
    }

    private static string GetRandomComment(Random rng)
    {
        var comments = new[]
        {
            "Personal foarte amabil si profesionist.",
            "Curatenia ar putea fi imbunatatita.",
            "Mancarea a fost buna.",
            "Timpii de asteptare au fost prea lungi.",
            "Medicul a fost foarte atent si m-a explicat totul.",
            "Conditiile de cazare sunt satisfacatoare.",
            "Am fost tratata cu respect si profesionalism.",
            "Ar fi nevoie de mai mult personal pe tura de noapte.",
            "Echipamentele medicale sunt moderne.",
            "Comunicarea cu personalul a fost excelenta.",
            "Parcarea la spital este insuficienta.",
            "Recomand acest spital cu incredere.",
            "S-ar putea imbunatati semnalizarea in spital.",
            "Asistentele au fost foarte grijulii.",
            "Temperatura in saloane a fost prea scazuta.",
        };
        return comments[rng.Next(comments.Length)];
    }

    private static async Task SeedUsersAsync(UserManager<HospitalManager> userManager, AppDbContext context)
    {
        var hospitals = context.Hospitals.Take(3).ToList();

        // Admin user (county level)
        var admin = new HospitalManager
        {
            UserName = "admin@smarthospital.ro",
            Email = "admin@smarthospital.ro",
            FullName = "Administrator Judet Cluj",
            Role = ManagerRole.Admin,
            EmailConfirmed = true,
        };
        await userManager.CreateAsync(admin, "Admin123!");

        // Manager for first hospital
        if (hospitals.Count > 0)
        {
            var manager1 = new HospitalManager
            {
                UserName = "manager.urgenta@smarthospital.ro",
                Email = "manager.urgenta@smarthospital.ro",
                FullName = "Manager Spitalul Judetean de Urgenta",
                HospitalId = hospitals[0].Id,
                Role = ManagerRole.Manager,
                EmailConfirmed = true,
            };
            await userManager.CreateAsync(manager1, "Manager123!");
        }

        // Manager for second hospital
        if (hospitals.Count > 1)
        {
            var manager2 = new HospitalManager
            {
                UserName = "manager.recuperare@smarthospital.ro",
                Email = "manager.recuperare@smarthospital.ro",
                FullName = "Manager Spitalul de Recuperare",
                HospitalId = hospitals[1].Id,
                Role = ManagerRole.Manager,
                EmailConfirmed = true,
            };
            await userManager.CreateAsync(manager2, "Manager123!");
        }
    }

    private static async Task SeedSlotConfigurationsAsync(AppDbContext context)
    {
        var departments = context.Departments.ToList();
        var slots = new List<SlotConfiguration>();

        foreach (var dept in departments)
        {
            // Mon-Fri, 08:00-16:00, 30-min slots, 2 patients per slot
            for (var day = DayOfWeek.Monday; day <= DayOfWeek.Friday; day++)
            {
                slots.Add(new SlotConfiguration
                {
                    DepartmentId = dept.Id,
                    DayOfWeek = day,
                    StartTime = new TimeOnly(8, 0),
                    EndTime = new TimeOnly(16, 0),
                    SlotDurationMinutes = 30,
                    MaxPatientsPerSlot = 2,
                    IsActive = true,
                });
            }
        }

        context.SlotConfigurations.AddRange(slots);
        await context.SaveChangesAsync();
    }

    private static async Task SeedBudgetAllocationsAsync(AppDbContext context)
    {
        var departments = context.Departments.Include(d => d.Hospital).ToList();
        var rng = new Random(2026);
        var now = DateTime.UtcNow;
        var currentMonth = now.Month;
        var currentYear = now.Year;
        var dayOfMonth = now.Day;
        var daysInMonth = DateTime.DaysInMonth(currentYear, currentMonth);

        var allocations = new List<BudgetAllocation>();

        foreach (var dept in departments)
        {
            // Base budget depends on department size (beds * tariff factor)
            var baseBudget = dept.BedsCount * rng.Next(8000, 25000);
            var totalBudget = (decimal)baseBudget;

            // Simulate consumption: proportional to day of month + random variance
            var expectedConsumption = (double)dayOfMonth / daysInMonth;
            var variance = (rng.NextDouble() * 0.4) - 0.15; // -15% to +25% variance
            var consumptionRatio = Math.Clamp(expectedConsumption + variance, 0.15, 0.99);
            var consumed = totalBudget * (decimal)consumptionRatio;

            // Max cases based on beds and turnover
            var maxCases = dept.BedsCount * rng.Next(2, 5);
            var usedCases = (int)(maxCases * consumptionRatio);

            // Determine status
            BudgetStatus status;
            if (consumptionRatio >= 0.90)
                status = BudgetStatus.Exhausted;
            else if (consumptionRatio >= 0.70)
                status = BudgetStatus.Limited;
            else
                status = BudgetStatus.Available;

            allocations.Add(new BudgetAllocation
            {
                HospitalId = dept.HospitalId,
                DepartmentId = dept.Id,
                Year = currentYear,
                Month = currentMonth,
                TotalBudgetRON = Math.Round(totalBudget, 2),
                ConsumedBudgetRON = Math.Round(consumed, 2),
                MaxCases = maxCases,
                UsedCases = usedCases,
                Status = status,
                LastUpdated = now.AddHours(-rng.Next(1, 48)),
            });
        }

        context.BudgetAllocations.AddRange(allocations);
        await context.SaveChangesAsync();
    }
}
