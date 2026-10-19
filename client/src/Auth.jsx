import React, { useEffect, useState } from 'react';
import './auth.css';

async function authRequest(path, body) {
  let response;
  try {
    response = await fetch(`/api/auth/${path}`, { method: body || path === 'logout' ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  } catch { throw new Error('Unable to reach Gather. Check your connection and try again.'); }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.errors ? Object.entries(data.errors).map(([field, message]) => `${field}: ${message}`).join(' ') : data?.message || 'Unable to complete your request. Please try again.');
    error.status = response.status;
    throw error;
  }
  if (!data?.user) throw new Error('The server returned an unexpected response. Please try again.');
  return data.user;
}

function Brand() {
  return <a className="brand" href="./" aria-label="Gather home"><span className="brand-icon"><i/><i/><i/><i/></span>gather<span className="brand-period">.</span></a>;
}

function AuthForm({ onAuthenticated, notice }) {
  const [register, setRegister] = useState(false);
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (register && !values.name.trim()) return setError('Please enter your name.');
    if (register && values.password !== values.confirm) return setError('Your passwords do not match.');
    setBusy(true);
    try {
      const user = await authRequest(register ? 'register' : 'login', { email: values.email.trim(), password: values.password, ...(register ? { name: values.name.trim() } : {}) });
      onAuthenticated(user);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  function switchMode() { setRegister(!register); setError(''); setValues({ ...values, password: '', confirm: '' }); setVisible(false); }
  return <div className="auth-page"><aside className="auth-story"><Brand/><div className="auth-story-copy"><span className="eyebrow">A PLACE FOR YOUR PEOPLE</span><h1>Good connections.<br/>A little closer<span className="heading-dot">.</span></h1><p>From familiar faces to future collaborators, give your connections a home.</p><div className="auth-connection-art" aria-hidden="true"><span>FR</span><span>+ YOU</span><span>WK</span><i/><i/></div></div><p className="auth-story-footer">A little organization. A lot of connection.</p></aside><main className="auth-main"><div className="auth-mobile-brand"><Brand/></div><section className="auth-card" aria-labelledby="auth-title"><span className="eyebrow">YOUR PERSONAL ADDRESS BOOK</span><h2 id="auth-title">{register ? 'Make yourself at home.' : 'Welcome back.'}</h2><p className="auth-intro">{register ? 'Create an account and start gathering your people.' : 'Sign in to pick up where you left off.'}</p>{notice && <p className="auth-notice" role="status">{notice}</p>}<form onSubmit={submit} className="auth-form"><fieldset disabled={busy}>{register && <label htmlFor="auth-name">Your name<input id="auth-name" name="name" autoComplete="name" required maxLength={80} value={values.name} onChange={e => setValues({ ...values, name: e.target.value })}/></label>}<label htmlFor="auth-email">Email address<input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254} value={values.email} onChange={e => setValues({ ...values, email: e.target.value })}/></label><label htmlFor="auth-password">Password<input id="auth-password" name="password" type={visible ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 12 : undefined} maxLength={128} aria-describedby={register ? 'password-help' : undefined} value={values.password} onChange={e => setValues({ ...values, password: e.target.value })}/></label>{register && <p className="password-help" id="password-help">Use 12 to 128 characters for your password.</p>}{register && <label htmlFor="auth-confirm">Confirm password<input id="auth-confirm" name="confirmPassword" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={128} value={values.confirm} onChange={e => setValues({ ...values, confirm: e.target.value })}/></label>}<label className="show-password"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)}/>Show password{register ? 's' : ''}</label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary auth-submit" disabled={busy}>{busy ? 'Please wait...' : register ? 'Create account' : 'Sign in'}<span aria-hidden="true"> &rarr;</span></button></fieldset></form><p className="auth-switch">{register ? 'Already have an account?' : 'New to Gather?'} <button onClick={switchMode} disabled={busy}>{register ? 'Sign in' : 'Create an account'}</button></p></section><p className="auth-main-footer">Your network is more than a list. Keep it growing.</p></main></div>;
}

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);
  async function boot() {
    setLoading(true); setError('');
    try { setUser(await authRequest('me')); }
    catch (err) { if (err.status === 401) setUser(null); else setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    boot();
    const expired = () => { setUser(null); setError(''); setNotice('Your session has expired. Please sign in again.'); };
    window.addEventListener('gather:session-expired', expired);
    return () => window.removeEventListener('gather:session-expired', expired);
  }, []);
  async function logout() {
    setLogoutBusy(true); setError('');
    try { await authRequest('logout'); setUser(null); setNotice('You have been signed out. See you soon.'); }
    catch (err) { setError(err.message); }
    finally { setLogoutBusy(false); }
  }
  if (loading || (!user && error)) return <div className="auth-boot"><Brand/><div className="state-panel">{loading ? <><span className="spinner"/><h2>Making yourself at home...</h2><p role="status">Checking your session.</p></> : <><h2>We could not connect to Gather</h2><p role="alert">{error}</p><button className="button primary" onClick={boot}>Try again</button></>}</div></div>;
  if (!user) return <AuthForm onAuthenticated={value => { setUser(value); setNotice(''); setError(''); }} notice={notice}/>;
  return <>{error && <div className="session-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss sign out error">&times;</button></div>}{children({ user, logout, logoutBusy })}</>;
}
