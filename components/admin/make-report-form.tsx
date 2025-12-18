"use client"

import * as React from "react"
import { useTransition } from "react"
import { differenceInYears, format, isValid, parseISO } from "date-fns"
import tinycolor from "tinycolor2"
import { CirclePlus, CircleX, Copy, MinusCircle, Plus, XCircle, Info } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PRIORITY_COLORS, PRIORITY_LABELS, getPriorityDetails } from "@/lib/priority"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

type ErTeamInjuryPayload = {
  front?: Record<string, string[] | null | undefined> | null
  back?: Record<string, string[] | null | undefined> | null
} | null

export interface AdminErTeamReportDetails {
  id: string
  status: string
  patient_payload?: ErTeamPatientPayload[] | null // Now an array of patients
  incident_payload?: Record<string, unknown> | null
  injury_payload?: ErTeamInjuryPayload
  notes?: string | null
}

export interface AdminReport {
  id: string
  created_at: string
  location_address: string | null
  latitude?: number | null
  longitude?: number | null
  firstName: string | null
  middleName?: string | null
  lastName: string | null
  mobileNumber: string | null
  emergency_type?: string | null
  emergency_details?: string | null
  er_team_id?: string | number | null
  casualties?: number | null
  responded_at?: string | null
  resolved_at?: string | null
  er_team_report?: AdminErTeamReportDetails | null
}

interface Barangay {
  id: number
  name: string
}

interface ERTeam {
  id: number
  name: string
}

interface IncidentType {
  id: number
  name: string
}

interface Hospital {
  id: string
  name: string
}

interface MakeReportFormProps {
  selectedReport: AdminReport | null
  erTeams: ERTeam[]
  barangays: Barangay[]
  incidentTypes: IncidentType[]
  hospitals: Hospital[]
  onReportSubmitted: () => void
}

const INCIDENT_TYPE_ALIASES: Record<string, string> = {
  "vehicular accident": "vehicular/pedestrian road crash incident",
  "vehicular": "vehicular/pedestrian road crash incident",
  "vehicular accident incident": "vehicular/pedestrian road crash incident",
  "vehicular incident": "vehicular/pedestrian road crash incident",
  "vehicular/pedestrian roadcrash incident": "vehicular/pedestrian road crash incident",
  "vehicular/pedestrian road crash": "vehicular/pedestrian road crash incident",
  "vehicular/pedestrian road crash incident": "vehicular/pedestrian road crash incident",
  "road crash": "vehicular/pedestrian road crash incident",
  "road crash incident": "vehicular/pedestrian road crash incident",
  "road accident": "vehicular/pedestrian road crash incident",
  "road incident": "vehicular/pedestrian road crash incident",
  "traffic accident": "vehicular/pedestrian road crash incident",
  "traffic incident": "vehicular/pedestrian road crash incident",
  "vehicular/pedestrian accident": "vehicular/pedestrian road crash incident",
  "vehicular/pedestrian accident incident": "vehicular/pedestrian road crash incident",
  "others": "others",
  "other": "others",
  "medical": "medical emergency",
  "medical emergency": "medical emergency",
  "fire": "fire incident",
  "fire incident": "fire incident",
}

const normalize = (value: string) => value.trim().toLowerCase()

export const FRONT_BODY_REGION_IDS = [
  "front_x3D__x22_right-thigh_x22_",
  "front_x3D__x22_left-thigh_x22_",
  "stomach",
  "front_x3D__x22_right-foot",
  "front_x3D__x22_left-foot_x22_",
  "front_x3D__x22_right-chest_x22_",
  "front_x3D__x22_left-chest_x22_",
  "front_x3D__x22_face_x22_",
  "front_x3D__x22_right-forearm_x22_",
  "front_x3D__x22_left_x5F_forearm_x22_",
  "front_x3D__x22_right-ribs_x22_",
  "front_x3D__x22_left_x5F_ribs_x22_",
  "front_x3D__x22_belly_x22_",
  "front_x3D__x22_left_x5F_arm_x22_",
  "front_x3D__x22_right-arm_x22_",
  "front_x3D__x22_neck_x22_",
  "front_x3D__x22_right-shoulder_x22_",
  "front_x3D__x22_left-shoulder_x22_",
  "front_x3D__x22_right-knee_x22_",
  "front_x3D__x22_left-knee_x22_",
  "front_x3D__x22_upper-head_x22_",
  "front_x3D__x22_right-hand_x22_",
  "front_x3D__x22_left-hand_x22_",
  "front_x3D__x22_right-neck_x22_",
  "front_x3D__x22_left_x5F_neck_x22_",
  "front_x3D__x22_right-finger_x22_",
  "front_x3D__x22_left-finger_x22_",
  "front-_x22_right-ankle_x22_",
  "front_x3D__x22_left-ankle_x22_",
  "front_x3D__x22_right-wrist_x22_",
  "front_x3D__x22_left-wrist_x22_",
  "front_x3D__x22_right-eyes_x22_",
  "front_x3D__x22_left-eye_x22_",
  "front_x3D__x22_mouth_x22_",
  "front_x3D__x22_chin_x22_",
  "front_x3D__x22_nose_x22_",
] as const

export const BACK_BODY_REGION_IDS = [
  "back_x3D__x22_right-hand_x22_",
  "back_x3D__x22_right-thigh_x22_",
  "back_x3D__x22_left-thigh_x22_",
  "back_x3D__x22_left-ribs_x22_",
  "back_x3D__x22_right-ribs_x22_",
  "back_x3D__x22_head_x22_",
  "back_x3D__x22_lower-back_x22_",
  "back_x3D__x22_left-buttocks_x22_",
  "back_x3D__x22_right-buttocks_x22_",
  "back_x3D__x22_left-foot_x22_",
  "back_x3D__x22_right-foot_x22_",
  "back_x3D__x22_left-forearm_x22_",
  "back_x3D__x22_right-forearm_x22_",
  "back_x3D__x22_mid-back_x22_",
  "back_x3D__x22_right-calf_x22_",
  "back_x3D__x22_left-calf_x22_",
  "back_x22_right-upper-arm_x22_",
  "back_x3D__x22_left-upper-arm_x22_",
  "back_x3D__x22_upper-back_x22_",
  "back_x3D__x22_left-shoulder_x22_",
  "back_x3D__x22_right-shoulder_x22_",
  "back_x22_right-knee_x22_",
  "back_x3D__x22_left-knee_x22_",
  "back_x3D__x22_neck_x22_",
  "back_x3D__x22_left-hand_x22_",
  "back_x3D__x22_right-finger_x22_",
  "back_x3D__x22_left-finger_x22_",
  "back_x3D__x22_left-ears_x22_",
  "back_x3D__x22_right-ears_x22_",
  "back-_x22_right-ankle_x22_",
  "back_x3D__x22_left-ankle_x22_",
  "back_x3D__x22_left-elbow_x22_",
  "back_x3D__x22_right-elbow_x22_",
] as const

export const FRONT_SVG_PATH = "/body_part_front-01.svg"
export const BACK_SVG_PATH = "/body_part_back-01.svg"

const STEP1_REQUIRED_FIELDS = [
  "incidentDate",
  "incidentTime",
  "incidentTypeId",
  "barangayId",
  "erTeamId",
  "preparedBy",
] as const

const PATIENT_REQUIRED_FIELDS = [
  "patientName",
  "patientNumber",
  "patientBirthday",
  "patientAge",
  "patientAddress",
  "patientSex",
  "evacPriority",
  "typeOfEmergencySelections",
  "incidentLocation",
  "moiPoiToi",
  "noi",
  "signsSymptoms",
  "gcsEye",
  "gcsVerbal",
  "gcsMotor",
  "locAvpu",
  "pulseRate",
  "bloodPressure",
  "bpm",
  "oxygenSaturation",
  "painScale",
  "temperature",
  "respiratoryRate",
  "bloodLossLevel",
  "turnoverInCharge",
  "receivingHospitalId",
  "receivingDate",
  "emtErtDate",
] as const

const REQUIRED_FIELD_LABEL = "Required to fill-up"

type Step1Field = typeof STEP1_REQUIRED_FIELDS[number]
type PatientFieldKey = typeof PATIENT_REQUIRED_FIELDS[number]

type PatientSex = "male" | "female" | ""

interface ErTeamPatientPayload {
  patientNumber?: string | null
  patientName?: string | null
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  suffix?: string | null
  patientBirthday?: string | null
  patientAge?: string | null
  patientSex?: PatientSex | null
  patientAddress?: string | null
  contactNumber?: string | null
  incidentLocation?: string | null
  receivingHospitalId?: string | null
  receivingDate?: string | null
  turnoverInCharge?: string | null
  emtErtDate?: string | null
  bloodLossLevel?: string | null
  estimatedBloodLoss?: string | null
  painScale?: string | null
  signsSymptoms?: string | null
  moiPoiToi?: string | null
  noi?: string | null
  airwaySelections?: string[] | null
  breathingSelections?: string[] | null
  circulationSelections?: string[] | null
  typeOfEmergencySelections?: string[] | null
  bloodPressure?: string | null
  pulseRate?: string | null
  respiratoryRate?: string | null
  temperature?: string | null
  oxygenSaturation?: string | null
  bpm?: string | null
  gcsEye?: string | null
  gcsVerbal?: string | null
  gcsMotor?: string | null
  gcsOther?: string | null
  locAvpu?: string | null
  evacPriority?: string | null
  bodyPartInjuries?: Record<string, string[]> | null
  injuryPayload?: ErTeamInjuryPayload
}

interface PatientFormState {
  id: string
  patientName: string
  firstName?: string
  middleName?: string
  lastName?: string
  suffix?: string
  patientNumber: string
  contactNumber: string
  patientBirthday: string
  patientAge: string
  patientAddress: string
  patientSex: PatientSex
  evacPriority: string
  typeOfEmergencySelections: string[]
  airwaySelections: string[]
  breathingSelections: string[]
  circulationSelections: string[]
  incidentLocation: string
  moiPoiToi: string
  noi: string
  signsSymptoms: string
  gcsEye: string
  gcsVerbal: string
  gcsMotor: string
  gcsOther: string
  locAvpu: string
  pulseRate: string
  bloodPressure: string
  bpm: string
  oxygenSaturation: string
  painScale: string
  temperature: string
  respiratoryRate: string
  bloodLossLevel: string
  estimatedBloodLoss: string
  turnoverInCharge: string
  receivingHospitalId?: string
  receivingDate: string
  emtErtDate: string
  bodyPartInjuries: Record<string, string[]>
}

const generatePatientId = () => {
  const globalCrypto = typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID()
  }
  return `patient-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`
}

const createEmptyPatient = (): PatientFormState => ({
  id: generatePatientId(),
  patientName: "",
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  patientNumber: "",
  contactNumber: "",
  patientBirthday: "",
  patientAge: "",
  patientAddress: "",
  patientSex: "",
  evacPriority: "",
  typeOfEmergencySelections: [],
  airwaySelections: [],
  breathingSelections: [],
  circulationSelections: [],
  incidentLocation: "",
  moiPoiToi: "",
  noi: "",
  signsSymptoms: "",
  gcsEye: "",
  gcsVerbal: "",
  gcsMotor: "",
  gcsOther: "",
  locAvpu: "",
  pulseRate: "",
  bloodPressure: "",
  bpm: "",
  oxygenSaturation: "",
  painScale: "",
  temperature: "",
  respiratoryRate: "",
  bloodLossLevel: "",
  estimatedBloodLoss: "",
  turnoverInCharge: "",
  receivingHospitalId: undefined,
  receivingDate: format(new Date(), "yyyy-MM-dd"), // Auto-fill current date
  emtErtDate: format(new Date(), "yyyy-MM-dd"), // Auto-fill current date
  bodyPartInjuries: {},
})

const cloneBodyInjuries = (source?: Record<string, string[]> | null): Record<string, string[]> => {
  if (!source) return {}
  return JSON.parse(JSON.stringify(source)) as Record<string, string[]>
}

