let adminCsrfToken = ""

export function setAdminCsrfToken(value: string | undefined) {
  adminCsrfToken = value?.trim() ?? ""
}

export function getAdminCsrfToken() {
  return adminCsrfToken
}

export function clearAdminCsrfToken() {
  adminCsrfToken = ""
}
