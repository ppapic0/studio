import { redirect } from 'next/navigation';

export default function ConnectionTestPage() {
    // This page is obsolete and now permanently redirects to the dashboard.
    redirect('/dashboard');

    // The return is needed for type safety but will not be reached.
    return null;
}
