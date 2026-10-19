import mongoose from 'mongoose';

export const groups = ['Work', 'Friends', 'Family', 'Other'];
export const limits = { firstName: 80, lastName: 80, email: 254, phone: 40, company: 120, jobTitle: 120, notes: 2000 };
export function validateContact(body) {
  const errors = {};
  const value = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { errors: { form: 'Provide a contact object.' }, value };
  for (const [field, max] of Object.entries(limits)) {
    if (body[field] !== undefined && typeof body[field] !== 'string') errors[field] = 'Must be text.';
    value[field] = typeof body[field] === 'string' ? body[field].trim() : '';
    if (value[field].length > max) errors[field] = `Use ${max} characters or fewer.`;
  }
  if (!value.firstName) errors.firstName = 'First name is required.';
  if (!value.email) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) errors.email = 'Enter a valid email address.';
  value.email = value.email.toLowerCase();
  if (value.phone && !/^[+\d() .\-extEXT#]{3,40}$/.test(value.phone)) errors.phone = 'Enter a valid phone number.';
  value.group = body.group === undefined ? 'Other' : body.group;
  if (!groups.includes(value.group)) errors.group = 'Choose Work, Friends, Family, or Other.';
  return { errors, value };
}

const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ...Object.fromEntries(Object.entries(limits).map(([field, maxlength]) => [field, { type: String, trim: true, maxlength, required: ['firstName', 'email'].includes(field) }])),
  group: { type: String, enum: groups, default: 'Other' }
}, { timestamps: true, versionKey: false });
schema.index({ owner: 1, email: 1 }, { unique: true });
export const Contact = mongoose.model('Contact', schema);
