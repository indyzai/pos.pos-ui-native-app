import { Redirect } from 'expo-router';
import { useAuthSession } from '../auth/AuthSessionContext';

export default function Index() {
    const { authenticated, initializing } = useAuthSession();
    if (initializing) return null;
    return <Redirect href={authenticated ? '/billing' : '/login'} />;
}
