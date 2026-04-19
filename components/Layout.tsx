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
  </>
);

export default Layout;