const mergeInjuryPayload = (injuryPayload: ErTeamInjuryPayload): Record<string, string[]> => {
  if (!injuryPayload) return {}
  const result: Record<string, string[]> = {}
  const applySection = (section?: Record<string, string[] | null | undefined> | null) => {
    if (!section) return
    Object.entries(section).forEach(([regionId, codes]) => {
      if (!codes || !Array.isArray(codes)) return
      result[regionId] = codes.filter((code): code is string => typeof code === "string")
    })
  }
  applySection(injuryPayload.front)
  applySection(injuryPayload.back)
  return result
}

const normalizePayloadArray = (value: string[] | null | undefined): string[] => (Array.isArray(value) ? [...value] : [])

const createPatientFromErPayload = (payload: ErTeamPatientPayload, globalInjuryPayload?: ErTeamInjuryPayload): PatientFormState => {
  // Use the patient's own injury data if available, otherwise fall back to global injury data
  const patientInjuryData = payload.injuryPayload || globalInjuryPayload
  const bodyPartInjuries = patientInjuryData ? mergeInjuryPayload(patientInjuryData) : {}
  return {
    id: generatePatientId(),
    patientName: payload.patientName ?? "",
    firstName: payload.firstName ?? "",
    middleName: payload.middleName ?? "",
    lastName: payload.lastName ?? "",
    suffix: payload.suffix ?? "",
    patientNumber: payload.patientNumber ?? "",
    contactNumber: payload.contactNumber ?? payload.patientNumber ?? "",
    patientBirthday: payload.patientBirthday ?? "",
    patientAge: payload.patientAge ?? "",
    patientAddress: payload.patientAddress ?? "",
    patientSex: (payload.patientSex as PatientSex) ?? "",
    evacPriority: payload.evacPriority ?? "",
    typeOfEmergencySelections: normalizePayloadArray(payload.typeOfEmergencySelections),
    airwaySelections: normalizePayloadArray(payload.airwaySelections),
    breathingSelections: normalizePayloadArray(payload.breathingSelections),
    circulationSelections: normalizePayloadArray(payload.circulationSelections),
    incidentLocation: payload.incidentLocation ?? "",
    moiPoiToi: payload.moiPoiToi ?? "",
    noi: payload.noi ?? "",
    signsSymptoms: payload.signsSymptoms ?? "",
    gcsEye: payload.gcsEye ?? "",
    gcsVerbal: payload.gcsVerbal ?? "",
    gcsMotor: payload.gcsMotor ?? "",
    gcsOther: payload.gcsOther ?? "",
    locAvpu: payload.locAvpu ?? "",
    pulseRate: payload.pulseRate ?? "",
    bloodPressure: payload.bloodPressure ?? "",
    bpm: payload.bpm ?? "",
    oxygenSaturation: payload.oxygenSaturation ?? "",
    painScale: payload.painScale ?? "",
    temperature: payload.temperature ?? "",
    respiratoryRate: payload.respiratoryRate ?? "",
    bloodLossLevel: payload.bloodLossLevel ?? "",
    estimatedBloodLoss: payload.estimatedBloodLoss ?? "",
    turnoverInCharge: payload.turnoverInCharge ?? "",
    receivingHospitalId: payload.receivingHospitalId ?? undefined,
    receivingDate: payload.receivingDate ?? "",
    emtErtDate: payload.emtErtDate ?? "",
    bodyPartInjuries,
  }
}

const REGION_LABELS: Record<string, string> = {
  "front_x3D__x22_right-thigh_x22_": "Front Right Thigh",
  "front_x3D__x22_left-thigh_x22_": "Front Left Thigh",
  stomach: "Front Abdomen",
  "front_x3D__x22_right-foot": "Front Right Foot",
  "front_x3D__x22_left-foot_x22_": "Front Left Foot",
  "front_x3D__x22_right-chest_x22_": "Front Right Chest",
  "front_x3D__x22_left-chest_x22_": "Front Left Chest",
  "front_x3D__x22_face_x22_": "Face",
  "front_x3D__x22_right-forearm_x22_": "Front Right Forearm",
  "front_x3D__x22_left_x5F_forearm_x22_": "Front Left Forearm",
  "front_x3D__x22_right-ribs_x22_": "Front Right Ribs",
  "front_x3D__x22_left_x5F_ribs_x22_": "Front Left Ribs",
  "front_x3D__x22_belly_x22_": "Front Lower Abdomen",
  "front_x3D__x22_left_x5F_arm_x22_": "Front Left Upper Arm",
  "front_x3D__x22_right-arm_x22_": "Front Right Upper Arm",
  "front_x3D__x22_neck_x22_": "Front Neck",
  "front_x3D__x22_right-shoulder_x22_": "Front Right Shoulder",
  "front_x3D__x22_left-shoulder_x22_": "Front Left Shoulder",
  "front_x3D__x22_right-knee_x22_": "Front Right Knee",
  "front_x3D__x22_left-knee_x22_": "Front Left Knee",
  "front_x3D__x22_upper-head_x22_": "Top of Head (Front)",
  "front_x3D__x22_right-hand_x22_": "Front Right Hand",
  "front_x3D__x22_left-hand_x22_": "Front Left Hand",
  "front_x3D__x22_right-neck_x22_": "Front Right Neck",
  "front_x3D__x22_left_x5F_neck_x22_": "Front Left Neck",
  "front_x3D__x22_right-finger_x22_": "Front Right Fingers",
  "front_x3D__x22_left-finger_x22_": "Front Left Fingers",
  "front-_x22_right-ankle_x22_": "Front Right Ankle",
  "front_x3D__x22_left-ankle_x22_": "Front Left Ankle",
  "front_x3D__x22_right-wrist_x22_": "Front Right Wrist",
  "front_x3D__x22_left-wrist_x22_": "Front Left Wrist",
  "front_x3D__x22_right-eyes_x22_": "Right Eye",
  "front_x3D__x22_left-eye_x22_": "Left Eye",
  "front_x3D__x22_mouth_x22_": "Mouth",
  "front_x3D__x22_chin_x22_": "Chin",
  "front_x3D__x22_nose_x22_": "Nose",
  "back_x3D__x22_right-hand_x22_": "Back Right Hand",
  "back_x3D__x22_right-thigh_x22_": "Back Right Thigh",
  "back_x3D__x22_left-thigh_x22_": "Back Left Thigh",
  "back_x3D__x22_left-ribs_x22_": "Back Left Ribs",
  "back_x3D__x22_right-ribs_x22_": "Back Right Ribs",
  "back_x3D__x22_head_x22_": "Back Head",
  "back_x3D__x22_lower-back_x22_": "Lower Back",
  "back_x3D__x22_left-buttocks_x22_": "Left Buttock",
  "back_x3D__x22_right-buttocks_x22_": "Right Buttock",
  "back_x3D__x22_left-foot_x22_": "Back Left Foot",
  "back_x3D__x22_right-foot_x22_": "Back Right Foot",
  "back_x3D__x22_left-forearm_x22_": "Back Left Forearm",
  "back_x3D__x22_right-forearm_x22_": "Back Right Forearm",
  "back_x3D__x22_mid-back_x22_": "Mid Back",
  "back_x3D__x22_right-calf_x22_": "Back Right Calf",
  "back_x3D__x22_left-calf_x22_": "Back Left Calf",
  "back_x22_right-upper-arm_x22_": "Back Right Upper Arm",
  "back_x3D__x22_left-upper-arm_x22_": "Back Left Upper Arm",
  "back_x3D__x22_upper-back_x22_": "Upper Back",
  "back_x3D__x22_left-shoulder_x22_": "Back Left Shoulder",
  "back_x3D__x22_right-shoulder_x22_": "Back Right Shoulder",
  "back_x22_right-knee_x22_": "Back Right Knee",
  "back_x3D__x22_left-knee_x22_": "Back Left Knee",
  "back_x3D__x22_neck_x22_": "Back Neck",
  "back_x3D__x22_left-hand_x22_": "Back Left Hand",
  "back_x3D__x22_right-finger_x22_": "Back Right Fingers",
  "back_x3D__x22_left-finger_x22_": "Back Left Fingers",
  "back_x3D__x22_left-ears_x22_": "Left Ear (Back)",
  "back_x3D__x22_right-ears_x22_": "Right Ear (Back)",
  "back-_x22_right-ankle_x22_": "Back Right Ankle",
  "back_x3D__x22_left-ankle_x22_": "Back Left Ankle",
  "back_x3D__x22_left-elbow_x22_": "Back Left Elbow",
  "back_x3D__x22_right-elbow_x22_": "Back Right Elbow",
}

const REGION_DEFAULT_FILL = "#e2e8f0"
const REGION_SELECTED_FILL = "#2563eb"
const REGION_HOVER_FILL = "#bfdbfe"
const INJURY_TYPE_OPTIONS = [
  { code: "D", label: "Deformities", shortLabel: "Deformity" },
  { code: "C", label: "Contusions", shortLabel: "Contusion" },
  { code: "A", label: "Abrasions", shortLabel: "Abrasion" },
  { code: "P", label: "Penetrations", shortLabel: "Penetration" },
  { code: "B", label: "Burns", shortLabel: "Burn" },
  { code: "T", label: "Tenderness", shortLabel: "Tenderness" },
  { code: "L", label: "Lacerations", shortLabel: "Laceration" },
  { code: "S", label: "Swelling", shortLabel: "Swelling" },
] as const

const INJURY_TYPE_COLOR_MAP: Record<string, string> = {
  D: "#ef4444",
  C: "#f97316",
  A: "#facc15",
  P: "#8b5cf6",
  B: "#fb7185",
  T: "#22d3ee",
  L: "#10b981",
  S: "#6366f1",
}

const INJURY_LOOKUP = INJURY_TYPE_OPTIONS.reduce<Record<string, (typeof INJURY_TYPE_OPTIONS)[number]>>((acc, option) => {
  acc[option.code] = option
  acc[option.label.toLowerCase()] = option
  acc[option.shortLabel.toLowerCase()] = option
  return acc
}, {})

const escapeSelector = (value: string) => {
  if (typeof window !== "undefined" && window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value)
  }
  return value.replace(/([.#:[\],=])/g, "\\$1")
}

const svgContentCache = new Map<string, string>()

interface InteractiveBodyDiagramProps {
  view: "front" | "back"
  svgPath: string
  regionIds: readonly string[]
  selectedRegions: string[]
  regionColors: Record<string, string>
  onRegionSelect: (regionId: string) => void
}

function InteractiveBodyDiagram({ view, svgPath, regionIds, selectedRegions, regionColors, onRegionSelect }: InteractiveBodyDiagramProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [svgContent, setSvgContent] = React.useState<string>("")

  React.useEffect(() => {
    let isMounted = true
    const loadSvg = async () => {
      if (svgContentCache.has(svgPath)) {
        if (isMounted) setSvgContent(svgContentCache.get(svgPath) ?? "")
        return
      }
      try {
        const response = await fetch(svgPath)
        if (!response.ok) throw new Error(`Failed to load SVG: ${response.status}`)
        const text = await response.text()
        svgContentCache.set(svgPath, text)
        if (isMounted) setSvgContent(text)
      } catch (error) {
        console.error("Error loading SVG diagram:", error)
        if (isMounted) setSvgContent("<svg></svg>")
      }
    }
    void loadSvg()
    return () => {
      isMounted = false
    }
  }, [svgPath])

  React.useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = svgContent
  }, [svgContent])

  React.useEffect(() => {
    if (!containerRef.current) return
    const svgElement = containerRef.current.querySelector("svg")
    if (!svgElement) return

    svgElement.removeAttribute("width")
    svgElement.removeAttribute("height")
    svgElement.style.width = "100%"
    svgElement.style.height = "auto"
    svgElement.style.maxWidth = "320px"
    svgElement.style.display = "block"
    svgElement.style.margin = "0 auto"

    const selectedSet = new Set(selectedRegions)
    const cleanupFns: Array<() => void> = []

    regionIds.forEach((regionId) => {
      const selector = `#${escapeSelector(regionId)}`
      const regionElement = svgElement.querySelector<SVGGraphicsElement>(selector)
      if (!regionElement) return

      const applyStyles = (isHover = false) => {
        const selectedColor = regionColors[regionId]
        const isActive = selectedSet.has(regionId)
        const strokeColor = selectedColor
          ? tinycolor(selectedColor).darken(20).toHexString()
          : isActive
            ? REGION_SELECTED_FILL
            : "#1f2937"
        const fillColor = selectedColor
          ? selectedColor
          : isHover
            ? REGION_HOVER_FILL
            : isActive
              ? REGION_SELECTED_FILL
              : REGION_DEFAULT_FILL
        regionElement.style.cursor = "pointer"
        regionElement.style.transition = "fill 0.15s ease, stroke-width 0.15s ease"
        regionElement.style.stroke = strokeColor
        regionElement.style.strokeWidth = selectedColor || isActive ? "2" : "1.2"
        regionElement.style.fill = fillColor
        regionElement.style.opacity = selectedColor || isActive ? "0.95" : "1"
      }

      applyStyles()

      const handleMouseEnter = () => {
        if (!regionColors[regionId]) {
          applyStyles(true)
        }
      }

      const handleMouseLeave = () => {
        applyStyles()
      }

      const handleClick = () => {
        onRegionSelect(regionId)
      }

      regionElement.addEventListener("mouseenter", handleMouseEnter)
      regionElement.addEventListener("mouseleave", handleMouseLeave)
      regionElement.addEventListener("click", handleClick)

      cleanupFns.push(() => {
        regionElement.removeEventListener("mouseenter", handleMouseEnter)
        regionElement.removeEventListener("mouseleave", handleMouseLeave)
        regionElement.removeEventListener("click", handleClick)
      })
    })

    return () => {
      cleanupFns.forEach((fn) => fn())
    }
  }, [regionIds, selectedRegions, regionColors, onRegionSelect, svgContent])

  return (
    <div className="w-full">
      <div ref={containerRef} className="w-full" aria-label={`${view} body diagram`} />
      {!svgContent && (
        <div className="py-6 text-center text-sm text-gray-400">Loading diagram…</div>
      )}
    </div>
  )
}

