import { Redirect } from 'expo-router';
import { useAuthSession } from '../features/auth/AuthSessionContext';

export default function Index() {
    const { authenticated, initializing } = useAuthSession();
    if (initializing) return null;
    return <Redirect href={authenticated ? '/billing' : '/login'} />;
}
