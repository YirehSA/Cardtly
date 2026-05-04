'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/marketing/Navbar'
import Footer from '@/components/marketing/Footer'
import { Mail, MessageSquare, Send, Check, ArrowRight } from 'lucide-react'

const grad = 'linear-gradient(135deg, #00d4ff, #7c3aed, #ec4899)'
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#fff',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.15s',
}

const TOPICS = [
  'General question',
  'Billing or payments',
  'Technical support',
  'Feature request',
  'Partnership or press',
  'Something else',
]

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    // Simulate sending — wire to Resend when live
    await new Promise(r => setTimeout(r, 1200))
    setSent(true)
    setSending(false)
  }

  return (
    <div style={{ background: '#000', color: '#fff' }}>
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)' }} />
        <div className="relative max-w-2xl mx-auto">
          <p className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#7c3aed' }}>Contact us</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-6">
            We actually<br /><span style={gradText}>read our inbox.</span>
          </h1>
          <p className="text-lg" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Questions, ideas, complaints, compliments — send them all. We respond within one business day.
          </p>
        </div>
      </section>

      {/* Form + info */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-10">

          {/* Left — info */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Reach us at</p>
              <a href="mailto:hello@cardtly.com"
                className="flex items-center gap-3 text-sm font-medium transition hover:opacity-80"
                style={{ color: '#00d4ff' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(0,212,255,0.1)' }}>
                  <Mail className="w-4 h-4" style={{ color: '#00d4ff' }} />
                </div>
                hello@cardtly.com
              </a>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Response time</p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                We typically respond within one business day, Monday to Friday, South African time (SAST / UTC+2).
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Quick links</p>
              <div className="space-y-2">
                {[
                  { href: '/how-it-works', label: 'How Cardtly works' },
                  { href: '/pricing',       label: 'Pricing and plans' },
                  { href: '/about',         label: 'About us' },
                ].map(({ href, label }) => (
                  <Link key={href} href={href}
                    className="flex items-center gap-2 text-sm transition hover:opacity-80"
                    style={{ color: 'rgba(255,255,255,0.45)' }}>
                    <ArrowRight className="w-3 h-3" style={{ color: '#7c3aed' }} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right — form */}
          <div className="lg:col-span-3">
            <div className="p-8 rounded-3xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {sent ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                    style={{ background: 'rgba(124,58,237,0.2)' }}>
                    <Check className="w-8 h-8" style={{ color: '#7c3aed' }} />
                  </div>
                  <h3 className="text-2xl font-black mb-2">Message sent!</h3>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    We'll get back to you within one business day.
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Your name
                      </label>
                      <input
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Andre Nel"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        Email address
                      </label>
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="hello@example.com"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Topic
                    </label>
                    <select
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      style={{ ...inputStyle, appearance: 'none' }}
                    >
                      <option value="" style={{ background: '#111' }}>Select a topic...</option>
                      {TOPICS.map(t => (
                        <option key={t} value={t} style={{ background: '#111' }}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Message
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="What's on your mind?"
                      style={{ ...inputStyle, resize: 'none' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: grad, boxShadow: '0 4px 24px rgba(124,58,237,0.35)' }}>
                    {sending ? 'Sending...' : <><Send className="w-4 h-4" />Send message</>}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