const INJURY_TYPE_LOOKUP = INJURY_TYPE_OPTIONS.reduce<Record<string, { code: string; label: string; shortLabel: string }>>((acc, option) => {
  acc[option.code] = option
  return acc
}, {})

const formatInjuryList = (injuries: string[]) => {
  if (injuries.length === 0) return ""
  if (injuries.length === 1) return injuries[0]
  if (injuries.length === 2) return `${injuries[0]} and ${injuries[1]}`
  const allButLast = injuries.slice(0, -1).join(", ")
  return `${allButLast}, and ${injuries[injuries.length - 1]}`
}

const summarizeBodyPart = (part: string, injuries: string[]) => {
  const partLabel = REGION_LABELS[part] ?? part
  if (injuries.length === 0) return partLabel
  const labels = injuries.map((code) => INJURY_TYPE_LOOKUP[code]?.shortLabel ?? code)
  const summary = formatInjuryList(labels)
  return `${partLabel} (${summary})`
}

const parseDate = (value: string | undefined) => {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const formatDateValue = (value: string | undefined) => {
  const date = parseDate(value)
  return date ? format(date, "PPP") : ""
}

interface DatePickerFieldProps {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  allowClear?: boolean
  error?: boolean
  fromYear?: number
  toYear?: number
}

const DatePickerField: React.FC<DatePickerFieldProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = "Select date",
  disabled,
  required,
  allowClear = false,
  error = false,
  fromYear,
  toYear,
}) => {
  const [open, setOpen] = React.useState(false)
  const selectedDate = parseDate(value)

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange("")
      return
    }
    const iso = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().split("T")[0]
    onChange(iso)
    setOpen(false)
  }

  return (
    <div className="space-y-1">
      <Label
        htmlFor={id}
        className={cn(
          "block text-sm font-medium",
          error ? "text-red-600" : "text-gray-700",
        )}
      >
        {label} {required ? <span className="text-red-500">*</span> : null}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground",
              error && "border-red-500 text-red-600 focus-visible:ring-red-500",
            )}
            disabled={disabled}
            aria-invalid={error}
          >
            <div className="flex flex-1 items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span className="truncate">
                  {selectedDate ? formatDateValue(value) : placeholder}
                </span>
              </div>
              {allowClear && value && (
                <span
                  role="button"
                  tabIndex={0}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
                  onClick={(event) => {
                    event.stopPropagation()
                    onChange("")
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      event.stopPropagation()
                      onChange("")
                    }
                  }}
                >
                  <XCircle className="h-4 w-4" />
                </span>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--trigger-width)]" align="start" data-trigger-width>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            initialFocus
            captionLayout="dropdown"
            fromYear={fromYear}
            toYear={toYear}
            className="w-full"
            classNames={{
              dropdowns: "flex w-full gap-2",
              dropdown_month: "flex-1",
              dropdown_year: "flex-1",
            }}
          />
          {allowClear && (
            <div className="flex justify-end border-t border-gray-100 bg-gray-50 p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange("")
                  setOpen(false)
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {error ? (
        <p className="text-xs font-semibold text-red-500">{REQUIRED_FIELD_LABEL}</p>
      ) : null}
    </div>
  )
}

const CalendarDays = CirclePlus // placeholder icon import replacement

interface PatientHeaderProps {
  patient: PatientFormState
  index: number
  isActive: boolean
  onActivate: () => void
  onRemove: () => void
  onDuplicate: () => void
  canRemove: boolean
}

const PatientHeader = ({ patient, index, isActive, onActivate, onRemove, onDuplicate, canRemove }: PatientHeaderProps) => {
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "w-full flex items-center justify-between rounded-md border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500",
        isActive ? "border-orange-500 bg-orange-50" : "border-gray-200 bg-white hover:border-gray-300",
      )}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onActivate()
        }
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
            isActive ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600",
          )}
        >
          <span className="text-sm font-semibold text-gray-800">Patient {index + 1}</span>
        </div>
        <span className="text-xs text-gray-500 truncate">
          {patient.patientName || "Unnamed patient"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={(event) => {
                event.stopPropagation()
                onDuplicate()
              }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Duplicate patient</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!canRemove}
                onClick={(event) => {
                  event.stopPropagation()
                  onRemove()
                }}
              >
                <MinusCircle className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Remove patient</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}

function validatePatientFields(patient: PatientFormState): PatientFieldKey[] {
  const missing: PatientFieldKey[] = []
  PATIENT_REQUIRED_FIELDS.forEach((field) => {
    const value = patient[field]
    if (Array.isArray(value)) {
      if (value.length === 0) missing.push(field)
      return
    }
    if (typeof value === "string") {
      if (value.trim().length === 0) missing.push(field)
      return
    }
    if (value === undefined || value === null) {
      missing.push(field)
    }
  })
  return missing
}

function summarizePatient(patient: PatientFormState) {
  const frontParts = FRONT_BODY_REGION_IDS.filter((part) => (patient.bodyPartInjuries[part] ?? []).length > 0)
  const backParts = BACK_BODY_REGION_IDS.filter((part) => (patient.bodyPartInjuries[part] ?? []).length > 0)
  const frontSummary = frontParts.map((part) => summarizeBodyPart(part, patient.bodyPartInjuries[part]!)).join("; ")
  const backSummary = backParts.map((part) => summarizeBodyPart(part, patient.bodyPartInjuries[part]!)).join("; ")
  const uniqueInjuryCodes = new Set<string>()
  Object.values(patient.bodyPartInjuries).forEach((codes) => codes.forEach((code) => uniqueInjuryCodes.add(code)))
  const injurySummary = formatInjuryList(Array.from(uniqueInjuryCodes).map((code) => INJURY_TYPE_LOOKUP[code]?.shortLabel ?? code))
  return {
    frontSummary,
    backSummary,
    injurySummary,
  }
}

function getInitialInjuryState(patients: PatientFormState[], activeId: string | null) {
  if (!activeId) return { dialog: null as null | { patientId: string; regionId: string; view: "front" | "back" }, pending: [] as string[] }
  const patient = patients.find((p) => p.id === activeId)
  if (!patient) return { dialog: null, pending: [] }
  return { dialog: null, pending: [] }
}

