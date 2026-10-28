import { useEffect, useRef, useState } from 'react';
import { api, can, qs, ROLE_LABELS } from '../api';
import { useAuth, useLiveEvent } from '../auth';
import { Avatar, Empty } from '../components/ui';

export default function Chat({ scope }) {
  const { user, toast, online } = useAuth();
  const [channel, setChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    api(`/chat/channel${qs({ workspace: scope.wid, project: scope.pid })}`).then(async (ch) => {
      setChannel(ch);
      const msgs = await api(`/chat/${ch._id}/messages?limit=50`);
      setMessages(msgs);
      setHasMore(msgs.length === 50);
    });
  }, [scope.wid, scope.pid]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  useLiveEvent('chat.message', ({ channelId, message }) => {
    if (channel && channelId === channel._id)
      setMessages((m) => (m.some((x) => x._id === message._id) ? m : [...m, message]));
  });

  const loadOlder = async () => {
    const older = await api(`/chat/${channel._id}/messages?limit=50&before=${encodeURIComponent(messages[0].createdAt)}`);
    setMessages((m) => [...older, ...m]);
    setHasMore(older.length === 50);
  };

  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    try {
      const msg = await api(`/chat/${channel._id}/messages`, { method: 'POST', body: { text: t } });
      setMessages((m) => (m.some((x) => x._id === msg._id) ? m : [...m, msg]));
    } catch (err) { toast(err.message, 'error'); setText(t); }
  };

  let lastDay = '';
  return (
    <div className="card chat">
      <div className="chat-head">
        <strong># {channel?.name || 'general'}</strong>
        <small className="muted">Common questions for {scope.project ? scope.project.name : scope.ws.name}</small>
        <span className={`live ${online ? 'on' : ''}`}>{online ? '● live' : '○ reconnecting'}</span>
      </div>
      <div className="chat-messages">
        {hasMore && <button className="btn sm load-older" onClick={loadOlder}>Load older messages</button>}
        {!messages.length && <Empty>No messages yet. Ask the first question!</Empty>}
        {messages.map((m) => {
          const day = new Date(m.createdAt).toDateString();
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = String(m.author?._id) === String(user._id);
          const name = m.delegatedFrom ? `${m.delegatedFrom} (deleted)` : m.author?.name || 'Unknown';
          return (
            <div key={m._id}>
              {showDay && <div className="day-sep"><span>{day}</span></div>}
              <div className={`msg ${mine && !m.delegatedFrom ? 'mine' : ''}`}>
                <Avatar name={name} size={30} />
                <div className="msg-body">
                  <div className="msg-meta"><strong>{name}</strong>{m.author?.role && !m.delegatedFrom && <small>{ROLE_LABELS[m.author.role]}</small>}<time>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
                  <div className="msg-text">{m.text}</div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form className="chat-input" onSubmit={send}>
        <input placeholder={can(user, 'chat.write') ? `Message #${channel?.name || 'general'}` : 'You have read-only access to chat'} value={text} onChange={(e) => setText(e.target.value)} disabled={!channel || !can(user, 'chat.write')} />
        <button className="btn primary" disabled={!text.trim()}>Send</button>
      </form>
    </div>
  );
}
