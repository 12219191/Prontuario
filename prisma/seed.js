const { PrismaClient, UserRole, AppointmentStatus, TimelineEventType, MediaContext } = require("@prisma/client");
const { randomBytes, scryptSync } = require("node:crypto");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  await prisma.auditTrail.deleteMany();
  await prisma.session.deleteMany();
  await prisma.loginChallenge.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.authRateLimit.deleteMany();
  await prisma.clinicalDocument.deleteMany();
  await prisma.procedure.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.patientExam.deleteMany();
  await prisma.consent.deleteMany();
  await prisma.clinicalMedia.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.professional.deleteMany();

  const clinician = await prisma.professional.create({
    data: {
      name: "Dra. Camila Matos",
      email: "camila@xfts.local",
      passwordHash: hashPassword("Camila@123"),
      role: UserRole.CLINICIAN,
      specialty: "Tricologia",
      phone: "(11) 99911-0001"
    }
  });

  const assistant = await prisma.professional.create({
    data: {
      name: "Assistente Laura",
      email: "laura@xfts.local",
      passwordHash: hashPassword("Laura@123"),
      role: UserRole.CLINICAL_ASSISTANT,
      specialty: "Apoio assistencial"
    }
  });

  const reception = await prisma.professional.create({
    data: {
      name: "Recepcao Marina",
      email: "marina@xfts.local",
      passwordHash: hashPassword("Marina@123"),
      role: UserRole.RECEPTION,
      specialty: "Operacao"
    }
  });

  const admin = await prisma.professional.create({
    data: {
      name: "Gestor Rafael",
      email: "rafael@xfts.local",
      passwordHash: hashPassword("Rafael@123"),
      role: UserRole.ADMIN,
      specialty: "Administracao"
    }
  });

  const patient = await prisma.patient.create({
    data: {
      code: "PAC-2026-00128",
      fullName: "Helena Costa",
      age: 36,
      sex: "Feminino",
      phone: "(11) 99988-4412",
      paymentModel: "Particular",
      treatmentStatus: "Plano capilar em acompanhamento",
      chiefComplaint: "Queda capilar difusa ha 4 meses",
      allergies: JSON.stringify(["Dipirona", "Latex"]),
      alerts: JSON.stringify(["Uso de isotretinoina recente", "Consentimento de imagem expira em 3 dias"]),
      tags: JSON.stringify(["Tricologia", "Comparacao fotografica", "Retorno"]),
      lastVisitAt: new Date("2026-04-02T14:30:00"),
      nextVisitAt: new Date("2026-05-03T10:00:00")
    }
  });

  const appointment = await prisma.appointment.create({
    data: {
      patientId: patient.id,
      professionalId: clinician.id,
      source: "Agenda",
      status: AppointmentStatus.IN_PROGRESS,
      specialty: "Tricologia",
      financialContext: "Pacote ativo 6 sessoes",
      scheduledAt: new Date("2026-04-16T09:00:00"),
      anamnesisChiefComplaint: "Queda capilar aumentada e afinamento progressivo.",
      anamnesisHistory: "Paciente relata piora apos periodo de estresse intenso e dieta restritiva.",
      systemsReview: "Sem febre, sem perda ponderal relevante, refere fadiga ocasional.",
      personalHistory: "Anemia ferripriva previa, uso irregular de suplementos.",
      familyHistory: "Mae com alopecia androgenetica.",
      habitsContext: "Sono irregular, ingestao hidrica baixa, atividade fisica 2x por semana.",
      bloodPressure: "110/70",
      heartRate: "76",
      weight: "62",
      height: "1.68",
      physicalExamFindings: "Rarefacao em regiao parietal, sem placas cicatriciais.",
      skinExamFindings: "Pele integra, sem lesoes inflamatorias relevantes.",
      additionalExamNotes: "Pull test discretamente positivo.",
      diagnosticHypotheses: JSON.stringify(["Efluvio telogeno", "Alopecia androgenetica feminina"]),
      mainDiagnosis: "Efluvio telogeno",
      associatedDiagnoses: "Deficiencia nutricional em investigacao",
      diagnosticNotes: "Correlacionar com ferritina, vitamina D e perfil hormonal.",
      prescriptionPlan: "Minoxidil topico 5% 1x ao dia por 90 dias. Suplementacao apos resultados laboratoriais.",
      procedurePlan: "Fototricograma digital e captacao padronizada de imagens.",
      guidancePlan: "Orientado sobre adesao, nutricao e retorno em 30 dias com exames.",
      referralPlan: "Solicitado parecer nutricional se mantida restricao alimentar.",
      finalGuidance: "Retorno com exames e manutencao das fotos de seguimento.",
      returnSuggestion: "30 dias",
      dischargeType: "encerramento_atendimento",
      summary: "Consulta de retorno com manutencao de conduta e investigacao laboratorial complementar."
    }
  });

  await prisma.timelineEvent.createMany({
    data: [
      {
        patientId: patient.id,
        appointmentId: appointment.id,
        type: TimelineEventType.CONSULTATION,
        title: "Consulta de retorno",
        description: "Reavaliacao clinica com foco em adesao e resposta ao tratamento.",
        eventAt: new Date("2026-04-16T09:00:00"),
        professional: clinician.name,
        treatmentLabel: "Plano capilar"
      },
      {
        patientId: patient.id,
        appointmentId: appointment.id,
        type: TimelineEventType.PHOTO,
        title: "Upload de foto clinica",
        description: "Imagem vinculada ao exame fisico do retorno.",
        eventAt: new Date("2026-04-16T09:18:00"),
        professional: assistant.name,
        treatmentLabel: "Plano capilar"
      },
      {
        patientId: patient.id,
        appointmentId: appointment.id,
        type: TimelineEventType.PRESCRIPTION,
        title: "Prescricao ativa",
        description: "Minoxidil topico 5% mantido por 90 dias.",
        eventAt: new Date("2026-04-02T15:18:00"),
        professional: clinician.name,
        treatmentLabel: "Plano capilar"
      }
    ]
  });

  await prisma.clinicalMedia.createMany({
    data: [
      {
        patientId: patient.id,
        appointmentId: appointment.id,
        uploadedById: clinician.id,
        title: "Baseline frontal",
        caption: "Registro inicial frontal com luz controlada.",
        treatmentLabel: "Plano capilar",
        context: MediaContext.COMPARISON,
        imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
        consentLinked: true
      },
      {
        patientId: patient.id,
        appointmentId: appointment.id,
        uploadedById: assistant.id,
        title: "Vertex retorno",
        caption: "Captura do vertex no retorno de 30 dias.",
        treatmentLabel: "Plano capilar",
        context: MediaContext.PHYSICAL_EXAM,
        imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
        consentLinked: true
      }
    ]
  });

  await prisma.consent.createMany({
    data: [
      {
        patientId: patient.id,
        appointmentId: appointment.id,
        professionalId: assistant.id,
        type: "Uso de imagem",
        version: "v3.2",
        linkedTo: "Tratamento capilar",
        status: "Expirando",
        validUntil: new Date("2026-04-19T00:00:00"),
        signedAt: new Date("2026-01-10T11:12:00")
      },
      {
        patientId: patient.id,
        appointmentId: appointment.id,
        professionalId: clinician.id,
        type: "Tratamento",
        version: "v2.1",
        linkedTo: "Plano capilar",
        status: "Valido",
        validUntil: new Date("2026-10-02T00:00:00"),
        signedAt: new Date("2026-04-02T14:10:00")
      }
    ]
  });

  await prisma.patientExam.createMany({
    data: [
      {
        patientId: patient.id,
        appointmentId: appointment.id,
        type: "Ferritina",
        origin: "Lab Mais Vida",
        resultSummary: "31 ng/mL",
        clinicalNote: "Baixo-normal para contexto de queda capilar.",
        examDate: new Date("2026-03-29T08:20:00")
      },
      {
        patientId: patient.id,
        appointmentId: appointment.id,
        type: "Vitamina D",
        origin: "Lab Mais Vida",
        resultSummary: "24 ng/mL",
        clinicalNote: "Deficiencia leve.",
        examDate: new Date("2026-03-29T08:20:00")
      }
    ]
  });

  await prisma.prescription.create({
    data: {
      patientId: patient.id,
      appointmentId: appointment.id,
      name: "Minoxidil topico 5%",
      dosage: "Aplicar 1 mL no couro cabeludo 1x ao dia.",
      startedAt: new Date("2026-04-02T00:00:00"),
      notes: "Confirmar alergias antes da dispensacao."
    }
  });

  await prisma.procedure.create({
    data: {
      patientId: patient.id,
      appointmentId: appointment.id,
      name: "Fototricograma digital",
      area: "Couro cabeludo",
      notes: "Vinculado ao atendimento atual.",
      financialLink: "PACOTE-TRICO-06",
      performedAt: new Date("2026-04-16T09:20:00")
    }
  });

  await prisma.clinicalDocument.createMany({
    data: [
      {
        patientId: patient.id,
        appointmentId: appointment.id,
        title: "Resumo da consulta anterior",
        type: "Resumo clinico"
      },
      {
        patientId: patient.id,
        appointmentId: appointment.id,
        title: "Solicitacao de exames laboratoriais",
        type: "Documento clinico"
      }
    ]
  });

  await prisma.auditTrail.createMany({
    data: [
      {
        patientId: patient.id,
        appointmentId: appointment.id,
        actorId: clinician.id,
        entityName: "Appointment",
        fieldName: "mainDiagnosis",
        previousValue: "Hipotese em investigacao",
        nextValue: "Efluvio telogeno"
      },
      {
        patientId: patient.id,
        appointmentId: appointment.id,
        actorId: assistant.id,
        entityName: "ClinicalMedia",
        fieldName: "caption",
        previousValue: null,
        nextValue: "Captura do vertex no retorno de 30 dias."
      }
    ]
  });

  await prisma.session.createMany({
    data: [
      {
        token: "session-camila-bootstrap",
        professionalId: clinician.id,
        expiresAt: new Date("2027-12-31T23:59:59")
      },
      {
        token: "session-laura-bootstrap",
        professionalId: assistant.id,
        expiresAt: new Date("2027-12-31T23:59:59")
      },
      {
        token: "session-marina-bootstrap",
        professionalId: reception.id,
        expiresAt: new Date("2027-12-31T23:59:59")
      },
      {
        token: "session-rafael-bootstrap",
        professionalId: admin.id,
        expiresAt: new Date("2027-12-31T23:59:59")
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
