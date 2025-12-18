"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Search, ChevronLeft, ChevronRight } from "lucide-react" // Added Chevron icons
import Link from "next/link";
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { getPriorityDetails, PRIORITY_ORDER } from "@/lib/priority"

// Define InternalReport interface (must match your database schema)
interface InternalReportRow {
  id: number;
  original_report_id: string | null;
  incident_type_id: number;
  incident_date: string; // TIMESTAMPTZ
  time_responded: string | null; // TIMESTAMPTZ
  barangay_id: number;
  er_team_id: number;
  persons_involved: number | null;
  number_of_responders: number | null;
  prepared_by: string;
  created_at: string; // TIMESTAMPTZ
  patients: ReportPatientStatus[];
}

interface ReportPatientStatus {
  id: string
  patient_name: string | null
  current_status: string | null
  receiving_hospital_id: string | null
  receiving_hospital_name: string | null
}

// Define BaseEntry for reference tables (Barangays, Incident Types, ER Teams)
interface BaseEntry {
  id: number;
  name: string;
}

interface ReportHistoryTableProps {
  internalReports: InternalReportRow[];
  barangays: BaseEntry[];
  incidentTypes: BaseEntry[];
  erTeams: BaseEntry[];
  hospitalNameLookup: Record<string, string>;
  // Props for Search and Filters
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedIncidentType: number | 'all';
  setSelectedIncidentType: (id: number | 'all') => void;
  selectedBarangay: number | 'all';
  setSelectedBarangay: (id: number | 'all') => void;
  selectedErTeam: number | 'all';
  setSelectedErTeam: (id: number | 'all') => void;
  // --- New Props for Pagination ---
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  totalReports: number;
}

