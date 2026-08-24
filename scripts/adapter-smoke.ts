import {
  adapterStatus,
  getBankVerifier,
  getMailer,
  getPaymentGateway,
  getPayoutGateway,
  getShippingProvider,
  getSmsSender,
  hasMockMoneyDrivers,
  resetAdapters,
} from '../src/lib/adapters/registry';

function report(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
  console.log('payments     ', getPaymentGateway().label);
  console.log('payouts      ', getPayoutGateway().label);
  console.log('verification ', getBankVerifier().label);
  console.log('shipping     ', getShippingProvider().label);
  console.log('mail         ', getMailer().label);
  console.log('sms          ', getSmsSender().label);
  console.log('mock money?  ', hasMockMoneyDrivers());
}

report('no credentials (default)');
console.log(JSON.stringify(adapterStatus(), null, 2));

// Every driver must construct and be selected the moment its keys appear — the
// whole point of "no keys yet, build both paths".
Object.assign(process.env, {
  RAZORPAY_KEY_ID: 'rzp_test_smoke',
  RAZORPAY_KEY_SECRET: 'secret_smoke',
  RAZORPAY_WEBHOOK_SECRET: 'whsec_smoke',
  RAZORPAYX_ACCOUNT_NUMBER: '2323230012345678',
  SHIPROCKET_EMAIL: 'ops@lumenandco.example',
  SHIPROCKET_PASSWORD: 'smoke',
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'ops@lumenandco.example',
  SMTP_PASSWORD: 'smoke',
  MSG91_AUTH_KEY: 'smoke-auth-key',
});
resetAdapters();
report('razorpay + shiprocket + smtp + msg91');

// The alternate rails: Cashfree payouts, Decentro verification, Delhivery,
// Twilio. Razorpay keys are cleared so the fallbacks are the ones chosen.
Object.assign(process.env, {
  RAZORPAY_KEY_ID: '',
  RAZORPAY_KEY_SECRET: '',
  RAZORPAYX_ACCOUNT_NUMBER: '',
  SHIPROCKET_EMAIL: '',
  SHIPROCKET_PASSWORD: '',
  MSG91_AUTH_KEY: '',
  STRIPE_SECRET_KEY: 'sk_test_smoke',
  CASHFREE_CLIENT_ID: 'cf_smoke',
  CASHFREE_CLIENT_SECRET: 'cf_secret_smoke',
  DECENTRO_CLIENT_ID: 'dec_smoke',
  DECENTRO_CLIENT_SECRET: 'dec_secret_smoke',
  DECENTRO_MODULE_SECRET: 'dec_module_smoke',
  DELHIVERY_API_TOKEN: 'dl_smoke',
  TWILIO_ACCOUNT_SID: 'AC_smoke',
  TWILIO_AUTH_TOKEN: 'tw_secret_smoke',
  TWILIO_FROM_NUMBER: '+15005550006',
});
resetAdapters();
report('stripe + cashfree + decentro + delhivery + twilio');
