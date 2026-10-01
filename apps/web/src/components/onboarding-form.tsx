'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Building2, Globe2, LoaderCircle, Check } from 'lucide-react';
import { workspaceSchema } from '@/lib/validation';
import { Button } from './ui/button';
import { Input } from './ui/input';
export function OnboardingForm({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useForm<z.infer<typeof workspaceSchema>>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: '', segment: 'Serviços', timeZone: 'America/Sao_Paulo' },
  });
  return (
    <div className="onboarding-card card">
      <div className="onboarding-progress">
        <span>
          <Check size={13} /> Sua conta
        </span>
        <i />
        <span className="active">
          <b>2</b> Sua empresa
        </span>
        <i />
        <span>
          <b>3</b> Primeiros passos
        </span>
      </div>
      <span className="onboarding-icon">
        <Building2 size={26} />
      </span>
      <span className="eyebrow">BEM-VINDO(A), {firstName.toLocaleUpperCase('pt-BR')}</span>
      <h1>
        Vamos dar uma casa
        <br />
        às suas conversas?
      </h1>
      <p>
        Conte um pouquinho sobre seu negócio.
        <br />
        Você poderá ajustar tudo depois.
      </p>
      <form
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          setBusy(true);
          setError('');
          try {
            const response = await fetch('/api/workspaces', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(values),
            });
            if (!response.ok) {
              const body = await response.json();
              setError(body.error ?? 'Não foi possível salvar.');
              return;
            }
            router.push('/app');
            router.refresh();
          } catch {
            setError('Não foi possível conectar. Tente novamente.');
          } finally {
            setBusy(false);
          }
        })}
      >
        <div className="form-field">
          <label htmlFor="workspace-name">Nome da empresa</label>
          <Input
            id="workspace-name"
            placeholder="Ex.: Estúdio Aurora"
            {...form.register('name')}
            aria-invalid={!!form.formState.errors.name}
          />
          {form.formState.errors.name && (
            <p className="error-text">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="form-field">
          <label htmlFor="segment">O que sua empresa faz?</label>
          <select id="segment" className="input" {...form.register('segment')}>
            {['Serviços', 'Comércio', 'Alimentação', 'Saúde e bem-estar', 'Educação', 'Outro'].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="timezone">Fuso horário</label>
          <select id="timezone" className="input" {...form.register('timeZone')}>
            <option value="America/Sao_Paulo">Brasília (São Paulo) · UTC−3</option>
            <option value="America/Manaus">Manaus · UTC−4</option>
            <option value="America/Rio_Branco">Rio Branco · UTC−5</option>
            <option value="America/Noronha">Fernando de Noronha · UTC−2</option>
            <option value="Europe/Lisbon">Lisboa</option>
          </select>
          <small>
            <Globe2 size={12} /> Usado para horários e relatórios.
          </small>
        </div>
        {error && (
          <p className="form-alert" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="auth-submit">
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <>
              Criar minha empresa <ArrowRight size={16} />
            </>
          )}
        </Button>
      </form>
      <p className="onboarding-note">Seu espaço é privado. Só você e sua equipe têm acesso.</p>
    </div>
  );
}
