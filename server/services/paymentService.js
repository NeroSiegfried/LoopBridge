/**
 * LoopBridge — Payment Service
 *
 * Supports three payment providers:
 *   1. Paystack  — Nigerian cards, bank transfer, USSD, mobile money (NGN primary)
 *   2. Flutterwave — Nigerian + African + international cards/bank/mobile
 *   3. NOWPayments — Crypto: BTC, ETH, USDT, USDC, BNB, SOL, etc.
 *
 * Flow:
 *   1. Client calls POST /api/payments/initiate  → gets a checkout URL or payment details
 *   2. User pays on provider's hosted page
 *   3. Provider sends webhook to POST /api/payments/webhook/:provider
 *   4. Webhook verifies signature, marks payment success, calls progressRepo.markPaid()
 *   5. Client can also poll GET /api/payments/verify/:reference
 */
'use strict';

const https  = require('https');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { paymentRepo, progressRepo, courseRepo } = require('../repositories');

// ─── Internal HTTP helper ─────────────────────────────────────────────────────
function apiRequest(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// ─── Paystack ─────────────────────────────────────────────────────────────────
const paystackService = {
    async initiate({ userId, courseId, amount, currency, email, callbackUrl }) {
        if (!config.paystackSecretKey) throw Object.assign(new Error('Paystack not configured.'), { status: 503 });

        const reference = `lb_ps_${uuidv4().replace(/-/g, '').slice(0, 20)}`;
        const amountKobo = Math.round(amount * 100); // Paystack uses kobo

        const result = await apiRequest({
            hostname: 'api.paystack.co',
            path: '/transaction/initialize',
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.paystackSecretKey}`,
                'Content-Type': 'application/json'
            }
        }, {
            email,
            amount: amountKobo,
            currency: currency || 'NGN',
            reference,
            callback_url: callbackUrl || `${config.appBaseUrl}/payment/success`,
            metadata: { userId, courseId, loopbridge: true }
        });

        if (!result.body.status) throw Object.assign(new Error(result.body.message || 'Paystack init failed'), { status: 502 });

        await paymentRepo.create({ id: uuidv4(), userId, courseId, provider: 'paystack', reference, amount, currency: currency || 'NGN' });

        return {
            provider: 'paystack',
            reference,
            checkoutUrl: result.body.data.authorization_url,
            accessCode: result.body.data.access_code
        };
    },

    async verify(reference) {
        if (!config.paystackSecretKey) throw Object.assign(new Error('Paystack not configured.'), { status: 503 });

        const result = await apiRequest({
            hostname: 'api.paystack.co',
            path: `/transaction/verify/${encodeURIComponent(reference)}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${config.paystackSecretKey}` }
        });

        return result.body;
    },

    verifyWebhookSignature(rawBody, signature) {
        if (!config.paystackSecretKey) return false;
        const hash = crypto.createHmac('sha512', config.paystackSecretKey).update(rawBody).digest('hex');
        return hash === signature;
    }
};

// ─── Flutterwave ──────────────────────────────────────────────────────────────
const flutterwaveService = {
    async initiate({ userId, courseId, amount, currency, email, name, callbackUrl }) {
        if (!config.flutterwaveSecretKey) throw Object.assign(new Error('Flutterwave not configured.'), { status: 503 });

        const txRef = `lb_flw_${uuidv4().replace(/-/g, '').slice(0, 20)}`;

        const result = await apiRequest({
            hostname: 'api.flutterwave.com',
            path: '/v3/payments',
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.flutterwaveSecretKey}`,
                'Content-Type': 'application/json'
            }
        }, {
            tx_ref: txRef,
            amount,
            currency: currency || 'NGN',
            redirect_url: callbackUrl || `${config.appBaseUrl}/payment/success`,
            customer: { email, name },
            meta: { userId, courseId },
            customizations: { title: 'LoopBridge', logo: `${config.appBaseUrl}/images/logos/loopbridge.png` }
        });

        if (result.body.status !== 'success') throw Object.assign(new Error(result.body.message || 'Flutterwave init failed'), { status: 502 });

        await paymentRepo.create({ id: uuidv4(), userId, courseId, provider: 'flutterwave', reference: txRef, amount, currency: currency || 'NGN' });

        return {
            provider: 'flutterwave',
            reference: txRef,
            checkoutUrl: result.body.data.link
        };
    },

    async verify(txRef) {
        if (!config.flutterwaveSecretKey) throw Object.assign(new Error('Flutterwave not configured.'), { status: 503 });

        const result = await apiRequest({
            hostname: 'api.flutterwave.com',
            path: `/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${config.flutterwaveSecretKey}` }
        });
        return result.body;
    },

    verifyWebhookSignature(rawBody, signature) {
        if (!config.flutterwaveSecretKey) return false;
        const hash = crypto.createHmac('sha256', config.flutterwaveSecretKey).update(rawBody).digest('hex');
        return hash === signature;
    }
};

