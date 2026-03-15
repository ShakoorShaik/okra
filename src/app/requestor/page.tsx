import dynamic from 'next/dynamic';
const RequestorDashboard = dynamic(() => import('@/components/requestor/RequestorDashboard'), { ssr: false });
export default function RequestorPage() { return <RequestorDashboard />; }
