import { AppointmentStatus, MediaContext, TimelineEventType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRolePermissions, hasPermission } from "@/lib/permissions";
import {
  formatDateTime,
  mapAppointmentStatus,
  mapMediaContext,
  mapTimelineType,
  parseJsonArray
} from "@/lib/serializers";

export async function getDashboardData(role: UserRole = UserRole.CLINICIAN) {
  const patient = await prisma.patient.findFirst({
    include: {
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 1,
        include: { professional: true }
      },
      timelineEvents: {
        orderBy: { eventAt: "desc" },
        take: 5
      },
      media: { orderBy: { createdAt: "desc" }, take: 2 },
      consents: { orderBy: { signedAt: "desc" } }
    }
  });

  if (!patient) return null;

  const appointment = patient.appointments[0];
  const expiringConsent = patient.consents.find((item) => item.status === "Expirando");

  return {
    patientId: patient.id,
    patientName: patient.fullName,
    status: appointment ? mapAppointmentStatus(appointment.status) : "Sem atendimento",
    lastVisit: formatDateTime(patient.lastVisitAt),
    nextVisit: formatDateTime(patient.nextVisitAt),
    activeAlerts: parseJsonArray(patient.alerts),
    allergies: parseJsonArray(patient.allergies),
    expiringConsent: expiringConsent
      ? {
          type: expiringConsent.type,
          validUntil: formatDateTime(expiringConsent.validUntil)
        }
      : null,
    timeline: patient.timelineEvents.map((event) => ({
      id: event.id,
      type: mapTimelineType(event.type),
      title: event.title,
      description: event.description,
      date: formatDateTime(event.eventAt),
      professional: event.professional
    })),
    mediaCount: hasPermission(role, "view_clinical_chart") ? patient.media.length : 0
  };
}

