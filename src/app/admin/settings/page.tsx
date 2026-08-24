'use client';

import { useState } from 'react';
import { Save, Loader2, Shield, Truck, CreditCard, Gift, Globe, Bell } from 'lucide-react';

export default function AdminSettingsPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
        { key: 'freeShippingThreshold', label: 'Free Shipping Threshold (₹)', type: 'number', placeholder: '2999' },
        { key: 'standardShippingRate', label: 'Standard Shipping Rate (₹)', type: 'number', placeholder: '99' },
        { key: 'expressShippingRate', label: 'Express Shipping Rate (₹)', type: 'number', placeholder: '199' },
        { key: 'codEnabled', label: 'Enable Cash on Delivery', type: 'checkbox' },
        { key: 'codFee', label: 'COD Additional Fee (₹)', type: 'number', placeholder: '50' },
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
        { key: 'referralMinOrderValue', label: 'Minimum Order for Commission (₹)', type: 'number', placeholder: '999' },
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

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await new Promise(r => setTimeout(r, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Platform Settings</h1>
          <p className="text-xs text-zinc-400 mt-1">Configure store details, shipping, payments, and feature flags.</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {saved && (
            <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium rounded flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 px-4 py-2 rounded-lg text-xs font-semibold shadow-lg shadow-amber-500/10 transition-all"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <Save className="w-4 h-4" />
            Save All Changes
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.id} className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-5">
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Icon className="w-4 h-4 text-amber-400" /> {section.title}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {section.fields.map((field) => (
                  <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        placeholder={field.placeholder}
                        className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:border-amber-500/60 focus:outline-none min-h-[80px] resize-y"
                        rows={3}
                      />
                    ) : field.type === 'select' ? (
                      <select className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:border-amber-500/60 focus:outline-none">
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-sm text-zinc-300">{field.placeholder}</span>
                      </label>
                    ) : (
                      <input
                        type={field.type}
                        placeholder={field.placeholder}
                        step={field.step}
                        className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 font-mono focus:border-amber-500/60 focus:outline-none"
                      />
                    )}
                    {field.type === 'password' && (
                      <p className="text-[10px] text-zinc-500 mt-1">Leave blank to keep current value</p>
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