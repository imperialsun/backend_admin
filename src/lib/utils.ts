import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function todayDayString() {
  return new Date().toISOString().slice(0, 10)
}

export function daysAgoDayString(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

export function nowIsoString() {
  return new Date().toISOString()
}

export function hoursAgoIsoString(hours: number) {
  const date = new Date()
  date.setTime(date.getTime() - hours * 60 * 60 * 1000)
  return date.toISOString()
}

function parseDateTimeLikeValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [yearText, monthText, dayText] = trimmed.split("-")
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null
    }
    return new Date(year, month - 1, day, 0, 0, 0, 0)
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function formatTimeLocalInput(value: string) {
  const date = parseDateTimeLikeValue(value)
  if (!date) {
    return ""
  }
  const pad = (input: number) => String(input).padStart(2, "0")
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function applyTimeToIso(referenceValue: string, timeValue: string) {
  const referenceDate = parseDateTimeLikeValue(referenceValue)
  if (!referenceDate) {
    return ""
  }

  const trimmed = timeValue.trim()
  if (!trimmed) {
    return ""
  }

  const [hoursText, minutesText] = trimmed.split(":")
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return ""
  }

  referenceDate.setHours(hours, minutes, 0, 0)
  return referenceDate.toISOString()
}

export function advanceIsoByDays(value: string, days: number) {
  const date = parseDateTimeLikeValue(value)
  if (!date || !Number.isFinite(days)) {
    return ""
  }

  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export function formatDay(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00Z`))
}

export function toTitleCase(value: string) {
  return value
    .split(/[_\-.]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