export async function getPatientChart(patientId: string, role: UserRole = UserRole.CLINICIAN) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 1,
        include: { professional: true }
      },
      media: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: true }
      },
      consents: {
        orderBy: { signedAt: "desc" },
        include: { professional: true }
      },
      exams: { orderBy: { examDate: "desc" } },
      prescriptions: { orderBy: { startedAt: "desc" } },
      procedures: { orderBy: { performedAt: "desc" } },
      clinicalDocuments: { orderBy: { createdAt: "desc" } },
      timelineEvents: { orderBy: { eventAt: "desc" } },
      auditEntries: {
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { actor: true }
      }
    }
  });

  if (!patient) return null;

  const appointment = patient.appointments[0];
  const canViewClinical = hasPermission(role, "view_clinical_chart");
  const canViewAudit = hasPermission(role, "view_audit");
  const canViewFinancial = hasPermission(role, "view_financial_context");
  const pendingItems = [
    { label: "Confirmar renovacao do consentimento de imagem", critical: true },
    { label: "Anexar ferritina e vitamina D solicitadas", critical: false },
    { label: "Validar area do procedimento no financeiro", critical: false }
  ];

  return {
    patient: {
      id: patient.id,
      code: patient.code,
      name: patient.fullName,
      age: patient.age,
      sex: patient.sex,
      phone: patient.phone,
      paymentModel: patient.paymentModel,
      treatmentStatus: patient.treatmentStatus,
      complaint: patient.chiefComplaint,
      lastVisit: formatDateTime(patient.lastVisitAt),
      nextVisit: formatDateTime(patient.nextVisitAt),
      allergies: parseJsonArray(patient.allergies),
      alerts: parseJsonArray(patient.alerts),
      tags: parseJsonArray(patient.tags)
    },
    appointment: appointment
      ? {
          id: appointment.id,
          professionalId: appointment.professionalId,
          source: appointment.source,
          status: mapAppointmentStatus(appointment.status),
          rawStatus: appointment.status,
          specialty: appointment.specialty,
          financialContext: canViewFinancial ? appointment.financialContext : null,
          scheduledAt: formatDateTime(appointment.scheduledAt),
          professional: appointment.professional.name,
          anamnesis: {
            chiefComplaint: canViewClinical ? appointment.anamnesisChiefComplaint ?? "" : "",
            history: canViewClinical ? appointment.anamnesisHistory ?? "" : "",
            systemsReview: canViewClinical ? appointment.systemsReview ?? "" : "",
            personalHistory: canViewClinical ? appointment.personalHistory ?? "" : "",
            familyHistory: canViewClinical ? appointment.familyHistory ?? "" : "",
            habits: canViewClinical ? appointment.habitsContext ?? "" : ""
          },
          exam: {
            bloodPressure: canViewClinical ? appointment.bloodPressure ?? "" : "",
            heartRate: canViewClinical ? appointment.heartRate ?? "" : "",
            weight: canViewClinical ? appointment.weight ?? "" : "",
            height: canViewClinical ? appointment.height ?? "" : "",
            physicalFindings: canViewClinical ? appointment.physicalExamFindings ?? "" : "",
            skinFindings: canViewClinical ? appointment.skinExamFindings ?? "" : "",
            notes: canViewClinical ? appointment.additionalExamNotes ?? "" : ""
          },
          diagnosis: {
            hypotheses: canViewClinical ? parseJsonArray(appointment.diagnosticHypotheses) : [],
            main: canViewClinical ? appointment.mainDiagnosis ?? "" : "",
            associated: canViewClinical ? appointment.associatedDiagnoses ?? "" : "",
            notes: canViewClinical ? appointment.diagnosticNotes ?? "" : ""
          },
          conduct: {
            prescription: canViewClinical ? appointment.prescriptionPlan ?? "" : "",
            procedures: canViewClinical ? appointment.procedurePlan ?? "" : "",
            guidance: canViewClinical ? appointment.guidancePlan ?? "" : "",
            referrals: canViewClinical ? appointment.referralPlan ?? "" : ""
          },
          closure: {
            finalGuidance: canViewClinical ? appointment.finalGuidance ?? "" : "",
            returnSuggestion: canViewClinical ? appointment.returnSuggestion ?? "" : "",
            dischargeType: canViewClinical ? appointment.dischargeType ?? "encerramento_atendimento" : "encerramento_atendimento",
            summary: canViewClinical ? appointment.summary ?? "" : ""
          }
        }
      : null,
    pendingItems,
    media: canViewClinical ? patient.media.map((item) => ({
      id: item.id,
      title: item.title,
      caption: item.caption,
      treatmentLabel: item.treatmentLabel,
      context: mapMediaContext(item.context),
      imageUrl: item.imageUrl,
      consentLinked: item.consentLinked,
      createdAt: formatDateTime(item.createdAt),
      author: item.uploadedBy.name
    })) : [],
    consents: canViewClinical ? patient.consents.map((item) => ({
      id: item.id,
      type: item.type,
      version: item.version,
      linkedTo: item.linkedTo,
      status: item.status,
      validUntil: formatDateTime(item.validUntil),
      signedAt: formatDateTime(item.signedAt),
      professional: item.professional.name
    })) : [],
    exams: canViewClinical ? patient.exams.map((item) => ({
      id: item.id,
      type: item.type,
      origin: item.origin,
      result: item.resultSummary,
      note: item.clinicalNote,
      date: formatDateTime(item.examDate)
    })) : [],
    prescriptions: canViewClinical ? patient.prescriptions.map((item) => ({
      id: item.id,
      name: item.name,
      dosage: item.dosage,
      notes: item.notes,
      startedAt: formatDateTime(item.startedAt)
    })) : [],
    procedures: canViewClinical ? patient.procedures.map((item) => ({
      id: item.id,
      name: item.name,
      area: item.area,
      notes: item.notes,
      financialLink: item.financialLink,
      performedAt: formatDateTime(item.performedAt)
    })) : [],
    documents: canViewClinical ? patient.clinicalDocuments.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      createdAt: formatDateTime(item.createdAt)
    })) : [],
    timeline: patient.timelineEvents
      .filter((item) => canViewClinical || ["CONSULTATION", "RETURN", "OPERATIONAL_NOTE"].includes(item.type))
      .map((item) => ({
      id: item.id,
      type: mapTimelineType(item.type),
      title: item.title,
      description: item.description,
      date: formatDateTime(item.eventAt),
      professional: item.professional,
      treatment: item.treatmentLabel
    })),
    audit: canViewAudit ? patient.auditEntries.map((item) => ({
      id: item.id,
      actor: item.actor?.name ?? "Sistema",
      entityName: item.entityName,
      fieldName: item.fieldName,
      previousValue: item.previousValue,
      nextValue: item.nextValue,
      createdAt: formatDateTime(item.createdAt)
    })) : [],
    session: {
      role,
      permissions: getRolePermissions(role)
    }
  };
}

