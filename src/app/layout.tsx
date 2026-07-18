import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Home",
    description: "Welcome to Next.js",
};

import "@/styles/globals.css";

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <title>Phaser Nextjs Template</title>
                <meta
                    name="description"
                    content="A Phaser 3 Next.js project template that demonstrates Next.js with React communication and uses Vite for bundling."
                />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <link rel="icon" href="/favicon.png" />
            </head>
            <body>{children}</body>
        </html>
    );
}

