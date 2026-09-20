import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata, Viewport } from "next";
import { Archivo, Martian_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const martianMono = Martian_Mono({
  variable: "--font-martian-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Nook", template: "%s · Nook" },
  description:
    "Nook is a calmer, more intentional real-time chat workspace for teams.",
};

// The app is light-only (see the tokens in globals.css); this tints the
// mobile browser chrome to match the page background.
export const viewport: Viewport = {
  themeColor: "#f8f7f2",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${martianMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* The Convex client is mounted by the /org layout, which is the only
            part of the app that talks to it. */}
        <ClerkProvider appearance={{ theme: shadcn }}>{children}</ClerkProvider>
      </body>
    </html>
  );
}
