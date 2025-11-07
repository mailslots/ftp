import Link from 'next/link';

const deploymentChecklist = [
  'Import this repository into your Vercel dashboard',
  'Confirm `npm run build` as the build command',
  'Deploy with the default output directory (`.next`)',
  'Celebrate your live “Hello, Vercel!” page'
];

export default function Home() {
  return (
    <main className="hero">
      <div className="hero__inner">
        <p className="hero__eyebrow">Ready to deploy</p>
        <h1>Hello, Vercel! 👋</h1>
        <p className="hero__tagline">
          This friendly Next.js starter ships with styling, metadata, and a quick
          deployment checklist so you can verify everything works moments after
          importing the project into Vercel.
        </p>
        <ol className="hero__checklist">
          {deploymentChecklist.map((item) => (
            <li key={item}>
              <span aria-hidden="true">✅</span>
              {item}
            </li>
          ))}
        </ol>
        <div className="hero__actions">
          <Link
            className="hero__cta"
            href="https://vercel.com/docs/deployments/overview"
            target="_blank"
            rel="noreferrer"
          >
            Learn how deployment works
          </Link>
          <Link className="hero__secondary" href="https://vercel.com/new" target="_blank" rel="noreferrer">
            Deploy now
          </Link>
        </div>
      </div>
    </main>
  );
}
