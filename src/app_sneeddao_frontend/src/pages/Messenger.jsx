// /messenger: only the Sneed SMS conversations, filling the window. The same page serves a pop-out
// window (Pop out on /sms), a tab of its own and the installed app's Messages shortcut. No site header;
// "Full view" goes back to /sms. Sending, limits and read marks are the ones /sms uses
// (hooks/useSmsSend.js, hooks/useSmsReadMark.js).
//   /messenger                     the conversation list
//   /messenger?with=<p>[,<p>…]     that conversation open (?recipient= is the same, as on /sms)
//   /messenger?compact=1           one pane at any width
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Principal } from '@dfinity/principal';
import { useAuth } from '../AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSmsInbox } from '../contexts/SmsContext';
import ThemeToggle from '../components/ThemeToggle';
import SmsConversations from '../components/SmsConversations';
import { useSmsSend } from '../hooks/useSmsSend';
import { useSmsReadMark } from '../hooks/useSmsReadMark';
import { keyFromWithParam, SMS_ACCENT, SMS_ACCENT_DARK } from '../utils/smsConversations';
import { FaComments, FaExternalLinkAlt } from 'react-icons/fa';

const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const BAR_HEIGHT = 44;

const isPrincipal = (t) => { Principal.fromText(t); return true; };

/// The tab or window title: "Messages", "(3) Messages" while three are unread; the old title comes back.
function useDocumentTitle(title) {
    useEffect(() => {
        const before = document.title;
        return () => { document.title = before; };
    }, []);
    useEffect(() => { document.title = title; }, [title]);
}

export default function Messenger() {
    const { theme } = useTheme();
    const { identity, isAuthenticated, login } = useAuth();
    const [searchParams] = useSearchParams();
    const sms = useSmsInbox({ active: true });
    const { submitSms, limits } = useSmsSend({ identity, isAuthenticated, sms });
    const { unreadMark } = useSmsReadMark(sms);
    const [loadingOlder, setLoadingOlder] = useState(false);

    const me = identity?.getPrincipal().toString();
    const withParam = searchParams.get('with') ?? searchParams.get('recipient');
    const initialKey = useMemo(() => (me && withParam ? keyFromWithParam(withParam, me, isPrincipal) : null), [me, withParam]);
    const compact = searchParams.get('compact') === '1';

    // opening the page: check for new messages now (and the sent list), as /sms does
    useEffect(() => {
        if (isAuthenticated) sms?.sync({ includeSent: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated]);

    const unread = isAuthenticated ? (sms?.unreadCount ?? 0) : 0;
    useDocumentTitle(unread > 0 ? `(${unread}) Messages` : 'Messages');

    const received = sms?.received;
    const sent = sms?.sent;
    const loaded = !!(received?.loaded && sent?.loaded);
    const hasOlder = sms?.mode === 'paged' && !!(received?.hasOlder || sent?.hasOlder);
    const loadOlder = async () => {
        setLoadingOlder(true);
        try { await sms?.loadOlder('all'); } catch (e) { console.error('Failed to load older messages', e); } finally { setLoadingOlder(false); }
    };

    // "Full view": in a pop-out, the window that opened it when it is still on this site; else this tab
    const fullView = (e) => {
        const opener = window.opener;
        try {
            if (opener && !opener.closed && opener.location.origin === window.location.origin) {
                e.preventDefault();
                opener.location.assign('/sms?view=conversations');
                opener.focus();
            }
        } catch (_) { /* another site: follow the link */ }
    };

    const bar = (
        <div style={{
            height: BAR_HEIGHT, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0 calc(0.75rem + env(safe-area-inset-right, 0px)) 0 calc(0.75rem + env(safe-area-inset-left, 0px))',
            borderBottom: `1px solid ${theme.colors.border}`, background: theme.colors.secondaryBg,
        }}>
            <span style={{ width: 26, height: 26, borderRadius: '8px', display: 'grid', placeItems: 'center', color: '#fff', background: `linear-gradient(135deg, ${SMS_ACCENT}, ${SMS_ACCENT_DARK})`, flexShrink: 0 }}>
                <FaComments size={13} />
            </span>
            <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: theme.colors.primaryText, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Messages
                {unread > 0 && (
                    <span aria-label={`${unread} unread`} style={{ marginLeft: '0.45rem', background: SMS_ACCENT, color: '#fff', borderRadius: '999px', padding: '0 0.45rem', fontSize: '0.72rem', fontWeight: 700, lineHeight: '1.25rem', display: 'inline-block', verticalAlign: 'middle' }}>
                        {unread}
                    </span>
                )}
            </h1>
            <Link to="/sms?view=conversations" onClick={fullView} title="Open Sneed SMS with every view"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: theme.colors.secondaryText, textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                <FaExternalLinkAlt size={11} /> Full view
            </Link>
            <ThemeToggle iconOnly />
        </div>
    );

    return (
        <div style={{
            position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: theme.colors.primaryBg,
            fontFamily: SYSTEM_FONT, paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 1,
        }}>
            {bar}
            <main style={{ flex: 1, minHeight: 0, padding: '0.5rem calc(0.5rem + env(safe-area-inset-right, 0px)) 0.5rem calc(0.5rem + env(safe-area-inset-left, 0px))' }}>
                {isAuthenticated && me ? (
                    <SmsConversations
                        key={initialKey || 'list'}
                        me={me}
                        received={received?.items}
                        sent={sent?.items}
                        unreadMark={unreadMark}
                        loaded={loaded}
                        hasOlder={hasOlder}
                        loadingOlder={loadingOlder}
                        onLoadOlder={loadOlder}
                        send={submitSms}
                        limits={limits}
                        accent={SMS_ACCENT}
                        accentDark={SMS_ACCENT_DARK}
                        onOpenMessage={(m) => window.open(`/msg/${m.id}`, '_blank', 'noopener')}
                        initialKey={initialKey}
                        fill
                        narrow={compact}
                    />
                ) : (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: theme.colors.secondaryText, textAlign: 'center', padding: '1rem' }}>
                        <FaComments size={32} style={{ opacity: 0.5 }} />
                        <span>Sign in to see your messages.</span>
                        <button type="button" onClick={login}
                            style={{ background: `linear-gradient(135deg, ${SMS_ACCENT}, ${SMS_ACCENT_DARK})`, color: '#fff', border: 'none', borderRadius: '10px', padding: '0.6rem 1.2rem', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', fontFamily: SYSTEM_FONT }}>
                            Sign in
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
