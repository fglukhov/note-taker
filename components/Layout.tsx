import React, { ReactNode } from 'react';
import Header from '@/components/Header';

type Props = {
  children: ReactNode;
};

const Layout: React.FC<Props> = (props) => (
  <>
    <Header />
    <main>
      <div className="container">{props.children}</div>
    </main>
    <style jsx global>{`
      html {
        box-sizing: border-box;
      }

      *,
      *:before,
      *:after {
        box-sizing: inherit;
      }

      body {
        margin: 0;
        padding: 0;
        font-size: 16px;
        font-family:
          -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica,
          Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
          'Segoe UI Symbol';
        background: rgba(0, 0, 0, 0.05);
      }

      input,
      textarea {
        font-size: 16px;
      }

      button {
        cursor: pointer;
      }
    `}</style>
  </>
);

export default Layout;
