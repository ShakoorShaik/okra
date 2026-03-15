import dynamic from 'next/dynamic';
const ProviderDashboard = dynamic(() => import('@/components/provider/ProviderDashboard'), { ssr: false });
export default function ProviderPage() { return <ProviderDashboard />; }
