'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

type UploadStatus = 'idle' | 'capturing' | 'uploading' | 'success' | 'error';

export default function MobileUploadPage() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const [status, setStatus] = useState<UploadStatus>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCapture = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus('uploading');
        setErrorMsg('');

        try {
            const base64 = await fileToBase64(file);

            const res = await fetch(`${API_BASE}/api/scan/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    image: base64,
                    mimeType: file.type,
                }),
            });

            if (!res.ok) {
                throw new Error(`Upload failed: ${res.statusText}`);
            }

            setStatus('success');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
            setStatus('error');
        }

        // Reset file input so user can re-select
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleScanAnother = () => {
        setStatus('idle');
        setErrorMsg('');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950/20 to-gray-950 flex flex-col items-center justify-center p-6">
            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">
                    SLKnight
                </h1>
                <p className="text-gray-400">
                    Scan your loan document
                </p>
            </div>

            {/* Hidden file input with camera capture */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
            />

            {/* Main action area */}
            <div className="w-full max-w-sm space-y-6">
                {status === 'idle' && (
                    <button
                        onClick={handleCapture}
                        className="w-full py-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xl font-semibold shadow-lg shadow-indigo-500/30 active:scale-95 transition-transform"
                    >
                        <div className="text-4xl mb-2">📸</div>
                        Take Photo of Document
                    </button>
                )}

                {status === 'uploading' && (
                    <div className="text-center py-12">
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-white text-lg font-medium">Uploading & analyzing...</p>
                        <p className="text-gray-400 text-sm mt-1">AI is extracting your loan data</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="text-center space-y-6">
                        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8">
                            <div className="text-5xl mb-3">✅</div>
                            <h2 className="text-xl font-bold text-white mb-1">Upload Complete!</h2>
                            <p className="text-gray-400">Check the Magic Mirror on your computer to see results</p>
                        </div>
                        <button
                            onClick={handleScanAnother}
                            className="w-full py-5 rounded-2xl bg-white/10 border border-white/20 text-white text-lg font-semibold active:scale-95 transition-transform"
                        >
                            📸 Scan Another Document
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center space-y-6">
                        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8">
                            <div className="text-5xl mb-3">❌</div>
                            <h2 className="text-xl font-bold text-white mb-1">Upload Failed</h2>
                            <p className="text-gray-400">{errorMsg || 'Something went wrong. Try again.'}</p>
                        </div>
                        <button
                            onClick={handleScanAnother}
                            className="w-full py-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-lg font-semibold active:scale-95 transition-transform"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>

            {/* Session info */}
            <div className="mt-12 text-center">
                <p className="text-gray-600 text-xs">
                    Session: {sessionId}
                </p>
            </div>
        </div>
    );
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the data:mime;base64, prefix
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