// ─── NOWPayments (Crypto) ─────────────────────────────────────────────────────
const nowpaymentsService = {
    async initiate({ userId, courseId, amount, currency, callbackUrl }) {
        if (!config.nowpaymentsApiKey) throw Object.assign(new Error('NOWPayments not configured.'), { status: 503 });

        const orderId = `lb_np_${uuidv4().replace(/-/g, '').slice(0, 20)}`;

        const result = await apiRequest({
            hostname: 'api.nowpayments.io',
            path: '/v1/invoice',
            method: 'POST',
            headers: {
                'x-api-key': config.nowpaymentsApiKey,
                'Content-Type': 'application/json'
            }
        }, {
            price_amount: amount,
            price_currency: currency || 'usd', // NOWPayments uses lowercase
            order_id: orderId,
            order_description: `LoopBridge course access: ${courseId}`,
            ipn_callback_url: `${config.appBaseUrl}/api/payments/webhook/nowpayments`,
            success_url: callbackUrl || `${config.appBaseUrl}/payment/success`,
            cancel_url: `${config.appBaseUrl}/payment/cancel`
        });

        if (!result.body.id) throw Object.assign(new Error(result.body.message || 'NOWPayments init failed'), { status: 502 });

        await paymentRepo.create({ id: uuidv4(), userId, courseId, provider: 'nowpayments', reference: orderId, amount, currency: (currency || 'USD').toUpperCase() });

        return {
            provider: 'nowpayments',
            reference: orderId,
            checkoutUrl: result.body.invoice_url,
            paymentId: result.body.id
        };
    },

    verifyIpnSignature(rawBody, signature) {
        if (!config.nowpaymentsIpnSecret) return false;
        const hash = crypto.createHmac('sha512', config.nowpaymentsIpnSecret).update(rawBody).digest('hex');
        return hash === signature;
    }
};

