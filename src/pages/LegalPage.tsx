import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Brand } from '../components/Brand.js';

/** Replace these with the operator's real details before launch. */
const SUPPORT_EMAIL = 'support@axiomlearning.app';
const PRODUCT_NAME = 'Axiom Olympiad Learning';
const UPDATED = 'November 2026';

type Kind = 'privacy' | 'terms';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function LegalPage() {
  const { pathname } = useLocation();
  const kind: Kind = pathname.startsWith('/terms') ? 'terms' : 'privacy';

  useEffect(() => {
    document.title = kind === 'privacy' ? `Privacy notice · ${PRODUCT_NAME}` : `Terms of use · ${PRODUCT_NAME}`;
  }, [kind]);

  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link to="/" className="brand-link" aria-label="Back to Axiom"><Brand /></Link>
        <nav className="legal-nav" aria-label="Legal pages">
          <Link to="/privacy" className={kind === 'privacy' ? 'legal-nav-active' : ''}>Privacy</Link>
          <Link to="/terms" className={kind === 'terms' ? 'legal-nav-active' : ''}>Terms</Link>
        </nav>
      </header>

      <article className="legal-body">
        <span className="legal-kicker"><ShieldCheck size={14} /> {kind === 'privacy' ? 'PRIVACY NOTICE' : 'TERMS OF USE'}</span>
        <h1>{kind === 'privacy' ? 'Your learning data, in plain language.' : 'A fair, simple agreement.'}</h1>
        <p className="legal-lede">
          {kind === 'privacy'
            ? `${PRODUCT_NAME} is a study tool for competition mathematics. This notice explains exactly what we keep, why, and how to remove it.`
            : `These terms cover your use of ${PRODUCT_NAME}. They are short on purpose: learn honestly, respect the service, and keep your account secure.`}
        </p>
        <p className="legal-updated">Last updated {UPDATED}</p>

        {kind === 'privacy' ? (
          <>
            <Section title="What we store">
              <ul>
                <li><strong>Study progress</strong> — lessons opened and completed, answers, mastery estimates, XP, streaks, achievements, practice sessions and assessment results.</li>
                <li><strong>Your tutor conversation</strong> — messages you send to the study tutor and its replies.</li>
                <li><strong>Profile preferences</strong> — display name, grade band (optional), daily goal, theme, and whether you joined the weekly league.</li>
                <li><strong>Account details</strong> — only if you create an account: your email address and a salted, hashed password. We never store your password in readable form.</li>
              </ul>
            </Section>
            <Section title="Guest spaces and accounts">
              <p>
                If you start without an account we create a private guest space and set a single essential cookie so you can return to it.
                A guest space holds no email address, so we cannot recover it for you: clearing your browser cookies may make that progress unreachable.
                You can convert any guest space into a real account from the Progress page at any time, keeping all of your work.
              </p>
            </Section>
            <Section title="Cookies">
              <p>
                We use one essential cookie, <code>axiom_session</code>, to keep you signed in to your own study space. It is <code>HttpOnly</code>, sent only with
                same-site requests, and expires after 30 days. We do not use advertising cookies, cross-site trackers, or third-party analytics scripts.
              </p>
            </Section>
            <Section title="Third-party services">
              <p>
                Typefaces are loaded from Google Fonts, which may receive your IP address and browser details as part of serving the font files.
                The app and its database are hosted by our infrastructure provider, which processes data on our behalf. We do not sell your data or share it with advertisers.
              </p>
            </Section>
            <Section title="The study tutor is not an external AI service">
              <p>
                The tutor is produced by rules running inside this application, using your own curriculum and learning record. Your messages are not sent to an
                external AI model or provider.
              </p>
            </Section>
            <Section title="The weekly league">
              <p>
                The league is opt-in. If you join, other opted-in learners can see your display name and weekly XP — never your email address, grade, answers, or individual results.
                You can leave at any time by turning it off in your study preferences.
              </p>
            </Section>
            <Section title="How long we keep data">
              <p>
                Your study records are kept while your study space exists. Guest sessions expire after 30 days of inactivity and the space is then no longer reachable.
                You can delete everything immediately, at any time, from the Progress page.
              </p>
            </Section>
            <Section title="Your choices and your data">
              <p>
                From the Progress page you can update your details, export nothing into the void (we keep no dark patterns), sign out, or permanently delete your study space
                and every record that belongs to it. Deletion is immediate and cannot be undone. You may also contact us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to
                ask what we hold about you, or to request correction or erasure.
              </p>
            </Section>
            <Section title="Students under 13">
              <p>
                This service is intended for students preparing for academic competitions. If you are under 13, please use it with the involvement of a parent or guardian,
                and create an account only with their permission.
              </p>
            </Section>
            <Section title="Changes to this notice">
              <p>If this notice changes in a meaningful way, we will update the date above and, where appropriate, note it inside the app.</p>
            </Section>
          </>
        ) : (
          <>
            <Section title="What this service is">
              <p>
                {PRODUCT_NAME} is an independent educational study tool. Lessons, practice questions, and sample assessments are original material written for learning purposes.
                We are not affiliated with, endorsed by, or connected to any competition organiser, and our content is not official syllabus, past-paper, or exam material.
              </p>
            </Section>
            <Section title="Using your study space">
              <p>
                You may start a guest study space without an account, or create one with a valid email address. Keep your sign-in details to yourself; you are responsible
                for activity in your space. You must be old enough to use the service under the laws that apply to you, or have a guardian's permission.
              </p>
            </Section>
            <Section title="Acceptable use">
              <ul>
                <li>Do not attempt to access another learner's space, bypass mastery gates, or disrupt the service.</li>
                <li>Do not scrape, bulk-download, resell, or republish the curriculum or question bank.</li>
                <li>Do not upload unlawful, harmful, or abusive material in free-text answers.</li>
                <li>Automated access, load testing, or attempts to circumvent rate limits are not permitted.</li>
              </ul>
              <p>We may suspend or remove a study space that breaks these rules.</p>
            </Section>
            <Section title="Your work">
              <p>
                You keep ownership of the answers and proofs you write. You give us permission to store and display them back to you, and to administrators for
                rubric-based proof review, so the service can work as described.
              </p>
            </Section>
            <Section title="Learning outcomes">
              <p>
                Practice and progress estimates are designed to help you learn. They are not predictions of any competition result, and we do not promise a particular
                score, grade, admission, or outcome.
              </p>
            </Section>
            <Section title="Availability and changes">
              <p>
                We work to keep the service available, but it is provided “as is” and may occasionally be interrupted for maintenance or because of issues outside our control.
                Features, curricula, and these terms may change; material changes will be reflected by the date above.
              </p>
            </Section>
            <Section title="Limitation of liability">
              <p>
                To the fullest extent permitted by law, we are not liable for indirect or consequential losses arising from your use of the service, or for loss of progress
                caused by clearing browser data, losing account credentials, or events beyond our reasonable control.
              </p>
            </Section>
            <Section title="Ending your use">
              <p>
                You can sign out or permanently delete your study space at any time from the Progress page. We may end access where these terms are seriously or repeatedly broken.
              </p>
            </Section>
            <Section title="Questions">
              <p>Reach us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
            </Section>
          </>
        )}

        <footer className="legal-footer">
          <Link className="button button-secondary" to="/"><ArrowLeft size={15} /> Back to {PRODUCT_NAME.split(' ')[0]}</Link>
          <span>Original practice material · Not affiliated with competition organisers</span>
        </footer>
      </article>
    </main>
  );
}
