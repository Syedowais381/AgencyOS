import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Cable,
  ClipboardList,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  LineChart,
  Megaphone,
  Radio,
  Settings,
  Sparkles,
  Target,
  Users,
  UsersRound,
  Workflow,
  Zap,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  phase?: number;
};

export const mainNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, phase: 1 },
  { title: "CRM", href: "/dashboard/crm", icon: Users, phase: 1 },
  { title: "Sales", href: "/dashboard/sales", icon: LineChart, phase: 1 },
  { title: "Content", href: "/dashboard/content", icon: Megaphone, phase: 2 },
  {
    title: "Competitor Intelligence",
    href: "/dashboard/competitors",
    icon: Target,
    phase: 2,
  },
  {
    title: "Students / Clients",
    href: "/dashboard/clients",
    icon: GraduationCap,
    phase: 1,
  },
  { title: "Team", href: "/dashboard/team", icon: UsersRound, phase: 3 },
  { title: "Tasks", href: "/dashboard/tasks", icon: ClipboardList, phase: 3 },
  { title: "Automations", href: "/dashboard/automations", icon: Workflow, phase: 3 },
  { title: "Reports", href: "/dashboard/reports", icon: Radio, phase: 3 },
  { title: "AI Agents", href: "/dashboard/ai-agents", icon: Bot, phase: 2 },
  {
    title: "Call Analysis",
    href: "/dashboard/call-analysis",
    icon: Headphones,
    phase: 4,
  },
  {
    title: "Integrations",
    href: "/dashboard/integrations",
    icon: Cable,
    phase: 1,
  },
  { title: "Settings", href: "/dashboard/settings", icon: Settings, phase: 1 },
];

export const accentNav: NavItem[] = [
  {
    title: "AI Sales Trainer",
    href: "/dashboard/sales-trainer",
    icon: Sparkles,
    phase: 4,
  },
  { title: "Setter Inbox", href: "/dashboard/setter", icon: Zap, phase: 4 },
];
