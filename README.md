# Agenda de Contatos — Connected Universe (Ryan Leal Edition)

Aplicação web moderna, responsiva, segura e acessível para gerenciamento local de contatos, reconstruída a partir de um projeto acadêmico simples de 3 arquivos (`HTML` + `CSS` + `JavaScript`) para um produto completo de portfólio integrado à identidade visual de [ryanleal.com.br](https://ryanleal.com.br/).

- **Produção (Vercel):** https://projeto-agenda-contatos-orcin.vercel.app/
- **Repositório:** https://github.com/washryan/projeto_agenda_contatos
- **Portfólio:** https://ryanleal.com.br/

---

## Origem Acadêmica e Evolução

O projeto original (`v1-original`, preservado na tag/branch de histórico) possuía apenas um formulário simples (`Nome` e `Telefone`) com renderização via concatenação em `innerHTML`, array apenas em memória (sem persistência entre reloads), ausência de validação robusta, ausência de edição/exclusão/busca/filtros e vulnerabilidade direta a XSS.

Na versão **2.0 (Connected Universe — Ryan Leal Edition)**, toda a arquitetura foi reengenheirada com separação entre domínio puro, persistência resiliente, interface segura (zero `innerHTML` com dados de usuário), design editorial escuro com fundo interativo em Canvas 2D, testes unitários com cobertura mensurada, testes E2E reais, auditoria automatizada WCAG 2.2 AA e cabeçalhos de segurança CSP.

---

## Funcionalidades

- **CRUD Completo:** criar, visualizar, editar, favoritar/desfavoritar e excluir contatos com diálogo de confirmação para ações destrutivas.
- **Campos Úteis:**
  - Obrigatórios: `Nome` e `Telefone`.
  - Opcionais: `E-mail`, `Categoria` (`Pessoal`, `Trabalho`, `Família`, `Cliente`, `Outro`), `Observações` e `Favorito`.
- **Validação & Normalização:**
  - Suporte a nomes internacionais e acentuação Unicode.
  - Rejeição de nomes vazios, espaços apenas, campos acima do limite ou contendo tags HTML/scripts.
  - Normalização de telefones brasileiros (fixo e celular com DDD/`+55`) e suporte a formatos internacionais E.164, impedindo duplicidade após normalização.
- **Pesquisa, Filtros e Ordenação:**
  - Busca instantânea por nome, telefone (formatado ou apenas dígitos) e e-mail, insensível a maiúsculas e acentos.
  - Filtro por favoritos e por categoria.
  - Ordenação `A–Z`, `Z–A`, `Mais recentes` e `Atualizados recentemente`.
  - Indicadores em tempo real calculados diretamente dos dados reais.
- **Ações Rápidas:**
  - Ligação direta (`tel:`).
  - Link para WhatsApp (`https://wa.me/...`) exibido apenas quando o número é válido e compatível.
  - Cópia rápida do telefone para a área de transferência.
- **Importação e Exportação Seguras:**
  - Exportação **JSON** com envelope versionado (`schemaVersion: 1`).
  - Exportação **CSV** compatível com Excel/Google Sheets (UTF-8 BOM, RFC 4180 e neutralização contra **CSV Formula Injection**).
  - Importação **JSON** com validação de schema, prevenção de *prototype pollution*, detecção de duplicados e estratégia explícita (`Mesclar ignorando duplicados` ou `Substituir agenda atual` com confirmação).

---

## Stack Tecnológica

- **Vite 6** + **TypeScript** (`strict: true`)
- **CSS modular com Design Tokens** + tipografia self-hosted (`Oswald`, `Manrope`, `Fira Code` via `@fontsource`)
- **Canvas 2D** (`connectedUniverse.ts`) + **GSAP** para microinterações controladas (com suporte integral a `prefers-reduced-motion` e pausa automática em abas inativas)
- **Vitest** + **@vitest/coverage-v8** + **jsdom**
- **Playwright** + **@axe-core/playwright**
- **ESLint** (`typescript-eslint` + `no-eval`)

---

## Instalação e Execução Local

```bash
# 1. Instalar dependências
npm install

# 2. Rodar servidor de desenvolvimento
npm run dev

# 3. Verificar tipos e lint
npm run typecheck
npm run lint

# 4. Executar testes unitários com cobertura
npm run test:coverage

# 5. Gerar build de produção
npm run build

# 6. Executar testes E2E e auditoria de acessibilidade (usa o build de produção)
npm run test:e2e
```

---

## Armazenamento de Dados e Privacidade

- Os contatos são persistidos exclusivamente no **`localStorage` do navegador** (`rl_agenda_contatos_v1`), no dispositivo do usuário.
- Não há backend próprio, telemetria, analytics ou sincronização automática com servidores externos.
- Dados corrompidos no armazenamento local são preservados em chave de recuperação (`rl_agenda_contatos_corrupted_backup`) com opção de download de backup bruto na interface, evitando perda silenciosa.
- Para backup entre dispositivos, utilize os botões **Exportar JSON** e **Importar**.

---

## Deploy na Vercel

O projeto inclui `vercel.json` configurado para build estático Vite (`dist/`) com cabeçalhos HTTP de segurança:

- `Content-Security-Policy` (`default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'`)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` restritiva

---

## Documentação Complementar

- [Relatório de Auditoria Técnica e Segurança](docs/AUDIT_REPORT.md)
- [Relatório de Testes, Cobertura e Validação Visual](docs/TEST_REPORT.md)

---

## Limitações Conhecidas

- Por ser uma aplicação *local-first* sem backend, limpar os dados do navegador remove os contatos locais caso não haja exportação JSON prévia.
- Não há sincronização automática entre múltiplos navegadores ou dispositivos.

---

## Créditos

Desenvolvido e modernizado por **Ryan Leal** ([ryanleal.com.br](https://ryanleal.com.br/)).
