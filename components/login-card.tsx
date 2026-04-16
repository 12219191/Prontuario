"use client";

import { useState, useTransition } from "react";
import styles from "./login-card.module.css";

export function LoginCard() {
  const [email, setEmail] = useState("camila@xfts.local");
  const [password, setPassword] = useState("Camila@123");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "login-mfa" | "reset-request" | "reset-confirm">("login");
  const [resetToken, setResetToken] = useState("");
  const [nextPassword, setNextPassword] = useState("NovaSenha@123");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaChallengeToken, setMfaChallengeToken] = useState("");
  const [info, setInfo] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");

    if (mode === "reset-request") {
      startTransition(async () => {
        const response = await fetch("/api/auth/password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "request", email })
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data.message ?? "Nao foi possivel solicitar redefinicao.");
          return;
        }

        setInfo(data.message);
        if (data.resetToken) {
          setResetToken(data.resetToken);
          setMode("reset-confirm");
        }
      });
      return;
    }

    if (mode === "reset-confirm") {
      startTransition(async () => {
        const response = await fetch("/api/auth/password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "confirm",
            token: resetToken,
            password: nextPassword
          })
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data.message ?? "Nao foi possivel redefinir a senha.");
          return;
        }

        setInfo("Senha redefinida. Entre com a nova credencial.");
        setPassword(nextPassword);
        setMode("login");
      });
      return;
    }

    if (mode === "login-mfa") {
      startTransition(async () => {
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "mfa",
            challengeToken: mfaChallengeToken,
            code: mfaCode
          })
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data.message ?? "Nao foi possivel validar MFA.");
          return;
        }

        window.location.reload();
      });
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Nao foi possivel autenticar.");
        return;
      }

      if (data.requiresMfa) {
        setMode("login-mfa");
        setMfaChallengeToken(data.challengeToken);
        setInfo("Informe o codigo do app autenticador ou um recovery code.");
        return;
      }

      window.location.reload();
    });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Acesso seguro</p>
        <h1 className={styles.title}>Entrar no Prontuario Eletronico</h1>
        <p className={styles.muted}>
          Autentique-se para acessar o fluxo clinico conforme o seu perfil.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input id="email" className={styles.input} value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          {mode === "login" ? (
            <div className={styles.field}>
              <label htmlFor="password">Senha</label>
              <input id="password" type="password" className={styles.input} value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
          ) : null}
          {mode === "login-mfa" ? (
            <div className={styles.field}>
              <label htmlFor="mfaCode">Codigo MFA ou recovery code</label>
              <input id="mfaCode" className={styles.input} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} />
            </div>
          ) : null}
          {mode === "reset-confirm" ? (
            <>
              <div className={styles.field}>
                <label htmlFor="resetToken">Token de redefinicao</label>
                <input id="resetToken" className={styles.input} value={resetToken} onChange={(event) => setResetToken(event.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="nextPassword">Nova senha</label>
                <input id="nextPassword" type="password" className={styles.input} value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} />
              </div>
            </>
          ) : null}
          <button className={styles.button} type="submit" disabled={isPending}>
            {isPending
              ? "Processando..."
              : mode === "login"
                ? "Entrar"
                : mode === "login-mfa"
                  ? "Validar MFA"
                : mode === "reset-request"
                  ? "Gerar token"
                  : "Redefinir senha"}
          </button>
          {mode === "login" ? (
            <button className={styles.linkButton} type="button" onClick={() => { setMode("reset-request"); setError(""); setInfo(""); }}>
              Esqueci minha senha
            </button>
          ) : mode === "login-mfa" ? (
            <button className={styles.linkButton} type="button" onClick={() => { setMode("login"); setError(""); setInfo(""); setMfaCode(""); setMfaChallengeToken(""); }}>
              Voltar
            </button>
          ) : (
            <button className={styles.linkButton} type="button" onClick={() => { setMode("login"); setError(""); setInfo(""); }}>
              Voltar para login
            </button>
          )}
          {error ? <p className={styles.muted}>{error}</p> : null}
          {info ? <p className={styles.muted}>{info}</p> : null}
        </form>

        {mode === "reset-confirm" && resetToken ? (
          <div className={styles.tokenBox}>
            <strong>Token demo</strong>
            <p className={`${styles.muted} ${styles.mono}`}>{resetToken}</p>
            <p className={styles.muted}>
              Nova senha: minimo de 10 caracteres, com maiuscula, minuscula, numero e simbolo.
            </p>
          </div>
        ) : null}

        <div className={styles.demo}>
          <strong>Credenciais demo</strong>
          <p className={styles.muted}>camila@xfts.local / Camila@123</p>
          <p className={styles.muted}>laura@xfts.local / Laura@123</p>
          <p className={styles.muted}>marina@xfts.local / Marina@123</p>
          <p className={styles.muted}>rafael@xfts.local / Rafael@123</p>
        </div>
      </div>
    </div>
  );
}
