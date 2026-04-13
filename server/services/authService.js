/**
 * LoopBridge — Auth Service
 *
 * Business logic for authentication: login, logout, session validation,
 * Google SSO, and phone OTP signup.
 * No HTTP concepts — receives plain args, returns plain objects or throws.
 */
'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const config = require('../config');
const { userRepo, sessionRepo, otpRepo } = require('../repositories');

const googleClient = config.googleClientId
    ? new OAuth2Client(config.googleClientId)
    : null;

function sanitiseUser(row) {
    return {
        id: row.uid || row.id,
        username: row.username,
        displayName: row.display_name,
        email: row.email,
        role: row.role,
        avatar: row.avatar,
        authorOf: JSON.parse(row.author_of || '[]')
    };
}

/**
 * Create a new session for a user row and return { user, sessionId, expiresAt }.
 */
async function createSession(userRow) {
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + config.sessionTtlMs).toISOString();
    await sessionRepo.create({ id: sessionId, userId: userRow.id, expiresAt });
    return { user: sanitiseUser(userRow), sessionId, expiresAt };
}

const authService = {
    /**
     * Validate credentials and create a session.
     * @returns {{ user, sessionId, expiresAt }} or throws
     */
    async login(username, password) {
        if (!username || !password) {
            const err = new Error('Username and password are required.');
            err.status = 400;
            throw err;
        }

        const user = await userRepo.findByUsername(username);
        if (!user) {
            const err = new Error('Invalid credentials.');
            err.status = 401;
            throw err;
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            const err = new Error('Invalid credentials.');
            err.status = 401;
            throw err;
        }

        return createSession(user);
    },

    /**
     * Google Sign-In: verify the ID token, find-or-create the user, create session.
     */
    async googleLogin(idToken) {
        if (!googleClient) {
            const err = new Error('Google Sign-In is not configured on this server.');
            err.status = 501;
            throw err;
        }

        let ticket;
        try {
            ticket = await googleClient.verifyIdToken({
                idToken,
                audience: config.googleClientId
            });
        } catch {
            const err = new Error('Invalid Google token.');
            err.status = 401;
            throw err;
        }

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        // 1. Try to find by google_id
        let user = await userRepo.findByGoogleId(googleId);
        if (user) return createSession(user);

        // 2. Try to find by email and link google_id
        user = await userRepo.findByEmail(email);
        if (user) {
            await userRepo.linkGoogleId(user.id, googleId);
            return createSession(user);
        }

        // 3. Create new user
        const newId = uuidv4();
        const username = email.split('@')[0] + '_g' + googleId.slice(-4);
        const randomPw = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
        user = await userRepo.create({
            id: newId,
            username,
            passwordHash: randomPw,
            displayName: name || username,
            email,
            role: 'user',
            avatar: picture || null,
            googleId
        });
        return createSession(user);
    },

    /**
     * Send OTP to a phone number. Returns { channel, expiresInSeconds }.
     * In dev mode, the OTP is logged to console and returned in response.
     */
    async sendOtp(phone, channel = 'email') {
        if (!phone) {
            const err = new Error('Phone number is required.');
            err.status = 400;
            throw err;
        }

        const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

        await otpRepo.create({ phone, code, channel, expiresAt });

        // ── Production: integrate actual send providers here ──
        // For email: use nodemailer / SES
        // For WhatsApp: use Twilio WhatsApp API
        // For now, log it (dev mode) so you can test:
        console.log(`[OTP] ${channel.toUpperCase()} code for ${phone}: ${code}`);

        return {
            channel,
            expiresInSeconds: 600,
            // Include OTP in response ONLY in development for testing
            ...(config.nodeEnv === 'development' ? { code } : {})
        };
    },

    /**
     * Verify OTP and create/login user.
     */
    async verifyOtpAndLogin({ phone, code, channel = 'email', displayName, email }) {
        if (!phone || !code) {
            const err = new Error('Phone and OTP code are required.');
            err.status = 400;
            throw err;
        }

        const record = await otpRepo.findValid(phone, code, channel);
        if (!record) {
            const err = new Error('Invalid or expired OTP code.');
            err.status = 401;
            throw err;
        }

        await otpRepo.markUsed(record.id);

        // Find existing user by phone
        let user = await userRepo.findByPhone(phone);
        if (user) {
            if (!user.phone_verified) {
                await userRepo.setPhoneVerified(user.id, phone);
            }
            return createSession(user);
        }

        // If email provided, check if user exists with that email
        if (email) {
            user = await userRepo.findByEmail(email);
            if (user) {
                await userRepo.setPhoneVerified(user.id, phone);
                return createSession(user);
            }
        }

        // Create new user
        const newId = uuidv4();
        const username = 'user_' + phone.replace(/\D/g, '').slice(-6);
        const randomPw = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
        user = await userRepo.create({
            id: newId,
            username,
            passwordHash: randomPw,
            displayName: displayName || username,
            email: email || `${phone.replace(/\D/g, '')}@phone.loopbridge.local`,
            role: 'user',
            phone
        });
        await userRepo.setPhoneVerified(newId, phone);
        return createSession(user);
    },

    /**
     * Destroy a session.
     */
    async logout(sessionId) {
        if (sessionId) {
            await sessionRepo.deleteById(sessionId);
        }
    },

    /**
     * Look up the current session + user.
     * @returns {Object|null} user object or null
     */
    async getSession(sessionId) {
        if (!sessionId) return null;
        const row = await sessionRepo.findValidWithUser(sessionId);
        if (!row) return null;
        return sanitiseUser(row);
    }
};

module.exports = authService;
