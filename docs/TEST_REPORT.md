# Relatório de Testes, Cobertura, Acessibilidade e Performance

**Data:** 2026-11-12  
**Escopo verificado:** Build de produção (`dist/`) e núcleo de domínio/persistência/DOM.

---

## 1. Resumo das Verificações Executadas

| Verificação | Comando executado | Resultado |
| --- | --- | --- |
| Typecheck TypeScript (`strict`) | `npm run typecheck` | Aprovado (`0` erros) |
| Lint ESLint (`typescript-eslint`, `no-eval`) | `npm run lint` | Aprovado (`0` erros, `0` avisos) |
| Testes unitários + cobertura (`v8`) | `npm run test:coverage` | **28/28** aprovados (`7` suítes, `1.93s`) |
| Build de produção Vite | `npm run build` | Aprovado (`630ms`, `0` erros) |
| Testes E2E + Axe WCAG 2.2 AA | `npx playwright test --reporter=line` | **5/5** fluxos compostos aprovados (`11.6s`) |
| Lighthouse (produção local `vite preview`) | `npx lighthouse http://127.0.0.1:4173` | **Perf 92 / A11y 100 / BP 100 / SEO 100** |

---

## 2. Cobertura de Testes Unitários (`@vitest/coverage-v8`)

| Camada / Arquivo | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| **Total monitorado** | **97.78%** | **91.93%** | **100.00%** | **97.72%** |
| `src/domain/contact.ts` | 100.00% | 100.00% | 100.00% | 100.00% |
| `src/domain/importExport.ts` | 100.00% | 82.85% | 100.00% | 100.00% |
| `src/domain/normalize.ts` | 98.24% | 92.72% | 100.00% | 98.24% |
| `src/domain/searchFilterSort.ts` | 97.56% | 90.62% | 100.00% | 97.43% |
| `src/domain/serialization.ts` | 96.34% | 94.23% | 100.00% | 96.29% |
| `src/domain/validation.ts` | 98.33% | 92.53% | 100.00% | 98.30% |
| `src/storage/contactRepository.ts` | 95.34% | 88.88% | 100.00% | 95.23% |
| `src/ui/dom.ts` | 100.00% | 96.29% | 100.00% | 100.00% |

### Regras cobertas nas 7 suítes unitárias (`tests/unit/`)
- `normalize.test.ts`: colapso de espaços, normalização accent-insensitive, normalização BR (10 e 11 dígitos, `+55`, `55`), E.164 internacional, exclusão de WhatsApp para fixo e rejeição de números inválidos.
- `validation.test.ts`: nomes Unicode com acentuação e apóstrofo, nomes vazios/curtos, limites máximos de caracteres, duplicidade por telefone normalizado (ignorando próprio ID em edição), validação de e-mail/categoria e bloqueio de payloads XSS/HTML.
- `searchFilterSort.test.ts`: busca por nome sem acentos, dígitos de telefone, e-mail, filtro por favoritos/categoria, ordenação (`A–Z`, `Z–A`, criação, atualização) e contadores reais.
- `serialization.test.ts`: envelope `v1`, migração de lista legada `v0`, rejeição de JSON malformado/versão futura, prevenção de *prototype pollution* (`__proto__`, `constructor`) e deduplicação.
- `importExport.test.ts`: proteção contra CSV Formula Injection (`=`, `+`, `-`, `@`, `\t`), escape RFC 4180, BOM UTF-8, preview de importação JSON com detecção de duplicados/XSS e estratégias `merge-skip` / `replace`.
- `contactRepository.test.ts`: persistência em `localStorage`, migração automática `v0 -> v1`, preservação de payload corrompido em chave de backup e tratamento de `QuotaExceededError` / storage indisponível.
- `xssDomSafety.test.ts`: renderização segura de payloads `<script>`, `<img onerror>`, `<svg onload>` e `<iframe>` como `textContent` inerte em DOM real (`jsdom`).

---

## 3. Testes E2E, Acessibilidade e Responsividade (`tests/e2e/agenda.spec.ts`)

Executados em Chromium contra o servidor de produção (`npm run preview -- --host 127.0.0.1 --port 4173`):

- Fluxos funcionais verificados: estado inicial vazio, criação, validação de erros inline, bloqueio de duplicidade normalizada, edição, persistência pós-reload, busca sem acentos, ordenação `A–Z`/`Z–A`, filtros por favoritos e categoria, favoritar, links `tel:` e `https://wa.me/...` (somente compatíveis), confirmação e cancelamento de exclusão, exportação JSON e CSV (verificando neutralização de fórmula no arquivo baixado), importação JSON válida e rejeição de importação inválida, rejeição e renderização inerte de XSS, recuperação de `localStorage` corrompido, navegação por teclado (`Enter`/`Escape` e retorno de foco), `prefers-reduced-motion: reduce` e `0` erros no console/CSP.
- **Auditoria Axe (`@axe-core/playwright` — tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`):** `0` violações nos estados vazio, modal aberto e lista populada. (Durante a auditoria inicial, o Axe identificou `aria-prohibited-attr` no container de toasts e `label-content-name-mismatch` no link do portfólio — ambos corrigidos e revalidados com `0` violações.)
- **Larguras validadas sem overflow horizontal (`scrollWidth <= innerWidth`):** `320px`, `375px`, `390px`, `768px`, `1024px`, `1440px` e `1920px`.

---

## 4. Auditoria Visual e Lighthouse

### Inspeção visual de screenshots
Foram inspecionadas capturas em desktop (`1440px`), tablet (`768px`), mobile (`390px`) e modal com erros de validação. Problemas identificados e corrigidos durante a auditoria:
1. O botão `Limpar filtros` permanecia visível mesmo com `[hidden]` devido à regra `.btn { display: inline-flex }` — corrigido com `[hidden] { display: none !important; }`.
2. O `backdrop-filter` em cada card causava artefato de composição em capturas mobile longas — substituído por superfície translúcida sólida de alto contraste.
3. Os toasts foram limitados a 2 simultâneos no canto inferior direito com `pointer-events: none` no container para não obstruir botões de ação.

### Lighthouse (ambiente de produção local)
- **Performance:** `92` (`CLS: 0.164` — leve deslocamento atribuído ao carregamento inicial da webfont local e renderização da toolbar)
- **Accessibility:** `100`
- **Best Practices:** `100`
- **SEO:** `100`
