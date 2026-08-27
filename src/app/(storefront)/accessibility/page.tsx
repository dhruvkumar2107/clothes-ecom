import type { Metadata } from 'next';
import Link from 'next/link';
import { Eye, Keyboard, Volume2, Contrast, CheckCircle, HelpCircle, ChevronDown, Mail } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Accessibility Statement | LUMEN&CO',
  description: 'Our commitment to digital accessibility. WCAG 2.1 AA compliance, known issues, and how to report barriers.',
  alternates: { canonical: '/accessibility' },
};

const COMMITMENTS = [
  {
    icon: CheckCircle,
    title: 'WCAG 2.1 Level AA',
    desc: 'We target full conformance with WCAG 2.1 AA. Regular automated and manual testing.',
  },
  {
    icon: Keyboard,
    title: 'Keyboard navigation',
    desc: 'All interactive elements reachable and operable via keyboard. Focus indicators visible.',
  },
  {
    icon: Eye,
    title: 'Screen reader support',
    desc: 'Semantic HTML, ARIA labels, alt text, live regions. Tested with NVDA, JAWS, VoiceOver.',
  },
  {
    icon: Contrast,
    title: 'Color contrast',
    desc: 'Minimum 4.5:1 for text, 3:1 for UI components. No color-only information.',
  },
  {
    icon: Volume2,
    title: 'Text resizing & zoom',
    desc: 'Content reflows at 200% zoom. No loss of function. Relative units (rem) throughout.',
  },
  {
    icon: HelpCircle,
    title: 'Clear language',
    desc: 'Plain English. Defined abbreviations. Consistent navigation. Error messages are specific.',
  },
];

const KNOWN_ISSUES = [
  {
    severity: 'Low',
    issue: 'Product image zoom modal lacks visible focus trap indicator on some browsers.',
    status: 'Fix scheduled for Q2 2025',
    workaround: 'Use ESC to close. Tab order is logical.',
  },
  {
    severity: 'Low',
    issue: 'Autocomplete search suggestions not announced to screen readers in overlay.',
    status: 'Fix scheduled for Q2 2025',
    workaround: 'Use full search page (/search) which has full ARIA support.',
  },
  {
    severity: 'Medium',
    issue: 'Some third-party widgets (payment, tracking) may not meet AA contrast.',
    status: 'Ongoing — vendor escalation',
    workaround: 'Use native checkout flow; tracking available in account.',
  },
];

const TESTING = [
  'Automated: axe-core in CI on every PR',
  'Manual: Monthly screen reader testing (NVDA, VoiceOver, TalkBack)',
  'Manual: Keyboard-only navigation audit quarterly',
  'Manual: 200% zoom reflow test on all key flows',
  'User testing: Annual sessions with disabled participants',
  'Monitoring: Real-user metrics via Clarity (anonymized)',
];

