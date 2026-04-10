import React from 'react';
import Sidebar from '../components/Sidebar';

export default function Placeholder({ title, description }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8f5]">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 border-b border-orange-100 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        </header>
        <div className="p-8">
          <div className="bg-white border border-orange-100 rounded-2xl p-6 text-left">
            <p className="text-slate-900 font-bold">Đang phát triển</p>
            <p className="text-slate-600 mt-2">
              {description || 'Trang này sẽ được kết nối dữ liệu MySQL khi bạn sẵn sàng.'}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

