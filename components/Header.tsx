// Header.tsx
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signOut, useSession } from 'next-auth/react';
import styles from './Header.module.scss';

const Header: React.FC = () => {
  const router = useRouter();
  const isActive: (pathname: string) => boolean = (pathname) =>
    router.pathname === pathname;

  const { data: session, status } = useSession();

  const left = (
    <div className={styles.left}>
      <Link
        href="/"
        className={styles.brand}
        data-active={isActive('/') ? 'true' : 'false'}
        aria-label="RootNote"
      >
        <img
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
      <div className={styles.right}>
        <p>Validating session ...</p>
      </div>
    );
  } else if (!session) {
    right = (
      <div className={styles.right}>
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
      <div className={styles.right}>
        <p>
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
    <header className={styles.header}>
      <div className="container">
        <nav className={styles.nav} aria-label="Main">
          {left}
          {right}
        </nav>
      </div>
    </header>
  );
};

export default Header;
