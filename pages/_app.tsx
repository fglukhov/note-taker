import { SessionProvider } from 'next-auth/react';
import { AppProps } from 'next/app';
import { Analytics } from '@vercel/analytics/next';
import '../assets/scss/vars.scss';
import '../assets/scss/global.scss';
import '@/assets/css/app.css';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

const App = ({ Component, pageProps }: AppProps) => {
  return (
    <SessionProvider session={pageProps.session}>
      <Component {...pageProps} />
      <Analytics />
    </SessionProvider>
  );
};

export default App;
