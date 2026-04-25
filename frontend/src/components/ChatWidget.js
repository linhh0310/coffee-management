import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

const quickActions = [
  'Giới thiệu quán',
  'Xem menu và giá',
  'Gợi ý món',
  'Khuyến mãi hôm nay',
  'Đặt bàn / liên hệ'
];

function Bubble({ role, children }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm shadow-sm ${isUser ? 'bg-[#7a4a27] text-white' : 'bg-white text-[#2d1f16] border border-[#eadfd4]'}`}>
        {children}
      </div>
    </div>
  );
}

function getSessionId() {
  const key = 'coffee_chat_session_id';
  let value = localStorage.getItem(key);
  if (!value) {
    value = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, value);
  }
  return value;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Xin chào, mình có thể giúp bạn xem menu, gợi ý món, khuyến mãi và thông tin liên hệ.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const sessionIdRef = useRef(getSessionId());

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading, open]);

  const sendMessage = async (raw) => {
    const text = String(raw ?? input).trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post('/api/chat', { message: text, sessionId: sessionIdRef.current });
      const data = res.data || {};
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: data.reply || 'Mình có thể hỗ trợ bạn về menu, gợi ý món, khuyến mãi và liên hệ.',
          items: Array.isArray(data.items) ? data.items : [],
          action: data.action || null,
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : quickActions
        }
      ]);
    } catch (error) {
      const fallbackSuggestions = Array.isArray(error?.response?.data?.suggestions) ? error.response.data.suggestions : quickActions;
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: error?.response?.data?.message || 'Hiện tại mình chưa thể phản hồi, vui lòng thử lại sau.',
          items: [],
          action: null,
          suggestions: fallbackSuggestions
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const welcomeActions = useMemo(() => quickActions, []);

  return (
    <div className="fixed bottom-5 right-5 z-[9998]">
      {open && (
        <div className="mb-3 w-[360px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-3xl border border-[#eadfd4] bg-[#fffaf4] shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between bg-[#7a4a27] px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Coffee AI Assistant</p>
              <p className="text-[11px] text-white/80">Hỗ trợ nhanh cho khách hàng</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-white/10">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div ref={listRef} className="max-h-[420px] overflow-y-auto px-3 py-3 space-y-2">
            {messages.map((msg, idx) => (
              <div key={`${msg.role}-${idx}`} className="space-y-2">
                <Bubble role={msg.role}>{msg.text}</Bubble>
                {Array.isArray(msg.items) && msg.items.length > 0 && (
                  <div className="space-y-2.5">
                    {msg.items.map((item, itemIdx) => (
                      <div key={`${item.title}-${itemIdx}`} className="rounded-2xl border border-[#eee0d1] bg-white px-3 py-2.5 text-sm shadow-[0_6px_18px_rgba(122,74,39,0.06)]">
                        <div className="flex items-center gap-3">
                          <div className="relative h-14 w-14 shrink-0 rounded-2xl overflow-visible">
                            <div className="h-14 w-14 overflow-hidden rounded-2xl bg-[#f6ede4] ring-1 ring-[#efe1d2]">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[#b48a67]">
                                  <span className="material-symbols-outlined text-[24px]">local_cafe</span>
                                </div>
                              )}
                            </div>
                            {item.rank && (
                              <span className="absolute -left-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#c9832b] to-[#8b572a] text-[10px] font-extrabold text-white shadow-[0_4px_10px_rgba(139,87,42,0.35)] ring-2 ring-[#fffaf4]">
                                {item.rank}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold leading-5 text-[#2d1f16]">{item.title}</p>
                            {item.subtitle && <p className="mt-0.5 text-[11px] text-[#8a6b54]">{item.subtitle}</p>}
                            {item.meta && <p className="mt-0.5 text-[11px] text-[#a18167]">{item.meta}</p>}
                          </div>

                          {item.price && <p className="shrink-0 text-[12px] font-bold text-[#c86d12]">{item.price}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {msg.action && (
                  <a
                    href={msg.action.href}
                    className="inline-flex rounded-full bg-[#7a4a27] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5f3518]"
                  >
                    {msg.action.label}
                  </a>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-[#eadfd4] bg-white text-[#2d1f16] shadow-sm px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5" aria-label="Đang nhập">
                      <span className="h-2 w-2 rounded-full bg-[#c86d12] animate-bounce [animation-delay:-0.25s]" />
                      <span className="h-2 w-2 rounded-full bg-[#c86d12] animate-bounce [animation-delay:-0.1s]" />
                      <span className="h-2 w-2 rounded-full bg-[#c86d12] animate-bounce" />
                    </div>
                    <span className="text-[11px] font-medium text-[#8b6a4f]">Đang nhập...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#eadfd4] bg-white p-3">
            <div className="flex flex-wrap gap-2 mb-2">
              {welcomeActions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => sendMessage(item)}
                  className="rounded-full bg-[#f7efe7] px-3 py-1 text-[11px] font-semibold text-[#7a4a27] hover:bg-[#f1e3d3]"
                >
                  {item}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhập câu hỏi của bạn..."
                className="flex-1 rounded-2xl border border-[#e3cfb8] px-4 py-2 text-sm outline-none focus:border-[#c98a45]"
              />
              <button type="submit" className="rounded-2xl bg-[#7a4a27] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5f3518]">
                Gửi
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#7a4a27] text-white shadow-[0_14px_30px_rgba(122,74,39,0.35)] hover:bg-[#5f3518]"
      >
        <span className="material-symbols-outlined text-[24px]">chat</span>
      </button>
    </div>
  );
}
