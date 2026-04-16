"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import styles from "./chart-app.module.css";
import { LocalQr } from "@/components/local-qr";
import { CHART_NAV_ITEMS } from "@/lib/constants";

type ChartData = {
  patient: {
    id: string;
    code: string;
    name: string;
    age: number;
    sex: string;
    phone: string;
    paymentModel: string;
    treatmentStatus: string;
    complaint: string;
    lastVisit: string | null;
    nextVisit: string | null;
    allergies: string[];
    alerts: string[];
    tags: string[];
  };
  appointment: {
    id: string;
    professionalId: string;
    source: string;
    status: string;
    rawStatus: string;
    specialty: string;
    financialContext: string | null;
    scheduledAt: string | null;
    professional: string;
    anamnesis: Record<string, string>;
    exam: Record<string, string>;
    diagnosis: { hypotheses: string[]; main: string; associated: string; notes: string };
    conduct: Record<string, string>;
    closure: { finalGuidance: string; returnSuggestion: string; dischargeType: string; summary: string };
  } | null;
  pendingItems: { label: string; critical: boolean }[];
  media: Array<{ id: string; title: string; caption: string; treatmentLabel: string | null; context: string; imageUrl: string; createdAt: string | null; author: string }>;
  consents: Array<{ id: string; type: string; version: string; linkedTo: string; status: string; validUntil: string | null; signedAt: string | null; professional: string }>;
  exams: Array<{ id: string; type: string; origin: string; result: string; note: string; date: string | null }>;
  prescriptions: Array<{ id: string; name: string; dosage: string; notes: string | null; startedAt: string | null }>;
  procedures: Array<{ id: string; name: string; area: string; notes: string | null; financialLink: string | null; performedAt: string | null }>;
  documents: Array<{ id: string; title: string; type: string; createdAt: string | null }>;
  timeline: Array<{ id: string; type: string; title: string; description: string; date: string | null; professional: string; treatment: string | null }>;
  audit: Array<{ id: string; actor: string; fieldName: string; createdAt: string | null }>;
  session: {
    mfaEnabled: boolean;
    role: string;
    permissions: string[];
  };
};

type DashboardData = {
  patientId: string;
  patientName: string;
  status: string;
  activeAlerts: string[];
  expiringConsent: { type: string; validUntil: string | null } | null;
  timeline: Array<{ id: string; type: string; title: string; description: string; date: string | null; professional: string }>;
  mediaCount: number;
};