export function ReportHistoryTable({ 
  internalReports, 
  barangays, 
  incidentTypes, 
  erTeams,
  hospitalNameLookup,
  searchTerm,
  setSearchTerm,
  selectedIncidentType,
  setSelectedIncidentType,
  selectedBarangay,
  setSelectedBarangay,
  selectedErTeam,
  setSelectedErTeam,
  // --- Pagination Props ---
  currentPage,
  setCurrentPage,
  totalPages,
  totalReports,
}: ReportHistoryTableProps) {

  const router = useRouter()

  const normalizeId = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return null
    return String(value)
  }

  const getBarangayName = (id: number | string) => {
    const normalized = normalizeId(id)
    if (normalized === null) return 'N/A'
    return barangays.find((b) => normalizeId(b.id) === normalized)?.name || 'N/A'
  }

  const getIncidentTypeName = (id: number | string) => {
    const normalized = normalizeId(id)
    if (normalized === null) return 'N/A'
    return incidentTypes.find((it) => normalizeId(it.id) === normalized)?.name || 'N/A'
  }

  const getErTeamName = (id: number | string) => {
    const normalized = normalizeId(id)
    if (normalized === null) return 'N/A'
    return erTeams.find((et) => normalizeId(et.id) === normalized)?.name || 'N/A'
  }

  const getHospitalName = (id: string | null | undefined, fallbackName: string | null | undefined) => {
    if (fallbackName) return fallbackName
    const normalized = id ? String(id) : null
    if (!normalized) return null
    return hospitalNameLookup[normalized] ?? null
  }

  // Handlers for pagination buttons
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [exportIncidentType, setExportIncidentType] = React.useState<number | 'all'>('all');
  const [exportBarangay, setExportBarangay] = React.useState<number | 'all'>('all');
  const [exportErTeam, setExportErTeam] = React.useState<number | 'all'>('all');
  const [exportSearch, setExportSearch] = React.useState('');
  const [dateFilterType, setDateFilterType] = React.useState<'all' | 'day' | 'month' | 'year' | 'range'>('all');
  const [dateDay, setDateDay] = React.useState('');
  const [dateMonth, setDateMonth] = React.useState('');
  const [dateYear, setDateYear] = React.useState(String(new Date().getFullYear()));
  const [dateRangeStart, setDateRangeStart] = React.useState('');
  const [dateRangeEnd, setDateRangeEnd] = React.useState('');
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (exportDialogOpen) {
      setExportIncidentType(selectedIncidentType);
      setExportBarangay(selectedBarangay);
      setExportErTeam(selectedErTeam);
      setExportSearch(searchTerm);
      setDateFilterType('all');
      setDateDay('');
      setDateMonth('');
      setDateYear(String(new Date().getFullYear()));
      setDateRangeStart('');
      setDateRangeEnd('');
      setExportError(null);
    }
  }, [exportDialogOpen, selectedIncidentType, selectedBarangay, selectedErTeam, searchTerm]);

  const computeDateRange = () => {
    if (dateFilterType === 'all') {
      return { dateFrom: null, dateTo: null };
    }
    if (dateFilterType === 'day') {
      if (!dateDay) {
        setExportError('Please select a day.');
        return null;
      }
      const start = new Date(`${dateDay}T00:00:00`);
      const end = new Date(`${dateDay}T23:59:59.999`);
      return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
    }
    if (dateFilterType === 'month') {
      if (!dateMonth) {
        setExportError('Please select a month.');
        return null;
      }
      const start = new Date(`${dateMonth}-01T00:00:00`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setMilliseconds(end.getMilliseconds() - 1);
      return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
    }
    if (dateFilterType === 'year') {
      const yearNum = Number(dateYear);
      if (!dateYear || Number.isNaN(yearNum)) {
        setExportError('Please enter a valid year.');
        return null;
      }
      const start = new Date(yearNum, 0, 1, 0, 0, 0);
      const end = new Date(yearNum + 1, 0, 1, 0, 0, 0);
      end.setMilliseconds(end.getMilliseconds() - 1);
      return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
    }
    if (dateFilterType === 'range') {
      if (!dateRangeStart || !dateRangeEnd) {
        setExportError('Please choose both start and end dates.');
        return null;
      }
      const start = new Date(`${dateRangeStart}T00:00:00`);
      const end = new Date(`${dateRangeEnd}T23:59:59.999`);
      if (end < start) {
        setExportError('End date must be after start date.');
        return null;
      }
      return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
    }
    return { dateFrom: null, dateTo: null };
  };

  const handleExport = async () => {
    setExportError(null);
    const range = computeDateRange();
    if (range === null) return;
    try {
      setIsExporting(true);
      const payload = {
        incidentTypeId: exportIncidentType === 'all' ? null : exportIncidentType,
        barangayId: exportBarangay === 'all' ? null : exportBarangay,
        erTeamId: exportErTeam === 'all' ? null : exportErTeam,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        searchTerm: exportSearch.trim() ? exportSearch.trim() : null,
      };
      const response = await fetch('/api/internal-reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error('Request failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `internal-reports-${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setExportDialogOpen(false);
    } catch (err) {
      console.error('Failed to export internal reports CSV:', err);
      setExportError('Failed to generate CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Back Button for Admin Dashboard */}
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

    <Card className="shadow-lg h-full rounded-lg">
      <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-2xl font-bold">History of Admin Reports</CardTitle>
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" className="bg-white text-orange-600 hover:bg-orange-50">
              Download CSV
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Download reports as CSV</DialogTitle>
              <DialogDescription>
                Choose the filters to apply before generating the CSV export.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Barangay</p>
                <Select value={String(exportBarangay)} onValueChange={(value) => setExportBarangay(value === 'all' ? 'all' : Number(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Barangays" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="all">All Barangays</SelectItem>
                    {barangays.map((barangay) => (
                      <SelectItem key={barangay.id} value={String(barangay.id)}>
                        {barangay.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Incident Type</p>
                <Select value={String(exportIncidentType)} onValueChange={(value) => setExportIncidentType(value === 'all' ? 'all' : Number(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Incident Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Incident Types</SelectItem>
                    {incidentTypes.map((type) => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">ER Team</p>
                <Select value={String(exportErTeam)} onValueChange={(value) => setExportErTeam(value === 'all' ? 'all' : Number(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All ER Teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ER Teams</SelectItem>
                    {erTeams.map((team) => (
                      <SelectItem key={team.id} value={String(team.id)}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">Date filter</p>
                <Select value={dateFilterType} onValueChange={(value: typeof dateFilterType) => setDateFilterType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All dates</SelectItem>
                    <SelectItem value="day">Specific day</SelectItem>
                    <SelectItem value="month">Specific month</SelectItem>
                    <SelectItem value="year">Specific year</SelectItem>
                    <SelectItem value="range">Custom range</SelectItem>
                  </SelectContent>
                </Select>
                {dateFilterType === 'day' && (
                  <Input type="date" value={dateDay} onChange={(e) => setDateDay(e.target.value)} />
                )}
                {dateFilterType === 'month' && (
                  <Input type="month" value={dateMonth} onChange={(e) => setDateMonth(e.target.value)} />
                )}
                {dateFilterType === 'year' && (
                  <Input type="number" value={dateYear} onChange={(e) => setDateYear(e.target.value)} min="1900" max="2100" />
                )}
                {dateFilterType === 'range' && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input type="date" value={dateRangeStart} onChange={(e) => setDateRangeStart(e.target.value)} placeholder="Start date" />
                    <Input type="date" value={dateRangeEnd} onChange={(e) => setDateRangeEnd(e.target.value)} placeholder="End date" />
                  </div>
                )}
              </div>
              {exportError && <p className="text-sm text-red-600">{exportError}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExportDialogOpen(false)} disabled={isExporting}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? 'Generating...' : 'Download CSV'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent className="p-6 bg-white rounded-b-lg">
        {/* --- Search and Filters Section --- */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
          {/* Search Input */}
          <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by ID, Prepared By, or Keyword..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border rounded-lg w-full"
              />
          </div>

          {/* Incident Type Filter */}
          <Select 
            value={String(selectedIncidentType)} 
            onValueChange={(value) => setSelectedIncidentType(value === 'all' ? 'all' : Number(value))}
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by Incident Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Incident Types</SelectItem>
              {incidentTypes.map((type) => (
                <SelectItem key={type.id} value={String(type.id)}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Barangay Filter */}
          <Select 
            value={String(selectedBarangay)} 
            onValueChange={(value) => setSelectedBarangay(value === 'all' ? 'all' : Number(value))}
          >
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="Filter by Barangay" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">All Barangays</SelectItem>
              {barangays.map((barangay) => (
                <SelectItem key={barangay.id} value={String(barangay.id)}>
                  {barangay.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ER Team Filter */}
          <Select 
            value={String(selectedErTeam)} 
            onValueChange={(value) => setSelectedErTeam(value === 'all' ? 'all' : Number(value))}
          >
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="Filter by ER Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ER Teams</SelectItem>
              {erTeams.map((team) => (
                <SelectItem key={team.id} value={String(team.id)}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* ----------------------------------- */}

        <div className="overflow-x-auto">
          {internalReports.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100">
                  <TableHead className="w-[100px] font-semibold text-gray-700">Report ID</TableHead>
                  <TableHead className="font-semibold text-gray-700">Original Incident ID</TableHead>
                  <TableHead className="font-semibold text-gray-700">Incident Type</TableHead>
                  <TableHead className="font-semibold text-gray-700">Incident Date & Time</TableHead>
                  <TableHead className="font-semibold text-gray-700">Barangay</TableHead>
                  <TableHead className="font-semibold text-gray-700">ER Team</TableHead>
                  <TableHead className="font-semibold text-gray-700">Prepared By</TableHead>
                  <TableHead className="font-semibold text-gray-700">Created At</TableHead>
                  <TableHead className="font-semibold text-gray-700">Hospitals Patient Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {internalReports.map((report) => (
                  <TableRow
                    key={report.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/admin/report-history/${report.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        router.push(`/admin/report-history/${report.id}`)
                      }
                    }}
                  >
                    <TableCell className="font-medium text-gray-800">{report.id}</TableCell>
                    <TableCell className="text-gray-700">{report.original_report_id ? report.original_report_id.substring(0, 8) + '...' : 'N/A'}</TableCell>
                    <TableCell className="text-gray-700">{getIncidentTypeName(report.incident_type_id)}</TableCell>
                    <TableCell className="text-gray-700">{format(new Date(report.incident_date), 'PPP HH:mm')}</TableCell>
                    <TableCell className="text-gray-700">{getBarangayName(report.barangay_id)}</TableCell>
                    <TableCell className="text-gray-700">{getErTeamName(report.er_team_id)}</TableCell>
                    <TableCell className="text-gray-700">{report.prepared_by}</TableCell>
                    <TableCell className="text-gray-700">{format(new Date(report.created_at), 'PPP HH:mm')}</TableCell>
                    <TableCell className="text-gray-700">
                      {report.patients && report.patients.length > 0 ? (
                        <div className="space-y-1">
                          {report.patients.slice(0, 2).map((patient) => (
                            <div key={patient.id} className="flex items-center justify-between gap-4 rounded-md bg-gray-50 px-3 py-2 text-xs">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-gray-800">{patient.patient_name || "Unnamed patient"}</p>
                                <p className="truncate text-[11px] text-gray-500">
                                  {(() => {
                                    const resolved = getHospitalName(patient.receiving_hospital_id, patient.receiving_hospital_name)
                                    if (resolved) return resolved
                                    if (patient.receiving_hospital_id) return patient.receiving_hospital_id
                                    return "No hospital assigned"
                                  })()}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-orange-700">
                                {patient.current_status ? patient.current_status.replace(/_/g, " ") : "pending"}
                              </span>
                            </div>
                          ))}
                          {report.patients.length > 2 ? (
                            <p className="text-[11px] font-medium text-gray-500">+{report.patients.length - 2} more patients…</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No patients recorded</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-gray-500">No admin reports found matching the current filters.</div>
          )}
        </div>
        
        {/* --- Pagination Controls --- */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages} ({totalReports} reports total)
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className="p-2 h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="p-2 h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {/* ----------------------------- */}

      </CardContent>
    </Card>
    </div>
  )
}