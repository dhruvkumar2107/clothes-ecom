'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Loader2, Globe, Truck, CreditCard, Gift, Bell } from 'lucide-react';
import { apiPost } from '@/lib/api-client';

type FieldDef = { key: string; label: string; type: string; placeholder?: string; step?: string; options?: string[] };

function isSelectField(field: FieldDef): field is FieldDef & { type: 'select'; options: string[] } {
  return field.type === 'select' && Array.isArray(field.options);
}

function isNumberField(field: FieldDef): field is FieldDef & { type: 'number'; step: string } {
  return field.type === 'number' && field.step != null;
}

const sections = [
  {
    id: 'store',
    title: 'Store Information',
    icon: Globe,
    fields: [
      { key: 'storeName', label: 'Store Name', type: 'text', placeholder: 'LUMEN&CO' },
      { key: 'storeEmail', label: 'Contact Email', type: 'email', placeholder: 'hello@lumen.co' },
      { key: 'storePhone', label: 'Contact Phone', type: 'tel', placeholder: '+91 98765 43210' },
      { key: 'gstNumber', label: 'GST Number', type: 'text', placeholder: '29AAACL1234A1Z5' },
      { key: 'storeAddress', label: 'Registered Address', type: 'textarea', placeholder: '123 Fashion Street, Bangalore, KA 560001' },
    ],
  },
  {
    id: 'shipping',
    title: 'Shipping Configuration',
    icon: Truck,
    fields: [
      { key: 'freeShippingThreshold', label: 'Free Shipping Threshold (INR)', type: 'number', placeholder: '2999' },
      { key: 'standardShippingRate', label: 'Standard Shipping Rate (INR)', type: 'number', placeholder: '99' },
      { key: 'expressShippingRate', label: 'Express Shipping Rate (INR)', type: 'number', placeholder: '199' },
      { key: 'codEnabled', label: 'Enable Cash on Delivery', type: 'checkbox' },
      { key: 'codFee', label: 'COD Additional Fee (INR)', type: 'number', placeholder: '50' },
    ],
  },
  {
    id: 'payments',
    title: 'Payment Gateway',
    icon: CreditCard,
    fields: [
      { key: 'razorpayKeyId', label: 'Razorpay Key ID', type: 'text', placeholder: 'rzp_test_...' },
      { key: 'razorpayKeySecret', label: 'Razorpay Key Secret', type: 'password', placeholder: '••••••••' },
      { key: 'stripePublishableKey', label: 'Stripe Publishable Key', type: 'text', placeholder: 'pk_test_...' },
      { key: 'stripeSecretKey', label: 'Stripe Secret Key', type: 'password', placeholder: '••••••••' },
    ],
  },
  {
    id: 'referral',
    title: 'Referral Program',
    icon: Gift,
    fields: [
      { key: 'referralWelcomeCoupon', label: 'Welcome Coupon Code', type: 'text', placeholder: 'WELCOME10' },
      { key: 'referralCommissionPercent', label: 'Default Commission %', type: 'number', step: '0.1', placeholder: '7.5' },
      { key: 'referralHoldDays', label: 'Commission Hold Period (days)', type: 'number', placeholder: '14' },
      { key: 'referralMinOrderValue', label: 'Minimum Order for Commission (INR)', type: 'number', placeholder: '999' },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications & SMS',
    icon: Bell,
    fields: [
      { key: 'smsProvider', label: 'SMS Provider', type: 'select', options: ['mock', 'twilio', 'msg91'] },
      { key: 'twilioAccountSid', label: 'Twilio Account SID', type: 'text', placeholder: 'AC...' },
      { key: 'twilioAuthToken', label: 'Twilio Auth Token', type: 'password', placeholder: '••••••••' },
      { key: 'msg91AuthKey', label: 'MSG91 Auth Key', type: 'password', placeholder: '••••••••' },
    ],
  },
];

export default function AdminSettingsPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.data) {
            const map: Record<string, string> = {};
            for (const s of data.data) {
              map[s.key] = s.value;
            }
            setValues(map);
          }
        }
      } catch {}
    }
    loadSettings();
  }, []);

  const handleChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const entries = Object.entries(values);
      for (const [key, value] of entries) {
        await apiPost('/admin/settings', { key, value, valueType: 'string', group: 'general' });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>Settings</h1>
          <p className="text-[13px] text-[#7A7468] mt-0.5">Configure store, shipping, payments, and features</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {saved && (
            <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-[11px] font-medium rounded-lg flex items-center gap-1">
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-[#0A0A0A] hover:bg-[#1A1A1A] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-[12px] font-medium transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <Save className="w-3.5 h-3.5" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="bg-white rounded-xl border border-[#E8E5DE] p-5 space-y-4">
              <h2 className="text-[13px] font-semibold text-[#0A0A0A] flex items-center gap-2">
                <Icon className="w-4 h-4 text-[#9C7C4E]" /> {section.title}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {section.fields.map((field) => (
                  <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label className="block text-[11px] font-medium text-[#7A7468] mb-1">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        placeholder={field.placeholder}
                        value={values[field.key] || ''}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none min-h-[80px] resize-y transition-colors"
                        rows={3}
                      />
                    ) : isSelectField(field) ? (
                      <select
                        value={values[field.key] || ''}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors"
                      >
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={values[field.key] === 'true'}
                          onChange={(e) => handleChange(field.key, e.target.checked ? 'true' : 'false')}
                          className="w-4 h-4 rounded border-[#E8E5DE] bg-[#FAF9F7] text-[#9C7C4E] focus:ring-[#9C7C4E]"
                        />
                        <span className="text-[12px] text-[#7A7468]">{field.placeholder}</span>
                      </label>
                    ) : (
                      <input
                        type={field.type}
                        placeholder={field.placeholder}
                        value={values[field.key] || ''}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        step={isNumberField(field) ? field.step : undefined}
                        className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] font-mono focus:border-[#9C7C4E]/50 focus:outline-none transition-colors"
                      />
                    )}
                    {field.type === 'password' && (
                      <p className="text-[10px] text-[#9E9789] mt-1">Leave blank to keep current value</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