export function MakeReportForm({ selectedReport, erTeams, barangays, incidentTypes, hospitals, onReportSubmitted }: MakeReportFormProps) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1)

  const [incidentDate, setIncidentDate] = React.useState("")
  const [incidentTime, setIncidentTime] = React.useState("")
  const [incidentTypeId, setIncidentTypeId] = React.useState<string | undefined>()
  const [barangayId, setBarangayId] = React.useState<string | undefined>()
  const [erTeamId, setErTeamId] = React.useState<string | undefined>()
  const [timeRespondedDate, setTimeRespondedDate] = React.useState("")
  const [timeRespondedTime, setTimeRespondedTime] = React.useState("")
  const [personsInvolved, setPersonsInvolved] = React.useState<string>("1") // Default to 1 casualty
  const [numberOfResponders, setNumberOfResponders] = React.useState<string>("3") // Default to 3 responders
  const [preparedBy, setPreparedBy] = React.useState("")
  const [searchTerm, setSearchTerm] = React.useState("")
  const [otherIncidentDescription, setOtherIncidentDescription] = React.useState("")
  const [isBarangayDropdownOpen, setIsBarangayDropdownOpen] = React.useState(false)
  const barangayDropdownRef = React.useRef<HTMLDivElement | null>(null)

  const initialPatientRef = React.useRef<PatientFormState[] | null>(null)
  const selectedPatientPayload = selectedReport?.er_team_report?.patient_payload ?? null
  const selectedInjuryPayload = selectedReport?.er_team_report?.injury_payload ?? null

  if (!initialPatientRef.current) {
    if (Array.isArray(selectedPatientPayload) && selectedPatientPayload.length > 0) {
      // Multiple patients from ER team report
      const seededPatients = selectedPatientPayload.map((patientPayload, index) => 
        createPatientFromErPayload(patientPayload, selectedInjuryPayload)
      )
      initialPatientRef.current = seededPatients
    } else if (selectedPatientPayload && !Array.isArray(selectedPatientPayload)) {
      // Single patient (legacy format)
      const seededPatient = createPatientFromErPayload(selectedPatientPayload, selectedInjuryPayload)
      initialPatientRef.current = [seededPatient]
    } else {
      // No ER team data
      initialPatientRef.current = [createEmptyPatient()]
    }
  }

  const [patients, setPatients] = React.useState<PatientFormState[]>(() => initialPatientRef.current!)
  const [activePatientId, setActivePatientId] = React.useState<string>(() => initialPatientRef.current![0].id)
  const [patientValidationErrors, setPatientValidationErrors] = React.useState<Record<string, PatientFieldKey[]>>({})
  const [missingInjuryPatientIds, setMissingInjuryPatientIds] = React.useState<string[]>([])

  const [isLoading, setIsLoading] = React.useState(false)
  const [formMessage, setFormMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = React.useState(false)
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = React.useState(false)
  const [isSubmitting, startTransition] = useTransition()

  const activePatient = patients.find((patient) => patient.id === activePatientId) ?? patients[0]
  const incidentPrefillStateRef = React.useRef<{ incidentId: string | null; baseApplied: boolean }>({ incidentId: null, baseApplied: false })

  React.useEffect(() => {
    if (!activePatient) {
      setActivePatientId(patients[0]?.id ?? "")
    }
  }, [patients, activePatient])

  React.useEffect(() => {
    if (!selectedReport) return

    const incidentId = selectedReport.id
    if (incidentPrefillStateRef.current.incidentId !== incidentId) {
      incidentPrefillStateRef.current = { incidentId, baseApplied: false }
      if (Array.isArray(selectedPatientPayload) && selectedPatientPayload.length > 0) {
        const seededPatients = selectedPatientPayload.map((patientPayload, index) => 
          createPatientFromErPayload(patientPayload, selectedInjuryPayload)
        )
        setPatients(seededPatients)
        setActivePatientId(seededPatients[0].id)
      } else if (selectedPatientPayload && !Array.isArray(selectedPatientPayload)) {
        // Single patient (legacy format)
        const seededPatient = createPatientFromErPayload(selectedPatientPayload, selectedInjuryPayload)
        setPatients([seededPatient])
        setActivePatientId(seededPatient.id)
      }
    }

    if (!incidentPrefillStateRef.current.baseApplied) {
      const createdAt = selectedReport.created_at ? new Date(selectedReport.created_at) : null
      if (createdAt && !Number.isNaN(createdAt.getTime())) {
        setIncidentDate(createdAt.toISOString().slice(0, 10))
        setIncidentTime(createdAt.toISOString().slice(11, 16))
      }

      const respondedAt = selectedReport.responded_at ? new Date(selectedReport.responded_at) : null
      if (respondedAt && !Number.isNaN(respondedAt.getTime())) {
        setTimeRespondedDate(respondedAt.toISOString().slice(0, 10))
        setTimeRespondedTime(respondedAt.toISOString().slice(11, 16))
      } else {
        setTimeRespondedDate("")
        setTimeRespondedTime("")
      }

      if (!numberOfResponders) {
        setNumberOfResponders("3")
      }
      const patientCount = Array.isArray(selectedPatientPayload) ? selectedPatientPayload.length : (selectedPatientPayload ? 1 : 1)
      if (!personsInvolved) {
        setPersonsInvolved(String(patientCount))
      }

      if (Array.isArray(selectedPatientPayload) && selectedPatientPayload.length > 0) {
      } else if (selectedPatientPayload && !Array.isArray(selectedPatientPayload)) {
        const legacyPatient = selectedPatientPayload as ErTeamPatientPayload
        setPatients((prev) =>
          prev.map((patient, index) =>
            index === 0
              ? {
                  ...patient,
                  incidentLocation: legacyPatient.incidentLocation ?? patient.incidentLocation,
                  receivingHospitalId: legacyPatient.receivingHospitalId ?? patient.receivingHospitalId,
                  receivingDate: legacyPatient.receivingDate ?? patient.receivingDate,
                  turnoverInCharge: legacyPatient.turnoverInCharge ?? patient.turnoverInCharge,
                  emtErtDate: legacyPatient.emtErtDate ?? patient.emtErtDate,
                }
              : patient,
          ),
        )
      }

      incidentPrefillStateRef.current.baseApplied = true
    }

    if (selectedReport.emergency_type && !incidentTypeId) {
      if (incidentTypes.length === 0) return
      const normalizedType = normalize(selectedReport.emergency_type)
      const targetName = INCIDENT_TYPE_ALIASES[normalizedType] ?? normalizedType
      const directMatch = incidentTypes.find((incident) => normalize(incident.name) === targetName)
      if (directMatch) {
        setIncidentTypeId(String(directMatch.id))
      }
      if ((targetName === "others" || normalizedType.startsWith("others")) && selectedReport.emergency_details) {
        setOtherIncidentDescription(selectedReport.emergency_details)
      }
    }
  }, [selectedReport, incidentTypes, incidentTypeId, selectedPatientPayload, selectedInjuryPayload, patients.length])

  React.useEffect(() => {
    if (!selectedReport) return
    if (!selectedReport.er_team_id) return
    if (erTeamId) return
    if (erTeams.length === 0) return
    if (incidentPrefillStateRef.current.incidentId !== selectedReport.id) return
    setErTeamId(String(selectedReport.er_team_id))
  }, [selectedReport, erTeamId, erTeams])

  // Auto-update casualties count when patients change
  React.useEffect(() => {
    if (!selectedReport?.er_team_report) {
      // Only auto-update for new admin reports, not when reviewing ER team reports
      setPersonsInvolved(String(patients.length))
    }
  }, [patients.length, selectedReport?.er_team_report])

  const handlePatientChange = <K extends keyof PatientFormState>(patientId: string, key: K, value: PatientFormState[K]) => {
    if (key === "patientBirthday") {
      const parsed = value ? parseISO(String(value)) : null
      const computedAge = parsed && isValid(parsed) ? String(Math.max(differenceInYears(new Date(), parsed), 0)) : ""
      setPatients((prev) => prev.map((patient) => (patient.id === patientId ? {
        ...patient,
        patientBirthday: String(value ?? ""),
        patientAge: computedAge,
      } : patient)))
      setPatientValidationErrors((prev) => {
        const current = prev[patientId]
        if (!current) return prev
        const nextMissing = current.filter((field) => field !== "patientBirthday" && field !== "patientAge")
        return { ...prev, [patientId]: nextMissing }
      })
      return
    }
    if (key === "patientAge") {
      return setPatients((prev) => prev.map((patient) => (patient.id === patientId ? { ...patient, patientAge: String(value ?? "") } : patient)))
    }
    setPatients((prev) => prev.map((patient) => (patient.id === patientId ? { ...patient, [key]: value } : patient)))
    setPatientValidationErrors((prev) => {
      const current = prev[patientId]
      if (!current) return prev
      if (!PATIENT_REQUIRED_FIELDS.includes(key as PatientFieldKey)) return prev
      const nextMissing = current.filter((field) => field !== key)
      return { ...prev, [patientId]: nextMissing }
    })
  }

  const handlePatientBodyInjuriesChange = (patientId: string, updater: (prev: Record<string, string[]>) => Record<string, string[]>) => {
    setPatients((prev) => prev.map((patient) => (patient.id === patientId ? { ...patient, bodyPartInjuries: updater(patient.bodyPartInjuries) } : patient)))
  }

  const handleAddPatient = () => {
    const nextPatient = createEmptyPatient()
    setPatients((prev) => [...prev, nextPatient])
    setActivePatientId(nextPatient.id)
  }

  const handleDuplicatePatient = (patientId: string) => {
    setPatients((prev) => {
      const index = prev.findIndex((patient) => patient.id === patientId)
      if (index === -1) return prev
      const duplicate = {
        ...prev[index],
        id: generatePatientId(),
      }
      const next = [...prev.slice(0, index + 1), duplicate, ...prev.slice(index + 1)]
      return next
    })
  }

  const handleRemovePatient = (patientId: string) => {
    setPatients((prev) => {
      if (prev.length === 1) return prev
      const next = prev.filter((patient) => patient.id !== patientId)
      if (activePatientId === patientId) {
        setActivePatientId(next[0]?.id ?? "")
      }
      const { [patientId]: _removed, ...rest } = patientValidationErrors
      setPatientValidationErrors(rest)
      return next
    })
  }

  const validateStep1 = () => {
    const missing = STEP1_REQUIRED_FIELDS.filter((field) => {
      const value = {
        incidentDate,
        incidentTime,
        incidentTypeId,
        barangayId,
        erTeamId,
        preparedBy,
      }[field]
      if (Array.isArray(value)) return value.length === 0
      return !value || (typeof value === "string" && value.trim().length === 0)
    })
    if (missing.length > 0) {
      setFormMessage({ type: "error", text: "Please complete all required incident fields before continuing." })
      return false
    }
    return true
  }

  const validatePatients = () => {
    const nextErrors: Record<string, PatientFieldKey[]> = {}
    patients.forEach((patient) => {
      const missing = validatePatientFields(patient)
      if (missing.length > 0) {
        nextErrors[patient.id] = missing
      }
    })
    setPatientValidationErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      const firstPatientId = Object.keys(nextErrors)[0]
      setActivePatientId(firstPatientId)
      setFormMessage({ type: "error", text: "Please complete the required fields for each patient before continuing." })
      return false
    }
    return true
  }

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (barangayDropdownRef.current && !barangayDropdownRef.current.contains(event.target as Node)) {
        setIsBarangayDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  React.useEffect(() => {
    if (!barangayId) return
    const match = barangays.find((barangay) => String(barangay.id) === barangayId)
    if (!match) return
    if (match.name !== searchTerm) {
      setSearchTerm(match.name)
    }
  }, [barangayId, barangays, searchTerm])

  const handleBarangaySelect = (barangay: Barangay) => {
    const nextId = String(barangay.id)
    setBarangayId(nextId)
    setSearchTerm(barangay.name)
    setIsBarangayDropdownOpen(false)
    setPatients((prev) => prev.map((patient) => ({ ...patient, incidentLocation: barangay.name })))
  }

  const handleClearBarangay = () => {
    setBarangayId(undefined)
    setSearchTerm("")
    setPatients((prev) => prev.map((patient) => ({ ...patient, incidentLocation: "" })))
  }

  const filteredBarangays = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return barangays
    return barangays.filter((barangay) => barangay.name.toLowerCase().includes(term))
  }, [searchTerm, barangays])

  React.useEffect(() => {
    const deriveFullName = (user: any) => {
      const parts = [user?.firstName, user?.middleName, user?.lastName].filter(Boolean)
      const name = parts.join(" ").replace(/\s+/g, " ").trim()
      return name || user?.username || user?.email || ""
    }

    const primePreparedBy = async () => {
      try {
        if (preparedBy) return
        const raw = typeof window !== "undefined" ? localStorage.getItem("mdrrmo_user") : null
        if (raw) {
          try {
            const u = JSON.parse(raw)
            const full = deriveFullName(u)
            if (full) {
              setPreparedBy(full)
              return
            }
          } catch {}
        }
        const { data: sessionData } = await supabase.auth.getSession()
        const uid = sessionData?.session?.user?.id
        if (uid) {
          const { data: profile } = await supabase
            .from("users")
            .select("firstName, middleName, lastName, username, email")
            .eq("id", uid)
            .single()
          if (profile) {
            const full = deriveFullName(profile)
            if (full) setPreparedBy(full)
          }
        }
      } catch {}
    }
    void primePreparedBy()
  }, [preparedBy])

  const ensurePatientInjuries = () => {
    const missingPatients = patients.filter((patient) => Object.keys(patient.bodyPartInjuries).length === 0)
    if (missingPatients.length > 0) {
      setMissingInjuryPatientIds(missingPatients.map((patient) => patient.id))
      const message = missingPatients.length === 1
        ? "Please mark at least one injury on the body diagram for this patient before continuing."
        : "Please mark at least one injury on the body diagram for each patient before continuing."
      setFormMessage({ type: "error", text: message })
      setActivePatientId(missingPatients[0].id)
      return false
    }
    setMissingInjuryPatientIds([])
    return true
  }

  React.useEffect(() => {
    if (missingInjuryPatientIds.length === 0) return
    const nextMissing = missingInjuryPatientIds.filter((id) => {
      const patient = patients.find((candidate) => candidate.id === id)
      if (!patient) return false
      return Object.keys(patient.bodyPartInjuries).length === 0
    })
    if (nextMissing.length !== missingInjuryPatientIds.length) {
      setMissingInjuryPatientIds(nextMissing)
    }
  }, [patients, missingInjuryPatientIds])

  const handleStepNext = () => {
    if (step === 1) {
      if (!validateStep1()) return
      setFormMessage(null)
      setStep(2)
      return
    }
    if (step === 2) {
      if (!validatePatients()) return
      if (!ensurePatientInjuries()) {
        setStep(3)
        return
      }
      setFormMessage(null)
      setStep(3)
      return
    }
  }

  const handleStepBack = () => {
    setFormMessage(null)
    setStep((prev) => {
      if (prev === 3) return 2
      if (prev === 2) return 1
      return prev
    })
  }

  const resetForm = () => {
    setIncidentDate("")
    setIncidentTime("")
    setIncidentTypeId(undefined)
    setBarangayId(undefined)
    setErTeamId(undefined)
    setTimeRespondedDate("")
    setTimeRespondedTime("")
    setPersonsInvolved("1") // Default to 1 casualty
    setNumberOfResponders("3") // Default to 3 responders
    setPreparedBy("")
    setSearchTerm("")
    setIsBarangayDropdownOpen(false)
    setStep(1)
    setPatients(() => {
      const initialPatient = createEmptyPatient()
      setActivePatientId(initialPatient.id)
      return [initialPatient]
    })
    setPatientValidationErrors({})
    setFormMessage(null)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting || isLoading) return

    if (!validateStep1()) {
      setStep(1)
      return
    }
    if (!validatePatients()) {
      setStep(2)
      return
    }
    if (!ensurePatientInjuries()) {
      setStep(3)
      return
    }

    setIsConfirmDialogOpen(true)
  }

  const handleConfirmSubmit = () => {
    if (isSubmitting || isLoading) return

    setIsConfirmDialogOpen(false)

    const incidentDateTime = new Date(`${incidentDate}T${incidentTime}:00Z`).toISOString()
    const timeRespondedIso = timeRespondedDate && timeRespondedTime ? new Date(`${timeRespondedDate}T${timeRespondedTime}:00Z`).toISOString() : null
    const primaryHospitalId = patients.find((patient) => patient.receivingHospitalId)?.receivingHospitalId ?? null

    setIsLoading(true)
    setFormMessage(null)

    startTransition(async () => {
      try {
        const { data: insertData, error: insertError } = await supabase
          .from("internal_reports")
          .insert({
            original_report_id: selectedReport?.id ?? null,
            incident_type_id: incidentTypeId ? parseInt(incidentTypeId, 10) : null,
            incident_date: incidentDateTime,
            time_responded: timeRespondedIso,
            barangay_id: barangayId ? parseInt(barangayId, 10) : null,
            er_team_id: erTeamId ? parseInt(erTeamId, 10) : null,
            receiving_hospital_id: primaryHospitalId,
            persons_involved: personsInvolved ? parseInt(personsInvolved, 10) : null,
            number_of_responders: numberOfResponders ? parseInt(numberOfResponders, 10) : null,
            prepared_by: preparedBy,
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single()

        if (insertError) throw insertError
        const reportId = insertData?.id
        if (!reportId) throw new Error("Failed to retrieve new report ID")

        const patientRows = patients.map((patient) => {
          const frontSummary = FRONT_BODY_REGION_IDS.filter((part) => (patient.bodyPartInjuries[part] ?? []).length > 0)
            .map((part) => summarizeBodyPart(part, patient.bodyPartInjuries[part]!))
            .join("; ")
          const backSummary = BACK_BODY_REGION_IDS.filter((part) => (patient.bodyPartInjuries[part] ?? []).length > 0)
            .map((part) => summarizeBodyPart(part, patient.bodyPartInjuries[part]!))
            .join("; ")
          const uniqueInjuryCodes = new Set<string>()
          Object.values(patient.bodyPartInjuries).forEach((codes) => codes.forEach((code) => uniqueInjuryCodes.add(code)))
          const injurySummary = formatInjuryList(Array.from(uniqueInjuryCodes).map((code) => INJURY_TYPE_LOOKUP[code]?.shortLabel ?? code))
          const gcsEyeScore = patient.gcsEye ? parseInt(patient.gcsEye, 10) : null
          const gcsVerbalScore = patient.gcsVerbal ? parseInt(patient.gcsVerbal, 10) : null
          const gcsMotorScore = patient.gcsMotor ? parseInt(patient.gcsMotor, 10) : null
          const gcsTotal = [gcsEyeScore, gcsVerbalScore, gcsMotorScore].some((value) => value !== null)
            ? (Number(gcsEyeScore ?? 0) + Number(gcsVerbalScore ?? 0) + Number(gcsMotorScore ?? 0))
            : null
          const estimatedBloodLoss = patient.estimatedBloodLoss ? Number(patient.estimatedBloodLoss) : null
          return {
            internal_report_id: reportId,
            receiving_hospital_id: patient.receivingHospitalId ?? null,
            patient_name: patient.patientName,
            patient_contact_number: patient.patientNumber,
            patient_birthday: patient.patientBirthday || null,
            patient_age: patient.patientAge ? parseInt(patient.patientAge, 10) : null,
            patient_address: patient.patientAddress,
            patient_sex: patient.patientSex || null,
            evacuation_priority: patient.evacPriority || null,
            emergency_category: patient.typeOfEmergencySelections.join(", "),
            airway_interventions: patient.airwaySelections.join(", "),
            breathing_support: patient.breathingSelections.join(", "),
            circulation_status: patient.circulationSelections.join(", "),
            body_parts_front: frontSummary,
            body_parts_back: backSummary,
            injury_types: injurySummary,
            incident_location: patient.incidentLocation,
            moi_poi_toi: patient.moiPoiToi,
            noi: patient.noi || null,
            signs_symptoms: patient.signsSymptoms || null,
            gcs_eye: gcsEyeScore,
            gcs_verbal: gcsVerbalScore,
            gcs_motor: gcsMotorScore,
            gcs_total: gcsTotal,
            gcs_other: patient.gcsOther || null,
            loc_avpu: patient.locAvpu || null,
            pulse_rate: patient.pulseRate || null,
            blood_pressure: patient.bloodPressure || null,
            bpm: patient.bpm || null,
            oxygen_saturation: patient.oxygenSaturation || null,
            pain_scale: patient.painScale || null,
            temperature: patient.temperature || null,
            respiratory_rate: patient.respiratoryRate || null,
            blood_loss_level: patient.bloodLossLevel || null,
            estimated_blood_loss: estimatedBloodLoss,
            turnover_in_charge: patient.turnoverInCharge || null,
            receiving_hospital_date: patient.receivingDate ? new Date(`${patient.receivingDate}T00:00:00Z`).toISOString() : null,
            emt_ert_date: patient.emtErtDate ? new Date(`${patient.emtErtDate}T00:00:00Z`).toISOString() : null,
          }
        })

        if (patientRows.length > 0) {
          const { error: patientInsertError } = await supabase
            .from("internal_report_patients")
            .insert(patientRows)
          if (patientInsertError) throw patientInsertError
        }

        const { data: authUser } = await supabase.auth.getUser()
        const narrativePayload = {
          internal_report_id: reportId,
          title: `Narrative Report - ${incidentDate ? formatDateValue(incidentDate) : reportId}`,
          narrative_text: narrativeText || narrativeReport,
          status: "draft" as const,
          created_by: authUser?.user?.id ?? null,
        }

        const { error: narrativeError } = await supabase.from("narrative_reports").insert(narrativePayload)
        if (narrativeError) {
          console.error("Failed to create narrative draft", narrativeError)
        }

        if (selectedReport?.er_team_report?.id) {
          const { error: erTeamUpdateError } = await supabase
            .from("er_team_reports")
            .update({ status: "resolved", internal_report_id: reportId, updated_at: new Date().toISOString() })
            .eq("id", selectedReport.er_team_report.id)

          if (erTeamUpdateError) {
            throw erTeamUpdateError
          }
        }

        setFormMessage({ type: "success", text: "Internal report submitted successfully!" })
        onReportSubmitted()
        resetForm()
        setIsSuccessDialogOpen(true)
      } catch (error: any) {
        console.error("Error submitting internal report", error)
        setFormMessage({ type: "error", text: error.message || "Failed to submit report." })
      } finally {
        setIsLoading(false)
      }
    })
  }

  const activeDialogState = React.useMemo(() => {
    if (!activePatient) return null
    return {
      patientId: activePatient.id,
      bodyPartInjuries: activePatient.bodyPartInjuries,
    }
  }, [activePatient])

  const narrativeReport = React.useMemo(() => {
    const incidentTypeName = incidentTypeId ? incidentTypes.find((type) => String(type.id) === incidentTypeId)?.name : undefined
    const barangayName = barangayId ? barangays.find((barangay) => String(barangay.id) === barangayId)?.name : undefined
    const erTeamName = erTeamId ? erTeams.find((team) => String(team.id) === erTeamId)?.name : undefined
    const incidentDateFormatted = incidentDate ? formatDateValue(incidentDate) : ""
    const reportTimestamp = [incidentDateFormatted, incidentTime].filter(Boolean).join(" ")

    const respondedDateFormatted = timeRespondedDate ? formatDateValue(timeRespondedDate) : ""
    const respondedTimestamp = [respondedDateFormatted, timeRespondedTime].filter(Boolean).join(" ")

    const header = reportTimestamp
      ? `MDRRMO BULAN INCIDENT REPORT (${reportTimestamp})`
      : "MDRRMO BULAN INCIDENT REPORT"

    const lines: string[] = [header, ""]

    lines.push(`Type of Incident: ${incidentTypeName ?? "________________"}`)
    lines.push(`Incident Location: ${barangayName ?? "________________"}`)

    const turnoverHospitals = patients
      .map((patient) => patient.receivingHospitalId)
      .filter(Boolean)
      .map((hospitalId) => hospitals.find((hospital) => hospital.id === hospitalId)?.name ?? hospitalId)

    const hospitalNames = turnoverHospitals.length > 0 ? turnoverHospitals.join(", ") : "________________"

    const detailTime = reportTimestamp || incidentTime || "________________"
    const detailResponded = respondedTimestamp || "________________"
    const detailTeam = erTeamName ?? "________________"
    const hospitalTarget = hospitalNames
    const editableClause = "Ayon sa team _______________________________."
    const preparedText = preparedBy ? `Inihanda ni ${preparedBy}.` : ""

    const detailParagraph = `Bandang ${detailTime} Nakatanggap ng report ang aming Team mula sa isang user gamit ang MDRRMO Emergency App nitong ${detailResponded}. Agad namang rumesponde ang ${detailTeam} at agad na inassit ang pasyente at nilapatan ng First Aid na inilipat sa spineboard bago sinakay sa Rescue Vehicle at dinala sa ${hospitalTarget} para sa atensyong medikal. ${editableClause} ${preparedText}`.trim()

    lines.push(`Details: ${detailParagraph}`)

    lines.push(`Turnover Hospital: ${hospitalNames}`)

    const turnoverInChargeLine = patients
      .map((patient) => patient.turnoverInCharge)
      .filter((value) => value && value.trim().length > 0)
      .join(", ") || "________________"
    lines.push(`Patient turnover in charge: ${turnoverInChargeLine}`)

    lines.push(`ER Team: ${erTeamName ?? "________________"}`)

    return lines.join("\n").trim()
  }, [
    incidentDate,
    incidentTime,
    incidentTypeId,
    barangayId,
    erTeamId,
    preparedBy,
    personsInvolved,
    numberOfResponders,
    timeRespondedDate,
    timeRespondedTime,
    patients,
    incidentTypes,
    barangays,
    erTeams,
  ])

  React.useEffect(() => {
    setNarrativeText(narrativeReport)
  }, [narrativeReport])

  const handleOpenInjuryDialog = (patientId: string, regionId: string, view: "front" | "back") => {
    setPatients((prev) => prev.map((patient) => (patient.id === patientId ? { ...patient, bodyPartInjuries: patient.bodyPartInjuries } : patient)))
    setActivePatientId(patientId)
    setInjuryDialog({ patientId, regionId, view })
    const existing = activeDialogState?.bodyPartInjuries[regionId] ?? []
    setPendingInjurySelection(existing)
    setInjurySelectionError(null)
  }

  const [injuryDialog, setInjuryDialog] = React.useState<null | { patientId: string; regionId: string; view: "front" | "back" }>(null)
  const [pendingInjurySelection, setPendingInjurySelection] = React.useState<string[]>([])
  const [injurySelectionError, setInjurySelectionError] = React.useState<string | null>(null)
  const [narrativeText, setNarrativeText] = React.useState("")

  const handleConfirmInjurySelection = () => {
    if (!injuryDialog) return
    if (pendingInjurySelection.length === 0) {
      setInjurySelectionError("Select at least one injury type for this body part.")
      return
    }
    handlePatientBodyInjuriesChange(injuryDialog.patientId, (prev) => ({
      ...prev,
      [injuryDialog.regionId]: pendingInjurySelection,
    }))
    setInjuryDialog(null)
    setPendingInjurySelection([])
    setInjurySelectionError(null)
  }

  const handleClearInjurySelection = () => {
    if (!injuryDialog) return
    handlePatientBodyInjuriesChange(injuryDialog.patientId, (prev) => {
      const next = { ...prev }
      delete next[injuryDialog.regionId]
      return next
    })
    setInjuryDialog(null)
    setPendingInjurySelection([])
    setInjurySelectionError(null)
  }

  const handleCancelInjurySelection = () => {
    setInjuryDialog(null)
    setPendingInjurySelection([])
    setInjurySelectionError(null)
  }

  const stepDescriptors: { id: 1 | 2 | 3; label: string; description: string }[] = React.useMemo(() => (
    [
      { id: 1, label: "Incident", description: "Incident basics & responders" },
      { id: 2, label: "Patients", description: "Patients & transfer details" },
      { id: 3, label: "Injuries", description: "Body diagrams & injury log" },
    ]
  ), [])

  const renderStepPill = (descriptor: { id: 1 | 2 | 3; label: string; description: string }) => {
    const isActive = descriptor.id === step
    const isCompleted = descriptor.id < step
    return (
      <div
        key={descriptor.id}
        role="button"
        tabIndex={0}
        onClick={() => setStep(descriptor.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            setStep(descriptor.id)
          }
        }}
        className={cn(
          "group flex items-center gap-3 rounded-full border px-4 py-2 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500",
          isActive
            ? "border-orange-500 bg-orange-50 text-orange-700 shadow-sm"
            : isCompleted
              ? "border-green-500 bg-green-50 text-green-700"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
            isActive
              ? "bg-orange-500 text-white"
              : isCompleted
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-500",
          )}
        >
          {descriptor.id}
        </span>
        <div className="text-left">
          <p className="text-sm font-semibold leading-tight">{descriptor.label}</p>
          <p className="text-xs text-gray-500 leading-tight">{descriptor.description}</p>
        </div>
      </div>
    )
  }

  const StepTooltip = ({ text }: { text: string }) => (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger type="button" className="inline-flex items-center justify-center rounded-full border border-gray-200 p-1 text-gray-400 hover:text-gray-600 hover:border-gray-300">
          <Info className="h-4 w-4" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs text-gray-600">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  const renderPatientSummary = (patient: PatientFormState, index: number) => {
    const missingFields = patientValidationErrors[patient.id] ?? []
    const hasErrors = missingFields.length > 0
    const { frontSummary, backSummary, injurySummary } = summarizePatient(patient)
    const missingInjury = missingInjuryPatientIds.includes(patient.id)
    const containerHasErrors = hasErrors || missingInjury
    const priorityDetails = getPriorityDetails(patient.evacPriority)
    const gcsTotal = Number(patient.gcsEye || 0) + Number(patient.gcsVerbal || 0) + Number(patient.gcsMotor || 0)
    return (
      <div key={patient.id} className={cn("rounded-lg border p-4", containerHasErrors ? "border-red-300 bg-red-50" : "border-gray-200 bg-white")}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-gray-800">Patient {index + 1}</h4>
            <p className="text-xs text-gray-500">{patient.patientName || "Unnamed patient"}</p>
          </div>
          {containerHasErrors ? (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">Missing fields</span>
          ) : null}
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-600">
          <div>
            <dt className="font-semibold text-gray-700">Injury Summary</dt>
            <dd className="mt-1 text-gray-600">{injurySummary || "No injuries selected yet"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-700">Front Body</dt>
            <dd className="mt-1 text-gray-600">{frontSummary || "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-700">Back Body</dt>
            <dd className="mt-1 text-gray-600">{backSummary || "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-700">Evacuation Priority</dt>
            <dd className="mt-1">
              {priorityDetails ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white",
                    priorityDetails.colorClass,
                  )}
                >
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                  {priorityDetails.description}
                </span>
              ) : (
                <span className="text-gray-500">No priority selected</span>
              )}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="font-semibold text-gray-700">GCS</span>
            <span className="text-gray-600">{gcsTotal ? `${gcsTotal} (E${patient.gcsEye || 0} V${patient.gcsVerbal || 0} M${patient.gcsMotor || 0})` : "—"}</span>
            <span className="font-semibold text-gray-700">Vitals</span>
            <span className="text-gray-600 text-left">
              {[patient.locAvpu, patient.pulseRate && `${patient.pulseRate} PR`, patient.bloodPressure && `BP ${patient.bloodPressure}`, patient.oxygenSaturation && `O₂ ${patient.oxygenSaturation}%`, patient.respiratoryRate && `RR ${patient.respiratoryRate}`, patient.temperature && `${patient.temperature}°C`, patient.painScale && `Pain ${patient.painScale}/10`]
                .filter(Boolean)
                .join(" · ") || "—"}
            </span>
            <span className="font-semibold text-gray-700">Blood Loss</span>
            <span className="text-gray-600">{patient.bloodLossLevel || "—"}{patient.estimatedBloodLoss ? ` (${patient.estimatedBloodLoss} L)` : ""}</span>
          </div>
          <div>
            <dt className="font-semibold text-gray-700">Body Diagram</dt>
            <dd className="mt-1">
              {missingInjury ? (
                <span className="text-red-600 font-semibold">Select injury regions before submitting</span>
              ) : (
                <span className="text-gray-600">{injurySummary ? "Completed" : "No injuries recorded yet"}</span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    )
  }

  const renderIncidentStep = () => (
    <>
      <div className="flex items-center justify-between bg-white border rounded-md px-4 py-3 shadow-sm sticky top-[88px] z-10">
        <div className="flex items-center gap-3 text-sm font-semibold text-gray-700">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white">1</span>
          Incident Details
        </div>
        <StepTooltip text="Fill in date, time, location, and responding team details for this incident." />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <DatePickerField
          id="incidentDate"
          label="Incident Date"
          value={incidentDate}
          onChange={setIncidentDate}
          required
          error={!incidentDate}
        />
        <div>
          <Label htmlFor="incidentTime" className="block text-sm font-medium text-gray-700 mb-1">
            Time Reported
          </Label>
          <Input
            id="incidentTime"
            type="time"
            value={incidentTime}
            onChange={(event) => setIncidentTime(event.target.value)}
            required
          />
          {!incidentTime ? <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p> : null}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <Label htmlFor="incidentType" className="block text-sm font-medium text-gray-700 mb-1">
            Incident Type
          </Label>
          <Select value={incidentTypeId} onValueChange={setIncidentTypeId}>
            <SelectTrigger id="incidentType">
              <SelectValue placeholder="Select incident type" />
            </SelectTrigger>
            <SelectContent className="bg-white rounded-md shadow-lg max-h-60 overflow-y-auto">
              {incidentTypes.map((type) => (
                <SelectItem key={type.id} value={String(type.id)}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!incidentTypeId ? <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p> : null}
        </div>

        <div ref={barangayDropdownRef} className="relative">
          <Label htmlFor="barangaySearch" className="block text-sm font-medium text-gray-700 mb-1">
            Barangay Name
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="barangaySearch"
              type="text"
              placeholder="Search barangay..."
              value={searchTerm}
              onFocus={() => setIsBarangayDropdownOpen(true)}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setIsBarangayDropdownOpen(true)
              }}
            />
            {searchTerm ? (
              <Button type="button" variant="outline" className="px-3" onClick={handleClearBarangay}>
                Clear
              </Button>
            ) : null}
          </div>
          {isBarangayDropdownOpen ? (
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {filteredBarangays.length > 0 ? (
                filteredBarangays.map((barangay) => (
                  <button
                    key={barangay.id}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-gray-100",
                      barangayId === String(barangay.id) && "bg-gray-100 font-semibold",
                    )}
                    onClick={() => handleBarangaySelect(barangay)}
                  >
                    {barangay.name}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">No matching barangays.</div>
              )}
            </div>
          ) : null}
          {!barangayId ? <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p> : null}
        </div>

        <div>
          <Label htmlFor="erTeam" className="block text-sm font-medium text-gray-700 mb-1">
            ER Team
          </Label>
          <Select value={erTeamId} onValueChange={setErTeamId}>
            <SelectTrigger id="erTeam">
              <SelectValue placeholder="Select ER team" />
            </SelectTrigger>
            <SelectContent className="bg-white rounded-md shadow-lg max-h-60 overflow-y-auto">
              {erTeams.map((team) => (
                <SelectItem key={team.id} value={String(team.id)}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!erTeamId ? <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="personsInvolved" className="block text-sm font-medium text-gray-700 mb-1">
            Estimated Persons Involved
          </Label>
          <Input
            id="personsInvolved"
            type="number"
            min="0"
            value={personsInvolved}
            onChange={(event) => setPersonsInvolved(event.target.value.replace(/[^0-9]/g, ""))}
          />
        </div>
        <div>
          <Label htmlFor="respondersCount" className="block text-sm font-medium text-gray-700 mb-1">
            Number of Responders
          </Label>
          <Input
            id="respondersCount"
            type="number"
            min="0"
            value={numberOfResponders}
            onChange={(event) => setNumberOfResponders(event.target.value.replace(/[^0-9]/g, ""))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DatePickerField
          id="respondedDate"
          label="Responded Date"
          value={timeRespondedDate}
          onChange={setTimeRespondedDate}
          allowClear
          placeholder="Select date"
        />
        <div>
          <Label htmlFor="respondedTime" className="block text-sm font-medium text-gray-700 mb-1">
            Responded Time
          </Label>
          <Input
            id="respondedTime"
            type="time"
            value={timeRespondedTime}
            onChange={(event) => setTimeRespondedTime(event.target.value)}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="preparedBy" className="block text-sm font-medium text-gray-700 mb-1">
          Prepared By
        </Label>
        <Input
          id="preparedBy"
          type="text"
          value={preparedBy}
          onChange={(event) => setPreparedBy(event.target.value)}
          required
        />
        {!preparedBy ? <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p> : null}
      </div>
    </>
  )

  const renderPatientStep = () => (
    <>
      <div className="flex items-center justify-between bg-white border rounded-md px-4 py-3 shadow-sm sticky top-[88px] z-10">
        <div className="flex items-center gap-3 text-sm font-semibold text-gray-700">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white">2</span>
          Patients
        </div>
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger type="button" className="inline-flex items-center justify-center rounded-full border border-gray-200 p-1 text-gray-400 hover:text-gray-600 hover:border-gray-300">
                <Info className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs text-gray-600">
                Manage each patient’s profile, transfer, and treatment details.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button type="button" size="sm" onClick={handleAddPatient}>
            <Plus className="mr-1 h-4 w-4" /> Add patient
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-full shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-800">Patient List</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {patients.map((patient, index) => (
              <PatientHeader
                key={patient.id}
                index={index}
                patient={patient}
                canRemove={patients.length > 1}
                onRemove={() => handleRemovePatient(patient.id)}
                onDuplicate={() => handleDuplicatePatient(patient.id)}
                isActive={patient.id === activePatientId}
                onActivate={() => setActivePatientId(patient.id)}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-800">
              Patient {patients.findIndex((patient) => patient.id === activePatient?.id) + 1 || 1} Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Label htmlFor="patientName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </Label>
                <Input
                  id="patientName"
                  value={activePatient?.patientName ?? ""}
                  onChange={(event) => handlePatientChange(activePatient.id, "patientName", event.target.value)}
                  required
                />
                {patientValidationErrors[activePatient.id]?.includes("patientName") ? (
                  <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="patientNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Number
                </Label>
                <Input
                  id="patientNumber"
                  value={activePatient?.patientNumber ?? ""}
                  onChange={(event) => handlePatientChange(activePatient.id, "patientNumber", event.target.value.replace(/[^0-9]/g, "").slice(0, 11))}
                  required
                />
                {patientValidationErrors[activePatient.id]?.includes("patientNumber") ? (
                  <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <DatePickerField
                id="patientBirthday"
                label="Birthday"
                value={activePatient?.patientBirthday ?? ""}
                onChange={(next) => handlePatientChange(activePatient.id, "patientBirthday", next)}
                required
                error={patientValidationErrors[activePatient.id]?.includes("patientBirthday")}
                fromYear={1900}
                toYear={new Date().getFullYear()}
              />
              <div>
                <Label htmlFor="patientAge" className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </Label>
                <Input
                  id="patientAge"
                  type="number"
                  min="0"
                  value={activePatient?.patientAge ?? ""}
                  onChange={(event) => handlePatientChange(activePatient.id, "patientAge", event.target.value.replace(/[^0-9]/g, ""))}
                  required
                />
                {patientValidationErrors[activePatient.id]?.includes("patientAge") ? (
                  <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                ) : null}
              </div>
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1">Sex</Label>
                <div className="flex items-center gap-3">
                  {(["male", "female"] as const).map((sexOption) => (
                    <label key={sexOption} className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <Checkbox
                        checked={activePatient?.patientSex === sexOption}
                        onCheckedChange={(checked) => handlePatientChange(activePatient.id, "patientSex", checked ? sexOption : "")}
                      />
                      {sexOption.charAt(0).toUpperCase() + sexOption.slice(1)}
                    </label>
                  ))}
                </div>
                {patientValidationErrors[activePatient.id]?.includes("patientSex") ? (
                  <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                ) : null}
              </div>
            </div>

            <div>
              <Label htmlFor="patientAddress" className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </Label>
              <Textarea
                id="patientAddress"
                value={activePatient?.patientAddress ?? ""}
                onChange={(event) => handlePatientChange(activePatient.id, "patientAddress", event.target.value)}
                rows={2}
                required
              />
              {patientValidationErrors[activePatient.id]?.includes("patientAddress") ? (
                <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
              ) : null}
            </div>

            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">Evacuation Priority</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRIORITY_LABELS.map((priority) => (
                  <Button
                    key={priority.value}
                    type="button"
                    variant={activePatient?.evacPriority === priority.value ? "default" : "outline"}
                    className={cn(
                      "justify-start border",
                      activePatient?.evacPriority === priority.value
                        ? PRIORITY_COLORS[priority.value]
                        : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200",
                      activePatient?.evacPriority === priority.value && "text-white",
                    )}
                    onClick={() =>
                      handlePatientChange(
                        activePatient.id,
                        "evacPriority",
                        activePatient?.evacPriority === priority.value ? "" : priority.value,
                      )
                    }
                  >
                    <span className={cn("inline-flex h-3 w-3 rounded-full mr-2", PRIORITY_COLORS[priority.value])} />
                    <span className="flex flex-col text-left">
                      <span className="text-sm font-semibold">{priority.label}</span>
                      <span className={cn("text-xs", activePatient?.evacPriority === priority.value ? "text-white" : "text-gray-500")}>{priority.description}</span>
                    </span>
                  </Button>
                ))}
              </div>
              {patientValidationErrors[activePatient.id]?.includes("evacPriority") ? (
                <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
              ) : null}
            </div>

            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">Emergency Category</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {[
                  "Cardiac",
                  "Trauma",
                  "OB-Gyn",
                  "Neurologic",
                  "Respiratory",
                  "Pediatric",
                  "Burn",
                ].map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={activePatient?.typeOfEmergencySelections.includes(option) ? "default" : "outline"}
                    className={cn(
                      "justify-start",
                      activePatient?.typeOfEmergencySelections.includes(option)
                        ? "bg-orange-500 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50",
                    )}
                    onClick={() => {
                      const existing = activePatient?.typeOfEmergencySelections ?? []
                      const next = existing.includes(option)
                        ? existing.filter((item) => item !== option)
                        : [...existing, option]
                      handlePatientChange(activePatient.id, "typeOfEmergencySelections", next)
                    }}
                  >
                    {option}
                  </Button>
                ))}
              </div>
              {patientValidationErrors[activePatient.id]?.includes("typeOfEmergencySelections") ? (
                <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="rounded-lg border shadow-sm p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Airway (A)</p>
                {[
                  "Patent",
                  "Obstructed",
                  "Needs suctioning",
                  "Needs airway adjunct",
                ].map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={activePatient?.airwaySelections.includes(option) ? "default" : "outline"}
                    className={cn(
                      "mb-2 w-full justify-start",
                      activePatient?.airwaySelections.includes(option)
                        ? "bg-orange-100 text-orange-700 border-orange-400"
                        : "bg-white text-gray-700 hover:bg-gray-50",
                    )}
                    onClick={() => {
                      const existing = activePatient?.airwaySelections ?? []
                      const next = existing.includes(option)
                        ? existing.filter((item) => item !== option)
                        : [...existing, option]
                      handlePatientChange(activePatient.id, "airwaySelections", next)
                    }}
                  >
                    {option}
                  </Button>
                ))}
              </div>

              <div className="rounded-lg border shadow-sm p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Breathing (B)</p>
                {[
                  "Normal",
                  "Shallow",
                  "Labored",
                  "Bagged",
                ].map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={activePatient?.breathingSelections.includes(option) ? "default" : "outline"}
                    className={cn(
                      "mb-2 w-full justify-start",
                      activePatient?.breathingSelections.includes(option)
                        ? "bg-orange-100 text-orange-700 border-orange-400"
                        : "bg-white text-gray-700 hover:bg-gray-50",
                    )}
                    onClick={() => {
                      const existing = activePatient?.breathingSelections ?? []
                      const next = existing.includes(option)
                        ? existing.filter((item) => item !== option)
                        : [...existing, option]
                      handlePatientChange(activePatient.id, "breathingSelections", next)
                    }}
                  >
                    {option}
                  </Button>
                ))}
              </div>

              <div className="rounded-lg border shadow-sm p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Circulation (C)</p>
                {[
                  "Radial",
                  "Carotid",
                  "None",
                ].map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={activePatient?.circulationSelections.includes(option) ? "default" : "outline"}
                    className={cn(
                      "mb-2 w-full justify-start",
                      activePatient?.circulationSelections.includes(option)
                        ? "bg-orange-100 text-orange-700 border-orange-400"
                        : "bg-white text-gray-700 hover:bg-gray-50",
                    )}
                    onClick={() => {
                      const existing = activePatient?.circulationSelections ?? []
                      const next = existing.includes(option)
                        ? existing.filter((item) => item !== option)
                        : [...existing, option]
                      handlePatientChange(activePatient.id, "circulationSelections", next)
                    }}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="incidentLocationPatient" className="block text-sm font-medium text-gray-700 mb-1">
                  Incident Location (Patient perspective)
                </Label>
                <Input
                  id="incidentLocationPatient"
                  value={activePatient?.incidentLocation ?? ""}
                  onChange={(event) => handlePatientChange(activePatient.id, "incidentLocation", event.target.value)}
                  required
                />
                {patientValidationErrors[activePatient.id]?.includes("incidentLocation") ? (
                  <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="moiPoiToiPatient" className="block text-sm font-medium text-gray-700 mb-1">
                  MOI / POI / TOI
                </Label>
                <Textarea
                  id="moiPoiToiPatient"
                  value={activePatient?.moiPoiToi ?? ""}
                  onChange={(event) => handlePatientChange(activePatient.id, "moiPoiToi", event.target.value)}
                  rows={3}
                  required
                />
                {patientValidationErrors[activePatient.id]?.includes("moiPoiToi") ? (
                  <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="noiPatient" className="block text-sm font-medium text-gray-700 mb-1">
                  NOI (Nature of Injury)
                </Label>
                <Textarea
                  id="noiPatient"
                  value={activePatient?.noi ?? ""}
                  onChange={(event) => handlePatientChange(activePatient.id, "noi", event.target.value)}
                  rows={3}
                  required
                />
                {patientValidationErrors[activePatient.id]?.includes("noi") ? (
                  <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="signsSymptomsPatient" className="block text-sm font-medium text-gray-700 mb-1">
                  S/S (Signs &amp; Symptoms)
                </Label>
                <Textarea
                  id="signsSymptomsPatient"
                  value={activePatient?.signsSymptoms ?? ""}
                  onChange={(event) => handlePatientChange(activePatient.id, "signsSymptoms", event.target.value)}
                  rows={3}
                  required
                />
                {patientValidationErrors[activePatient.id]?.includes("signsSymptoms") ? (
                  <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-lg border shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Glasgow Coma Scale (GCS)</p>
                  <span className="text-xs text-gray-500">Tap to select score</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold text-gray-600 mb-2 block">Eye (4-1)</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {["4", "3", "2", "1"].map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant={activePatient?.gcsEye === value ? "default" : "outline"}
                          className={cn(
                            "py-2",
                            activePatient?.gcsEye === value ? "bg-orange-500 text-white" : "bg-white text-gray-700 hover:bg-gray-50",
                          )}
                          onClick={() => handlePatientChange(activePatient.id, "gcsEye", value)}
                        >
                          {value}
                        </Button>
                      ))}
                    </div>
                    {patientValidationErrors[activePatient.id]?.includes("gcsEye") ? (
                      <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-gray-600 mb-2 block">Verbal (5-1)</Label>
                    <div className="grid grid-cols-5 gap-2">
                      {["5", "4", "3", "2", "1"].map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant={activePatient?.gcsVerbal === value ? "default" : "outline"}
                          className={cn(
                            "py-2",
                            activePatient?.gcsVerbal === value ? "bg-orange-500 text-white" : "bg-white text-gray-700 hover:bg-gray-50",
                          )}
                          onClick={() => handlePatientChange(activePatient.id, "gcsVerbal", value)}
                        >
                          {value}
                        </Button>
                      ))}
                    </div>
                    {patientValidationErrors[activePatient.id]?.includes("gcsVerbal") ? (
                      <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-gray-600 mb-2 block">Motor (6-1)</Label>
                    <div className="grid grid-cols-6 gap-2">
                      {["6", "5", "4", "3", "2", "1"].map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant={activePatient?.gcsMotor === value ? "default" : "outline"}
                          className={cn(
                            "py-2",
                            activePatient?.gcsMotor === value ? "bg-orange-500 text-white" : "bg-white text-gray-700 hover:bg-gray-50",
                          )}
                          onClick={() => handlePatientChange(activePatient.id, "gcsMotor", value)}
                        >
                          {value}
                        </Button>
                      ))}
                    </div>
                    {patientValidationErrors[activePatient.id]?.includes("gcsMotor") ? (
                      <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                  <span className="text-sm font-semibold text-gray-700">Total GCS</span>
                  <span className="text-lg font-bold text-gray-900">
                    {Number(activePatient?.gcsEye || 0) + Number(activePatient?.gcsVerbal || 0) + Number(activePatient?.gcsMotor || 0)}
                  </span>
                </div>
                <div>
                  <Label htmlFor="gcsOther" className="block text-xs font-semibold text-gray-600 mb-1">
                    Other Remarks
                  </Label>
                  <Textarea
                    id="gcsOther"
                    value={activePatient?.gcsOther ?? ""}
                    onChange={(event) => handlePatientChange(activePatient.id, "gcsOther", event.target.value)}
                    rows={2}
                    placeholder="Optional notes"
                  />
                </div>
              </div>
              <div className="rounded-lg border shadow-sm p-4 space-y-4">
                <p className="text-sm font-semibold text-gray-700">Vital Signs &amp; Assessment</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="locAvpu" className="block text-xs font-semibold text-gray-600 mb-1">
                      LOC / AVPU
                    </Label>
                    <Input
                      id="locAvpu"
                      value={activePatient?.locAvpu ?? ""}
                      onChange={(event) => handlePatientChange(activePatient.id, "locAvpu", event.target.value)}
                      placeholder="e.g. Alert"
                      required
                    />
                    {patientValidationErrors[activePatient.id]?.includes("locAvpu") ? (
                      <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="pulseRate" className="block text-xs font-semibold text-gray-600 mb-1">
                      Pulse Rate
                    </Label>
                    <Input
                      id="pulseRate"
                      value={activePatient?.pulseRate ?? ""}
                      onChange={(event) => handlePatientChange(activePatient.id, "pulseRate", event.target.value)}
                      placeholder="bpm"
                      required
                    />
                    {patientValidationErrors[activePatient.id]?.includes("pulseRate") ? (
                      <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="bloodPressure" className="block text-xs font-semibold text-gray-600 mb-1">
                      BP
                    </Label>
                    <Input
                      id="bloodPressure"
                      value={activePatient?.bloodPressure ?? ""}
                      onChange={(event) => handlePatientChange(activePatient.id, "bloodPressure", event.target.value)}
                      placeholder="e.g. 120/80"
                      required
                    />
                    {patientValidationErrors[activePatient.id]?.includes("bloodPressure") ? (
                      <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="bpm" className="block text-xs font-semibold text-gray-600 mb-1">
                      BPM
                    </Label>
                    <Input
                      id="bpm"
                      value={activePatient?.bpm ?? ""}
                      onChange={(event) => handlePatientChange(activePatient.id, "bpm", event.target.value)}
                      placeholder="Beats per minute"
                      required
                    />
                    {patientValidationErrors[activePatient.id]?.includes("bpm") ? (
                      <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="oxygenSaturation" className="block text-xs font-semibold text-gray-600 mb-1">
                      O₂ Saturation (%)
                    </Label>
                    <Input
                      id="oxygenSaturation"
                      value={activePatient?.oxygenSaturation ?? ""}
                      onChange={(event) => handlePatientChange(activePatient.id, "oxygenSaturation", event.target.value)}
                      required
                    />
                    {patientValidationErrors[activePatient.id]?.includes("oxygenSaturation") ? (
                      <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="painScale" className="block text-xs font-semibold text-gray-600 mb-1">
                      Pain (1-10)
                    </Label>
                    <Input
                      id="painScale"
                      type="number"
                      min="0"
                      max="10"
                      value={activePatient?.painScale ?? ""}
                      onChange={(event) => handlePatientChange(activePatient.id, "painScale", event.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                      required
                    />
                    {patientValidationErrors[activePatient.id]?.includes("painScale") ? (
                      <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="temperature" className="block text-xs font-semibold text-gray-600 mb-1">
                      Temperature (°C)
                    </Label>
                    <Input
                      id="temperature"
                      value={activePatient?.temperature ?? ""}
                      onChange={(event) => handlePatientChange(activePatient.id, "temperature", event.target.value)}
                      required
                    />
                    {patientValidationErrors[activePatient.id]?.includes("temperature") ? (
                      <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                    ) : null}
                  </div>
                  <div>
                    <Label htmlFor="respiratoryRate" className="block text-xs font-semibold text-gray-600 mb-1">
                      Respiratory Rate (RR)
                    </Label>
                    <Input
                      id="respiratoryRate"
                      value={activePatient?.respiratoryRate ?? ""}
                      onChange={(event) => handlePatientChange(activePatient.id, "respiratoryRate", event.target.value)}
                      required
                    />
                    {patientValidationErrors[activePatient.id]?.includes("respiratoryRate") ? (
                      <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <Label className="block text-xs font-semibold text-gray-600 mb-1">Blood Loss</Label>
                  <div className="flex flex-wrap gap-2">
                    {["Major", "Minor", "None"].map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant={activePatient?.bloodLossLevel === option ? "default" : "outline"}
                        className={cn(
                          "px-4",
                          activePatient?.bloodLossLevel === option
                            ? "bg-orange-500 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-50",
                        )}
                        onClick={() => handlePatientChange(activePatient.id, "bloodLossLevel", option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                  {patientValidationErrors[activePatient.id]?.includes("bloodLossLevel") ? (
                    <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                  ) : null}
                </div>

                <div>
                  <Label htmlFor="estimatedBloodLoss" className="block text-xs font-semibold text-gray-600 mb-1">
                    Estimated Quantity (Liters)
                  </Label>
                  <Input
                    id="estimatedBloodLoss"
                    value={activePatient?.estimatedBloodLoss ?? ""}
                    onChange={(event) => handlePatientChange(activePatient.id, "estimatedBloodLoss", event.target.value)}
                    placeholder="e.g. 0.5"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <div className="min-w-0">
                <Label htmlFor="receivingHospital" className="block text-sm font-medium text-gray-700 mb-1">
                  Receiving Hospital
                </Label>
                <Select
                  value={activePatient?.receivingHospitalId}
                  onValueChange={(value) => handlePatientChange(activePatient.id, "receivingHospitalId", value)}
                  required
                >
                  <SelectTrigger id="receivingHospital" className="w-full max-w-full truncate">
                    <SelectValue placeholder="Select hospital" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto w-[var(--radix-select-trigger-width)]">
                    {hospitals.map((hospital) => (
                      <SelectItem key={hospital.id} value={hospital.id} className="whitespace-normal break-words">
                        {hospital.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {patientValidationErrors[activePatient.id]?.includes("receivingHospitalId") ? (
                  <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                ) : null}
              </div>
              <div className="min-w-0">
                <Label htmlFor="turnoverInCharge" className="block text-sm font-medium text-gray-700 mb-1">
                  Turnover In-Charge
                </Label>
                <Input
                  id="turnoverInCharge"
                  value={activePatient?.turnoverInCharge ?? ""}
                  onChange={(event) => handlePatientChange(activePatient.id, "turnoverInCharge", event.target.value)}
                  required
                />
                {patientValidationErrors[activePatient.id]?.includes("turnoverInCharge") ? (
                  <p className="text-xs text-red-500 mt-1">{REQUIRED_FIELD_LABEL}</p>
                ) : null}
              </div>
              <DatePickerField
                id="receivingDate"
                label="Receiving Date"
                value={activePatient?.receivingDate ?? ""}
                onChange={(next) => handlePatientChange(activePatient.id, "receivingDate", next)}
                required
                error={patientValidationErrors[activePatient.id]?.includes("receivingDate")}
              />
              <DatePickerField
                id="emtErtDate"
                label="EMT/ERT Date"
                value={activePatient?.emtErtDate ?? ""}
                onChange={(next) => handlePatientChange(activePatient.id, "emtErtDate", next)}
                required
                error={patientValidationErrors[activePatient.id]?.includes("emtErtDate")}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )

  const renderInjuryStep = () => (
    <>
      <div className="flex items-center justify-between bg-white border rounded-md px-4 py-3 shadow-sm sticky top-[88px] z-10">
        <div className="flex items-center gap-3 text-sm font-semibold text-gray-700">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white">3</span>
          Injuries & Body Diagram
        </div>
        <div className="text-xs text-gray-500">
          Select a patient to continue marking injuries on the diagram.
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-800">Patients</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {patients.map((patient, index) => (
              <Button
                key={patient.id}
                type="button"
                variant={patient.id === activePatientId ? "default" : "outline"}
                className="justify-start"
                onClick={() => setActivePatientId(patient.id)}
              >
                Patient {index + 1}: {patient.patientName || "Unnamed"}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-800">Body Diagram</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Front</h3>
              <InteractiveBodyDiagram
                view="front"
                svgPath={FRONT_SVG_PATH}
                regionIds={FRONT_BODY_REGION_IDS}
                selectedRegions={Object.keys(activePatient?.bodyPartInjuries ?? {})}
                regionColors={FRONT_BODY_REGION_IDS.reduce<Record<string, string>>((acc, part) => {
                  const injuries = activePatient?.bodyPartInjuries[part] ?? []
                  if (injuries.length > 0) {
                    const color = injuries.map((code) => INJURY_TYPE_COLOR_MAP[code] ?? REGION_SELECTED_FILL)
                    acc[part] = tinycolor.mix(color[0], color[color.length - 1] ?? color[0], 60 / Math.max(color.length - 1, 1)).toHexString()
                  }
                  return acc
                }, {})}
                onRegionSelect={(regionId) => handleOpenInjuryDialog(activePatient.id, regionId, "front")}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Back</h3>
              <InteractiveBodyDiagram
                view="back"
                svgPath={BACK_SVG_PATH}
                regionIds={BACK_BODY_REGION_IDS}
                selectedRegions={Object.keys(activePatient?.bodyPartInjuries ?? {})}
                regionColors={BACK_BODY_REGION_IDS.reduce<Record<string, string>>((acc, part) => {
                  const injuries = activePatient?.bodyPartInjuries[part] ?? []
                  if (injuries.length > 0) {
                    const color = injuries.map((code) => INJURY_TYPE_COLOR_MAP[code] ?? REGION_SELECTED_FILL)
                    acc[part] = tinycolor.mix(color[0], color[color.length - 1] ?? color[0], 60 / Math.max(color.length - 1, 1)).toHexString()
                  }
                  return acc
                }, {})}
                onRegionSelect={(regionId) => handleOpenInjuryDialog(activePatient.id, regionId, "back")}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )

  const renderSummarySidebar = () => (
    <Card className="shadow-lg xl:sticky xl:top-6 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
      <CardHeader className="bg-white border-b py-3">
        <CardTitle className="text-sm font-semibold text-gray-800">Submission Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 py-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Incident</h3>
          <dl className="mt-2 space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <dt>Date</dt>
              <dd>{incidentDate ? formatDateValue(incidentDate) : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Time</dt>
              <dd>{incidentTime || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Type</dt>
              <dd>{incidentTypes.find((type) => String(type.id) === incidentTypeId)?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Barangay</dt>
              <dd>{barangays.find((barangay) => String(barangay.id) === barangayId)?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>ER Team</dt>
              <dd>{erTeams.find((team) => String(team.id) === erTeamId)?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Prepared by</dt>
              <dd>{preparedBy || "—"}</dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700">Patients</h3>
          <div className="mt-2 space-y-3">
            {patients.map((patient, index) => renderPatientSummary(patient, index))}
          </div>
        </div>

        {formMessage ? (
          <div
            className={cn(
              "rounded-md px-3 py-2 text-sm",
              formMessage.type === "success"
                ? "bg-green-50 text-green-700 border border-green-300"
                : "bg-red-50 text-red-700 border border-red-300",
            )}
          >
            {formMessage.text}
          </div>
        ) : null}

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-700">Narrative Report</h3>
          <Textarea
            value={narrativeText}
            onChange={(event) => setNarrativeText(event.target.value)}
            rows={8}
            placeholder="Narrative report will generate as incident and patient details are provided."
            className="mt-2 resize-none text-xs leading-relaxed"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleStepBack}
            disabled={step === 1 || isLoading || isSubmitting}
          >
            Back
          </Button>
          {step < 3 ? (
            <Button
              type="button"
              onClick={() => {
                handleStepNext()
              }}
              disabled={isLoading || isSubmitting}
            >
              Next
            </Button>
          ) : (
            <Button form="make-report-form" type="submit" disabled={isLoading || isSubmitting}>
              {isLoading || isSubmitting ? "Submitting…" : "Submit report"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="shadow-lg h-full rounded-lg">
        <CardHeader className="bg-orange-600 text-white rounded-t-lg p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-2xl font-bold">
              {selectedReport ? `Create Report for Incident ID: ${selectedReport.id.substring(0, 8)}…` : "Create New Incident Report"}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0 bg-white rounded-b-lg">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 sticky top-0 z-10 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {stepDescriptors.map(renderStepPill)}
            </div>
          </div>

          <form id="make-report-form" onSubmit={handleSubmit} className="p-6 space-y-6">
            {step === 1 ? renderIncidentStep() : null}
            {step === 2 ? renderPatientStep() : null}
            {step === 3 ? renderInjuryStep() : null}
          </form>
        </CardContent>
      </Card>

      {renderSummarySidebar()}

      <Dialog open={Boolean(injuryDialog)} onOpenChange={(open) => !open && handleCancelInjurySelection()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {injuryDialog ? `Select injuries for ${REGION_LABELS[injuryDialog.regionId] ?? injuryDialog.regionId}` : "Select injuries"}
            </DialogTitle>
            <DialogDescription>
              Choose all applicable injury types for this region.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {INJURY_TYPE_OPTIONS.map((option) => {
                const isSelected = pendingInjurySelection.includes(option.code)
                return (
                  <Button
                    key={option.code}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "justify-start",
                      isSelected
                        ? "bg-orange-500 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50",
                    )}
                    onClick={() => {
                      setPendingInjurySelection((prev) => {
                        if (prev.includes(option.code)) {
                          return prev.filter((code) => code !== option.code)
                        }
                        return [...prev, option.code]
                      })
                    }}
                  >
                    <span
                      className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full"
                      style={{ backgroundColor: INJURY_TYPE_COLOR_MAP[option.code], color: "#fff" }}
                    >
                      {option.code}
                    </span>
                    {option.label}
                  </Button>
                )
              })}
            </div>
            {injurySelectionError ? (
              <p className="text-xs text-red-500">{injurySelectionError}</p>
            ) : null}
          </div>
          <DialogFooter className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleClearInjurySelection}>
              Clear region
            </Button>
            <Button type="button" variant="outline" onClick={handleCancelInjurySelection}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirmInjurySelection}>
              Save selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit internal report?</DialogTitle>
            <DialogDescription>
              You are about to submit this incident as an internal report. Review all details before confirming.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)} disabled={isLoading || isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSubmit} disabled={isLoading || isSubmitting}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Internal report submitted</DialogTitle>
            <DialogDescription>
              The internal report has been recorded successfully. Choose what to do next.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsSuccessDialogOpen(false)
                if (typeof window !== "undefined") {
                  window.close()
                }
              }}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setIsSuccessDialogOpen(false)
                handleAddPatient()
                setStep(2)
              }}
            >
              Add new patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

}
