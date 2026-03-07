'use client';
import dynamic from 'next/dynamic';
const Page = dynamic(() => import('../../admin/revenue/page'), { ssr: false });
export default function SA() { return <Page />; }
