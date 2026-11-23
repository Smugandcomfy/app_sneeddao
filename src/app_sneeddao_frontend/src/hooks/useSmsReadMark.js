// The Sneed SMS "new since I opened" mark and the read marking. Moved out of pages/SMS.jsx unchanged,
// so /sms and /messenger mark messages seen the same way.
import { useState, useEffect, useRef } from 'react';

/// `sms` is the shared inbox (useSmsInbox). `onCaptured(sms)` (optional) runs once, when the mark is
/// captured (the page uses it to show the inbox when there are new messages).
export function useSmsReadMark(sms, { onCaptured } = {}) {
    const onCapturedRef = useRef(onCaptured);
    onCapturedRef.current = onCaptured;

    // Message highlighting: the last-seen mark as it was when the page opened (messages newer than it
    // stay marked New while the page is open, also those that come in while it is open)
    const [capturedOldMessagesTimestamp, setCapturedOldMessagesTimestamp] = useState(null);

    // Helper function to check if a message is new (for highlighting)
    const isMessageNew = (messageTimestamp) => {
        const mark = capturedOldMessagesTimestamp ?? sms?.lastSeen;
        if (mark === null || mark === undefined) return false;
        return BigInt(messageTimestamp) > BigInt(mark);
    };

    // Last-seen mark: capture it once (as the canister has it) when the page opens, then mark
    // everything shown as seen, also messages that come in while the page is open and visible
    useEffect(() => {
        if (!sms?.lastSeenFresh || capturedOldMessagesTimestamp !== null) return;
        setCapturedOldMessagesTimestamp(sms.lastSeen ?? 0n);
        onCapturedRef.current?.(sms);
    }, [sms?.lastSeenFresh, sms?.lastSeen, sms?.unreadCount, capturedOldMessagesTimestamp]);

    const newestReceived = sms?.received?.items?.[0]?.created_at ?? null;
    useEffect(() => {
        if (capturedOldMessagesTimestamp === null || newestReceived === null) return;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        sms?.markSeen(newestReceived);
    }, [capturedOldMessagesTimestamp, newestReceived]);

    return {
        capturedOldMessagesTimestamp,
        isMessageNew,
        unreadMark: capturedOldMessagesTimestamp ?? sms?.lastSeen ?? null,
    };
}
