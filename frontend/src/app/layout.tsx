import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import '@/globals.css';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-body',
    display: 'swap',
});

const playfair = Playfair_Display({
    subsets: ['latin'],
    variable: '--font-heading',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'SLKnight — Generative Financial Reality Engine',
    description: 'A multimodal, autonomous financial health platform for student loan borrowers. Built with Gemini 3.',
    keywords: ['student loans', 'financial planning', 'AI', 'Gemini', 'debt management'],
    authors: [{ name: 'SLKnight Team' }],
    openGraph: {
        title: 'SLKnight — Generative Financial Reality Engine',
        description: 'Your lifecycle companion from student to debt-free borrower.',
        type: 'website',
    },
};

interface RootLayoutProps {
    readonly children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
    return (
        <html lang="en" className="dark" suppressHydrationWarning>
            <body
                className={`${inter.variable} ${playfair.variable} font-sans antialiased min-h-screen relative`}
                suppressHydrationWarning
                style={{
                    backgroundImage: 'url(/Cloud.png)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundAttachment: 'fixed',
                }}
            >
                {/* Sky blue overlay with Figma gradient */}
                <div
                    className="absolute inset-0 bg-gradient-to-b from-[#C7EBFF]/90 to-[#006DBC]/90 pointer-events-none"
                    style={{ position: 'fixed', zIndex: 0 }}
                />

                {/* Content wrapper */}
                <div className="relative z-10 min-h-screen flex flex-col">
                    {children}
                </div>
            </body>
        </html>
    );
}
