// @ts-nocheck - SSE types
'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';

interface LetterWriterProps {
    letterType: string;
    servicer?: string;
    onClose: () => void;
}

const LETTER_TEMPLATES: Record<string, { title: string; description: string }> = {
    IDR_APPLICATION: {
        title: 'Income-Driven Repayment Application',
        description: 'Request enrollment in an IDR plan (SAVE, PAYE, IBR)',
    },
    AUTOPAY_ENROLLMENT: {
        title: 'Autopay Enrollment Request',
        description: 'Request autopay setup for 0.25% rate discount',
    },
    PSLF_CERTIFICATION: {
        title: 'PSLF Employment Certification',
        description: 'Certify qualifying employment for Public Service Loan Forgiveness',
    },
    SERVICER_DISPUTE: {
        title: 'Payment Dispute Letter',
        description: 'Dispute an incorrect payment, balance, or interest calculation',
    },
    FORBEARANCE_REQUEST: {
        title: 'Forbearance Request',
        description: 'Request temporary pause on loan payments',
    },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function LetterWriter({ letterType, servicer, onClose }: LetterWriterProps) {
    const [letterContent, setLetterContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [copied, setCopied] = useState(false);

    const template = LETTER_TEMPLATES[letterType] || {
        title: 'Formal Letter',
        description: 'Generate a formal letter to your loan servicer',
    };

    const generateLetter = useCallback(async () => {
        setIsGenerating(true);
        setLetterContent('');
        setIsComplete(false);

        try {
            const response = await fetch(`${API_BASE}/api/simulator/generate-letter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    letterType,
                    servicer: servicer || 'Nelnet',
                }),
            });

            if (!response.ok) throw new Error('Failed to generate letter');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No reader');

            let content = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;

                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'letter') {
                            content += data.text;
                            setLetterContent(content);
                        } else if (data.type === 'done') {
                            setIsComplete(true);
                        }
                    } catch (e) {
                        // Parse error, skip
                    }
                }
            }
        } catch (error) {
            console.error('Error generating letter:', error);
            // Fallback demo letter
            const fallback = `${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

${servicer || 'Nelnet'} Student Loan Services
P.O. Box 82563
Lincoln, NE 68501-2563

RE: Request for ${template.title}
Account ending in: ****4567

Dear ${servicer || 'Nelnet'} Representative,

I am writing to formally request enrollment in the SAVE (Saving on a Valuable Education) income-driven repayment plan for my federal student loans.

Based on my current annual income of $75,000 and household size of 1, I understand that my monthly payment under the SAVE plan would be approximately $166, compared to my current standard repayment of $450/month.

I have attached the following documentation to support my application:
• Most recent tax return (2024)
• Proof of income (recent pay stubs)
• Completed IDR Application Form

Please process this request at your earliest convenience. I understand that I must recertify my income and family size annually to remain on this plan.

If you require any additional documentation or have questions, please contact me at [email] or [phone].

Thank you for your prompt attention to this matter.

Sincerely,

[Your Name]
[Your Address]
[City, State ZIP]

Enclosures: IDR Application, Tax Return, Pay Stubs`;

            setLetterContent(fallback);
            setIsComplete(true);
        } finally {
            setIsGenerating(false);
        }
    }, [letterType, servicer, template.title]);

    const handleCopy = () => {
        navigator.clipboard.writeText(letterContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden border border-white/20"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-black/20">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="text-3xl">✉️</span>
                            Letter Writer
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-white/60 hover:text-white text-2xl p-2"
                        >
                            ×
                        </button>
                    </div>
                    <p className="text-white/70">{template.title}</p>
                    <p className="text-white/50 text-sm">{template.description}</p>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {!letterContent && !isGenerating && (
                        <div className="text-center py-12">
                            <div className="text-5xl mb-4">📝</div>
                            <p className="text-white/70 mb-6">
                                Click below to generate a personalized letter to {servicer || 'your loan servicer'}
                            </p>
                            <button
                                onClick={generateLetter}
                                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-xl hover:from-indigo-400 hover:to-purple-400 transition-all"
                            >
                                Generate Letter
                            </button>
                        </div>
                    )}

                    {(letterContent || isGenerating) && (
                        <div className="bg-white rounded-xl p-8 shadow-xl">
                            {/* Letter preview styled like a document */}
                            <div className="font-serif text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                                {letterContent}
                                {isGenerating && (
                                    <span className="inline-block w-2 h-4 bg-indigo-500 ml-1 animate-pulse" />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex justify-between items-center">
                    <div className="text-white/50 text-sm">
                        {isComplete && '✓ Letter ready to send'}
                        {isGenerating && '✍️ Gemini is writing...'}
                    </div>
                    <div className="flex gap-3">
                        {isComplete && (
                            <button
                                onClick={handleCopy}
                                className="px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-400 transition flex items-center gap-2"
                            >
                                {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
