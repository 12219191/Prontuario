# Prontuario Eletronico

Base full-stack do modulo de prontuario clinico descrito no PRD, implementada com `Next.js + TypeScript + Prisma + SQLite`.

## Stack

- `Next.js` App Router para interface e rotas de API.
- `Prisma` para modelagem do dominio clinico.
- `SQLite` para persistencia local de desenvolvimento.
- UI server/client integrada ao banco, com fluxo clinico guiado.

## O que esta pronto

- Contexto fixo do paciente com alertas, alergias e status do atendimento.
- Atendimento atual com anamnese, exame fisico, diagnostico, conduta e alta.
- Timeline clinica unificada com eventos de consulta, foto, exame, prescricao e consentimento.
- Cadastro de midia clinica com legenda obrigatoria e validacao de consentimento.
- Registro e historico de consentimentos versionados.
- Exames, prescricoes, procedimentos, documentos e trilha de auditoria.
- Login real por email e senha com hash no banco.
- Redefinicao de senha por token temporario.
- Permissoes por perfil: recepcao, assistente clinico, profissional assistencial e administrador.
- Politica minima de senha e auditoria de eventos de autenticacao.
- MFA local com TOTP e recovery codes.
- QR code de MFA gerado localmente no cliente.
- API REST basica em `app/api`.
- Seed inicial com paciente, atendimento e dados demo.

## Como rodar

1. Instale as dependencias:

```bash
npm install
```

2. Gere o client do Prisma:

```bash
npm run db:generate
```

3. Crie o banco local:

```bash
npm run db:push
```

4. Popule com dados demo:

```bash
npm run db:seed
```

5. Suba a aplicacao:

```bash
npm run dev
```

6. Abra `http://localhost:3000`.

## Usuarios demo

- `Dra. Camila Matos` (`CLINICIAN`)
- `camila@xfts.local / Camila@123`
- `Assistente Laura` (`CLINICAL_ASSISTANT`)
- `laura@xfts.local / Laura@123`
- `Recepcao Marina` (`RECEPTION`)
- `marina@xfts.local / Marina@123`
- `Gestor Rafael` (`ADMIN`)
- `rafael@xfts.local / Rafael@123`

Use essas credenciais na tela inicial de login. Para trocar de perfil, faca logout e entre novamente com outro usuario.

## MFA local

- O MFA pode ser habilitado no painel contextual do app apos login.
- A ativacao gera um segredo TOTP, uma URL `otpauth` e recovery codes.
- O QR code do setup e gerado localmente com biblioteca embarcada no projeto.
- Depois de habilitado, o login passa a exigir codigo TOTP ou recovery code.
- Por padrao, os usuarios demo iniciam com MFA desabilitado.
- Para o perfil `ADMIN`, o MFA passa a ser obrigatorio antes de acessar o prontuario.

## Reset de senha demo

- Na tela de login, clique em `Esqueci minha senha`.
- Informe o email demo.
- O sistema gera um token temporario e o exibe na propria interface para ambiente local.
- Use o token para definir uma nova senha.

## Sessao

- A sessao e mantida em cookie `httpOnly`.
- Sessoes validas sao renovadas automaticamente durante o uso.
- Quando a senha e redefinida, as sessoes anteriores do usuario sao invalidadas.

## Politica de senha

- Minimo de 10 caracteres.
- Pelo menos uma letra maiuscula.
- Pelo menos uma letra minuscula.
- Pelo menos um numero.
- Pelo menos um caractere especial.

## Auditoria de autenticacao

- Login com sucesso.
- Tentativa de login invalida para usuario conhecido.
- Solicitacao de reset de senha.
- Conclusao de reset de senha.

## Protecao contra abuso

- A conta e bloqueada por 15 minutos apos 5 tentativas invalidas consecutivas.
- A solicitacao de novo token de reset entra em cooldown de 2 minutos por usuario.
- Login possui rate limit por IP: 10 tentativas em 5 minutos, com bloqueio de 10 minutos.
- Solicitacao de reset possui rate limit por IP: 5 tentativas em 10 minutos, com bloqueio de 15 minutos.
- Confirmacao de reset possui rate limit por IP: 10 tentativas em 10 minutos, com bloqueio de 10 minutos.

## Estrutura principal

- [app/page.tsx](C:\Users\mkt\OneDrive\Documentos\New project\app\page.tsx)
- [components/chart-app.tsx](C:\Users\mkt\OneDrive\Documentos\New project\components\chart-app.tsx)
- [lib/chart-service.ts](C:\Users\mkt\OneDrive\Documentos\New project\lib\chart-service.ts)
- [prisma/schema.prisma](C:\Users\mkt\OneDrive\Documentos\New project\prisma\schema.prisma)
- [prisma/seed.js](C:\Users\mkt\OneDrive\Documentos\New project\prisma\seed.js)

## Proximo passo recomendado

Adicionar envio real de email para reset, politica forte de senha, upload real de arquivos e storage seguro de documentos/imagens para evoluir para producao.
