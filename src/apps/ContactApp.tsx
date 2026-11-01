// src/apps/ContactApp.tsx
import React, { useState } from 'react';
import {
  Mail,
  Send,
  User,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { sendOSNotification } from '../notificationSystem';

export default function ContactApp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = (): boolean => {
    const errs: { [key: string]: string } = {};

    if (!name.trim()) {
      errs.name = 'Name is required';
    } else if (name.trim().length < 2) {
      errs.name = 'Name must be at least 2 characters';
    }

    if (!email.trim()) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (!subject.trim()) {
      errs.subject = 'Subject is required';
    }

    if (!message.trim()) {
      errs.message = 'Message is required';
    } else if (message.trim().length < 10) {
      errs.message = 'Message must be at least 10 characters';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      sendOSNotification({
        appName: 'Contact',
        title: 'Message Sent',
        message: `Thank you, ${name}! Your message "${subject}" has been received.`,
      });
    }, 800);
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    setErrors({});
    setIsSuccess(false);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 sm:p-6 text-gray-800 dark:text-gray-200">
      <div className="max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-black/5 dark:border-white/10">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
            <Mail size={20} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Get in Touch
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Send a note, feedback, or start a conversation with the VEGA team.
            </p>
          </div>
        </div>

        {isSuccess ? (
          <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-2xl text-center space-y-3 animate-arrive my-6">
            <CheckCircle2 size={36} className="text-green-600 dark:text-green-400 mx-auto" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Message Delivered!
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Thank you for reaching out, <strong>{name}</strong>. A notification has been registered in the system.
            </p>
            <button
              onClick={handleReset}
              className="mt-2 px-4 py-1.5 text-xs bg-[#668b7b] text-white rounded-xl font-medium hover:bg-[#557869] transition"
            >
              Send Another Note
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
            {/* Name & Email Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Your Name *
                </label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => {
                      setName(e.target.value);
                      if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                    }}
                    placeholder="Alex Morgan"
                    className={`w-full pl-8 pr-3 py-1.5 text-xs bg-black/5 dark:bg-white/10 border rounded-xl outline-none transition ${
                      errors.name ? 'border-red-400 focus:border-red-500' : 'border-transparent focus:border-[#668b7b]'
                    }`}
                  />
                </div>
                {errors.name && (
                  <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> {errors.name}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                    }}
                    placeholder="alex@example.com"
                    className={`w-full pl-8 pr-3 py-1.5 text-xs bg-black/5 dark:bg-white/10 border rounded-xl outline-none transition ${
                      errors.email ? 'border-red-400 focus:border-red-500' : 'border-transparent focus:border-[#668b7b]'
                    }`}
                  />
                </div>
                {errors.email && (
                  <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> {errors.email}
                  </span>
                )}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                Subject *
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => {
                  setSubject(e.target.value);
                  if (errors.subject) setErrors(prev => ({ ...prev, subject: '' }));
                }}
                placeholder="Collaboration, feature idea, or feedback"
                className={`w-full px-3 py-1.5 text-xs bg-black/5 dark:bg-white/10 border rounded-xl outline-none transition ${
                  errors.subject ? 'border-red-400 focus:border-red-500' : 'border-transparent focus:border-[#668b7b]'
                }`}
              />
              {errors.subject && (
                <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> {errors.subject}
                </span>
              )}
            </div>

            {/* Message */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                  Message *
                </label>
                <span className="text-[10px] text-gray-400 font-mono">
                  {message.length} characters
                </span>
              </div>
              <textarea
                value={message}
                onChange={e => {
                  setMessage(e.target.value);
                  if (errors.message) setErrors(prev => ({ ...prev, message: '' }));
                }}
                rows={4}
                placeholder="Write your note here..."
                className={`w-full p-3 text-xs bg-black/5 dark:bg-white/10 border rounded-xl outline-none transition resize-none ${
                  errors.message ? 'border-red-400 focus:border-red-500' : 'border-transparent focus:border-[#668b7b]'
                }`}
              />
              {errors.message && (
                <span className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> {errors.message}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1.5 min-h-[36px]"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-[#668b7b] hover:bg-[#557869] text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition shadow-xs active:scale-95 disabled:opacity-50 min-h-[40px]"
              >
                <Send size={13} className={isSubmitting ? 'animate-pulse' : ''} />
                <span>{isSubmitting ? 'Sending...' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
