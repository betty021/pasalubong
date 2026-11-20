import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLive } from '../realtime.jsx';
import Avatar from '../components/Avatar.jsx';

const time = (d) => new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const dayTime = (d) => {
  const x = new Date(d);
  return x.toDateString() === new Date().toDateString() ? time(d) : x.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

// Customer: iisang usapan lang (sa may-ari)  ->  /messages
// Admin (may-ari): listahan ng mga customer + usapan  ->  /admin/messages  at  /admin/messages/:id
export default function Chat() {
  const { user } = useAuth();
  return user.role === 'admin' ? <OwnerInbox /> : <CustomerChat />;
}

function CustomerChat() {
  const [id, setId] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/chat/conversations', { method: 'POST' }).then((d) => setId(d.id)).catch((e) => setError(e.message));
  }, []);
  return (
    <main className="page"><div className="wrap">
      <h1>Message the <span className="accent">store</span></h1>
      <div className="chat single">
        <section className="chat-pane">
          {error && <div className="err" style={{ margin: 16 }}>{error}</div>}
          {id ? <Thread id={id} base={null} /> : !error && <p className="empty">Loading…</p>}
        </section>
      </div>
    </div></main>
  );
}

function OwnerInbox() {
  const { id } = useParams();
  const activeId = id ? Number(id) : null;
  const [convs, setConvs] = useState(null);
  const load = useCallback(() => api('/chat/conversations').then(setConvs).catch(() => setConvs([])), []);
  useEffect(() => { load(); }, [load, activeId]);
  useLive(['chat:message', 'chat:read', 'resync'], load);

  return (
    <main className="page"><div className="wrap">
      <h1>Customer <span className="accent">messages</span></h1>
      <div className={`chat ${activeId ? 'has-active' : ''}`}>
        <aside className="chat-list" aria-label="Conversations">
          {convs && !convs.length && <p className="empty" style={{ padding: '28px 16px' }}>No messages yet. Customers can message the store from the Messages page.</p>}
          {convs?.map((c) => (
            <Link key={c.id} to={`/admin/messages/${c.id}`} className={`chat-item ${c.id === activeId ? 'on' : ''}`}>
              <Avatar src={c.customer_avatar} name={c.customer_name} size={44} />
              <span className="ci-body">
                <span className="ci-top"><b>{c.customer_name}</b><small>{dayTime(c.last_message_at)}</small></span>
                <span className="ci-last">{c.last_sender === 'admin' ? 'You: ' : ''}{c.last_body}</span>
              </span>
              {c.unread > 0 && c.id !== activeId && <span className="cn">{c.unread}</span>}
            </Link>
          ))}
        </aside>
        <section className="chat-pane">
          {activeId ? <Thread key={activeId} id={activeId} base="/admin/messages" /> : <p className="empty">Select a conversation.</p>}
        </section>
      </div>
    </div></main>
  );
}

function Thread({ id, base }) {
  const { user } = useAuth();
  const me = user.role;
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const box = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(() => api(`/chat/conversations/${id}/messages`)
    .then((d) => { setConv(d.conversation); setMessages(d.messages); setError(''); })
    .catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const add = (m) => setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));

  useLive('chat:message', (d) => {
    if (d.conversation_id !== id) return;
    add(d.message);
    if (d.message.sender_role !== me) api(`/chat/conversations/${id}/read`, { method: 'POST' }).catch(() => {});
  });
  // Nabasa na ng kabila ang mga mensahe ko -> "Seen"
  useLive('chat:read', (d) => {
    if (d.conversation_id !== id || d.reader === me) return;
    const now = new Date().toISOString();
    setMessages((list) => list.map((m) => (m.sender_role === me && !m.read_at ? { ...m, read_at: now } : m)));
  });
  useLive('resync', load);

  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [messages]);

  async function send(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setError('');
    try {
      add(await api(`/chat/conversations/${id}/messages`, { method: 'POST', body: { body } }));
      setText('');
    } catch (err) { setError(err.message); } finally { setSending(false); }
  }

  if (error && !conv) return <div style={{ padding: 16 }}><div className="err" role="alert">{error}</div></div>;
  if (!conv) return <p className="muted" style={{ padding: 16 }}>Loading…</p>;

  const title = me === 'admin' ? conv.customer_name : conv.store_name;
  // Profile picture ng bawat panig (ang inilagay nila sa kanilang profile)
  const avatarOf = (role) => (role === 'admin' ? conv.owner_avatar : conv.customer_avatar);
  const nameOf = (role) => (role === 'admin' ? conv.store_name : conv.customer_name);
  const theirRole = me === 'admin' ? 'customer' : 'admin';
  const lastMineIdx = messages.map((m) => m.sender_role).lastIndexOf(me);

  return (
    <div className="thread">
      <div className="thread-head">
        {base && <button type="button" className="back-chat" aria-label="Back to conversations" onClick={() => navigate(base)}><i className="fa-solid fa-arrow-left" aria-hidden="true" /></button>}
        <Avatar src={avatarOf(theirRole)} name={title} size={42} />
        <span className="th-name"><b>{title}</b><small>{me === 'admin' ? 'Customer' : 'Store owner'}</small></span>
      </div>
      <div className="thread-msgs" ref={box}>
        {!messages.length && <p className="empty"><i className="fa-regular fa-comments" aria-hidden="true" /> Say hello</p>}
        {messages.map((m, i) => {
          const mine = m.sender_role === me;
          return (
            <div key={m.id} className={`bubble-row ${mine ? 'mine' : ''}`}>
              <Avatar src={avatarOf(m.sender_role)} name={nameOf(m.sender_role)} size={32} className="bubble-av" />
              <div className="bubble-col">
                <div className="bubble">{m.body}</div>
                <small className="bubble-meta">{time(m.created_at)}{mine && i === lastMineIdx && m.read_at ? ' · Seen' : ''}</small>
              </div>
            </div>
          );
        })}
      </div>
      {error && <div className="err" role="alert" style={{ margin: '0 12px' }}>{error}</div>}
      <form className="thread-form" onSubmit={send}>
        <textarea rows={1} value={text} maxLength={2000} placeholder="Type a message…" aria-label="Message"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button type="submit" className="btn sm" disabled={sending || !text.trim()}>Send</button>
      </form>
    </div>
  );
}
