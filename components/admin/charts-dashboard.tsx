"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, getWeek, getDate, getMonth, getYear, eachDayOfInterval, eachMonthOfInterval } from 'date-fns';
import { Calendar as CalendarIcon, Download, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Link from "next/link";

interface EmergencyReport {
  id: string;
  emergency_type: string;
  status: string;
  created_at: string; 
}

interface InternalReport {
  id: number;
  incident_type_id: number;
  incident_date: string; 
  barangay_id: number;
  created_at: string;
}


interface BaseEntry {
  id: number;
  name: string;
}

interface ChartsDashboardProps {
  allEmergencyReports: EmergencyReport[];
  allInternalReports: InternalReport[];
  barangays: BaseEntry[];
  incidentTypes: BaseEntry[];
}

type BarangayIncidentPieEntry = {
  name: string;
  value: number;
  incidentTypes: { name: string; count: number }[];
};

interface PdfTableSummary {
  title: string;
  columns: { header: string; widthRatio: number }[];
  rows: string[][];
}

const addSummaryTablesToPdf = (pdfInstance: jsPDF, summaries: PdfTableSummary[], baseTitle: string) => {
  if (!summaries.length) return;

  const margin = 14;
  const headerHeight = 8;
  const lineHeight = 5.5;
  const pageWidth = pdfInstance.internal.pageSize.getWidth();
  const pageHeight = pdfInstance.internal.pageSize.getHeight();
  const tableWidth = pageWidth - margin * 2;

  const startNewTablePage = (title: string) => {
    pdfInstance.addPage();
    let yPosition = margin;
    pdfInstance.setFont('helvetica', 'bold');
    pdfInstance.setFontSize(14);
    pdfInstance.text(title, margin, yPosition);
    return yPosition + 10;
  };

  summaries.forEach((summary) => {
    if (summary.rows.length === 0) return;

    const ratioSum = summary.columns.reduce((sum, column) => sum + column.widthRatio, 0) || 1;
    const columnWidths = summary.columns.map(column => tableWidth * (column.widthRatio / ratioSum));

    let currentY = startNewTablePage(summary.title || `${baseTitle} Summary`);

    const drawHeader = () => {
      let x = margin;
      pdfInstance.setFont('helvetica', 'bold');
      pdfInstance.setFontSize(11);
      pdfInstance.setDrawColor(200, 200, 200);
      pdfInstance.setFillColor(240, 240, 240);
      pdfInstance.setTextColor(0, 0, 0);
      summary.columns.forEach((column, index) => {
        pdfInstance.setFillColor(240, 240, 240);
        pdfInstance.rect(x, currentY, columnWidths[index], headerHeight, 'F');
        pdfInstance.setDrawColor(200, 200, 200);
        pdfInstance.rect(x, currentY, columnWidths[index], headerHeight, 'S');
        pdfInstance.text(column.header, x + 2, currentY + 5);
        x += columnWidths[index];
      });
      currentY += headerHeight;
      pdfInstance.setFont('helvetica', 'normal');
      pdfInstance.setFontSize(11);
      pdfInstance.setTextColor(0, 0, 0);
    };

    const drawRows = () => {
      summary.rows.forEach((row) => {
        const cellLines = row.map((value, columnIndex) =>
          pdfInstance.splitTextToSize(value, Math.max(columnWidths[columnIndex] - 4, 4))
        );
        const rowLineCount = Math.max(...cellLines.map(lines => lines.length));
        const rowHeight = rowLineCount * lineHeight + 4;

        if (currentY + rowHeight > pageHeight - margin) {
          currentY = startNewTablePage(`${summary.title} (cont.)`);
          drawHeader();
        }

        let x = margin;
        cellLines.forEach((lines: string[], columnIndex: number) => {
          pdfInstance.rect(x, currentY, columnWidths[columnIndex], rowHeight);
          lines.forEach((line: string, lineIndex: number) => {
            pdfInstance.text(line, x + 2, currentY + 6 + lineIndex * lineHeight);
          });
          x += columnWidths[columnIndex];
        });

        currentY += rowHeight;
      });
    };

    drawHeader();
    drawRows();
  });
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-white border border-gray-300 rounded-md shadow-md text-sm">
        <p className="font-semibold">{`${payload[0].name}: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-white border border-gray-300 rounded-md shadow-md text-sm">
        <p className="font-semibold">{`${label}`}</p>
        {payload.map((entry: any, index: number) => (
          <p key={`item-${index}`} style={{ color: entry.color }}>
            {`${entry.name}: ${entry.value}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function ChartsDashboard({ allEmergencyReports, allInternalReports, barangays, incidentTypes }: ChartsDashboardProps) {
 

  // State for Pie Chart (Barangay Incidents)
  const [pieChartPeriod, setPieChartPeriod] = React.useState<string>('yearly');
  const [pieChartDate, setPieChartDate] = React.useState<Date | undefined>(new Date());
  const [pieChartMonth, setPieChartMonth] = React.useState<string>(format(new Date(), 'MM'));
  const [pieChartYear, setPieChartYear] = React.useState<string>(format(new Date(), 'yyyy'));
  const [pieStartDateRange, setPieStartDateRange] = React.useState<Date | undefined>(new Date());
  const [pieEndDateRange, setPieEndDateRange] = React.useState<Date | undefined>(new Date());
  const [pieStartTime, setPieStartTime] = React.useState<string>('00:00');
  const [pieEndTime, setPieEndTime] = React.useState<string>('23:59');

  // State for Bar Chart (Incident Types)
  const [barIncidentPeriod, setBarIncidentPeriod] = React.useState<string>('yearly');
  const [barIncidentMonth, setBarIncidentMonth] = React.useState<string>(format(new Date(), 'MM'));
  const [barIncidentYear, setBarIncidentYear] = React.useState<string>(format(new Date(), 'yyyy'));

  // State for Bar Chart (Report Status Counts)
  const [barStatusPeriod, setBarStatusPeriod] = React.useState<string>('yearly');
  const [barStatusDate, setBarStatusDate] = React.useState<Date | undefined>(new Date());
  const [barStatusMonth, setBarStatusMonth] = React.useState<string>(format(new Date(), 'MM'));
  const [barStatusYear, setBarStatusYear] = React.useState<string>(format(new Date(), 'yyyy'));
  const [barStatusStartDateRange, setBarStatusStartDateRange] = React.useState<Date | undefined>(new Date());
  const [barStatusEndDateRange, setBarStatusEndDateRange] = React.useState<Date | undefined>(new Date());
  const years = React.useMemo(() => {
    const currentYearNum = new Date().getFullYear();
    const yearsArray = [];
    for (let i = currentYearNum - 5; i <= currentYearNum + 1; i++) {
      yearsArray.push(String(i));
    }
    return yearsArray;
  }, []);

  // Months for dropdowns
  const months = [
    { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' },
    { value: '04', label: 'April' }, { value: '05', label: 'May' }, { value: '06', label: 'June' },
    { value: '07', label: 'July' }, { value: '08', label: 'August' }, { value: '09', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];

  // Colors for Incident Types Bar Chart
  const PIE_COLORS = React.useMemo<string[]>(
    () => ['#0EA5E9', '#F97316', '#22C55E', '#6366F1', '#F59E0B', '#EC4899', '#14B8A6', '#8B5CF6', '#EF4444', '#FBBF24', '#34D399', '#60A5FA'],
    []
  );

  const INCIDENT_TYPE_COLOR_MAP = React.useMemo<Record<string, string>>(
    () => ({
      'armed conflict': '#EF4444',
      'drowning incident': '#2563EB',
      'fire incident': '#FFB6C1',
      'medical emergency': '#10B981',
      'vehicular/pedestrian accident': '#6366F1',
      'vehicular/pedestrian roadcrash incident': '#9acd32',
      'water mishap': '#0EA5E9',
      'weather disturbance': '#22D3EE',
      'public disturbance': '#F59E0B',
      'tsunami': '#0EA5E9',
      'others': '#6B7280',
    }),
    []
  );

  // Helper function to get color for an incident type
  const getIncidentTypeColor = React.useCallback((typeName: string | null | undefined, index: number) => {
    const key = (typeName ?? '').toLowerCase().trim();
    if (key && INCIDENT_TYPE_COLOR_MAP[key]) {
      return INCIDENT_TYPE_COLOR_MAP[key];
    }
    return PIE_COLORS[index % PIE_COLORS.length];
  }, [INCIDENT_TYPE_COLOR_MAP, PIE_COLORS]);

  // --- Data Processing for Charts ---

  // Helper to get date range based on period and selected date/month/year
  const getPeriodDateRange = (period: string, date?: Date, month?: string, year?: string, startDateRange?: Date, endDateRange?: Date) => {
    let start: Date;
    let end: Date;

    const currentSelectedDate = date || new Date(); // Fallback to current date if undefined

    switch (period) {
      case 'daily':
        start = startOfDay(currentSelectedDate);
        end = endOfDay(currentSelectedDate);
        break;
      case 'weekly':
        start = startDateRange ? startOfDay(startDateRange) : startOfWeek(currentSelectedDate, { weekStartsOn: 0 });
        end = endDateRange ? endOfDay(endDateRange) : endOfWeek(currentSelectedDate, { weekStartsOn: 0 });
        break;
      case 'monthly':
        const monthDate = new Date(parseInt(year || format(new Date(), 'yyyy')), parseInt(month || format(new Date(), 'MM')) - 1, 1);
        start = startOfMonth(monthDate);
        end = endOfMonth(monthDate);
        break;
      case 'yearly':
        const yearDate = new Date(parseInt(year || format(new Date(), 'yyyy')), 0, 1);
        start = startOfYear(yearDate);
        end = endOfYear(yearDate);
        break;
      default: // Default to daily if period is not recognized
        start = startOfDay(currentSelectedDate);
        end = endOfDay(currentSelectedDate);
    }
    return { start, end };
  };

  // Pie Chart Data: Incidents per Barangay
  const getBarangayIncidentData = React.useCallback((): BarangayIncidentPieEntry[] => {
    const { start: periodStart, end: periodEnd } = getPeriodDateRange(
      pieChartPeriod,
      pieChartDate,
      pieChartMonth,
      pieChartYear,
      pieStartDateRange,
      pieEndDateRange
    );

    const [startHour, startMinute] = pieStartTime.split(':').map(Number);
    const [endHour, endMinute] = pieEndTime.split(':').map(Number);

    const filterStart = new Date(periodStart);
    filterStart.setHours(startHour, startMinute, 0, 0);

    const filterEnd = new Date(periodEnd);
    filterEnd.setHours(endHour, endMinute, 59, 999);

    const filteredReports = allInternalReports.filter(report => {
      const incidentDate = parseISO(report.incident_date);
      return incidentDate >= filterStart && incidentDate <= filterEnd;
    });

    const barangayCounts: Record<string, { total: number; incidentTypeCounts: Record<string, number> }> = {};

    filteredReports.forEach(report => {
      const barangayName = barangays.find(b => b.id === report.barangay_id)?.name || 'Unknown Barangay';
      const incidentTypeName = incidentTypes.find(it => it.id === report.incident_type_id)?.name || 'Unspecified';

      if (!barangayCounts[barangayName]) {
        barangayCounts[barangayName] = {
          total: 0,
          incidentTypeCounts: {},
        };
      }

      barangayCounts[barangayName].total += 1;
      barangayCounts[barangayName].incidentTypeCounts[incidentTypeName] =
        (barangayCounts[barangayName].incidentTypeCounts[incidentTypeName] || 0) + 1;
    });

    return Object.entries(barangayCounts).map(([name, data]) => ({
      name,
      value: data.total,
      incidentTypes: Object.entries(data.incidentTypeCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([typeName, count]) => ({ name: typeName, count })),
    }));
  }, [allInternalReports, barangays, incidentTypes, pieChartPeriod, pieChartDate, pieChartMonth, pieChartYear, pieStartDateRange, pieEndDateRange, pieStartTime, pieEndTime]);

  const pieChartData = getBarangayIncidentData();


  // Bar Chart Data: Incident Types (Monthly/Yearly)
  const getIncidentTypeBarData = React.useCallback(() => {
    const currentYear = parseInt(barIncidentYear || format(new Date(), 'yyyy'));
    const currentMonth = parseInt(barIncidentMonth || format(new Date(), 'MM'));

    if (barIncidentPeriod === 'yearly') {
      // Data for yearly view (months on X-axis, incident types as bars)
      const data: { [key: string]: any }[] = eachMonthOfInterval({
        start: new Date(currentYear, 0, 1),
        end: new Date(currentYear, 11, 31)
      }).map(date => {
        const monthLabel = format(date, 'MMM');
        const monthData: { [key: string]: any } = { month: monthLabel };
        incidentTypes.forEach(type => {
          monthData[type.name] = 0; // Initialize counts for all incident types to 0
        });
        return monthData;
      });

      allInternalReports.forEach(report => {
        const incidentDate = parseISO(report.incident_date);
        if (incidentDate.getFullYear() === currentYear) {
          const monthIndex = incidentDate.getMonth(); // 0-11
          const incidentTypeName = incidentTypes.find(it => it.id === report.incident_type_id)?.name;
          if (incidentTypeName) {
            data[monthIndex][incidentTypeName]++;
          }
        }
      });
      return data;

    } else { // barIncidentPeriod === 'monthly'
      // Data for monthly view (days on X-axis, incident types as bars)
      const { start: periodStart, end: periodEnd } = getPeriodDateRange(
        barIncidentPeriod,
        undefined,
        barIncidentMonth,
        barIncidentYear
      );

      const data: { [key: string]: any }[] = eachDayOfInterval({
        start: periodStart,
        end: periodEnd
      }).map(date => {
        const dayLabel = format(date, 'd'); // Day of month
        const dayData: { [key: string]: any } = { day: dayLabel };
        incidentTypes.forEach(type => {
          dayData[type.name] = 0; // Initialize counts for all incident types to 0
        });
        return dayData;
      });

      allInternalReports.forEach(report => {
        const incidentDate = parseISO(report.incident_date);
        if (incidentDate >= periodStart && incidentDate <= periodEnd) {
          const dayOfMonth = incidentDate.getDate(); // 1-31
          const incidentTypeName = incidentTypes.find(it => it.id === report.incident_type_id)?.name;
          if (incidentTypeName) {
            // Find the correct day object in the data array
            const targetDayData = data.find(item => parseInt(item.day) === dayOfMonth);
            if (targetDayData) {
              targetDayData[incidentTypeName]++;
            }
          }
        }
      });
      return data;
    }
  }, [allInternalReports, incidentTypes, barIncidentPeriod, barIncidentMonth, barIncidentYear]);

  const incidentTypeBarData = getIncidentTypeBarData();

  const barangayIncidentSummary = React.useMemo<PdfTableSummary[]>(() => {
    if (!pieChartData.length) return [];
    const total = pieChartData.reduce((sum, item) => sum + item.value, 0) || 1;

    const rows = pieChartData
      .slice()
      .sort((a, b) => b.value - a.value)
      .map(entry => {
        const percentage = ((entry.value / total) * 100).toFixed(1) + '%';
        const incidentTypesDetail = entry.incidentTypes
          .map(typeInfo => `${typeInfo.name} (${typeInfo.count})`)
          .join(', ');
        return [entry.name, percentage, incidentTypesDetail || '—'];
      });

    return [
      {
        title: 'Barangay Incident Breakdown',
        columns: [
          { header: 'Barangay', widthRatio: 0.28 },
          { header: 'Incident Percentage', widthRatio: 0.22 },
          { header: 'Incident Types', widthRatio: 0.5 },
        ],
        rows,
      }
    ];
  }, [pieChartData]);

  const incidentTypeSummary = React.useMemo<PdfTableSummary[]>(() => {
    if (!incidentTypeBarData.length) return [];

    const summarized = incidentTypes.map(type => {
      const totalCount = incidentTypeBarData.reduce((sum, item) => sum + (item[type.name] || 0), 0);
      return {
        typeName: type.name,
        total: totalCount,
      };
    }).filter(item => item.total > 0);

    const total = summarized.reduce((sum, item) => sum + item.total, 0) || 1;

    const rows = summarized
      .sort((a, b) => b.total - a.total)
      .map(item => {
        const percentage = ((item.total / total) * 100).toFixed(1) + '%';
        return [item.typeName, item.total.toString(), percentage];
      });

    return [
      {
        title: 'Incident Type Totals',
        columns: [
          { header: 'Incident Type', widthRatio: 0.5 },
          { header: 'Total Reports', widthRatio: 0.25 },
          { header: 'Percentage', widthRatio: 0.25 },
        ],
        rows,
      }
    ];
  }, [incidentTypeBarData, incidentTypes]);


  // Bar Chart Data: Report Status Counts (Daily/Weekly/Monthly/Yearly)
  const getReportStatusData = React.useCallback(() => {
    const { start: periodStart, end: periodEnd } = getPeriodDateRange(
      barStatusPeriod,
      barStatusDate,
      barStatusMonth,
      barStatusYear,
      barStatusStartDateRange,
      barStatusEndDateRange
    );

    const filteredReports = allEmergencyReports.filter(report => {
      const reportDate = parseISO(report.created_at);
      return reportDate >= periodStart && reportDate <= periodEnd;
    });

    const allCount = filteredReports.length;
    const resolvedCount = filteredReports.filter(r => r.status.trim().toLowerCase() === 'resolved').length;
    const activeCount = filteredReports.filter(r => r.status.trim().toLowerCase() === 'pending' || r.status.trim().toLowerCase() === 'active' || r.status.trim().toLowerCase() === 'responded').length;

    return [
      { name: 'All Reports', count: allCount, color: '#0088FE' },
      { name: 'Active/In-Progress', count: activeCount, color: '#FFBB28' },
      { name: 'Resolved', count: resolvedCount, color: '#00C49F' },
    ];
  }, [allEmergencyReports, barStatusPeriod, barStatusDate, barStatusMonth, barStatusYear, barStatusStartDateRange, barStatusEndDateRange]);

  const reportStatusBarData = getReportStatusData();

  const reportStatusSummary = React.useMemo<PdfTableSummary[]>(() => {
    if (!reportStatusBarData.length) return [];

    const total = reportStatusBarData.reduce((sum, item) => sum + item.count, 0) || 1;

    const rows = reportStatusBarData
      .map(item => {
        const percentage = ((item.count / total) * 100).toFixed(1) + '%';
        return [item.name, item.count.toString(), percentage];
      });

    return [
      {
        title: 'Emergency Report Status Summary',
        columns: [
          { header: 'Status', widthRatio: 0.5 },
          { header: 'Total Reports', widthRatio: 0.25 },
          { header: 'Percentage', widthRatio: 0.25 },
        ],
        rows,
      }
    ];
  }, [reportStatusBarData]);

  // --- PDF Download Function ---
  const handleDownloadPdf = async (
    chartId: string,
    chartTitle: string,
    summaryTables: PdfTableSummary[] = [],
    contentSelector: string = '[data-chart-canvas]'
  ) => {
    const chartElement = document.getElementById(chartId);
    if (!chartElement) {
      console.error(`Chart element with ID ${chartId} not found.`);
      return;
    }

    const captureTarget = contentSelector
      ? (chartElement.querySelector(contentSelector) as HTMLElement | null)
      : chartElement;

    if (!captureTarget) {
      console.error(`Capture target for chart ${chartId} not found using selector "${contentSelector}".`);
      return;
    }

    const originalOverflow = captureTarget.style.overflow;
    captureTarget.style.overflow = 'hidden';

    try {
      const canvas = await html2canvas(captureTarget, {
        scale: 2, // Increase scale for better resolution
        useCORS: true, // Important if your charts load external resources (e.g., fonts, images)
        logging: true,
        backgroundColor: '#ffffff',
      });

      captureTarget.style.overflow = originalOverflow; // Restore original overflow

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'legal');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginX = 14;
      const marginTop = 14;
      const marginBottom = 14;
      const usableWidth = pageWidth - marginX * 2;

      const headerContainer = document.createElement('div');
      headerContainer.style.width = `${canvas.width}px`;
      headerContainer.style.display = 'flex';
      headerContainer.style.alignItems = 'center';
      headerContainer.style.justifyContent = 'space-between';
      headerContainer.style.padding = '28px 40px';
      headerContainer.style.background = '#ffffff';
      headerContainer.style.position = 'absolute';
      headerContainer.style.left = '-99999px';

      const leftLogo = document.createElement('img');
      leftLogo.src = '/images/bulan-logo.png';
      leftLogo.alt = 'Bulan Logo';
      leftLogo.style.height = '250px';

      const rightLogo = document.createElement('img');
      rightLogo.src = '/images/logo.png';
      rightLogo.alt = 'MDRRMO Logo';
      rightLogo.style.height = '250px';

      const headerText = document.createElement('div');
      headerText.style.textAlign = 'center';
      headerText.style.flex = '1';
      headerText.style.fontFamily = 'Helvetica, Arial, sans-serif';
      headerText.innerHTML = `
        <div style="font-size:30px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#1f2933;">Republic of the Philippines</div>
        <div style="font-size:39px; font-weight:800; margin-top:10px; text-transform:uppercase; color:#1f2933;">Local Government Unit of Bulan Sorsogon</div>
        <div style="font-size:43px; font-weight:900; margin-top:12px; text-transform:uppercase; color:#ff6b00;">Municipal Disaster Risk Reduction and Management Office</div>
        <div style="font-size:30px; font-weight:600; margin-top:14px; color:#1f2933;">${chartTitle}</div>
      `;

      headerContainer.appendChild(leftLogo);
      headerContainer.appendChild(headerText);
      headerContainer.appendChild(rightLogo);

      document.body.appendChild(headerContainer);
      const headerCanvas = await html2canvas(headerContainer, { scale: 2, backgroundColor: '#ffffff' });
      document.body.removeChild(headerContainer);
      const headerImgData = headerCanvas.toDataURL('image/png');
      const headerHeightMm = (headerCanvas.height * usableWidth) / headerCanvas.width;

      const baseImgWidth = usableWidth;
      const baseImgHeight = (canvas.height * baseImgWidth) / canvas.width;
      const availableHeight = pageHeight - marginTop - headerHeightMm - marginBottom - 4;
      const scaleFactor = Math.min(1, availableHeight / baseImgHeight);
      const imgWidth = baseImgWidth * scaleFactor;
      const imgHeight = baseImgHeight * scaleFactor;
      const contentTop = marginTop + headerHeightMm + 4;
      const contentLeft = marginX + (usableWidth - imgWidth) / 2;
      const effectiveAvailableHeight = pageHeight - contentTop - marginBottom;
      let remainingHeight = Math.max(0, imgHeight - effectiveAvailableHeight);

      pdf.addImage(headerImgData, 'PNG', marginX, marginTop, usableWidth, headerHeightMm);
      pdf.addImage(imgData, 'PNG', contentLeft, contentTop, imgWidth, imgHeight);

      while (remainingHeight > 0) {
        pdf.addPage();
        pdf.addImage(headerImgData, 'PNG', marginX, marginTop, usableWidth, headerHeightMm);
        const offset = imgHeight - remainingHeight;
        pdf.addImage(imgData, 'PNG', contentLeft, contentTop - offset, imgWidth, imgHeight);
        remainingHeight -= effectiveAvailableHeight;
      }

      addSummaryTablesToPdf(pdf, summaryTables, chartTitle);

      pdf.save(`${chartTitle.replace(/\s/g, '_').toLowerCase()}_chart.pdf`);

    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      captureTarget.style.overflow = originalOverflow; // Ensure overflow is restored even on error
    }
  };
  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex justify-start mb-4">
        <Button
          variant="outline"
          className="bg-gray-200 hover:bg-gray-300 text-gray-800"
          asChild
        >
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Link>
        </Button>
      </div>

      {/* Pie Chart: Incidents per Barangay */}
      <Card id="barangay-incident-chart" className="shadow-lg col-span-full">
        <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold">Incidents by Barangay</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-700"
            onClick={() => handleDownloadPdf('barangay-incident-chart', 'Barangay Incidents', barangayIncidentSummary)}
          >
            <Download className="h-4 w-4 mr-2" /> PDF
          </Button>
        </CardHeader>
        <CardContent className="p-6 bg-white rounded-b-lg">
          <div className="flex flex-col gap-4 mb-6">
            <Select value={pieChartPeriod} onValueChange={setPieChartPeriod}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Day</SelectItem>
                <SelectItem value="weekly">Range</SelectItem>
                <SelectItem value="monthly">Month</SelectItem>
                <SelectItem value="yearly">Year</SelectItem>
              </SelectContent>
            </Select>

            {pieChartPeriod === 'daily' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !pieChartDate && "text-muted-foreground"
                    )}
                  >
                    <span> {/* Added span to wrap children */}
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {pieChartDate ? format(pieChartDate, "PPP") : <span>Select Day</span>}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={pieChartDate}
                    onSelect={setPieChartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}

            {pieChartPeriod === 'weekly' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !pieStartDateRange && "text-muted-foreground"
                      )}
                    >
                      <span> {/* Added span to wrap children */}
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {pieStartDateRange ? format(pieStartDateRange, "PPP") : <span>Start Date</span>}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={pieStartDateRange}
                      onSelect={setPieStartDateRange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !pieEndDateRange && "text-muted-foreground"
                      )}
                    >
                      <span> {/* Added span to wrap children */}
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {pieEndDateRange ? format(pieEndDateRange, "PPP") : <span>End Date</span>}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={pieEndDateRange}
                      onSelect={setPieEndDateRange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {(pieChartPeriod === 'monthly' || pieChartPeriod === 'yearly') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pieChartPeriod === 'monthly' && (
                  <Select value={pieChartMonth} onValueChange={setPieChartMonth}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map(month => (
                        <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={pieChartYear} onValueChange={setPieChartYear}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                type="time"
                value={pieStartTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPieStartTime(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              />
              <Input
                type="time"
                value={pieEndTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPieEndTime(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              />
            </div>
          </div>
          <div data-chart-canvas className="w-full">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ paddingLeft: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-500 h-[350px] flex items-center justify-center">
                No incident data for the selected filters.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bar Chart: Incident Types (Monthly/Yearly) */}
      <Card id="incident-type-chart" className="shadow-lg col-span-full">
        <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold">Incident Types by Period</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-700"
            onClick={() => handleDownloadPdf('incident-type-chart', 'Incident Types', incidentTypeSummary)}
          >
            <Download className="h-4 w-4 mr-2" /> PDF
          </Button>
        </CardHeader>
        <CardContent className="p-6 bg-white rounded-b-lg">
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <Select value={barIncidentPeriod} onValueChange={setBarIncidentPeriod}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Month</SelectItem>
                <SelectItem value="yearly">Year</SelectItem>
              </SelectContent>
            </Select>
            {barIncidentPeriod === 'monthly' && (
              <Select value={barIncidentMonth} onValueChange={setBarIncidentMonth}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={barIncidentYear} onValueChange={setBarIncidentYear}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div data-chart-canvas className="w-full">
            {incidentTypeBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={460}>
                <BarChart
                  data={incidentTypeBarData}
                  margin={{ top: 36, right: 24, left: 24, bottom: 40 }}
                  barCategoryGap="6%"
                  barGap={0}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" />
                  {barIncidentPeriod === 'yearly' ? (
                    <XAxis dataKey="month" tickMargin={12} />
                  ) : (
                    <XAxis dataKey="day" tickMargin={12} />
                  )}
                  <YAxis allowDecimals={false} tickMargin={10} />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(30,64,175,0.08)' }} />
                  <Legend wrapperStyle={{ paddingTop: 18 }} iconType="circle" />
                  {incidentTypes.map((type, index) => (
                    <Bar
                      key={type.id}
                      dataKey={type.name}
                      fill={getIncidentTypeColor(type.name, index)}
                      name={type.name}
                      stroke="#1f2933"
                      strokeWidth={1}
                      fillOpacity={0.97}
                      radius={[12, 12, 0, 0]}
                      isAnimationActive={false}
                      maxBarSize={200}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-500 h-[350px] flex items-center justify-center">
                No incident type data for the selected period.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bar Chart: All Reports, Active, Resolved (Daily/Weekly/Monthly/Yearly) */}
      <Card id="report-status-chart" className="shadow-lg col-span-full">
        <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold">Emergency Report Status Overview</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-gray-700"
            onClick={() => handleDownloadPdf('report-status-chart', 'Report Status Overview', reportStatusSummary)}
          >
            <Download className="h-4 w-4 mr-2" /> PDF
          </Button>
        </CardHeader>
        <CardContent className="p-6 bg-white rounded-b-lg">
          <div className="flex flex-col gap-4 mb-6">
            <Select value={barStatusPeriod} onValueChange={setBarStatusPeriod}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a period" />
              </SelectTrigger>
              <SelectContent> 
                <SelectItem value="daily">Day</SelectItem>
                <SelectItem value="weekly">Range</SelectItem>
                <SelectItem value="monthly">Month</SelectItem>
                <SelectItem value="yearly">Year</SelectItem>
              </SelectContent>
            </Select>

            {barStatusPeriod === 'daily' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !barStatusDate && "text-muted-foreground"
                    )}
                  >
                    <span> 
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {barStatusDate ? format(barStatusDate, "PPP") : <span>Select Day</span>}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={barStatusDate}
                    onSelect={setBarStatusDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}

            {barStatusPeriod === 'weekly' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !barStatusStartDateRange && "text-muted-foreground"
                      )}
                    >
                      <span> 
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {barStatusStartDateRange ? format(barStatusStartDateRange, "PPP") : <span>Start Date</span>}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={barStatusStartDateRange}
                      onSelect={setBarStatusStartDateRange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !barStatusEndDateRange && "text-muted-foreground"
                      )}
                    >
                      <span> {/* Added span to wrap children */}
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {barStatusEndDateRange ? format(barStatusEndDateRange, "PPP") : <span>End Date</span>}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={barStatusEndDateRange}
                      onSelect={setBarStatusEndDateRange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {(barStatusPeriod === 'monthly' || barStatusPeriod === 'yearly') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {barStatusPeriod === 'monthly' && (
                  <Select value={barStatusMonth} onValueChange={setBarStatusMonth}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map(month => (
                        <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={barStatusYear} onValueChange={setBarStatusYear}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div data-chart-canvas className="w-full">
            {reportStatusBarData.length > 0 && reportStatusBarData.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={reportStatusBarData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Legend />
                  <Bar dataKey="count">
                    {reportStatusBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-500 h-[300px] flex items-center justify-center">
                No emergency report data for the selected period.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}