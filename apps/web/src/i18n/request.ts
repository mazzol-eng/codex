import { getRequestConfig } from 'next-intl/server';
import messages from '../messages/pt-BR.json';
// Add locale routing or workspace preference here when enabling English in the UI.
export default getRequestConfig(async () => ({ locale: 'pt-BR', messages }));
