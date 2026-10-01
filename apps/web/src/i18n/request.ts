import { getRequestConfig } from 'next-intl/server';
export default getRequestConfig(async () => ({
  locale: 'pt-BR',
  messages: { common: { name: 'BotHub' } },
}));
