export function validatePasswordPolicy(password: string) {
  const issues: string[] = [];

  if (password.length < 10) {
    issues.push("A senha deve ter pelo menos 10 caracteres.");
  }

  if (!/[A-Z]/.test(password)) {
    issues.push("A senha deve conter ao menos uma letra maiuscula.");
  }

  if (!/[a-z]/.test(password)) {
    issues.push("A senha deve conter ao menos uma letra minuscula.");
  }

  if (!/[0-9]/.test(password)) {
    issues.push("A senha deve conter ao menos um numero.");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    issues.push("A senha deve conter ao menos um caractere especial.");
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
