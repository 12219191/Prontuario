"use client";

import { useEffect, useState, useTransition } from "react";
import styles from "./mfa-enrollment-card.module.css";
import { LocalQr } from "@/components/local-qr";

export function MfaEnrollmentCard({
  professionalName
}: {
  professionalName: string;
}) {
  const [setup, setSetup] = useState<null | {
    secret: string;
    otpAuthUrl: string;
    recoveryCodes: string[];
  }>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const response = await fetch("/api/auth/mfa");
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message ?? "Nao foi possivel preparar MFA.");
        return;
      }

      setSetup({
        secret: data.secret,
        otpAuthUrl: data.otpAuthUrl,
        recoveryCodes: data.recoveryCodes
      });
    });
  }, []);

  async function confirmMfa() {
    if (!setup) return;
    const response = await fetch("/api/auth/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: setup.secret,
        code,
        recoveryCodes: setup.recoveryCodes
      })
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message ?? "Nao foi possivel habilitar MFA.");
      return;
    }

    window.location.reload();
  }

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>MFA obrigatorio</p>
        <h1 className={styles.title}>Ative o segundo fator para continuar</h1>
        <p className={styles.muted}>
          O perfil administrativo de {professionalName} precisa habilitar MFA antes de acessar o prontuario.
        </p>

        {setup ? (
          <div className={styles.grid}>
            <div className={styles.box}>
              <LocalQr className={styles.qr} value={setup.otpAuthUrl} alt="QR Code MFA" />
            </div>
            <div className={styles.box}>
              <p className={styles.eyebrow}>Segredo TOTP</p>
              <p className={styles.mono}>{setup.secret}</p>
              <p className={styles.eyebrow}>Recovery codes</p>
              <ul className={styles.list}>
                {setup.recoveryCodes.map((item) => (
                  <li key={item} className={styles.mono}>{item}</li>
                ))}
              </ul>
              <input
                className={styles.input}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Codigo do autenticador"
              />
              <div className={styles.actions}>
                <button className={styles.button} type="button" onClick={confirmMfa} disabled={isPending}>
                  Confirmar MFA
                </button>
                <button className={styles.secondary} type="button" onClick={logout}>
                  Sair
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className={styles.muted}>{isPending ? "Preparando configuracao..." : message || "Carregando..."}</p>
        )}
      </div>
    </div>
  );
}
