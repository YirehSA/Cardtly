'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  value: string
  onChange: (url: string) => void
  bucket: string
  userId: string
  shape: 'circle' | 'square'
  label?: string
}

export default function ImageUploader({ value, onChange, bucket, userId, shape, label }: Props) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

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
      <div className="relative inline-block">
        <img
          src={value}
          alt={label || 'Upload'}
          className={`w-24 h-24 object-cover border-2 border-border ${shapeClass}`}
        />
        <button
          onClick={() => onChange('')}
          className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition"
        >
          <X className="w-3 h-3" />
        </button>
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
