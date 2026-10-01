'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Mail,
  CheckCircle2,
  FlaskConical,
} from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { signupSchema, loginSchema } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
type Values = z.infer<typeof signupSchema>;
export function AuthForm({
  mode,
  googleEnabled = false,
}: {
  mode: 'login' | 'signup';
  googleEnabled?: boolean;
}) {
  const t = useTranslations('auth');
  const signup = mode === 'signup';
  const router = useRouter();
  const params = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(
      signup ? signupSchema : loginSchema.extend({ name: z.string(), terms: z.boolean() }),
    ),
    defaultValues: { name: '', email: '', password: '', terms: false },
  });
  async function submit(values: Values) {
    setError('');
    setBusy(true);
    try {
      const result = signup
        ? await authClient.signUp.email({
            name: values.name.trim(),
            email: values.email,
            password: values.password,
          })
        : await authClient.signIn.email({ email: values.email, password: values.password });
      if (result.error) {
        setError(
          result.error.status === 429
            ? 'Muitas tentativas. Aguarde um minuto e tente novamente.'
            : signup
              ? 'Não foi possível criar a conta. Confira os dados ou tente entrar.'
              : 'E-mail ou senha incorretos. Confira e tente novamente.',
        );
        return;
      }
      if ('twoFactorRedirect' in (result.data ?? {})) {
        router.push('/verificar');
        return;
      }
      router.push(signup ? '/onboarding' : '/app');
      router.refresh();
    } catch {
      setError('Não foi possível conectar. Tente novamente em instantes.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <span className="eyebrow">
        {signup ? 'SEU PRÓXIMO PASSO COMEÇA AQUI' : 'QUE BOM TER VOCÊ DE VOLTA'}
      </span>
      <h1>{t(signup ? 'signupTitle' : 'loginTitle')}</h1>
      <p className="auth-subtitle">{t(signup ? 'signupSubtitle' : 'loginSubtitle')}</p>
      {googleEnabled && (
        <>
          <Button
            variant="outline"
            className="auth-google"
            onClick={async () => {
              const result = await authClient.signIn.social({
                provider: 'google',
                callbackURL: '/app',
              });
              if (result.error) setError('Não foi possível entrar com o Google.');
            }}
          >
            Continuar com Google
          </Button>
          <div className="auth-or">
            <span>ou use seu e-mail</span>
          </div>
        </>
      )}
      <form onSubmit={form.handleSubmit(submit)} noValidate>
        {signup && (
          <div className="form-field">
            <label htmlFor="name">{t('name')}</label>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Como podemos te chamar?"
              {...form.register('name')}
              aria-invalid={!!form.formState.errors.name}
            />
            {form.formState.errors.name && (
              <p className="error-text">{form.formState.errors.name.message}</p>
            )}
          </div>
        )}
        <div className="form-field">
          <label htmlFor="email">{t('email')}</label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="voce@suaempresa.com.br"
            {...form.register('email')}
            aria-invalid={!!form.formState.errors.email}
          />
          {form.formState.errors.email && (
            <p className="error-text">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div className="form-field">
          <div className="form-label-row">
            <label htmlFor="password">{t('password')}</label>
            {!signup && <Link href="/recuperar-senha">Esqueceu a senha?</Link>}
          </div>
          <div className="password-input">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={signup ? 'new-password' : 'current-password'}
              placeholder={signup ? 'Pelo menos 12 caracteres' : 'Sua senha'}
              {...form.register('password')}
              aria-invalid={!!form.formState.errors.password}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="error-text">{form.formState.errors.password.message}</p>
          )}
        </div>
        {signup && (
          <div className="form-field">
            <label className="terms-checkbox">
              <input type="checkbox" {...form.register('terms')} />
              <span>
                Li e aceito os <Link href="/termos">termos de uso</Link> e a{' '}
                <Link href="/privacidade">política de privacidade</Link>.
              </span>
            </label>
            {form.formState.errors.terms && (
              <p className="error-text">{form.formState.errors.terms.message}</p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="form-alert">
            {error}
          </p>
        )}
        <Button type="submit" className="auth-submit" disabled={busy}>
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <>
              {t(signup ? 'signup' : 'login')}
              <ArrowRight size={17} />
            </>
          )}
        </Button>
      </form>
      <p className="auth-switch">
        {signup ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
        <Link href={signup ? '/login' : '/cadastro'}>{signup ? 'Entrar' : 'Começar grátis'}</Link>
      </p>
      {!signup && params.get('demo') === '1' && (
        <div className="demo-login">
          <FlaskConical size={18} />
          <div>
            <strong>Conheça o painel com dados de exemplo</strong>
            <p>Nenhuma mensagem real será enviada.</p>
            <button
              onClick={() => {
                form.setValue('email', 'demo@bothub.local');
                form.setValue('password', 'BotHubDemo2026!');
              }}
            >
              Preencher conta demo <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export function RecoveryForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const form = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: z.email('Digite um e-mail válido.') })),
  });
  return (
    <>
      <span className="eyebrow">VAMOS TE AJUDAR</span>
      <h1>{sent ? 'Confira seu e-mail.' : 'Esqueceu sua senha?'}</h1>
      {sent ? (
        <div className="recovery-success">
          <CheckCircle2 size={36} />
          <p>Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha.</p>
          <Link href="/login">Voltar para entrar</Link>
        </div>
      ) : (
        <>
          <p className="auth-subtitle">
            Acontece! Informe seu e-mail e enviaremos um link para você criar uma nova senha.
          </p>
          <form
            noValidate
            onSubmit={form.handleSubmit(async (values) => {
              setBusy(true);
              setError('');
              try {
                const result = await authClient.requestPasswordReset({
                  email: values.email,
                  redirectTo: '/redefinir-senha',
                });
                if (result.error)
                  setError('Não foi possível enviar agora. Aguarde e tente novamente.');
                else setSent(true);
              } catch {
                setError('Não foi possível conectar. Tente novamente.');
              } finally {
                setBusy(false);
              }
            })}
          >
            <div className="form-field">
              <label htmlFor="recovery-email">E-mail</label>
              <Input
                id="recovery-email"
                type="email"
                autoComplete="email"
                placeholder="voce@suaempresa.com.br"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="error-text">{form.formState.errors.email.message}</p>
              )}
            </div>
            {error && (
              <p role="alert" className="form-alert">
                {error}
              </p>
            )}
            <Button className="auth-submit" disabled={busy}>
              <Mail size={16} />
              {busy ? 'Enviando…' : 'Enviar link de recuperação'}
            </Button>
          </form>
          <p className="auth-switch">
            <Link href="/login">Voltar para entrar</Link>
          </p>
        </>
      )}
    </>
  );
}
export function ResetForm() {
  const params = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <span className="eyebrow">UM NOVO COMEÇO</span>
      <h1>{done ? 'Senha atualizada!' : 'Crie sua nova senha.'}</h1>
      {done ? (
        <div className="recovery-success">
          <CheckCircle2 size={36} />
          <p>Agora você já pode entrar com sua nova senha.</p>
          <Button asChild>
            <Link href="/login">Entrar na minha conta</Link>
          </Button>
        </div>
      ) : !token ? (
        <>
          <p className="auth-subtitle">Esse link não é válido ou expirou.</p>
          <Button asChild>
            <Link href="/recuperar-senha">Pedir um novo link</Link>
          </Button>
        </>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (password.length < 12) {
              setError('Use pelo menos 12 caracteres.');
              return;
            }
            setBusy(true);
            setError('');
            try {
              const result = await authClient.resetPassword({ newPassword: password, token });
              if (result.error) setError('O link expirou. Peça um novo link de recuperação.');
              else setDone(true);
            } catch {
              setError('Não foi possível conectar. Tente novamente.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-field">
            <label htmlFor="new-password">Nova senha</label>
            <Input
              id="new-password"
              autoComplete="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              maxLength={128}
              required
            />
          </div>
          {error && (
            <p role="alert" className="form-alert">
              {error}
            </p>
          )}
          <Button className="auth-submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar nova senha'}
          </Button>
        </form>
      )}
    </>
  );
}
export function VerifyForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  return (
    <>
      <span className="eyebrow">UMA CAMADA EXTRA DE PROTEÇÃO</span>
      <h1>Confirme que é você.</h1>
      <p className="auth-subtitle">
        Digite o código de seis dígitos do seu aplicativo autenticador.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await authClient.twoFactor.verifyTotp({ code });
          if (result.error) setError('Código inválido ou expirado. Tente novamente.');
          else {
            router.push('/app');
            router.refresh();
          }
        }}
      >
        <div className="form-field">
          <label htmlFor="code">Código de verificação</label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            required
          />
        </div>
        {error && (
          <p role="alert" className="form-alert">
            {error}
          </p>
        )}
        <Button className="auth-submit">Verificar e entrar</Button>
      </form>
    </>
  );
}
