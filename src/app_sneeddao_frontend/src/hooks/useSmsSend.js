// Sending Sneed SMS messages: the sneed_sms actor, the regular and premium limits, and one send
// function. Moved out of pages/SMS.jsx unchanged, so /sms and /messenger send the same way.
import { useState, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { createActor as createSmsActor } from '../../../declarations/sneed_sms';
import { usePremiumStatus } from './usePremiumStatus';

/// The text of a send_message error.
export const smsErrorText = (err) => {
    if (err?.RateLimited) return `Rate Limited: ${err.RateLimited}`;
    if (err?.InvalidInput) return `Invalid Input: ${err.InvalidInput}`;
    if (err?.Unauthorized) return `Unauthorized: ${err.Unauthorized}`;
    if (err?.NotFound) return `Not Found: ${err.NotFound}`;
    if (err?.AlreadyExists) return `Already Exists: ${err.AlreadyExists}`;
    return 'Failed to send message';
};

/// `sms` is the shared inbox (useSmsInbox): a successful send syncs it.
export function useSmsSend({ identity, isAuthenticated, sms }) {
    const [config, setConfig] = useState(null);
    const [premiumConfig, setPremiumConfig] = useState(null);

    // Premium status
    const { isPremium } = usePremiumStatus(identity);

    // Effective limits based on premium status
    const effectiveSubjectLimit = (isPremium && premiumConfig?.premium_max_subject_length)
        ? premiumConfig.premium_max_subject_length
        : (config?.max_subject_length || 200);
    const effectiveBodyLimit = (isPremium && premiumConfig?.premium_max_body_length)
        ? premiumConfig.premium_max_body_length
        : (config?.max_body_length || 5000);
    const effectiveMaxRecipients = (isPremium && premiumConfig?.premium_max_recipients)
        ? premiumConfig.premium_max_recipients
        : (config?.max_recipients || 20);
    const regularSubjectLimit = config?.max_subject_length || 200;
    const regularBodyLimit = config?.max_body_length || 5000;
    const regularMaxRecipients = config?.max_recipients || 20;
    const hasPremiumSubjectLimit = isPremium && effectiveSubjectLimit > regularSubjectLimit;
    const hasPremiumBodyLimit = isPremium && effectiveBodyLimit > regularBodyLimit;
    const hasPremiumMaxRecipients = isPremium && effectiveMaxRecipients > regularMaxRecipients;

    // Create SMS actor
    const getSmsActor = () => {
        if (!identity) return null;
        // Use the canister ID from environment or fallback to the IC canister ID
        const canisterId = process.env.CANISTER_ID_SNEED_SMS || 'v33jy-4qaaa-aaaad-absna-cai';
        return createSmsActor(canisterId, {
            agentOptions: { identity }
        });
    };

    // Fetch SMS config (regular and premium)
    const fetchConfig = async () => {
        try {
            const actor = getSmsActor();
            if (!actor) return;

            const [regularConfig, premiumCfg] = await Promise.all([
                actor.get_config(),
                actor.get_premium_config().catch(() => null)
            ]);

            // Normalize candid nat values (BigInt) into Numbers for safe arithmetic in the UI.
            // (Otherwise expressions like `effectiveSubjectLimit - subject.length` can throw.)
            setConfig({
                ...regularConfig,
                max_subject_length: Number(regularConfig?.max_subject_length ?? 200),
                max_body_length: Number(regularConfig?.max_body_length ?? 5000),
                max_recipients: Number(regularConfig?.max_recipients ?? 20)
            });
            if (premiumCfg) {
                setPremiumConfig({
                    sneed_premium_canister_id: premiumCfg.sneed_premium_canister_id?.[0]?.toString() || null,
                    premium_max_subject_length: Number(premiumCfg.premium_max_subject_length),
                    premium_max_body_length: Number(premiumCfg.premium_max_body_length),
                    premium_rate_limit_minutes: Number(premiumCfg.premium_rate_limit_minutes ?? 1),
                    premium_max_recipients: Number(premiumCfg.premium_max_recipients ?? 50)
                });
            }
        } catch (err) {
            console.error('Error fetching SMS config:', err);
        }
    };

    useEffect(() => {
        if (isAuthenticated) fetchConfig();
    }, [isAuthenticated]);

    /// Sends one message (the compose dialog and the Conversations view): { ok: true } or { ok: false, error }.
    const submitSms = async ({ recipients, subject, body, replyTo = null }) => {
        const actor = getSmsActor();
        if (!actor) return { ok: false, error: 'Not signed in' };
        try {
            const result = await actor.send_message({
                recipients: recipients.map((r) => Principal.fromText(String(r).trim())),
                subject,
                body,
                reply_to: replyTo !== null && replyTo !== undefined ? [[BigInt(replyTo)]] : [] // Optional array containing array of BigInt
            });
            if (!('ok' in result)) return { ok: false, error: smsErrorText(result.err) };
            await sms?.sync({ includeSent: true });
            return { ok: true };
        } catch (err) {
            console.error('Error sending message:', err);
            return { ok: false, error: 'Failed to send message: ' + (err.message || err.toString()) };
        }
    };

    return {
        getSmsActor, submitSms, config, premiumConfig, isPremium,
        effectiveSubjectLimit, effectiveBodyLimit, effectiveMaxRecipients,
        regularSubjectLimit, regularBodyLimit, regularMaxRecipients,
        hasPremiumSubjectLimit, hasPremiumBodyLimit, hasPremiumMaxRecipients,
        limits: { subject: effectiveSubjectLimit, body: effectiveBodyLimit, recipients: effectiveMaxRecipients },
    };
}
