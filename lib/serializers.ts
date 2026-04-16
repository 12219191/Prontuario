import { AppointmentStatus, MediaContext, TimelineEventType } from "@prisma/client";

type JsonValue = string[];

export function parseJsonArray(raw: string | null | undefined): JsonValue {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function formatDateTime(date: Date | null | undefined) {
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

export function mapAppointmentStatus(status: AppointmentStatus) {
  const dictionary: Record<AppointmentStatus, string> = {
    SCHEDULED: "Agendado",
    IN_PROGRESS: "Em atendimento",
    DRAFT: "Rascunho",
    PENDING_DOCUMENTATION: "Pendente de documentacao",
    COMPLETED: "Concluido",
    CLOSED: "Encerrado",
    CANCELLED: "Cancelado"
  };
  return dictionary[status];
}

export function mapTimelineType(type: TimelineEventType) {
  const dictionary: Record<TimelineEventType, string> = {
    CONSULTATION: "consulta",
    EVOLUTION: "evolucao",
    EXAM: "exame",
    PHOTO: "foto",
    PROCEDURE: "procedimento",
    PRESCRIPTION: "prescricao",
    DOCUMENT: "documento",
    CONSENT: "consentimento",
    DISCHARGE: "alta",
    RETURN: "retorno",
    OPERATIONAL_NOTE: "observacao_operacional"
  };
  return dictionary[type];
}

export function mapMediaContext(context: MediaContext) {
  const dictionary: Record<MediaContext, string> = {
    PHYSICAL_EXAM: "exame_fisico",
    EVOLUTION: "evolucao",
    PROCEDURE: "procedimento",
    COMPARISON: "comparacao",
    SUPPORTING_DOCUMENT: "documento"
  };
  return dictionary[context];
}
