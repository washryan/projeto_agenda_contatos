import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = process.env.PW_SCREENSHOT_DIR || '';

async function maybeCapture(
  page: import('@playwright/test').Page,
  name: string,
): Promise<void> {
  if (!SCREENSHOT_DIR) return;
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

test.describe('Agenda de Contatos — Connected Universe E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(`console.error: ${msg.text()}`);
      }
    });
    (page as unknown as { __trackedErrors?: string[] }).__trackedErrors = errors;
  });

  test.afterEach(async ({ page }) => {
    const errors = (page as unknown as { __trackedErrors?: string[] }).__trackedErrors ?? [];
    expect(errors, `Unexpected browser errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('1-6: initial empty state, create, validation, duplicate phone, edit, and persistence across reload', async ({
    page,
  }) => {
    await page.goto('/');

    // 1-2. Initial empty state and real counters
    await expect(page.getByTestId('empty-state-initial')).toBeVisible();
    await expect(page.getByTestId('stat-total')).toHaveText('0');
    await maybeCapture(page, '01-empty-desktop');

    // 4. Validate invalid contact inputs
    await page.getByTestId('add-contact-btn').click();
    await expect(page.getByTestId('contact-modal')).toBeVisible();
    await page.getByTestId('contact-submit').click();
    await expect(page.locator('#error-nome')).toContainText('Informe o nome');
    await expect(page.locator('#error-telefone')).toContainText('Informe o telefone');

    await page.fill('#contact-nome', '   ');
    await page.fill('#contact-telefone', '123');
    await page.fill('#contact-email', 'email-invalido');
    await page.getByTestId('contact-submit').click();
    await expect(page.locator('#error-nome')).toContainText('Informe o nome');
    await expect(page.locator('#error-telefone')).toContainText('Telefone inválido');
    await expect(page.locator('#error-email')).toContainText('e-mail válido');
    await maybeCapture(page, '02-modal-validation-errors');

    // 3. Create valid contact with Unicode accents
    await page.fill('#contact-nome', 'José Ângelo Souza');
    await page.fill('#contact-telefone', '11987654321');
    await page.fill('#contact-email', 'jose.angelo@empresa.com.br');
    await page.selectOption('#contact-categoria', 'trabalho');
    await page.fill('#contact-observacoes', 'Contato principal do estúdio.');
    await page.check('#contact-favorito');
    await page.getByTestId('contact-submit').click();

    await expect(page.getByTestId('contact-modal')).toBeHidden();
    await expect(page.getByTestId('contact-item')).toHaveCount(1);
    await expect(page.getByTestId('contact-name').first()).toHaveText('José Ângelo Souza');
    await expect(page.getByTestId('contact-phone').first()).toHaveText('(11) 98765-4321');
    await expect(page.getByTestId('stat-total')).toHaveText('1');
    await expect(page.getByTestId('stat-favorites')).toHaveText('1');

    // 5. Prevent duplicate phone even with different formatting (+55 / parentheses)
    await page.getByTestId('add-contact-btn').click();
    await page.fill('#contact-nome', 'Outro Nome');
    await page.fill('#contact-telefone', '+55 (11) 98765-4321');
    await page.getByTestId('contact-submit').click();
    await expect(page.locator('#error-telefone')).toContainText('já está cadastrado');
    await page.getByTestId('contact-cancel').click();

    // 6. Edit contact
    await page.getByTestId('action-edit').first().click();
    await page.fill('#contact-nome', 'José Ângelo Atualizado');
    await page.selectOption('#contact-categoria', 'cliente');
    await page.getByTestId('contact-submit').click();
    await expect(page.getByTestId('contact-name').first()).toHaveText('José Ângelo Atualizado');
    await expect(page.getByTestId('contact-category').first()).toHaveText('Cliente');

    // 11. Reload and verify persistence
    await page.reload();
    await expect(page.getByTestId('contact-item')).toHaveCount(1);
    await expect(page.getByTestId('contact-name').first()).toHaveText('José Ângelo Atualizado');
    await expect(page.getByTestId('stat-total')).toHaveText('1');
  });

  test('7-10 & 18: search, sort, filters, favorite toggle, tel: and WhatsApp links', async ({
    page,
  }) => {
    await page.goto('/');

    // Add mobile contact
    await page.getByTestId('add-contact-btn').click();
    await page.fill('#contact-nome', 'Ágata Fernandes');
    await page.fill('#contact-telefone', '(21) 99123-4567');
    await page.fill('#contact-email', 'agata@design.io');
    await page.selectOption('#contact-categoria', 'trabalho');
    await page.getByTestId('contact-submit').click();

    // Add landline contact (WhatsApp link should NOT be rendered for 10-digit BR landline)
    await page.getByTestId('add-contact-btn').click();
    await page.fill('#contact-nome', 'Bruno Fixo');
    await page.fill('#contact-telefone', '1133334444');
    await page.selectOption('#contact-categoria', 'pessoal');
    await page.getByTestId('contact-submit').click();

    // Check tel: and WhatsApp link rules (18)
    const agataCard = page.getByTestId('contact-item').filter({ hasText: 'Ágata Fernandes' });
    const brunoCard = page.getByTestId('contact-item').filter({ hasText: 'Bruno Fixo' });

    await expect(agataCard.getByTestId('action-call')).toHaveAttribute('href', 'tel:+5521991234567');
    await expect(agataCard.getByTestId('action-whatsapp')).toHaveAttribute(
      'href',
      'https://wa.me/5521991234567',
    );
    await expect(brunoCard.getByTestId('action-call')).toHaveAttribute('href', 'tel:+551133334444');
    await expect(brunoCard.getByTestId('action-whatsapp')).toHaveCount(0);

    // 10. Toggle favorite
    await brunoCard.getByTestId('action-favorite').click();
    await expect(page.getByTestId('stat-favorites')).toHaveText('1');

    // 8. Sort Z-A vs A-Z
    await page.getByTestId('sort-select').selectOption('nome-desc');
    await expect(page.getByTestId('contact-name').first()).toHaveText('Bruno Fixo');
    await page.getByTestId('sort-select').selectOption('nome-asc');
    await expect(page.getByTestId('contact-name').first()).toHaveText('Ágata Fernandes');

    // 7. Accent-insensitive search + no-results empty state
    await page.getByTestId('search-input').fill('agata');
    await expect(page.getByTestId('contact-item')).toHaveCount(1);
    await page.getByTestId('search-input').fill('inexistente-xyz');
    await expect(page.getByTestId('empty-state-filtered')).toBeVisible();
    await page.getByTestId('clear-filters-empty-btn').click();
    await expect(page.getByTestId('contact-item')).toHaveCount(2);

    // 9. Filter favorites and category
    await page.getByTestId('filter-favorites').click();
    await expect(page.getByTestId('contact-item')).toHaveCount(1);
    await expect(page.getByTestId('contact-name').first()).toHaveText('Bruno Fixo');

    await page.getByTestId('filter-category').selectOption('trabalho');
    await expect(page.getByTestId('empty-state-filtered')).toBeVisible();
    await page.getByTestId('toolbar-clear-filters').click();
    await expect(page.getByTestId('contact-item')).toHaveCount(2);
    await maybeCapture(page, '03-populated-desktop');
  });

  test('12-16: delete confirmation/cancel, JSON & CSV export, valid & invalid JSON import', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByTestId('add-contact-btn').click();
    await page.fill('#contact-nome', '=HYPERLINK("http://evil","Formula")');
    await page.fill('#contact-telefone', '(11) 97777-8888');
    await page.getByTestId('contact-submit').click();

    // 14. Export CSV & verify formula neutralization
    const csvDownloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-csv-btn').click();
    const csvDownload = await csvDownloadPromise;
    const csvPath = await csvDownload.path();
    expect(csvPath).toBeTruthy();
    const csvContent = fs.readFileSync(csvPath!, 'utf8');
    expect(csvContent).toContain(`"'=HYPERLINK(""http://evil"",""Formula"")"`);

    // 14. Export JSON
    const jsonDownloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-json-btn').click();
    const jsonDownload = await jsonDownloadPromise;
    const jsonPath = await jsonDownload.path();
    const jsonContent = fs.readFileSync(jsonPath!, 'utf8');
    expect(jsonContent).toContain('"schemaVersion": 1');

    // 13. Cancel deletion
    await page.getByTestId('action-delete').first().click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.getByTestId('confirm-cancel').click();
    await expect(page.getByTestId('contact-item')).toHaveCount(1);

    // 12. Confirm deletion
    await page.getByTestId('action-delete').first().click();
    await page.getByTestId('confirm-accept').click();
    await expect(page.getByTestId('empty-state-initial')).toBeVisible();

    // 16. Reject invalid import
    await page.getByTestId('import-btn').click();
    await page.getByTestId('import-file-input').setInputFiles({
      name: 'invalido.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{bad_json'),
    });
    await expect(page.getByTestId('import-status')).toContainText('malformado');
    await expect(page.getByTestId('import-confirm')).toBeDisabled();

    // 15. Import valid JSON
    await page.getByTestId('import-file-input').setInputFiles({
      name: 'contatos.json',
      mimeType: 'application/json',
      buffer: Buffer.from(jsonContent),
    });
    await expect(page.getByTestId('import-status')).toContainText('1 contato(s) válido(s)');
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('contact-item')).toHaveCount(1);
  });

  test('17 & 22: XSS payload rejection in form, inert rendering from storage, and corrupted storage recovery', async ({
    page,
  }) => {
    await page.goto('/');

    // 17a. XSS blocked at form validation level
    await page.getByTestId('add-contact-btn').click();
    await page.fill('#contact-nome', '<script>window.__xss=true</script>');
    await page.fill('#contact-telefone', '11988887777');
    await page.getByTestId('contact-submit').click();
    await expect(page.locator('#error-nome')).toContainText('tags HTML');
    await page.getByTestId('contact-cancel').click();

    // 17b. Raw XSS payload injected directly into localStorage renders as inert text
    await page.evaluate(() => {
      localStorage.setItem(
        'rl_agenda_contatos_v1',
        JSON.stringify({
          schemaVersion: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          contacts: [
            {
              id: 'xss-stored',
              nome: '<img src=x onerror="window.__xssStored=true">',
              telefone: '(11) 96666-5555',
              telefoneNormalizado: '+5511966665555',
              favorito: false,
              criadoEm: '2026-01-01T00:00:00.000Z',
              atualizadoEm: '2026-01-01T00:00:00.000Z',
            },
          ],
        }),
      );
    });
    await page.reload();
    await expect(page.getByTestId('contact-name').first()).toContainText('<img src=x');
    const xssFlag = await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__xssStored,
    );
    expect(xssFlag).toBeUndefined();

    // 22. Corrupted storage recovery banner
    await page.evaluate(() => {
      localStorage.setItem('rl_agenda_contatos_v1', '{corrupted_payload');
    });
    await page.reload();
    await expect(page.getByTestId('storage-warning-banner')).toBeVisible();
    await expect(page.getByTestId('download-corrupted-backup')).toBeVisible();
  });

  test('19-21 & Axe WCAG 2.2 AA: keyboard navigation, reduced motion, and responsiveness across 320-1920px', async ({
    page,
  }) => {
    // 20. Reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    // Axe audit on empty state
    const emptyAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(emptyAxe.violations).toEqual([]);

    // 19. Keyboard navigation: open modal, fill, Escape closes and restores focus
    const addBtn = page.getByTestId('add-contact-btn');
    await addBtn.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('contact-modal')).toBeVisible();

    // Axe audit on open modal
    const modalAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(modalAxe.violations).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('contact-modal')).toBeHidden();
    await expect(addBtn).toBeFocused();

    // Add 3 contacts for populated visual & responsiveness checks
    await page.evaluate(() => {
      localStorage.setItem(
        'rl_agenda_contatos_v1',
        JSON.stringify({
          schemaVersion: 1,
          updatedAt: '2026-02-10T10:00:00.000Z',
          contacts: [
            {
              id: '1',
              nome: 'Clara Mendes',
              telefone: '(11) 99111-2222',
              telefoneNormalizado: '+5511991112222',
              email: 'clara@studio.dev',
              categoria: 'trabalho',
              observacoes: 'Diretora de Arte',
              favorito: true,
              criadoEm: '2026-02-10T10:00:00.000Z',
              atualizadoEm: '2026-02-10T10:00:00.000Z',
            },
            {
              id: '2',
              nome: 'Henrique Oliveira',
              telefone: '(21) 98222-3333',
              telefoneNormalizado: '+5521982223333',
              email: 'henrique@cliente.com.br',
              categoria: 'cliente',
              favorito: false,
              criadoEm: '2026-02-09T10:00:00.000Z',
              atualizadoEm: '2026-02-09T10:00:00.000Z',
            },
            {
              id: '3',
              nome: 'Sofia Carvalho',
              telefone: '(87) 99333-4444',
              telefoneNormalizado: '+5587993334444',
              categoria: 'familia',
              favorito: true,
              criadoEm: '2026-02-08T10:00:00.000Z',
              atualizadoEm: '2026-02-08T10:00:00.000Z',
            },
          ],
        }),
      );
    });
    await page.reload();

    // Axe audit on populated state
    const populatedAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(populatedAxe.violations).toEqual([]);

    // 21. Responsiveness across all 7 required widths + small height
    const viewports = [
      { width: 320, height: 568, tag: '320-mobile' },
      { width: 375, height: 667, tag: '375-mobile' },
      { width: 390, height: 844, tag: '390-mobile' },
      { width: 768, height: 1024, tag: '768-tablet' },
      { width: 1024, height: 768, tag: '1024-laptop' },
      { width: 1440, height: 900, tag: '1440-desktop' },
      { width: 1920, height: 1080, tag: '1920-wide' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const overflow = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        };
      });
      expect(
        overflow.scrollWidth,
        `Horizontal overflow detected at ${vp.width}x${vp.height}`,
      ).toBeLessThanOrEqual(overflow.innerWidth);

      if (vp.width === 390 || vp.width === 768 || vp.width === 1440) {
        await maybeCapture(page, `04-responsive-${vp.tag}`);
      }
    }
  });
});
