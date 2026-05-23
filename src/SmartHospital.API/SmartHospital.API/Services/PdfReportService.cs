using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SmartHospital.API.DTOs;

namespace SmartHospital.API.Services;

public class PdfReportService
{
    public byte[] GenerateHospitalReport(HospitalDetailDto hospital, HospitalStatsDto stats)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(40);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Element(c => ComposeHeader(c, hospital));
                page.Content().Element(c => ComposeContent(c, hospital, stats));
                page.Footer().Element(ComposeFooter);
            });
        });

        return document.GeneratePdf();
    }

    private void ComposeHeader(IContainer container, HospitalDetailDto hospital)
    {
        container.Column(col =>
        {
            col.Item().Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text("SmartHospital").FontSize(20).Bold().FontColor(Colors.Blue.Darken2);
                    c.Item().Text("Patient Feedback Report").FontSize(14).FontColor(Colors.Grey.Darken1);
                });
                row.ConstantItem(120).AlignRight().Text(DateTime.Now.ToString("dd/MM/yyyy")).FontSize(10);
            });

            col.Item().PaddingVertical(5).LineHorizontal(1).LineColor(Colors.Blue.Darken2);

            col.Item().PaddingTop(10).Text(hospital.Name).FontSize(16).Bold();
            col.Item().Text($"{hospital.Address}, {hospital.City}, {hospital.County}").FontSize(9).FontColor(Colors.Grey.Darken1);
            col.Item().PaddingBottom(10);
        });
    }

    private void ComposeContent(IContainer container, HospitalDetailDto hospital, HospitalStatsDto stats)
    {
        container.Column(col =>
        {
            // Key metrics
            col.Item().PaddingVertical(10).Text("Overview").FontSize(14).Bold().FontColor(Colors.Blue.Darken2);

            col.Item().Table(table =>
            {
                table.ColumnsDefinition(c =>
                {
                    c.RelativeColumn();
                    c.RelativeColumn();
                    c.RelativeColumn();
                    c.RelativeColumn();
                });

                table.Cell().Element(CellStyle).Text("Total Feedback");
                table.Cell().Element(CellStyle).Text("Avg Satisfaction");
                table.Cell().Element(CellStyle).Text("Abuse Alerts");
                table.Cell().Element(CellStyle).Text("Total Beds");

                table.Cell().Element(ValueCellStyle).Text(stats.TotalFeedback.ToString()).Bold();
                table.Cell().Element(ValueCellStyle).Text($"{stats.AverageSatisfaction:F1}/4.0").Bold();
                table.Cell().Element(ValueCellStyle).Text(stats.AbuseAlertCount.ToString()).Bold();
                table.Cell().Element(ValueCellStyle).Text(hospital.TotalBeds.ToString()).Bold();
            });

            // Category Scores
            col.Item().PaddingTop(15).Text("Category Scores").FontSize(14).Bold().FontColor(Colors.Blue.Darken2);

            col.Item().Table(table =>
            {
                table.ColumnsDefinition(c =>
                {
                    c.RelativeColumn(3);
                    c.RelativeColumn(1);
                    c.RelativeColumn(4);
                });

                foreach (var cat in stats.CategoryScores)
                {
                    table.Cell().Element(CellStyle).Text(cat.Key);
                    table.Cell().Element(CellStyle).AlignCenter().Text($"{cat.Value:F1}");
                    table.Cell().Element(CellStyle).PaddingVertical(4).Row(row =>
                    {
                        var pct = Math.Min(cat.Value / 4.0, 1.0);
                        row.RelativeItem((float)pct).Height(12).Background(GetScoreColor(cat.Value));
                        if (pct < 1) row.RelativeItem((float)(1 - pct)).Height(12).Background(Colors.Grey.Lighten3);
                    });
                }
            });

            // Department comparison
            if (stats.DepartmentComparison.Count > 0)
            {
                col.Item().PaddingTop(15).Text("Department Comparison").FontSize(14).Bold().FontColor(Colors.Blue.Darken2);

                col.Item().Table(table =>
                {
                    table.ColumnsDefinition(c =>
                    {
                        c.RelativeColumn(3);
                        c.RelativeColumn(1);
                        c.RelativeColumn(1);
                    });

                    table.Header(header =>
                    {
                        header.Cell().Element(HeaderCellStyle).Text("Department");
                        header.Cell().Element(HeaderCellStyle).Text("Avg Score");
                        header.Cell().Element(HeaderCellStyle).Text("Responses");
                    });

                    foreach (var dept in stats.DepartmentComparison.OrderByDescending(d => d.AverageSatisfaction))
                    {
                        table.Cell().Element(CellStyle).Text(dept.Name);
                        table.Cell().Element(CellStyle).AlignCenter().Text($"{dept.AverageSatisfaction:F1}");
                        table.Cell().Element(CellStyle).AlignCenter().Text(dept.FeedbackCount.ToString());
                    }
                });
            }

            // Monthly trend
            if (stats.MonthlyTrend.Count > 0)
            {
                col.Item().PaddingTop(15).Text("Monthly Trend").FontSize(14).Bold().FontColor(Colors.Blue.Darken2);

                col.Item().Table(table =>
                {
                    table.ColumnsDefinition(c =>
                    {
                        c.RelativeColumn(2);
                        c.RelativeColumn(1);
                        c.RelativeColumn(1);
                    });

                    table.Header(header =>
                    {
                        header.Cell().Element(HeaderCellStyle).Text("Month");
                        header.Cell().Element(HeaderCellStyle).Text("Avg Score");
                        header.Cell().Element(HeaderCellStyle).Text("Responses");
                    });

                    foreach (var point in stats.MonthlyTrend)
                    {
                        table.Cell().Element(CellStyle).Text(point.Label);
                        table.Cell().Element(CellStyle).AlignCenter().Text($"{point.Value:F1}");
                        table.Cell().Element(CellStyle).AlignCenter().Text(point.Count.ToString());
                    }
                });
            }
        });
    }

    private void ComposeFooter(IContainer container)
    {
        container.Row(row =>
        {
            row.RelativeItem().AlignLeft().Text(t =>
            {
                t.Span("SmartHospital Platform - ").FontSize(8).FontColor(Colors.Grey.Medium);
                t.Span("Confidential Report").FontSize(8).FontColor(Colors.Grey.Medium).Italic();
            });
            row.RelativeItem().AlignRight().Text(t =>
            {
                t.Span("Page ").FontSize(8);
                t.CurrentPageNumber().FontSize(8);
                t.Span(" / ").FontSize(8);
                t.TotalPages().FontSize(8);
            });
        });
    }

    private static IContainer CellStyle(IContainer container) =>
        container.Padding(4).BorderBottom(1).BorderColor(Colors.Grey.Lighten2);

    private static IContainer ValueCellStyle(IContainer container) =>
        container.Padding(4).BorderBottom(1).BorderColor(Colors.Grey.Lighten2).AlignCenter();

    private static IContainer HeaderCellStyle(IContainer container) =>
        container.Padding(4).Background(Colors.Blue.Lighten4).BorderBottom(1).BorderColor(Colors.Blue.Darken2);

    private static string GetScoreColor(double score) => score switch
    {
        >= 3.5 => Colors.Green.Darken1,
        >= 2.5 => Colors.Yellow.Darken2,
        >= 1.5 => Colors.Orange.Darken1,
        _ => Colors.Red.Darken1
    };
}
