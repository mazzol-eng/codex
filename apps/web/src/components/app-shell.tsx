'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { brand } from '../../../../config/brand';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  LayoutDashboard,
  Bot,
  MessagesSquare,
  Users,
  Send,
  LayoutTemplate,
  BarChart3,
  Plug,
  Settings,
  ChevronsUpDown,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Plus,
  Check,
  LogOut,
  HelpCircle,
  Sparkles,
  Command,
  Building2,
} from 'lucide-react';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
const baseNavigation = [
  { key: 'overview', href: '/app', label: 'Visão geral', icon: LayoutDashboard },
  { key: 'bots', href: '/app/bots', label: 'Meus bots', icon: Bot, phase: 2 },
  { key: 'inbox', href: '/app/inbox', label: 'Caixa de entrada', icon: MessagesSquare, phase: 2 },
  { key: 'contacts', href: '/app/contacts', label: 'Contatos', icon: Users, phase: 3 },
  { key: 'campaigns', href: '/app/campaigns', label: 'Campanhas', icon: Send, phase: 3 },
  { key: 'templates', href: '/app/templates', label: 'Templates', icon: LayoutTemplate, phase: 2 },
  { key: 'analytics', href: '/app/analytics', label: 'Relatórios', icon: BarChart3, phase: 4 },
];
const baseManagement = [
  { key: 'channels', href: '/app/channels', label: 'Canais', icon: Plug, phase: 2 },
  { key: 'team', href: '/app/team', label: 'Equipe', icon: Users, phase: 4 },
  { key: 'settings', href: '/app/settings', label: 'Configurações', icon: Settings, phase: 4 },
];
type Workspace = { id: string; name: string; plan: string; isDemo: boolean };
export function AppShell({
  children,
  user,
  workspace,
  workspaces,
  role,
}: {
  children: React.ReactNode;
  user: { name: string; email: string };
  workspace: Workspace;
  workspaces: Workspace[];
  role: string;
}) {
  const t = useTranslations('navigation');
  const navigation = baseNavigation.map((item) => ({ ...item, label: t(item.key) }));
  const management = baseManagement.map((item) => ({ ...item, label: t(item.key) }));
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [command, setCommand] = useState(false);
  const [search, setSearch] = useState('');
  const current =
    [...navigation, ...management].find((item) => item.href === pathname)?.label ?? 'Seu espaço';
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommand((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const sidebar = (isMobile = false) => (
    <>
      <div className="sidebar-logo">
        <Logo href="/app" compact={collapsed && !isMobile} />
        {!isMobile && (
          <button
            className="collapse-button"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        )}
      </div>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="workspace-selector" aria-label="Selecionar empresa">
          <span className="workspace-avatar">{workspace.name.slice(0, 1)}</span>
          <div>
            <strong>{workspace.name}</strong>
            <span>Seu espaço de trabalho</span>
          </div>
          <ChevronsUpDown size={14} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="dropdown-menu" align="start" sideOffset={8}>
            <DropdownMenu.Label className="dropdown-label">SUAS EMPRESAS</DropdownMenu.Label>
            {workspaces.map((w) => (
              <DropdownMenu.Item
                className="dropdown-item"
                key={w.id}
                onSelect={async () => {
                  if (w.id === workspace.id) return;
                  const response = await fetch('/api/workspaces', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workspaceId: w.id }),
                  });
                  if (response.ok) {
                    router.push('/app');
                    router.refresh();
                  } else toast.error('Não foi possível trocar de empresa.');
                }}
              >
                <Building2 size={14} />
                {w.name}
                {workspace.id === w.id && <Check size={14} />}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="dropdown-separator" />
            <DropdownMenu.Item className="dropdown-item" asChild>
              <Link href="/onboarding">
                <Plus size={14} />
                Criar outra empresa
              </Link>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <div className="nav-section-label">PRINCIPAL</div>
      <nav aria-label="Menu do painel" className="sidebar-nav">
        {navigation.map((item) => (
          <Link
            href={item.href}
            key={item.href}
            className={pathname === item.href ? 'nav-item active' : 'nav-item'}
            onClick={() => setMobile(false)}
            title={collapsed ? item.label : undefined}
            aria-current={pathname === item.href ? 'page' : undefined}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
            {item.phase && (
              <span className="nav-coming" aria-label="Em breve">
                ·
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div className="nav-section-label workspace-nav-label">EMPRESA</div>
      <nav aria-label="Gerenciar empresa" className="sidebar-nav">
        {management.map((item) => (
          <Link
            href={item.href}
            key={item.href}
            className={pathname === item.href ? 'nav-item active' : 'nav-item'}
            onClick={() => setMobile(false)}
            title={collapsed ? item.label : undefined}
            aria-current={pathname === item.href ? 'page' : undefined}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-plan">
        <span className="plan-icon">
          <Sparkles size={16} />
        </span>
        <strong>Seu negócio pode ir além</strong>
        <p>Conheça os planos para o seu próximo passo.</p>
        <Link href="/precos">
          Conhecer planos <ChevronRight size={13} />
        </Link>
      </div>
      <div className="sidebar-bottom">
        <a href="/recursos" className="help-link">
          <HelpCircle size={17} />
          <span>Central de recursos</span>
          <span>↗</span>
        </a>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="user-menu">
            <span className="user-avatar">
              {user.name
                .split(' ')
                .slice(0, 2)
                .map((n) => n[0])
                .join('')}
            </span>
            <div>
              <strong>{user.name}</strong>
              <span>
                {(
                  {
                    owner: 'Dono(a)',
                    admin: 'Admin',
                    agent: 'Atendente',
                    viewer: 'Visualizador',
                  } as Record<string, string>
                )[role] ?? role}
              </span>
            </div>
            <ChevronsUpDown size={13} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="dropdown-menu" side="top" align="start" sideOffset={8}>
              <DropdownMenu.Label className="dropdown-label">{user.email}</DropdownMenu.Label>
              <DropdownMenu.Item className="dropdown-item" asChild>
                <Link href="/app/settings">
                  <Settings size={14} />
                  Perfil e configurações
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="dropdown-separator" />
              <DropdownMenu.Item
                className="dropdown-item"
                onSelect={async () => {
                  await authClient.signOut();
                  router.push('/login');
                  router.refresh();
                }}
              >
                <LogOut size={14} />
                Sair da conta
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </>
  );
  return (
    <div className={collapsed ? 'app-layout sidebar-collapsed' : 'app-layout'}>
      <aside className="desktop-sidebar">{sidebar()}</aside>
      <div className="app-main">
        <header className="app-header">
          <div className="app-breadcrumb">
            <Button
              size="icon"
              variant="ghost"
              className="mobile-menu-button"
              onClick={() => setMobile(true)}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </Button>
            <span>Seu espaço</span>
            <ChevronRight size={13} />
            <strong>{current}</strong>
          </div>
          <div className="app-header-actions">
            <button className="command-trigger" onClick={() => setCommand(true)}>
              <Search size={15} />
              <span>Pesquisar...</span>
              <kbd>⌘ K</kbd>
            </button>
            <ThemeToggle />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notificações">
                  <Bell size={18} />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="dropdown-menu notifications-menu"
                  align="end"
                  sideOffset={12}
                >
                  <DropdownMenu.Label className="dropdown-label">NOTIFICAÇÕES</DropdownMenu.Label>
                  <div className="notification-empty">
                    <Bell size={24} />
                    <strong>Tudo tranquilo por aqui.</strong>
                    <p>Novidades do seu atendimento vão aparecer neste espaço.</p>
                  </div>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <span className="header-avatar" aria-label={user.name}>
              {user.name[0]}
            </span>
          </div>
        </header>
        <main id="main-content" className="app-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>Feito para boas conversas.</span>
          <span>{brand.name} · Fases 0 e 1</span>
        </footer>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Acesso rápido">
        {[navigation[0]!, navigation[1]!, navigation[2]!, management[2]!].map((item) => (
          <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}>
            <item.icon size={19} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <Dialog.Root open={mobile} onOpenChange={setMobile}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="mobile-sidebar">
            <Dialog.Title className="sr-only">Menu de navegação</Dialog.Title>
            <Dialog.Description className="sr-only">
              Escolha uma área do seu painel.
            </Dialog.Description>
            <Dialog.Close className="mobile-sidebar-close" aria-label="Fechar menu">
              <X size={18} />
            </Dialog.Close>
            {sidebar(true)}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={command} onOpenChange={setCommand}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content command-dialog card">
            <Dialog.Title className="sr-only">Pesquisar no painel</Dialog.Title>
            <Dialog.Description className="sr-only">
              Digite o nome de uma área para navegar.
            </Dialog.Description>
            <div className="command-search">
              <Search size={18} />
              <input
                placeholder="Para onde vamos?"
                aria-label="Pesquisar áreas"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Dialog.Close aria-label="Fechar busca">
                <kbd>esc</kbd>
              </Dialog.Close>
            </div>
            <div className="command-results">
              {[...navigation, ...management]
                .filter((item) =>
                  item.label.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
                )
                .map((item) => (
                  <button
                    key={item.href}
                    onClick={() => {
                      setCommand(false);
                      setSearch('');
                      router.push(item.href);
                    }}
                  >
                    <item.icon size={17} />
                    {item.label}
                    {item.phase && <Badge>Em breve</Badge>}
                    <ArrowRightIcon />
                  </button>
                ))}
            </div>
            <div className="command-footer">
              <Command size={12} /> Encontre seu próximo passo.
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
function ArrowRightIcon() {
  return <ChevronRight size={13} />;
}
