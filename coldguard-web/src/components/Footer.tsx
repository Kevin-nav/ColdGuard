import Link from "next/link";
import Image from "next/image";
import { Mail } from "lucide-react";

export function Footer() {
    return (
        <footer className="w-full bg-foreground text-white py-12">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

                <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
                    {/* Brand Column */}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <Image src="/images/logo.png" alt="ColdGuard logo" width={32} height={32} className="object-contain brightness-0 invert" />
                            <span className="text-xl font-bold">ColdGuard</span>
                        </div>
                        <span className="text-sm mt-1 text-white/60">
                            Rural Vaccine Cold-Chain Integrity
                        </span>
                    </div>

                    {/* Links Column */}
                    <div className="flex flex-col gap-2 text-sm">
                        <span className="font-semibold text-white/80 mb-1">Legal</span>
                        <Link href="/terms" className="text-white/60 hover:text-white transition-colors">
                            Terms of Service
                        </Link>
                        <Link href="/privacy" className="text-white/60 hover:text-white transition-colors">
                            Privacy Policy
                        </Link>
                    </div>

                    {/* Contact Column */}
                    <div className="flex flex-col gap-2 text-sm">
                        <span className="font-semibold text-white/80 mb-1">Contact</span>
                        <a
                            href="mailto:rexbabel48@gmail.com"
                            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                        >
                            <Mail className="w-4 h-4" />
                            rexbabel48@gmail.com
                        </a>
                    </div>
                </div>

                {/* Bottom Divider */}
                <div className="border-t border-white/10 pt-6 text-center text-sm text-white/40">
                    &copy; {new Date().getFullYear()} ColdGuard. All rights reserved.
                </div>

            </div>
        </footer>
    );
}
