/**
 * LoopBridge — Payment Routes
 *
 * POST /api/payments/initiate              — start a payment         (auth required)
 * GET  /api/payments/verify/:reference     — verify after redirect   (auth required)
 * GET  /api/payments/history               — user's payment history  (auth required)
 * POST /api/payments/webhook/paystack      — Paystack webhook        (no auth — signed)
 * POST /api/payments/webhook/flutterwave   — Flutterwave webhook     (no auth — signed)
 * POST /api/payments/webhook/nowpayments   — NOWPayments IPN         (no auth — signed)
 *
 * NOTE: webhook signature verification reads `req.rawBody` (the exact bytes of
 * the request), which is captured by the global `express.json({ verify })` in
 * index.js. Do NOT add a separate body parser here — it would consume the
 * already-read stream and leave rawBody empty.
 */
'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { paymentService } = require('../services');

const router = express.Router();

// ─── Initiate payment ────────────────────────────────────
router.post('/initiate', requireAuth, async (req, res) => {
    try {
        const { provider, courseId, currency } = req.body;
        if (!provider || !courseId) {
            return res.status(400).json({ error: 'provider and courseId are required.' });
        }
        const result = await paymentService.initiate({
            provider,
            userId: req.user.id,
            courseId,
            email: req.user.email,
            name: req.user.displayName,
            currency
        });
        return res.json(result);
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message });
    }
});

// ─── Verify after redirect ───────────────────────────────
router.get('/verify/:reference', requireAuth, async (req, res) => {
    try {
        const result = await paymentService.verifyAndEnroll(req.params.reference, req.user.id);
        return res.json(result);
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message });
    }
});

// ─── Payment history ─────────────────────────────────────
router.get('/history', requireAuth, async (req, res) => {
    const payments = await paymentService.listByUser(req.user.id);
    return res.json(payments);
});

// ─── Webhooks ────────────────────────────────────────────
// req.rawBody (Buffer) is captured globally in index.js for signature checks.
router.post('/webhook/paystack', async (req, res) => {
    try {
        const sig = req.headers['x-paystack-signature'];
        await paymentService.handlePaystackWebhook(req.rawBody, sig);
        return res.sendStatus(200);
    } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
    }
});

router.post('/webhook/flutterwave', async (req, res) => {
    try {
        const sig = req.headers['verif-hash'];
        await paymentService.handleFlutterwaveWebhook(req.rawBody, sig);
        return res.sendStatus(200);
    } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
    }
});

router.post('/webhook/nowpayments', async (req, res) => {
    try {
        const sig = req.headers['x-nowpayments-sig'];
        await paymentService.handleNowpaymentsWebhook(req.rawBody, sig);
        return res.sendStatus(200);
    } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
    }
});

module.exports = router;
