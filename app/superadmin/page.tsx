'use client';
import dynamic from 'next/dynamic';
const AdminOverview = dynamic(() => import('../admin/page'), { ssr: false });
export default function SuperAdminOverview() { return <AdminOverview />; }
