import { UserRole } from "@prisma/client";

export type Permission =
  | "view_operational_context"
  | "view_clinical_chart"
  | "edit_chart"
  | "upload_media"
  | "manage_consents"
  | "finalize_appointment"
  | "view_audit"
  | "view_financial_context";

const permissionMap: Record<UserRole, Permission[]> = {
  RECEPTION: ["view_operational_context"],
  CLINICAL_ASSISTANT: [
    "view_operational_context",
    "view_clinical_chart",
    "upload_media",
    "manage_consents",
    "view_financial_context"
  ],
  CLINICIAN: [
    "view_operational_context",
    "view_clinical_chart",
    "edit_chart",
    "upload_media",
    "manage_consents",
    "finalize_appointment",
    "view_financial_context"
  ],
  ADMIN: [
    "view_operational_context",
    "view_clinical_chart",
    "edit_chart",
    "upload_media",
    "manage_consents",
    "finalize_appointment",
    "view_audit",
    "view_financial_context"
  ]
};

export function getRolePermissions(role: UserRole) {
  return permissionMap[role];
}

export function hasPermission(role: UserRole, permission: Permission) {
  return permissionMap[role].includes(permission);
}
