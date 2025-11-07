import Link from 'next/link';

export default function Home() {
  return (
    <main className="hero">
      <div className="hero__inner">
        <h1>Hello, Vercel! 👋</h1>
        <p>
          This is a minimal Next.js app. Deploy it to Vercel by importing this
          repository or using the Vercel CLI.
        </p>
        <Link className="hero__cta" href="https://vercel.com/docs" target="_blank">
          Learn how deployment works
        </Link>
      </div>
    </main>
  );
}