export function ChartApp({
  initialChart,
  dashboard,
  session
}: {
  initialChart: ChartData;
  dashboard: DashboardData;
  session: {
    professionalId: string;
    professionalName: string;
    mfaEnabled: boolean;
    role: string;
    permissions: string[];
  };
}) {
  const [chart, setChart] = useState(initialChart);
  const [activeSection, setActiveSection] = useState("Resumo");
  const [message, setMessage] = useState("Prontuario carregado com dados persistidos.");
  const [timelineType, setTimelineType] = useState("todos");
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState({
    anamnesis: initialChart.appointment?.anamnesis ?? {},
    exam: initialChart.appointment?.exam ?? {},
    diagnosis: {
      hypotheses: initialChart.appointment?.diagnosis.hypotheses.join(", ") ?? "",
      main: initialChart.appointment?.diagnosis.main ?? "",
      associated: initialChart.appointment?.diagnosis.associated ?? "",
      notes: initialChart.appointment?.diagnosis.notes ?? ""
    },
    conduct: initialChart.appointment?.conduct ?? {},
    closure: initialChart.appointment?.closure ?? {}
  });
  const [newMedia, setNewMedia] = useState({
    title: "",
    caption: "",
    treatmentLabel: "",
    context: "PHYSICAL_EXAM",
    imageUrl: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
    consentLinked: true
  });
  const [newConsent, setNewConsent] = useState({
    type: "Procedimento",
    version: "v1.0-demo",
    linkedTo: "Fototricograma digital",
    status: "Valido",
    validUntil: "2026-10-16"
  });
  const [mfaSetup, setMfaSetup] = useState<null | {
    secret: string;
    otpAuthUrl: string;
    recoveryCodes: string[];
  }>(null);
  const [mfaCode, setMfaCode] = useState("");

  const filteredTimeline = useMemo(
    () => chart.timeline.filter((item) => timelineType === "todos" || item.type === timelineType),
    [chart.timeline, timelineType]
  );
  const canViewClinical = chart.session.permissions.includes("view_clinical_chart");
  const canEditChart = chart.session.permissions.includes("edit_chart");
  const canUploadMedia = chart.session.permissions.includes("upload_media");
  const canManageConsents = chart.session.permissions.includes("manage_consents");
  const canFinalize = chart.session.permissions.includes("finalize_appointment");
  const canViewAudit = chart.session.permissions.includes("view_audit");

  async function refreshChart() {
    const response = await fetch(`/api/patients/${chart.patient.id}/chart`, { cache: "no-store" });

    if (response.status === 401) {
      window.location.reload();
      return;
    }

    const updated = (await response.json()) as ChartData;
    setChart(updated);
  }

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.reload();
  }

  async function prepareMfa() {
    const response = await fetch("/api/auth/mfa");
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message ?? "Nao foi possivel preparar MFA.");
      return;
    }
    setMfaSetup({
      secret: data.secret,
      otpAuthUrl: data.otpAuthUrl,
      recoveryCodes: data.recoveryCodes
    });
    setMessage("Escaneie o segredo TOTP e confirme com um codigo.");
  }

  async function confirmMfa() {
    if (!mfaSetup) return;
    const response = await fetch("/api/auth/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: mfaSetup.secret,
        code: mfaCode,
        recoveryCodes: mfaSetup.recoveryCodes
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.message ?? "Nao foi possivel habilitar MFA.");
      return;
    }
    window.location.reload();
  }

  async function turnOffMfa() {
    const response = await fetch("/api/auth/mfa", { method: "DELETE" });
    const data = response.ok ? null : await response.json();
    if (!response.ok) {
      setMessage(data?.message ?? "Nao foi possivel desabilitar MFA.");
      return;
    }
    window.location.reload();
  }

  function buildSummary() {
    return `Paciente ${chart.patient.name} em acompanhamento por ${chart.patient.treatmentStatus}. Queixa principal: ${draft.anamnesis.chiefComplaint ?? ""} Exame fisico relevante: ${draft.exam.physicalFindings ?? ""} Diagnostico principal: ${draft.diagnosis.main}. Conduta atual: ${draft.conduct.prescription ?? ""} ${draft.conduct.guidance ?? ""}`;
  }

  async function saveDraft(finalize = false) {
    if (!chart.appointment) return;
    if (finalize && chart.pendingItems.some((item) => item.critical)) {
      window.alert("Encerramento bloqueado: existe pendencia critica configurada.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/patients/${chart.patient.id}/chart`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: chart.appointment?.id,
          anamnesis: draft.anamnesis,
          exam: draft.exam,
          diagnosis: {
            hypotheses: draft.diagnosis.hypotheses.split(",").map((item) => item.trim()).filter(Boolean),
            main: draft.diagnosis.main,
            associated: draft.diagnosis.associated,
            notes: draft.diagnosis.notes
          },
          conduct: draft.conduct,
          closure: { ...draft.closure, summary: draft.closure.summary || buildSummary() },
          finalize
        })
      });

      if (response.status === 401) {
        window.location.reload();
        return;
      }

      if (!response.ok) {
        setMessage("Nao foi possivel salvar o atendimento.");
        return;
      }

      await refreshChart();
      setMessage(finalize ? "Atendimento concluido com resumo consolidado." : "Rascunho salvo no banco.");
    });
  }

  async function createMediaRecord() {
    if (!chart.appointment) return;
    const response = await fetch(`/api/patients/${chart.patient.id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: chart.appointment.id,
        uploadedById: chart.appointment.professionalId,
        ...newMedia
      })
    });

    if (response.status === 401) {
      window.location.reload();
      return;
    }

    const data = await response.json();
    if (!response.ok) {
      window.alert(data.message ?? "Erro ao salvar midia.");
      return;
    }

    await refreshChart();
    setNewMedia((current) => ({ ...current, title: "", caption: "", treatmentLabel: "" }));
    setMessage("Midia clinica registrada com rastreabilidade.");
  }

  async function createConsentRecord() {
    if (!chart.appointment) return;
    const response = await fetch(`/api/patients/${chart.patient.id}/consents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: chart.appointment.id,
        professionalId: chart.appointment.professionalId,
        ...newConsent
      })
    });

    if (response.status === 401) {
      window.location.reload();
      return;
    }

    const data = await response.json();
    if (!response.ok) {
      window.alert(data.message ?? "Erro ao registrar consentimento.");
      return;
    }

    await refreshChart();
    setMessage("Consentimento versionado e vinculado ao atendimento.");
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <section className={styles.card}>
          <div className={styles.headerRow}>
            <div>
              <p className={styles.eyebrow}>Paciente em contexto</p>
              <h1 className={styles.title}>{chart.patient.name}</h1>
              <p className={styles.muted}>{chart.patient.code} • {chart.patient.sex} • {chart.patient.age} anos</p>
            </div>
            <div className={styles.badges}>
              {chart.patient.allergies.map((item) => (
                <span key={item} className={`${styles.badge} ${styles.danger}`}>Alergia: {item}</span>
              ))}
              <span className={`${styles.badge} ${styles.warning}`}>{chart.appointment?.status}</span>
            </div>
          </div>
          <div className={styles.grid3}>
            <div><p className={styles.eyebrow}>Contato</p><strong>{chart.patient.phone}</strong></div>
            <div><p className={styles.eyebrow}>Pagamento</p><strong>{chart.patient.paymentModel}</strong></div>
            <div><p className={styles.eyebrow}>Ultimo atendimento</p><strong>{chart.patient.lastVisit ?? "-"}</strong></div>
          </div>
        </section>
        <section className={styles.card}>
          <div className={styles.split}>
            <div>
              <p className={styles.eyebrow}>Tratamento atual</p>
              <h2 className={styles.title}>{chart.patient.treatmentStatus}</h2>
              <p className={styles.muted}>{chart.patient.complaint}</p>
            </div>
            <div className={styles.chips}>
              {chart.patient.tags.map((tag) => <span key={tag} className={styles.chip}>{tag}</span>)}
            </div>
          </div>
          <div className={styles.grid3}>
            <div><p className={styles.eyebrow}>Profissional</p><strong>{chart.appointment?.professional}</strong></div>
            <div><p className={styles.eyebrow}>Origem</p><strong>{chart.appointment?.source}</strong></div>
            <div><p className={styles.eyebrow}>Proximo retorno</p><strong>{chart.patient.nextVisit ?? "-"}</strong></div>
          </div>
        </section>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <p className={styles.eyebrow}>SaaS Clinico</p>
          <h2 className={styles.title}>Prontuario Eletronico</h2>
          <p className={styles.muted}>Timeline clinica, registro guiado e conformidade embutida.</p>
          <nav className={styles.nav}>
            {CHART_NAV_ITEMS.map((item) => (
              <button key={item} type="button" className={`${styles.navButton} ${activeSection === item ? styles.navButtonActive : ""}`} onClick={() => setActiveSection(item)}>
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <main className={styles.surface}>
          <div className={styles.topbar}>
            <div>
              <p className={styles.eyebrow}>Atendimento conectado ao banco</p>
              <h2 className={styles.title}>{activeSection}</h2>
            </div>
            <div className={styles.actions}>
              <span className={styles.status}>{isPending ? "Processando..." : message}</span>
              <button className={styles.ghostButton} type="button" onClick={() => saveDraft(false)} disabled={!canEditChart}>Salvar rascunho</button>
            </div>
          </div>

          {activeSection === "Resumo" && (
            <div className={styles.stack}>
              <section className={styles.hero}>
                <article className={styles.panelCard}>
                  <p className={styles.eyebrow}>Visao executiva</p>
                  <h3 className={styles.title}>Nucleo clinico do atendimento</h3>
                  <div className={styles.grid3}>
                    <div><p className={styles.eyebrow}>Status</p><strong>{dashboard.status}</strong></div>
                    <div><p className={styles.eyebrow}>Midias</p><strong>{dashboard.mediaCount}</strong></div>
                    <div><p className={styles.eyebrow}>Timeline</p><strong>{chart.timeline.length} eventos</strong></div>
                  </div>
                </article>
                <article className={styles.panelCard}>
                  <p className={styles.eyebrow}>Alertas persistentes</p>
                  <ul className={styles.list}>
                    {dashboard.activeAlerts.map((alert) => <li key={alert}>{alert}</li>)}
                  </ul>
                </article>
              </section>
              <section className={styles.grid3}>
                {dashboard.timeline.slice(0, 3).map((event) => (
                  <article key={event.id} className={styles.metricCard}>
                    <p className={styles.eyebrow}>{event.type}</p>
                    <strong>{event.title}</strong>
                    <p className={styles.muted}>{event.description}</p>
                  </article>
                ))}
              </section>
            </div>
          )}

          {activeSection === "Atendimento Atual" && chart.appointment && (
            <div className={`${styles.stack} ${!canViewClinical ? styles.disabledBlock : ""}`}>
              {!canViewClinical && <section className={styles.panelCard}><p className={styles.eyebrow}>Acesso restrito</p><strong>Este perfil nao pode visualizar conteudo clinico sensivel.</strong></section>}
              {canViewClinical && <>
              <section className={styles.formCard}>
                <p className={styles.eyebrow}>Anamnese guiada</p>
                <div className={styles.grid2}>
                  <Field label="Queixa principal" multiline value={draft.anamnesis.chiefComplaint ?? ""} onChange={(value) => setDraft((current) => ({ ...current, anamnesis: { ...current.anamnesis, chiefComplaint: value } }))} />
                  <Field label="Historia da doenca atual" multiline value={draft.anamnesis.history ?? ""} onChange={(value) => setDraft((current) => ({ ...current, anamnesis: { ...current.anamnesis, history: value } }))} />
                  <Field label="Revisao de sistemas" multiline value={draft.anamnesis.systemsReview ?? ""} onChange={(value) => setDraft((current) => ({ ...current, anamnesis: { ...current.anamnesis, systemsReview: value } }))} />
                  <Field label="Antecedentes pessoais" multiline value={draft.anamnesis.personalHistory ?? ""} onChange={(value) => setDraft((current) => ({ ...current, anamnesis: { ...current.anamnesis, personalHistory: value } }))} />
                  <Field label="Antecedentes familiares" multiline value={draft.anamnesis.familyHistory ?? ""} onChange={(value) => setDraft((current) => ({ ...current, anamnesis: { ...current.anamnesis, familyHistory: value } }))} />
                  <Field label="Habitos e contexto" multiline value={draft.anamnesis.habits ?? ""} onChange={(value) => setDraft((current) => ({ ...current, anamnesis: { ...current.anamnesis, habits: value } }))} />
                </div>
              </section>

              <section className={styles.grid2}>
                <article className={styles.formCard}>
                  <p className={styles.eyebrow}>Exame fisico</p>
                  <div className={styles.grid2}>
                    <Field label="Pressao arterial" value={draft.exam.bloodPressure ?? ""} onChange={(value) => setDraft((current) => ({ ...current, exam: { ...current.exam, bloodPressure: value } }))} />
                    <Field label="Frequencia cardiaca" value={draft.exam.heartRate ?? ""} onChange={(value) => setDraft((current) => ({ ...current, exam: { ...current.exam, heartRate: value } }))} />
                    <Field label="Peso" value={draft.exam.weight ?? ""} onChange={(value) => setDraft((current) => ({ ...current, exam: { ...current.exam, weight: value } }))} />
                    <Field label="Altura" value={draft.exam.height ?? ""} onChange={(value) => setDraft((current) => ({ ...current, exam: { ...current.exam, height: value } }))} />
                    <Field label="Exame de couro cabeludo" multiline value={draft.exam.physicalFindings ?? ""} onChange={(value) => setDraft((current) => ({ ...current, exam: { ...current.exam, physicalFindings: value } }))} />
                    <Field label="Exame de pele" multiline value={draft.exam.skinFindings ?? ""} onChange={(value) => setDraft((current) => ({ ...current, exam: { ...current.exam, skinFindings: value } }))} />
                  </div>
                </article>

                <article className={styles.formCard}>
                  <p className={styles.eyebrow}>Diagnostico e conduta</p>
                  <div className={styles.grid2}>
                    <Field label="Hipoteses" multiline value={draft.diagnosis.hypotheses} onChange={(value) => setDraft((current) => ({ ...current, diagnosis: { ...current.diagnosis, hypotheses: value } }))} />
                    <Field label="Diagnostico principal" value={draft.diagnosis.main} onChange={(value) => setDraft((current) => ({ ...current, diagnosis: { ...current.diagnosis, main: value } }))} />
                    <Field label="Diagnosticos associados" value={draft.diagnosis.associated} onChange={(value) => setDraft((current) => ({ ...current, diagnosis: { ...current.diagnosis, associated: value } }))} />
                    <Field label="Observacoes clinicas" multiline value={draft.diagnosis.notes} onChange={(value) => setDraft((current) => ({ ...current, diagnosis: { ...current.diagnosis, notes: value } }))} />
                    <Field label="Prescricao" multiline value={draft.conduct.prescription ?? ""} onChange={(value) => setDraft((current) => ({ ...current, conduct: { ...current.conduct, prescription: value } }))} />
                    <Field label="Procedimentos" multiline value={draft.conduct.procedures ?? ""} onChange={(value) => setDraft((current) => ({ ...current, conduct: { ...current.conduct, procedures: value } }))} />
                    <Field label="Orientacoes" multiline value={draft.conduct.guidance ?? ""} onChange={(value) => setDraft((current) => ({ ...current, conduct: { ...current.conduct, guidance: value } }))} />
                    <Field label="Encaminhamentos" multiline value={draft.conduct.referrals ?? ""} onChange={(value) => setDraft((current) => ({ ...current, conduct: { ...current.conduct, referrals: value } }))} />
                  </div>
                </article>
              </section>
              </>}
            </div>
          )}

          {activeSection === "Evolucao" && (
            <div className={styles.stack}>
              <section className={styles.panelCard}>
                <div className={styles.toolbar}>
                  <div>
                    <p className={styles.eyebrow}>Timeline clinica</p>
                    <h3 className={styles.title}>Historico longitudinal</h3>
                  </div>
                  <select className={styles.select} value={timelineType} onChange={(event) => setTimelineType(event.target.value)}>
                    <option value="todos">Todos</option>
                    <option value="consulta">Consulta</option>
                    <option value="foto">Foto</option>
                    <option value="prescricao">Prescricao</option>
                    <option value="consentimento">Consentimento</option>
                    <option value="exame">Exame</option>
                  </select>
                </div>
              </section>
              <section className={styles.timeline}>
                {filteredTimeline.map((event) => (
                  <article key={event.id} className={styles.timelineItem}>
                    <div className={styles.timelineDot} />
                    <div className={styles.timelineBody}>
                      <div className={styles.split}>
                        <div><p className={styles.eyebrow}>{event.type}</p><strong>{event.title}</strong></div>
                        <span className={styles.chip}>{event.date}</span>
                      </div>
                      <p>{event.description}</p>
                      <p className={styles.muted}>{event.professional} - {event.treatment ?? "Sem tratamento"}</p>
                    </div>
                  </article>
                ))}
              </section>
            </div>
          )}
          
          {activeSection === "Exames" && (
            <div className={`${styles.stack} ${!canViewClinical ? styles.disabledBlock : ""}`}>
              {!canViewClinical && <section className={styles.panelCard}><strong>Perfil sem permissao para exames clinicos.</strong></section>}
              {canViewClinical && <>
              {chart.exams.map((exam) => (
                <article key={exam.id} className={styles.panelCard}>
                  <div className={styles.split}>
                    <div><p className={styles.eyebrow}>{exam.type}</p><strong>{exam.result}</strong></div>
                    <span className={styles.chip}>{exam.date}</span>
                  </div>
                  <p>{exam.note}</p>
                  <p className={styles.muted}>{exam.origin}</p>
                </article>
              ))}
              </>}
            </div>
          )}

          {activeSection === "Prescricao" && (
            <div className={`${styles.stack} ${!canViewClinical ? styles.disabledBlock : ""}`}>
              {!canViewClinical && <section className={styles.panelCard}><strong>Perfil sem permissao para prescricoes.</strong></section>}
              {canViewClinical && <>
              {chart.prescriptions.map((item) => (
                <article key={item.id} className={styles.panelCard}>
                  <p className={styles.eyebrow}>{item.name}</p>
                  <strong>{item.dosage}</strong>
                  <p className={styles.muted}>{item.notes}</p>
                </article>
              ))}
              </>}
            </div>
          )}

          {activeSection === "Procedimentos" && (
            <div className={styles.stack}>
              {chart.procedures.map((item) => (
                <article key={item.id} className={styles.panelCard}>
                  <div className={styles.split}>
                    <div><p className={styles.eyebrow}>{item.area}</p><strong>{item.name}</strong></div>
                    <span className={styles.chip}>{item.performedAt}</span>
                  </div>
                  <p>{item.notes}</p>
                  <p className={styles.muted}>Financeiro: {item.financialLink}</p>
                </article>
              ))}
            </div>
          )}

          {activeSection === "Documentos" && (
            <div className={`${styles.stack} ${!canViewClinical ? styles.disabledBlock : ""}`}>
              {!canViewClinical && <section className={styles.panelCard}><strong>Perfil sem permissao para documentos clinicos.</strong></section>}
              {canViewClinical && <>
              {chart.documents.map((item) => (
                <article key={item.id} className={styles.panelCard}>
                  <p className={styles.eyebrow}>{item.type}</p>
                  <strong>{item.title}</strong>
                  <p className={styles.muted}>{item.createdAt}</p>
                </article>
              ))}
              </>}
            </div>
          )}

          {activeSection === "Fotos" && (
            <div className={styles.stack}>
              {!canViewClinical && <section className={styles.panelCard}><strong>Perfil sem permissao para visualizacao de midia clinica.</strong></section>}
              {canViewClinical && <>
              <section className={styles.formCard}>
                <p className={styles.eyebrow}>Nova midia clinica</p>
                <div className={styles.grid2}>
                  <Field label="Titulo" value={newMedia.title} onChange={(value) => setNewMedia((current) => ({ ...current, title: value }))} />
                  <Field label="Tratamento" value={newMedia.treatmentLabel} onChange={(value) => setNewMedia((current) => ({ ...current, treatmentLabel: value }))} />
                  <Field label="Legenda obrigatoria" multiline value={newMedia.caption} onChange={(value) => setNewMedia((current) => ({ ...current, caption: value }))} />
                  <div className={styles.field}>
                    <label>Contexto</label>
                    <select className={styles.select} value={newMedia.context} onChange={(event) => setNewMedia((current) => ({ ...current, context: event.target.value }))}>
                      <option value="PHYSICAL_EXAM">Exame fisico</option>
                      <option value="EVOLUTION">Evolucao</option>
                      <option value="PROCEDURE">Procedimento</option>
                      <option value="COMPARISON">Comparacao</option>
                      <option value="SUPPORTING_DOCUMENT">Documento complementar</option>
                    </select>
                  </div>
                </div>
                <div className={styles.actions}>
                  <button className={styles.button} type="button" onClick={createMediaRecord} disabled={!canUploadMedia}>Salvar midia</button>
                </div>
              </section>

              <section className={styles.photoGrid}>
                {chart.media.map((item) => (
                  <article key={item.id} className={styles.mediaCard}>
                    <Image className={styles.photo} src={item.imageUrl} alt={item.title} width={800} height={800} />
                    <p className={styles.eyebrow}>{item.context}</p>
                    <strong>{item.title}</strong>
                    <p>{item.caption}</p>
                    <p className={styles.muted}>{item.createdAt} - {item.author}</p>
                  </article>
                ))}
              </section>
              </>}
            </div>
          )}

          {activeSection === "Consentimentos" && (
            <div className={styles.stack}>
              {!canViewClinical && <section className={styles.panelCard}><strong>Perfil sem permissao para visualizar consentimentos clinicos.</strong></section>}
              {canViewClinical && <>
              <section className={styles.formCard}>
                <p className={styles.eyebrow}>Novo consentimento</p>
                <div className={styles.grid2}>
                  <Field label="Tipo" value={newConsent.type} onChange={(value) => setNewConsent((current) => ({ ...current, type: value }))} />
                  <Field label="Versao" value={newConsent.version} onChange={(value) => setNewConsent((current) => ({ ...current, version: value }))} />
                  <Field label="Vinculo" value={newConsent.linkedTo} onChange={(value) => setNewConsent((current) => ({ ...current, linkedTo: value }))} />
                  <Field label="Validade" value={newConsent.validUntil} onChange={(value) => setNewConsent((current) => ({ ...current, validUntil: value }))} />
                </div>
                <div className={styles.actions}>
                  <button className={styles.button} type="button" onClick={createConsentRecord} disabled={!canManageConsents}>Registrar consentimento</button>
                </div>
              </section>

              {chart.consents.map((item) => (
                <article key={item.id} className={styles.panelCard}>
                  <div className={styles.split}>
                    <div><p className={styles.eyebrow}>{item.type}</p><strong>{item.linkedTo}</strong></div>
                    <span className={styles.chip}>{item.status}</span>
                  </div>
                  <p>Versao {item.version} - assinado em {item.signedAt}</p>
                  <p className={styles.muted}>Responsavel: {item.professional} - validade ate {item.validUntil}</p>
                </article>
              ))}
              </>}
            </div>
          )}

          {activeSection === "Alta" && (
            <div className={styles.stack}>
              {!canViewClinical && <section className={styles.panelCard}><strong>Perfil sem permissao para alta clinica.</strong></section>}
              {canViewClinical && <>
              <section className={styles.formCard}>
                <p className={styles.eyebrow}>Resumo automatico editavel</p>
                <textarea className={styles.textarea} value={draft.closure.summary || buildSummary()} onChange={(event) => setDraft((current) => ({ ...current, closure: { ...current.closure, summary: event.target.value } }))} />
                <div className={styles.grid2}>
                  <Field label="Orientacoes finais" multiline value={draft.closure.finalGuidance ?? ""} onChange={(value) => setDraft((current) => ({ ...current, closure: { ...current.closure, finalGuidance: value } }))} />
                  <Field label="Sugestao de retorno" value={draft.closure.returnSuggestion ?? ""} onChange={(value) => setDraft((current) => ({ ...current, closure: { ...current.closure, returnSuggestion: value } }))} />
                </div>
                <div className={styles.actions}>
                  <button className={styles.secondaryButton} type="button" onClick={() => saveDraft(false)} disabled={!canEditChart}>Salvar antes de concluir</button>
                  <button className={styles.button} type="button" onClick={() => saveDraft(true)} disabled={!canFinalize}>Concluir atendimento</button>
                </div>
              </section>
              </>}
            </div>
          )}
        </main>

        <aside className={styles.context}>
          <div className={styles.contextCard}>
            <p className={styles.eyebrow}>Painel contextual</p>
            <div className={styles.stack}>
              <div className={styles.card}>
                <p className={styles.eyebrow}>Perfil ativo</p>
                <div className={styles.roleBox}>
                  <strong>{session.professionalName}</strong>
                  <p className={styles.muted}>{session.role}</p>
                  <p className={styles.muted}>MFA: {session.mfaEnabled ? "Ativo" : "Inativo"}</p>
                  {!session.mfaEnabled ? (
                    <button className={styles.secondaryButton} type="button" onClick={prepareMfa}>
                      Preparar MFA
                    </button>
                  ) : (
                    <button className={styles.secondaryButton} type="button" onClick={turnOffMfa}>
                      Desabilitar MFA
                    </button>
                  )}
                  <button className={styles.ghostButton} type="button" onClick={logout}>Sair</button>
                </div>
                {mfaSetup ? (
                  <div className={styles.codeBox}>
                    <p className={styles.eyebrow}>Ativacao MFA</p>
                    <LocalQr className={styles.qrImage} value={mfaSetup.otpAuthUrl} alt="QR Code MFA" size={220} />
                    <p className={styles.muted}>Segredo TOTP</p>
                    <p className={styles.mono}>{mfaSetup.secret}</p>
                    <p className={styles.muted}>URL OTPAUTH</p>
                    <p className={styles.mono}>{mfaSetup.otpAuthUrl}</p>
                    <p className={styles.muted}>Recovery codes</p>
                    <ul className={styles.list}>
                      {mfaSetup.recoveryCodes.map((item) => <li key={item} className={styles.mono}>{item}</li>)}
                    </ul>
                    <input className={styles.input} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="Codigo do autenticador" />
                    <button className={styles.button} type="button" onClick={confirmMfa}>Confirmar MFA</button>
                  </div>
                ) : null}
              </div>
              <div className={styles.card}>
                <p className={styles.eyebrow}>Pendencias</p>
                <ul className={styles.list}>
                  {chart.pendingItems.map((item) => <li key={item.label}>{item.critical ? "[Critico] " : ""}{item.label}</li>)}
                </ul>
              </div>
              <div className={styles.card}>
                <p className={styles.eyebrow}>Consentimento em alerta</p>
                <strong>{dashboard.expiringConsent?.type ?? "Sem alertas"}</strong>
                <p className={styles.muted}>{dashboard.expiringConsent?.validUntil ?? "Todos os termos vigentes."}</p>
              </div>
              <div className={styles.card}>
                <p className={styles.eyebrow}>Auditoria recente</p>
                {canViewAudit ? (
                  <ul className={styles.list}>
                    {chart.audit.map((item) => <li key={item.id}>{item.createdAt} - {item.actor} - {item.fieldName}</li>)}
                  </ul>
                ) : (
                  <p className={styles.muted}>Somente administradores visualizam a trilha detalhada.</p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {multiline ? (
        <textarea className={styles.textarea} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={styles.input} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}
