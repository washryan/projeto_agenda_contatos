# Relatório de Auditoria Técnica e Segurança — Agenda de Contatos

**Data:** 2026-11-12  
**Repositório:** `washryan/projeto_agenda_contatos`  
**Commit de referência inicial:** `b841b77` (preservado na tag `v1-original` e branch `backup-original`)

---

## 1. Diagnóstico Inicial (Versão v1-original)

Na inspeção integral do repositório clonado e da aplicação publicada originalmente em `https://projeto-agenda-contatos-orcin.vercel.app/`:

- **Estrutura original:** 3 arquivos estáticos (`index.html` com 41 linhas, `script.js` com 37 linhas, `style.css` com 68 linhas).
- **Persistência inexistente:** `const contatos = []` mantinha registros apenas em memória; qualquer reload apagava todos os contatos.
- **Vulnerabilidade crítica de XSS:** `adicionaLinha()` concatenava `contato.nome` e `contato.telefone` diretamente em strings HTML (`<tr><td>${contato.nome}</td>...`) e atribuía a `corpoTabela.innerHTML = linhas`.
- **CRUD incompleto:** permitia apenas inserção; não existia visualização detalhada, edição, exclusão, confirmação, busca, filtros ou ordenação.
- **Ausência de validações:** aceitava nomes compostos apenas por espaços, telefones duplicados ou inválidos e entradas com tags HTML/scripts.
- **Acessibilidade e responsividade limitadas:** inputs sem `<label>` associado (apenas `placeholder`), ausência de estados `:focus-visible`, `body` com `height: 100vh` causando corte de conteúdo em listas maiores e ausência de região `aria-live` para feedback.
- **Ausência de testes, lint, typecheck, CSP e documentação.**

---

## 2. Correções Arquiteturais e de Segurança Implementadas (v2.0)

### 2.1 Eliminação Estrutural de XSS
- Removido completamente o uso de `innerHTML` e concatenação de HTML na camada de interface.
- Todos os componentes (`src/ui/dom.ts`, `contactList.ts`, `contactFormModal.ts`, `confirmDialog.ts`, `importModal.ts`, `toast.ts`) criam nós via `document.createElement` e inserem dados de usuário exclusivamente por `textContent`.
- **Defesa em profundidade na entrada:** `containsUnsafeMarkup()` em `src/domain/validation.ts` rejeita tags HTML, manipuladores inline (`onerror=`, `onclick=`) e esquemas `javascript:`/`vbscript:`/`data:text/html` antes mesmo de persistir ou importar.
- **Links externos seguros:** URLs `tel:` e `https://wa.me/<dígitos>` são geradas apenas a partir de dígitos validados em `normalizePhone()`; links externos usam `target="_blank" rel="noopener noreferrer"`.

### 2.2 Segurança de Dados, Importação e Exportação
- **Prevenção de Prototype Pollution:** `safeJsonParse()` em `src/domain/serialization.ts` remove chaves `__proto__`, `constructor` e `prototype` durante o `JSON.parse`, além de utilizar `Object.hasOwn` e validação estrita de protótipo em `coerceContactRecord()`.
- **Proteção contra CSV Formula Injection (CWE-1236):** `sanitizeCsvCell()` em `src/domain/importExport.ts` neutraliza células iniciadas por `=`, `+`, `-`, `@`, `\t` ou `\r` prefixando `'`, além de aplicar escape RFC 4180 e BOM UTF-8.
- **Versionamento e recuperação de schema:** envelope versionado `{ schemaVersion: 1, updatedAt, contacts }` com migração segura de listas legadas `v0`. Dados corrompidos no `localStorage` são isolados em `rl_agenda_contatos_corrupted_backup` e expostos via banner de recuperação com download do backup bruto.

### 2.3 Content Security Policy (CSP) e Cabeçalhos HTTP
- Tipografia (`Oswald`, `Manrope`, `Fira Code`) empacotada localmente via `@fontsource`, eliminando dependências de CDN externas.
- Configurados em `vercel.json` e `<meta http-equiv="Content-Security-Policy">`:
  - `default-src 'self'`
  - `script-src 'self'`
  - `style-src 'self'`
  - `font-src 'self'`
  - `img-src 'self' data:`
  - `connect-src 'self'`
  - `object-src 'none'`
  - `base-uri 'self'`
  - `frame-ancestors 'none'` (via cabeçalho HTTP na Vercel)
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.

### 2.4 Auditoria de Dependências (`npm audit`)
- `npm audit --omit=dev`: **0 vulnerabilidades** em dependências de produção (`@fontsource/*`, `gsap`).
- `npm audit` completo (incluindo `devDependencies`): **0 críticas, 0 altas, 10 moderadas** transitivas restritas a `minimatch` dentro do ecossistema `eslint`/`typescript-eslint` (ferramenta de lint local/CI, não incluída no bundle publicado).

---

## 3. Riscos Residuais Documentados

1. **Acesso físico ou XSS de extensão no navegador do usuário:** por armazenar dados em `localStorage`, extensões maliciosas com permissão de leitura do domínio ou acesso físico ao perfil do navegador podem ler os contatos locais. Não há criptografia com senha mestre para não introduzir falsa sensação de autenticação sem backend.
2. **Perda por limpeza manual de dados do navegador:** limpar cookies/dados de site apaga `localStorage`. Mitigado por avisos claros na interface e exportação JSON/CSV em 1 clique.
3. **Dependência transitiva de dev (`minimatch` no ESLint):** monitorada em `devDependencies`, sem impacto no código executado em produção (`dist/`).
