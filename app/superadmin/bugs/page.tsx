'use client';
import dynamic from 'next/dynamic';
const Page = dynamic(() => import('../../admin/bugs/page'), { ssr: false });
export default function SA() { return <Page />; }
