// pages/api/note/index.ts

import { getSession } from 'next-auth/react';
import {createClient} from "@supabase/supabase-js";

export const config = {
	api: {
		externalResolver: true,
	},
}

export default async function handle(req, res) {

	const { title, curId } = req.body;

	const session = await getSession({ req });

	const supabase = createClient(
		process.env.NEXT_SUPABASE_URL!,
		process.env.NEXT_SUPABASE_ANON_KEY!
	);

	const resultsUpdated = await supabase
		.from('Note')
		.update({ title: title })
		.eq('id', curId)

	res.json(resultsUpdated);

}


// Deploy test