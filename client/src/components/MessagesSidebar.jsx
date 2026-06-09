import { useEffect, useState } from 'react';
import { messagesApi } from '../api';
import '../styles/messages-sidebar.css';

export default function MessagesSidebar({ open, onClose, unreadCount, onUnreadCountChange }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await messagesApi.list(60);
      setMessages(data.messages || []);
      onUnreadCountChange?.(data.unreadCount || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open]);

  const markRead = async (messageId) => {
    try {
      const data = await messagesApi.markRead(messageId);
      setMessages((prev) => prev.map((message) => (message.id === messageId ? { ...message, read: true } : message)));
      onUnreadCountChange?.(data.unreadCount || 0);
    } catch {
      // no-op
    }
  };

  const markAllRead = async () => {
    try {
      const data = await messagesApi.markAllRead();
      setMessages((prev) => prev.map((message) => ({ ...message, read: true })));
      onUnreadCountChange?.(data.unreadCount || 0);
    } catch {
      // no-op
    }
  };

  return (
    <>
      <div className={`messages-backdrop ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`messages-sidebar ${open ? 'open' : ''}`}>
        <header className="messages-header">
          <h3>Messages</h3>
          <div className="messages-actions">
            <button type="button" onClick={markAllRead} disabled={!messages.length || !unreadCount}>Mark all read</button>
            <button type="button" onClick={onClose} aria-label="Close messages">✕</button>
          </div>
        </header>

        {loading && <p className="messages-empty">Loading…</p>}
        {error && <p className="messages-error">{error}</p>}

        {!loading && !error && messages.length === 0 && (
          <p className="messages-empty">No messages yet.</p>
        )}

        <ul className="messages-list">
          {messages.map((message) => (
            <li key={message.id} className={`message-item ${message.read ? 'read' : 'unread'}`}>
              <button
                type="button"
                className="message-content"
                onClick={() => markRead(message.id)}
              >
                <div className="message-title-row">
                  <strong>{message.title}</strong>
                  {!message.read && <span className="message-dot" />}
                </div>
                <p>{message.body}</p>
                <small>{new Date(message.createdAt).toLocaleString()}</small>
              </button>
              {message.link && (
                <a href={message.link} className="message-link" onClick={onClose}>Open</a>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
