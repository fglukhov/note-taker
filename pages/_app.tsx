import Head from 'next/head';
import { SessionProvider } from 'next-auth/react';
import { AppProps } from 'next/app';
import { Analytics } from '@vercel/analytics/next';
import { JetBrains_Mono } from 'next/font/google';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import '../assets/scss/vars.scss';
import '../assets/scss/global.scss';
import '@/assets/css/app.css';

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const App = ({ Component, pageProps }: AppProps) => {
  return (
    <>
      <Head>
        <title>RootNote – Tree notes & tasks, keyboard-first</title>
      </Head>
      <SessionProvider session={pageProps.session}>
        <div className={jetBrainsMono.variable}>
          <Component {...pageProps} />
          <Analytics />
        </div>
      </SessionProvider>
    </>
  );
};

export default App;
