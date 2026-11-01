import { Folder, UserRound, Terminal, Mail, FileText, Calculator, Edit, Settings, Activity, Globe } from 'lucide-react';
export const apps = [
  { id: 'about', name: 'About me', icon: UserRound, color: 'peach', detail: 'The person behind the pixels' },
  { id: 'projects', name: 'Projects', icon: Folder, color: 'blue', detail: 'A collection of things I make' },
  { id: 'terminal', name: 'Terminal', icon: Terminal, color: 'charcoal', detail: 'A different way to explore' },
  { id: 'contact', name: 'Contact', icon: Mail, color: 'green', detail: 'Start a conversation' },
  { id: 'notes', name: 'Notes', icon: FileText, color: 'purple', detail: 'Quickly jot down ideas' },
  { id: 'calculator', name: 'Calculator', icon: Calculator, color: 'orange', detail: 'Basic arithmetic helper' },
  { id: 'files', name: 'Files', icon: Folder, color: 'gray', detail: 'Manage your virtual files' },
  { id: 'editor', name: 'Editor', icon: Edit, color: 'blue', detail: 'Plain-text file editor' },
  { id: 'browser', name: 'Browser', icon: Globe, color: 'blue', detail: 'Explore the web & browse bookmarks' },
  { id: 'settings', name: 'Settings', icon: Settings, color: 'charcoal', detail: 'Configure OS preferences & 3D workspace' },
  { id: 'tasks', name: 'Task Manager', icon: Activity, color: 'green', detail: 'Monitor applications, windows & performance' },
] as const;
export type AppId = typeof apps[number]['id'];
export type AppDefinition = typeof apps[number];
