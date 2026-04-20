// Header.tsx
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';
import styles from './Header.module.scss';
import Image from 'next/image';

const Header: React.FC = () => {
  const router = useRouter();
  const isActive: (pathname: string) => boolean = (pathname) =>
    router.pathname === pathname;

  const { data: session, status } = useSession();
  const rightClassName = `flex flex-wrap items-center gap-2 justify-end ${styles.right}`;

  const left = (
    <div className={styles.left}>
      <Link
        href="/"
        className={styles.brand}
        data-active={isActive('/') ? 'true' : 'false'}
        aria-label="RootNote"
      >
        <Image
          className={styles.logoImg}
          src="/logo.svg"
          alt=""
          width={100}
          height={55}
          decoding="async"
        />
        <span className={styles.alpha} aria-hidden="true">
          alpha
        </span>
      </Link>
    </div>
  );

  let right: React.ReactNode = null;

  if (status === 'loading') {
    right = (
      <div className={rightClassName}>
        <p>Validating session ...</p>
      </div>
    );
  } else if (!session) {
    right = (
      <div className={rightClassName}>
        <Link
          href="/api/auth/signin"
          className="login-button"
          data-active={isActive('/signup')}
        >
          Log in
        </Link>
      </div>
    );
  } else if (session) {
    right = (
      <div className={rightClassName}>
        <p className="text-right">
          {session.user.name} ({session.user.email})
        </p>
        {/*<Link href="/create">*/}
        {/*	<button>*/}
        {/*		<a>New note</a>*/}
        {/*	</button>*/}
        {/*</Link>*/}
        <button type="button" onClick={() => signOut()}>
          <a>Log out</a>
        </button>
      </div>
    );
  }

  return (
    <header className="py-6 md:py-8">
      <div className="app-container">
        <nav
          className="flex justify-between items-center gap-8"
          aria-label="Main"
        >
          {left}
          {right}
        </nav>
      </div>
    </header>
  );
};

export default Header;
