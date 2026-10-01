import { z } from 'zod';
export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Digite seu nome completo.').max(80),
  email: z.email('Digite um e-mail válido.').max(254),
  password: z.string().min(12, 'Use pelo menos 12 caracteres.').max(128),
  terms: z.boolean().refine((v) => v, 'Aceite os termos para continuar.'),
});
export const loginSchema = z.object({
  email: z.email('Digite um e-mail válido.'),
  password: z.string().min(1, 'Digite sua senha.'),
});
export const workspaceSchema = z.object({
  name: z.string().trim().min(2, 'Digite o nome da empresa.').max(80),
  segment: z.enum([
    'Serviços',
    'Comércio',
    'Alimentação',
    'Saúde e bem-estar',
    'Educação',
    'Outro',
  ]),
  timeZone: z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Selecione um fuso válido.'),
});
export const resetSchema = z.object({
  password: z.string().min(12, 'Use pelo menos 12 caracteres.').max(128),
});
