import { SessionProvider } from 'next-auth/react';
import { AppProps } from "next/app";
import '../assets/scss/vars.scss'
import '../assets/scss/global.scss'

const App = ({ Component, pageProps }: AppProps) => {
	return (
		<SessionProvider session={pageProps.session}>
			<Component {...pageProps} />
		</SessionProvider>
	);
};

export default App;
