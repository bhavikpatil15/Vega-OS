// src/apps/ProjectsApp.tsx
import React, { useState, useEffect } from 'react';
import {
  Folder,
  Search,
  Plus,
  Trash2,
  ExternalLink,
  Tag,
  CheckCircle2,
  X,
  Code,
} from 'lucide-react';
import { sendOSNotification } from '../notificationSystem';

interface Project {
  id: string;
  title: string;
  category: 'System' | 'Web' | 'Design' | 'Tools';
  description: string;
  status: 'Active' | 'Completed' | 'Draft';
  updatedAt: string;
}

const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    title: 'VEGA Spatial Workspace',
    category: 'System',
    description: '3D depth and parallax workspace layer with Three.js WebGL rendering.',
    status: 'Active',
    updatedAt: 'Today',
  },
  {
    id: 'proj-2',
    title: 'IndexedDB Virtual File System',
    category: 'Tools',
    description: 'Hierarchical node storage with client-side isolation and directory traversal.',
    status: 'Completed',
    updatedAt: 'Yesterday',
  },
  {
    id: 'proj-3',
    title: 'Progressive Web App Shell',
    category: 'Web',
    description: 'Service worker precaching, offline manifest, and standalone installability.',
    status: 'Completed',
    updatedAt: '3 days ago',
  },
  {
    id: 'proj-4',
    title: 'Glassmorphic UI Design System',
    category: 'Design',
    description: 'Restrained typography, adaptive dark/light tokens, and accessible contrast.',
    status: 'Active',
    updatedAt: 'Just now',
  },
];

export default function ProjectsApp() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('nexus-projects');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_PROJECTS;
  });

  const [filter, setFilter] = useState<'All' | 'System' | 'Web' | 'Design' | 'Tools'>('All');
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'System' | 'Web' | 'Design' | 'Tools'>('Web');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('nexus-projects', JSON.stringify(projects));
    } catch {}
  }, [projects]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newProject: Project = {
      id: 'proj-' + Date.now(),
      title: newTitle.trim(),
      category: newCategory,
      description: newDesc.trim() || 'No description provided.',
      status: 'Active',
      updatedAt: 'Just now',
    };

    setProjects(prev => [newProject, ...prev]);
    setNewTitle('');
    setNewDesc('');
    setIsCreating(false);

    sendOSNotification({
      appName: 'Projects',
      title: 'Project Created',
      message: `Created project "${newProject.title}"`,
    });
  };

  const handleDelete = (id: string, title: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    sendOSNotification({
      appName: 'Projects',
      title: 'Project Removed',
      message: `Deleted "${title}"`,
    });
  };

  const filtered = projects.filter(p => {
    const matchesCategory = filter === 'All' || p.category === filter;
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 text-gray-800 dark:text-gray-200">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-3 border-b border-black/5 dark:border-white/10">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-black/5 dark:bg-white/10 border border-transparent focus:border-[#668b7b] rounded-xl outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(['All', 'System', 'Web', 'Design', 'Tools'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-1 text-[11px] rounded-lg transition min-h-[30px] whitespace-nowrap ${
                filter === cat
                  ? 'bg-[#668b7b] text-white font-medium'
                  : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400'
              }`}
            >
              {cat}
            </button>
          ))}

          <button
            onClick={() => setIsCreating(true)}
            className="ml-auto px-3 py-1 text-[11px] bg-[#668b7b] text-white hover:bg-[#557869] rounded-lg flex items-center gap-1 font-medium min-h-[30px] shrink-0"
          >
            <Plus size={13} />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* New Project Modal / Drawer */}
      {isCreating && (
        <form onSubmit={handleCreate} className="p-3.5 my-3 bg-black/5 dark:bg-white/10 rounded-2xl border border-black/5 dark:border-white/10 space-y-2.5 animate-arrive">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">New Project</span>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="p-1 hover:bg-black/10 dark:hover:bg-white/15 rounded-md text-gray-500"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              required
              placeholder="Project Name *"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl outline-none focus:border-[#668b7b]"
            />
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value as any)}
              className="px-3 py-1.5 text-xs bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl outline-none focus:border-[#668b7b]"
            >
              <option value="Web">Web</option>
              <option value="System">System</option>
              <option value="Design">Design</option>
              <option value="Tools">Tools</option>
            </select>
          </div>
          <textarea
            placeholder="Brief project summary..."
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl outline-none focus:border-[#668b7b] resize-none h-16"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1 text-xs bg-[#668b7b] text-white rounded-xl font-medium"
            >
              Create Project
            </button>
          </div>
        </form>
      )}

      {/* Projects Cards List */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
        {filtered.map(proj => (
          <div
            key={proj.id}
            className="p-3.5 bg-white/70 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 transition shadow-xs flex items-start justify-between gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded-md bg-[#668b7b]/15 text-[#668b7b] dark:text-[#88b3a0]">
                  {proj.category}
                </span>
                <span className="text-[10px] text-gray-400">• {proj.updatedAt}</span>
              </div>
              <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                {proj.title}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                {proj.description}
              </p>
            </div>
            <button
              onClick={() => handleDelete(proj.id, proj.title)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition shrink-0 min-h-[32px] min-w-[32px] flex items-center justify-center"
              title="Delete project"
              aria-label={`Delete ${proj.title}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-xs text-gray-400">
            No projects found matching "{search}".
          </div>
        )}
      </div>
    </div>
  );
}