const FEATURES = [
  { title: 'Skip to main content', desc: 'First focusable element on every page. Press Tab once.' },
  { title: 'Landmark regions', desc: 'Header, main, nav, aside, footer — all properly labelled.' },
  { title: 'Heading hierarchy', desc: 'Single H1 per page. Logical H2-H6 structure. No skipped levels.' },
  { title: 'Form labels', desc: 'Every input has visible label or aria-label. Required fields marked.' },
  { title: 'Error handling', desc: 'Errors announced via aria-live. Linked to field. Clear instructions.' },
  { title: 'Focus management', desc: 'Modals trap focus. Return focus to trigger on close.' },
  { title: 'Reduced motion', desc: 'Respects prefers-reduced-motion. Animations disabled.' },
  { title: 'High contrast', desc: 'Respects forced-colors mode. Borders visible in Windows High Contrast.' },
];

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-4xl">
        <header className="mb-14 max-w-2xl">
          <p className="u-label text-muted-2 mb-3">Accessibility</p>
          <h1 className="u-display text-3xl lg:text-5xl font-light tracking-tight text-ink mb-5">
            Accessibility statement
          </h1>
          <p className="text-ink-3 text-lg leading-relaxed">
            We believe fashion is for everybody — and so is our website. This statement outlines our commitments,
            current conformance, known gaps, and how to reach us if you encounter barriers.
          </p>
        </header>

        {/* Conformance */}
        <section className="mb-16 p-6 rounded-xl border border-accent/30 bg-accent/5">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-6 h-6 text-accent" aria-hidden="true" />
            <h2 className="u-title font-semibold text-ink">Conformance status</h2>
          </div>
          <p className="text-ink-2">
            <strong>Partially conformant</strong> with WCAG 2.1 Level AA. "Partially" means some content does not fully meet the standard.
            We are actively working on the known issues below.
          </p>
        </section>

        {/* Commitments */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">Our commitments</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {COMMITMENTS.map((commitment, i) => (
              <div key={i} className="p-5 rounded-xl border border-line bg-paper-2/40">
                <div className="flex items-center gap-3 mb-2">
                  <commitment.icon className="w-5 h-5 text-accent" aria-hidden="true" />
                  <h3 className="u-label font-semibold text-ink">{commitment.title}</h3>
                </div>
                <p className="text-sm text-ink-2">{commitment.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">Accessibility features</h2>
          <div className="space-y-4 max-w-2xl">
            {FEATURES.map((feature, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-lg border border-line bg-paper-2/40">
                <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="u-label font-semibold text-ink">{feature.title}</h3>
                  <p className="text-sm text-ink-2 mt-0.5">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Known issues */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">Known issues</h2>
          <p className="text-ink-2 mb-6 max-w-2xl">
            We\'re transparent about gaps. If you hit something not listed here, please tell us — we\'ll prioritize it.
          </p>
          <div className="space-y-4 max-w-2xl">
            {KNOWN_ISSUES.map((issue, i) => (
              <details key={i} className="group p-5 rounded-xl border border-line bg-paper-2/40">
                <summary className="flex items-start justify-between gap-4 cursor-pointer list-none">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="u-label font-semibold text-ink">{issue.issue}</h3>
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                        issue.severity === 'High' ? 'bg-danger/10 text-danger' :
                        issue.severity === 'Medium' ? 'bg-warning/10 text-warning' :
                        'bg-accent/10 text-accent'
                      }`}>
                        {issue.severity}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="w-5 h-5 text-muted flex-shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="mt-4 pt-4 border-t border-line space-y-2">
                  <div className="flex gap-2 text-sm">
                    <span className="text-ink-3">Status:</span>
                    <span className="text-ink">{issue.status}</span>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="text-ink-3">Workaround:</span>
                    <span className="text-ink">{issue.workaround}</span>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Testing */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">How we test</h2>
          <ul className="space-y-3 max-w-xl">
            {TESTING.map((item, i) => (
              <li key={i} className="flex items-start gap-3 p-4 rounded-lg border border-line bg-paper-2/40">
                <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-ink-2">{item}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Feedback */}
        <section className="mb-16 p-8 rounded-xl border border-line bg-paper-2/40 text-center">
          <h2 className="u-title text-xl font-semibold text-ink mb-3">Encountered a barrier?</h2>
          <p className="text-ink-2 mb-6 max-w-xl mx-auto">
            We take accessibility bugs as seriously as security bugs. Email us with the page, assistive tech used, and what happened.
            We\'ll acknowledge within 24 hours and fix on a timeline based on severity.
          </p>
          <a href="mailto:accessibility@lumen.co?subject=Accessibility%20Barrier%20Report&body=Page%3A%20%5BURL%5D%0AAssistive%20tech%3A%20%5BNVDA%20%2F%20VoiceOver%20%2F%20TalkBack%20%2F%20Keyboard%20only%5D%0AWhat%20happened%3A%20%5BDescription%5D%0AExpected%3A%20%5BWhat%20should%20happen%5D%0A%0AYour%20email%20%28optional%29%3A%20%5B%5D"
            className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus"
          >
            <Mail className="w-4 h-4" aria-hidden="true" />
            Report an Issue
          </a>
        </section>

        <footer className="pt-8 border-t border-line text-sm text-muted-2">
          <p>Last updated: January 2025. Next review: July 2025.</p>
        </footer>
      </div>
    </div>
  );
}