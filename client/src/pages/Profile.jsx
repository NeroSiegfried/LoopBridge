import { useEffect, useMemo, useState } from 'react';
import SEO from '../components/SEO';
import { profileApi } from '../api';
import { useAuth } from '../context/AuthContext';
import '../styles/profile.css';

const initialState = {
  email: { value: '', channel: 'email', requestId: null, otpCode: '', sending: false, verifying: false, status: '' },
  phone: { value: '', channel: 'sms', requestId: null, otpCode: '', sending: false, verifying: false, status: '' },
  username: { value: '', channel: 'email', requestId: null, otpCode: '', sending: false, verifying: false, status: '' },
};

export default function Profile() {
  const { user, refreshSession } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [forms, setForms] = useState(initialState);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    profileApi.get()
      .then((data) => {
        const current = data.user || null;
        setProfileUser(current);
        setForms((prev) => ({
          ...prev,
          email: { ...prev.email, value: current?.email || '' },
          phone: { ...prev.phone, value: current?.phone || '' },
          username: { ...prev.username, value: current?.username || '' },
        }));
      })
      .catch((err) => setError(err.message));
  }, [user]);

  const canShow = useMemo(() => !!profileUser, [profileUser]);

  const patchForm = (field, patch) => {
    setForms((prev) => ({ ...prev, [field]: { ...prev[field], ...patch } }));
  };

  const requestOtp = async (field) => {
    const state = forms[field];
    setError('');
    patchForm(field, { sending: true, status: '' });
    try {
      const response = await profileApi.requestChangeOtp({
        field,
        value: state.value,
        channel: state.channel,
      });
      patchForm(field, {
        requestId: response.requestId,
        status: `OTP sent via ${response.channel}.`,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      patchForm(field, { sending: false });
    }
  };

  const verifyOtp = async (field) => {
    const state = forms[field];
    setError('');
    if (!state.requestId || !state.otpCode) {
      setError('Request OTP first, then enter the code.');
      return;
    }

    patchForm(field, { verifying: true, status: '' });
    try {
      const response = await profileApi.verifyChangeOtp({
        requestId: state.requestId,
        code: state.otpCode,
      });
      setProfileUser(response.user);
      await refreshSession();
      patchForm(field, {
        requestId: null,
        otpCode: '',
        status: `${field} updated successfully.`,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      patchForm(field, { verifying: false });
    }
  };

  if (!user) {
    return (
      <section className="profile-page">
        <div className="section-container">
          <h1>Profile</h1>
          <p>Please log in to manage your profile data.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <SEO title="Profile — LoopBridge" description="Manage your profile details and security settings." />
      <section className="profile-page">
        <div className="section-container">
          <h1>Profile Settings</h1>
          <p className="profile-subtitle">Manage email, phone number, and username with OTP verification.</p>

          {error && <div className="profile-error">{error}</div>}

          {canShow && (
            <div className="profile-grid">
              <ProfileCard
                label="Email"
                field="email"
                value={forms.email.value}
                setValue={(value) => patchForm('email', { value })}
                channel={forms.email.channel}
                setChannel={(channel) => patchForm('email', { channel })}
                requestId={forms.email.requestId}
                otpCode={forms.email.otpCode}
                setOtpCode={(otpCode) => patchForm('email', { otpCode })}
                status={forms.email.status}
                sending={forms.email.sending}
                verifying={forms.email.verifying}
                onRequest={() => requestOtp('email')}
                onVerify={() => verifyOtp('email')}
                channelOptions={[{ value: 'email', label: 'Email OTP' }]}
              />

              <ProfileCard
                label="Phone Number"
                field="phone"
                value={forms.phone.value}
                setValue={(value) => patchForm('phone', { value })}
                channel={forms.phone.channel}
                setChannel={(channel) => patchForm('phone', { channel })}
                requestId={forms.phone.requestId}
                otpCode={forms.phone.otpCode}
                setOtpCode={(otpCode) => patchForm('phone', { otpCode })}
                status={forms.phone.status}
                sending={forms.phone.sending}
                verifying={forms.phone.verifying}
                onRequest={() => requestOtp('phone')}
                onVerify={() => verifyOtp('phone')}
                channelOptions={[{ value: 'sms', label: 'SMS OTP' }, { value: 'whatsapp', label: 'WhatsApp OTP' }]}
              />

              <ProfileCard
                label="Username"
                field="username"
                value={forms.username.value}
                setValue={(value) => patchForm('username', { value })}
                channel={forms.username.channel}
                setChannel={(channel) => patchForm('username', { channel })}
                requestId={forms.username.requestId}
                otpCode={forms.username.otpCode}
                setOtpCode={(otpCode) => patchForm('username', { otpCode })}
                status={forms.username.status}
                sending={forms.username.sending}
                verifying={forms.username.verifying}
                onRequest={() => requestOtp('username')}
                onVerify={() => verifyOtp('username')}
                channelOptions={[
                  { value: 'email', label: 'Email OTP' },
                  { value: 'sms', label: 'SMS OTP' },
                  { value: 'whatsapp', label: 'WhatsApp OTP' },
                ]}
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function ProfileCard({
  label,
  field,
  value,
  setValue,
  channel,
  setChannel,
  requestId,
  otpCode,
  setOtpCode,
  status,
  sending,
  verifying,
  onRequest,
  onVerify,
  channelOptions,
}) {
  return (
    <article className="profile-card">
      <h2>{label}</h2>
      <label htmlFor={`profile-${field}`}>New {label}</label>
      <input id={`profile-${field}`} value={value} onChange={(e) => setValue(e.target.value)} />

      <label htmlFor={`profile-${field}-channel`}>OTP Channel</label>
      <select id={`profile-${field}-channel`} value={channel} onChange={(e) => setChannel(e.target.value)}>
        {channelOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <button type="button" className="btn-primary" onClick={onRequest} disabled={sending || !value}>
        {sending ? 'Sending OTP…' : 'Request OTP'}
      </button>

      {requestId && (
        <>
          <label htmlFor={`profile-${field}-otp`}>Enter OTP</label>
          <input id={`profile-${field}-otp`} value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
          <button type="button" className="btn-secondary" onClick={onVerify} disabled={verifying || !otpCode}>
            {verifying ? 'Verifying…' : 'Verify & Update'}
          </button>
        </>
      )}

      {status && <p className="profile-status">{status}</p>}
    </article>
  );
}