export async function updateAppointmentChart(
  appointmentId: string,
  payload: {
    anamnesis?: Record<string, string>;
    exam?: Record<string, string>;
    diagnosis?: { hypotheses?: string[]; main?: string; associated?: string; notes?: string };
    conduct?: Record<string, string>;
    closure?: { finalGuidance?: string; returnSuggestion?: string; dischargeType?: string; summary?: string };
    finalize?: boolean;
  }
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, professional: true }
  });

  if (!appointment) {
    throw new Error("Atendimento nao encontrado.");
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: payload.finalize ? AppointmentStatus.COMPLETED : AppointmentStatus.DRAFT,
      anamnesisChiefComplaint: payload.anamnesis?.chiefComplaint,
      anamnesisHistory: payload.anamnesis?.history,
      systemsReview: payload.anamnesis?.systemsReview,
      personalHistory: payload.anamnesis?.personalHistory,
      familyHistory: payload.anamnesis?.familyHistory,
      habitsContext: payload.anamnesis?.habits,
      bloodPressure: payload.exam?.bloodPressure,
      heartRate: payload.exam?.heartRate,
      weight: payload.exam?.weight,
      height: payload.exam?.height,
      physicalExamFindings: payload.exam?.physicalFindings,
      skinExamFindings: payload.exam?.skinFindings,
      additionalExamNotes: payload.exam?.notes,
      diagnosticHypotheses: payload.diagnosis?.hypotheses
        ? JSON.stringify(payload.diagnosis.hypotheses)
        : undefined,
      mainDiagnosis: payload.diagnosis?.main,
      associatedDiagnoses: payload.diagnosis?.associated,
      diagnosticNotes: payload.diagnosis?.notes,
      prescriptionPlan: payload.conduct?.prescription,
      procedurePlan: payload.conduct?.procedures,
      guidancePlan: payload.conduct?.guidance,
      referralPlan: payload.conduct?.referrals,
      finalGuidance: payload.closure?.finalGuidance,
      returnSuggestion: payload.closure?.returnSuggestion,
      dischargeType: payload.closure?.dischargeType,
      summary: payload.closure?.summary
    }
  });

  await prisma.auditTrail.create({
    data: {
      patientId: appointment.patientId,
      appointmentId: appointment.id,
      actorId: appointment.professionalId,
      entityName: "Appointment",
      fieldName: "chartDraft",
      previousValue: "draft_previous",
      nextValue: "draft_saved"
    }
  });

  return updated;
}

export async function createMedia(
  patientId: string,
  payload: {
    appointmentId: string;
    uploadedById: string;
    title: string;
    caption: string;
    treatmentLabel?: string;
    context: keyof typeof MediaContext;
    imageUrl: string;
    consentLinked: boolean;
  }
) {
  if (!payload.caption.trim() || !payload.title.trim()) {
    throw new Error("Titulo e legenda sao obrigatorios.");
  }

  if (!payload.consentLinked) {
    throw new Error("Consentimento valido e obrigatorio para concluir o upload.");
  }

  const created = await prisma.clinicalMedia.create({
    data: {
      patientId,
      appointmentId: payload.appointmentId,
      uploadedById: payload.uploadedById,
      title: payload.title,
      caption: payload.caption,
      treatmentLabel: payload.treatmentLabel,
      context: MediaContext[payload.context],
      imageUrl: payload.imageUrl,
      consentLinked: payload.consentLinked
    },
    include: { uploadedBy: true }
  });

  await prisma.timelineEvent.create({
    data: {
      patientId,
      appointmentId: payload.appointmentId,
      type: TimelineEventType.PHOTO,
      title: `Foto clinica: ${payload.title}`,
      description: payload.caption,
      eventAt: new Date(),
      professional: created.uploadedBy.name,
      treatmentLabel: payload.treatmentLabel
    }
  });

  return created;
}

export async function createConsent(
  patientId: string,
  payload: {
    appointmentId: string;
    professionalId: string;
    type: string;
    version: string;
    linkedTo: string;
    status: string;
    validUntil?: string;
  }
) {
  const created = await prisma.consent.create({
    data: {
      patientId,
      appointmentId: payload.appointmentId,
      professionalId: payload.professionalId,
      type: payload.type,
      version: payload.version,
      linkedTo: payload.linkedTo,
      status: payload.status,
      validUntil: payload.validUntil ? new Date(payload.validUntil) : null,
      signedAt: new Date()
    },
    include: { professional: true }
  });

  await prisma.timelineEvent.create({
    data: {
      patientId,
      appointmentId: payload.appointmentId,
      type: TimelineEventType.CONSENT,
      title: "Novo consentimento registrado",
      description: `Termo ${payload.type} vinculado a ${payload.linkedTo}.`,
      eventAt: new Date(),
      professional: created.professional.name,
      treatmentLabel: payload.linkedTo
    }
  });

  return created;
}
