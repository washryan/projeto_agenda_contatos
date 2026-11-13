import { describe, expect, it, vi } from 'vitest';
import type { Contact } from '../../src/domain/contact';
import { renderContactList } from '../../src/ui/contactList';
import { clearChildren, el } from '../../src/ui/dom';

describe('DOM XSS defense-in-depth rendering', () => {
  it('supports safe DOM helper attributes and child types without innerHTML', () => {
    const box = el('div', {
      id: 'safe-box',
      attrs: { disabled: true, hidden: false, 'data-empty': undefined, 'data-count': 3 },
      children: ['texto puro', null, undefined, el('span', { text: 'filho' })],
    });
    expect(box.hasAttribute('disabled')).toBe(true);
    expect(box.hasAttribute('hidden')).toBe(false);
    expect(box.getAttribute('data-count')).toBe('3');
    expect(box.textContent).toBe('texto purofilho');
    clearChildren(box);
    expect(box.childNodes.length).toBe(0);
  });

  it('renders malicious strings as inert textContent without executing or injecting HTML elements', () => {
    const container = document.createElement('div');
    const maliciousContacts: Contact[] = [
      {
        id: 'xss-1',
        nome: '<script>window.__xssExecuted = true;</script><img src=x onerror="window.__xssExecuted=true">',
        telefone: '(11) 98765-4321',
        telefoneNormalizado: '+5511987654321',
        email: '"><svg onload=alert(1)>@evil.test',
        observacoes: '<iframe src="javascript:alert(1)"></iframe>',
        favorito: false,
        criadoEm: '2026-01-01T00:00:00.000Z',
        atualizadoEm: '2026-01-01T00:00:00.000Z',
      },
    ];

    renderContactList(container, maliciousContacts, 1, {
      onToggleFavorite: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onCopyPhone: vi.fn(),
      onAddFirst: vi.fn(),
      onOpenImport: vi.fn(),
      onClearFilters: vi.fn(),
    });

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect((window as unknown as Record<string, unknown>).__xssExecuted).toBeUndefined();

    const nameEl = container.querySelector('[data-testid="contact-name"]');
    expect(nameEl?.textContent).toContain('<script>');
    expect(nameEl?.innerHTML).not.toContain('<script>');
    expect(nameEl?.innerHTML).toContain('&lt;script&gt;');

    const callLink = container.querySelector('[data-testid="action-call"]');
    expect(callLink?.getAttribute('href')).toBe('tel:+5511987654321');
    const waLink = container.querySelector('[data-testid="action-whatsapp"]');
    expect(waLink?.getAttribute('href')).toBe('https://wa.me/5511987654321');
  });
});
