import React, { ReactNode } from 'react';
import Header from '@/components/Header';

type Props = {
  children: ReactNode;
};

const Layout: React.FC<Props> = (props) => (
  <>
    <Header />
    <main>
      <div className="app-container">{props.children}</div>
    </main>
  </>
);

export default Layout;