// ─── Main Payment Service ─────────────────────────────────────────────────────
const paymentService = {
    paystackService,
    flutterwaveService,
    nowpaymentsService,

    /**
     * Initiate a payment for a course.
     * provider: 'paystack' | 'flutterwave' | 'nowpayments'
     */
    async initiate({ provider, userId, courseId, email, name, currency }) {
        const course = await courseRepo.findById(courseId);
        if (!course) throw Object.assign(new Error('Course not found.'), { status: 404 });
        if (!course.price || course.price <= 0) throw Object.assign(new Error('This course is free — no payment needed.'), { status: 400 });

        const amount = course.price;
        const callbackUrl = `${config.appBaseUrl}/payment/success?courseId=${courseId}`;

        switch (provider) {
            case 'paystack':
                return paystackService.initiate({ userId, courseId, amount, currency: currency || 'NGN', email, callbackUrl });
            case 'flutterwave':
                return flutterwaveService.initiate({ userId, courseId, amount, currency: currency || 'NGN', email, name, callbackUrl });
            case 'nowpayments':
                return nowpaymentsService.initiate({ userId, courseId, amount, currency: currency || 'USD', callbackUrl });
            default:
                throw Object.assign(new Error(`Unknown provider: ${provider}`), { status: 400 });
        }
    },

    /**
     * Verify and finalise a payment by reference. Called by client after redirect.
     * Returns { ok, payment } or throws.
     */
    async verifyAndEnroll(reference, userId) {
        const payment = await paymentRepo.findByReference(reference);
        if (!payment) throw Object.assign(new Error('Payment record not found.'), { status: 404 });
        if (payment.userId !== userId) throw Object.assign(new Error('Payment does not belong to this user.'), { status: 403 });
        if (payment.status === 'success') {
            // Already processed — ensure enrollment exists
            await progressRepo.markPaid(userId, payment.courseId, payment.id);
            return { ok: true, payment };
        }

        let verified = false;
        let providerData = {};

        if (payment.provider === 'paystack') {
            const resp = await paystackService.verify(reference);
            if (resp.data?.status === 'success') { verified = true; providerData = resp.data; }
        } else if (payment.provider === 'flutterwave') {
            const resp = await flutterwaveService.verify(reference);
            if (resp.data?.status === 'successful') { verified = true; providerData = resp.data; }
        }
        // NOWPayments is async — only confirmed via IPN webhook

        if (!verified) throw Object.assign(new Error('Payment not yet confirmed.'), { status: 402 });

        await paymentRepo.updateStatus(reference, 'success', providerData);
        await progressRepo.markPaid(userId, payment.courseId, payment.id);
        return { ok: true, payment: await paymentRepo.findByReference(reference) };
    },

    /**
     * Handle Paystack webhook.
     * Express route must pass rawBody (Buffer) for signature verification.
     */
    async handlePaystackWebhook(rawBody, signature) {
        if (!paystackService.verifyWebhookSignature(rawBody, signature)) {
            throw Object.assign(new Error('Invalid webhook signature.'), { status: 401 });
        }
        const event = JSON.parse(rawBody.toString());
        if (event.event === 'charge.success') {
            const { reference } = event.data;
            const payment = await paymentRepo.findByReference(reference);
            if (payment && payment.status !== 'success') {
                await paymentRepo.updateStatus(reference, 'success', event.data);
                await progressRepo.markPaid(payment.userId, payment.courseId, payment.id);
            }
        }
        return { received: true };
    },

    /**
     * Handle Flutterwave webhook.
     */
    async handleFlutterwaveWebhook(rawBody, signature) {
        if (!flutterwaveService.verifyWebhookSignature(rawBody, signature)) {
            throw Object.assign(new Error('Invalid webhook signature.'), { status: 401 });
        }
        const event = JSON.parse(rawBody.toString());
        if (event.event === 'charge.completed' && event.data?.status === 'successful') {
            const reference = event.data.tx_ref;
            const payment = await paymentRepo.findByReference(reference);
            if (payment && payment.status !== 'success') {
                await paymentRepo.updateStatus(reference, 'success', event.data);
                await progressRepo.markPaid(payment.userId, payment.courseId, payment.id);
            }
        }
        return { received: true };
    },

    /**
     * Handle NOWPayments IPN webhook.
     */
    async handleNowpaymentsWebhook(rawBody, signature) {
        if (!nowpaymentsService.verifyIpnSignature(rawBody, signature)) {
            throw Object.assign(new Error('Invalid IPN signature.'), { status: 401 });
        }
        const event = JSON.parse(rawBody.toString());
        // payment_status: 'finished' or 'confirmed' = success
        if (['finished', 'confirmed'].includes(event.payment_status)) {
            const reference = event.order_id;
            const payment = await paymentRepo.findByReference(reference);
            if (payment && payment.status !== 'success') {
                await paymentRepo.updateStatus(reference, 'success', event);
                await progressRepo.markPaid(payment.userId, payment.courseId, payment.id);
            }
        }
        return { received: true };
    },

    async listByUser(userId) {
        return paymentRepo.listByUser(userId);
    }
};

module.exports = paymentService;
