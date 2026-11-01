// src/components/NotificationCenter.tsx
import React from 'react';
import {
  Bell,
  BellOff,
  Check,
  X,
  Sparkles,
  Trash2,
  Send,
  CheckCircle2,
} from 'lucide-react';
import type { OSNotification } from '../notificationSystem';
import { playSystemSound } from '../audio';

interface NotificationCenterProps {
  notifications: OSNotification[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onClose: () => void;
  dnd: boolean;
  setDnd: (dnd: boolean) => void;
  onSendTestNotification: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onDismiss,
  onClearAll,
  onClose,
  dnd,
  setDnd,
  onSendTestNotification,
}) => {
  const handleToggleDnd = () => {
    playSystemSound('toggle');
    setDnd(!dnd);
  };

  return (
    <div className="notification-center-content">
      {/* Panel Top Header */}
      <div className="panel-heading flex items-center justify-between">
        <div>
          <div className="eyebrow flex items-center gap-1.5">
            <span>NOTIFICATIONS</span>
            {dnd && (
              <span className="dnd-pill">
                <BellOff size={10} /> DND Active
              </span>
            )}
          </div>
          <h2>Notification Center</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            className={`dnd-quick-btn ${dnd ? 'is-active' : ''}`}
            onClick={handleToggleDnd}
            title={dnd ? 'Do Not Disturb is On (Click to unmute alerts)' : 'Turn on Do Not Disturb'}
            aria-pressed={dnd}
          >
            {dnd ? <BellOff size={14} /> : <Bell size={14} />}
            <span>{dnd ? 'DND On' : 'DND Off'}</span>
          </button>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close Notification Center"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Subheader with counter & clear all */}
      <div className="section-label flex items-center justify-between">
        <span>
          {notifications.length} {notifications.length === 1 ? 'ALERT' : 'ALERTS'}
        </span>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              onClick={() => {
                playSystemSound('toggle');
                onClearAll();
              }}
              className="clear-all-btn"
              aria-label="Clear all notifications"
            >
              <Trash2 size={12} />
              <span>Clear all</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="notifications-list">
        {notifications.map(n => (
          <article className="notification-item" key={n.id}>
            <span className="notif-badge-icon" aria-hidden="true">
              <Sparkles size={16} />
            </span>
            <div className="notif-body">
              <div className="notif-meta flex items-center justify-between">
                <span className="notif-app-tag">{n.appName}</span>
                <span className="notif-time">{formatRelativeTime(n.timestamp)}</span>
              </div>
              <strong className="notif-title">{n.title}</strong>
              <p className="notif-message">{n.message}</p>
            </div>
            <button
              className="notif-dismiss-btn"
              onClick={() => {
                playSystemSound('toggle');
                onDismiss(n.id);
              }}
              aria-label={`Dismiss notification: ${n.title}`}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </article>
        ))}

        {notifications.length === 0 && (
          <div className="empty-notifications">
            <CheckCircle2 size={32} className="text-muted opacity-40 mb-2" />
            <strong>All caught up.</strong>
            <p>No new notifications right now.</p>
          </div>
        )}
      </div>

      {/* Footer with Test Notification button */}
      <div className="notification-center-foot flex items-center justify-between">
        <span className="text-[10px] text-muted flex items-center gap-1.5">
          <span className="status-dot" />
          {dnd ? 'Pop-up banners are currently muted' : 'Pop-up alerts are active'}
        </span>
        <button
          className="test-notify-btn"
          onClick={() => {
            playSystemSound('notification');
            onSendTestNotification();
          }}
          title="Send a sample notification to test"
        >
          <Send size={11} />
          <span>Test Notification</span>
        </button>
      </div>
    </div>
  );
};
