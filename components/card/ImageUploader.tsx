'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, Loader2, Scissors } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  value: string
  onChange: (url: string) => void
  bucket: string
  userId: string
  shape: 'circle' | 'square'
  label?: string
  // When true, show the "Remove background" action on the uploaded image.
  // Useful for profile photos; less useful for gallery images.
  allowBackgroundRemoval?: boolean
}

export default function ImageUploader({ value, onChange, bucket, userId, shape, label, allowBackgroundRemoval }: Props) {
  const [uploading, setUploading] = useState(false)
  const [removingBg, setRemovingBg] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function removeBackground() {
    if (!value) return
    setRemovingBg(true)
    try {
      // Background-removal runs entirely in the browser via WebAssembly.
      // First call downloads the ~30MB ML model and caches it; later
      // calls are instant.
      const { removeBackground: imglyRemove } = await import('@imgly/background-removal')
      const blob = await imglyRemove(value, { output: { format: 'image/png', quality: 0.9 } })
      const file = new File([blob], `${Date.now()}-nobg.png`, { type: 'image/png' })
      const path = `${userId}/${Date.now()}-nobg.png`
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      onChange(data.publicUrl)
      toast.success('Background removed')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not remove background'
      toast.error(msg)
    } finally {
      setRemovingBg(false)
    }
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
  .from(bucket)
  .upload(path, file, { upsert: true })

    if (error) {
      toast.error('Upload failed: ' + error.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    onChange(data.publicUrl)
    setUploading(false)
    toast.success('Image uploaded')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl'

  if (value) {
    return (
      <div className="inline-flex items-center gap-2">
        <div className="relative inline-block">
          <img
            src={value}
            alt={label || 'Upload'}
            className={`w-24 h-24 object-cover border-2 border-border ${shapeClass}`}
            style={{
              background: allowBackgroundRemoval
                ? 'repeating-conic-gradient(rgba(0,0,0,0.06) 0% 25%, transparent 0% 50%) 50% / 16px 16px'
                : undefined,
            }}
          />
          <button
            onClick={() => onChange('')}
            className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition"
            aria-label="Remove image"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        {allowBackgroundRemoval && (
          <button onClick={removeBackground} disabled={removingBg}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed)' }}>
            {removingBg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
            {removingBg ? 'Removing...' : 'Remove background'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      className={`w-24 h-24 border-2 border-dashed border-border hover:border-foreground/30 flex flex-col items-center justify-center cursor-pointer transition bg-muted/30 hover:bg-muted/50 ${shapeClass}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {uploading ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      ) : (
        <>
          <Upload className="w-5 h-5 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground text-center px-2">
            {label || 'Upload'}
          </span>
        </>
      )}
    </div>
  )
}
