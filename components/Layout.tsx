import React, { ReactNode } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

type Props = {
  children: ReactNode;
};

const Layout: React.FC<Props> = (props) => (
  <>
    <Header />
    <main>
      <div className="app-container">{props.children}</div>
    </main>
    <Footer />
  </>
);

export default Layout;
