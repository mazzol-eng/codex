'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { Bot, Sparkles, X } from 'lucide-react';
export function ProductHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="product-header">
      <div>
        <span className="dashboard-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="product-header-actions">{children}</div>
    </div>
  );
}
export function EmptyProduct({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="product-empty card">
      <div className="empty-orbit">
        <Bot size={36} />
        <Sparkles size={18} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function ProductDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="product-dialog-overlay" />
        <Dialog.Content className="product-dialog">
          <div className="product-dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close className="icon-control" aria-label="Fechar">
              <X size={19} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export const statusLabel = (status: string) =>
  ({
    active: 'Ativo',
    draft: 'Rascunho',
    paused: 'Pausado',
    archived: 'Arquivado',
    connected: 'Conectado',
    pending: 'Aguardando verificação',
    error: 'Erro',
    demo: 'Exemplo',
  })[status] ?? status;
