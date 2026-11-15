"use client"

import { useRef } from "react"

// Gambar kecil (thumbnail / swatch) yang bisa diklik untuk diperbesar di dialog.
export function ItemImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={`block shrink-0 overflow-hidden rounded border border-zinc-200 bg-zinc-50 hover:ring-2 hover:ring-brand/40 ${className}`}
        title={alt}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed URL Supabase, ukuran sudah dikompres */}
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      </button>
      <dialog
        ref={dialog}
        onClick={() => dialog.current?.close()}
        className="m-auto max-h-[90vh] max-w-[90vw] cursor-zoom-out rounded bg-white p-2 backdrop:bg-black/60"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed URL Supabase */}
        <img src={src} alt={alt} className="max-h-[85vh] max-w-[85vw] object-contain" />
        <p className="mt-1 text-center text-xs text-zinc-500">{alt}</p>
      </dialog>
    </>
  )
}
