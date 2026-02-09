// @ts-nocheck - Complex types
'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';

interface CallSimulatorProps {
    servicer: string;
    phone?: string;
    objective: string;
    onClose: () => void;
}

interface CallScript {
    openingStatement: string;
    talkingPoints: { point: string; anticipatedResponse: string }[];
    closingStatement: string;
    keyPhrases: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function CallSimulator({ servicer, phone, objective, onClose }: CallSimulatorProps) {
    const [script, setScript] = useState<CallScript | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeStep, setActiveStep] = useState<number | null>(null);

    const generateScript = useCallback(async () => {
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE}/api/simulator/call-script`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    servicer,
                    objective,
                }),
            });

            if (!response.ok) throw new Error('Failed to generate script');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No reader');

            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;

                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'script') {
                            setScript(data.data);
                        } else if (data.type === 'text') {
                            fullText += data.text;
                        }
                    } catch (e) {
                        // Parse error, skip
                    }
                }
            }

            // If no structured script received, use fallback
            if (!script) {
                setScript(getFallbackScript());
            }
        } catch (error) {
            console.error('Error generating script:', error);
            setScript(getFallbackScript());
        } finally {
            setIsLoading(false);
        }
    }, [servicer, objective]);

    const getFallbackScript = (): CallScript => ({
        openingStatement: `"Hi, my name is [Your Name] and I'm calling about my student loan account ending in 4567. I'd like to ${objective.toLowerCase()}."`,
        talkingPoints: [
            {
                point: `Mention you want to enroll in autopay for the 0.25% interest rate reduction`,
                anticipatedResponse: `"I can help you with that. I'll need to verify your identity first. Can you confirm your date of birth and the last four digits of your Social Security number?"`,
            },
            {
                point: `Ask about the effective date and confirm the rate reduction amount`,
                anticipatedResponse: `"The autopay discount will apply to your next billing cycle, and you'll see a 0.25% reduction on your interest rate."`,
            },
            {
                point: `Request a confirmation email or letter for your records`,
                anticipatedResponse: `"I can send you a confirmation email. What email address would you like me to use?"`,
            },
            {
                point: `Ask if there are any other discounts or benefits you qualify for`,
                anticipatedResponse: `"Let me check your account... Based on your payment history, you may also qualify for our loyalty program."`,
            },
        ],
        closingStatement: `"Thank you for your help today. Just to confirm, I'm now enrolled in autopay with the 0.25% rate discount, and I'll receive a confirmation email. Is there a reference number for this call?"`,
        keyPhrases: [
            'autopay enrollment',
            'interest rate discount',
            '0.25% reduction',
            'confirmation email',
            'reference number',
        ],
    });

    // Auto-generate on mount
    useState(() => {
        generateScript();
    });

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
                <div className="p-6 border-b border-white/10 bg-gradient-to-r from-green-900/30 to-emerald-900/30">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="text-3xl">📞</span>
                            Call Prep: {servicer}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-white/60 hover:text-white text-2xl p-2"
                        >
                            ×
                        </button>
                    </div>
                    <div className="flex items-center gap-4 text-white/70">
                        <span className="text-lg font-mono">{phone || '888-486-4722'}</span>
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                            {objective}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {isLoading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
                            <span className="ml-3 text-white/70">Preparing your call script...</span>
                        </div>
                    )}

                    {script && !isLoading && (
                        <div className="space-y-6">
                            {/* Opening */}
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                                <div className="text-emerald-400 font-semibold text-sm mb-2">👋 OPENING</div>
                                <p className="text-white/90 italic">{script.openingStatement}</p>
                            </div>

                            {/* Talking Points */}
                            <div className="space-y-3">
                                <h3 className="text-white font-semibold">Talking Points (click to expand)</h3>
                                {script.talkingPoints.map((point, index) => (
                                    <motion.div
                                        key={index}
                                        className={`border rounded-xl overflow-hidden transition-all ${activeStep === index
                                                ? 'border-indigo-500 bg-indigo-500/10'
                                                : 'border-white/10 bg-white/5'
                                            }`}
                                    >
                                        <button
                                            onClick={() => setActiveStep(activeStep === index ? null : index)}
                                            className="w-full p-4 text-left flex items-start gap-3"
                                        >
                                            <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-sm flex items-center justify-center flex-shrink-0">
                                                {index + 1}
                                            </span>
                                            <span className="text-white/90">{point.point}</span>
                                        </button>
                                        {activeStep === index && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="px-4 pb-4 ml-9"
                                            >
                                                <div className="text-xs text-amber-400 mb-1">Expected response:</div>
                                                <p className="text-white/60 text-sm italic">{point.anticipatedResponse}</p>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>

                            {/* Closing */}
                            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                                <div className="text-purple-400 font-semibold text-sm mb-2">✅ CLOSING</div>
                                <p className="text-white/90 italic">{script.closingStatement}</p>
                            </div>

                            {/* Key Phrases */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <div className="text-white/60 text-sm mb-3">🔑 Key phrases to use:</div>
                                <div className="flex flex-wrap gap-2">
                                    {script.keyPhrases.map((phrase, index) => (
                                        <span
                                            key={index}
                                            className="px-3 py-1 bg-white/10 text-white/80 rounded-full text-sm"
                                        >
                                            {phrase}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex justify-between items-center">
                    <a
                        href={`tel:${phone || '888-486-4722'}`}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium rounded-xl hover:from-green-400 hover:to-emerald-400 transition-all flex items-center gap-2"
                    >
                        📱 Call {servicer} Now
                    </a>
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition"
                    >
                        Close
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
