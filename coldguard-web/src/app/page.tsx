import { Footer } from "../components/Footer";
import Image from "next/image";
import Link from "next/link";
import { Activity, WifiOff, PackageCheck, Mail, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">

      {/* ── Navigation Bar ── */}
      <nav className="w-full bg-white/80 backdrop-blur-md border-b border-border sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/images/logo.png" alt="ColdGuard logo" width={36} height={36} className="object-contain" />
            <span className="text-lg font-bold text-foreground">ColdGuard</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-foreground-secondary">
            <Link href="#features" className="hover:text-primary transition-colors hidden sm:block">Features</Link>
            <Link href="#impact" className="hover:text-primary transition-colors hidden sm:block">Our Impact</Link>
            <Link href="#contact" className="hover:text-primary transition-colors hidden sm:block">Contact</Link>
            <a
              href="mailto:info@coldguard.org"
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-pressed text-white font-semibold transition-all text-sm"
            >
              Get in Touch
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="w-full relative overflow-hidden min-h-[600px] lg:min-h-[700px] flex items-center">
        {/* Background Image */}
        <Image
          src="/images/hero.png"
          alt="A nurse vaccinating a child in a rural Ghanaian community health center"
          fill
          priority
          className="object-cover"
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[rgba(26,43,74,0.82)] via-[rgba(26,43,74,0.65)] to-[rgba(29,111,165,0.35)] z-[1]" />

        <div className="max-w-6xl mx-auto px-6 relative z-10 py-20 lg:py-32">
          <div className="max-w-2xl animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white font-medium text-sm mb-6 border border-white/20">
              <Image src="/images/logo.png" alt="" width={20} height={20} className="object-contain rounded-md" />
              <span>Project ColdGuard</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight mb-6">
              Protecting Vaccines,{" "}
              <br className="hidden md:block" />
              <span className="text-primary-light">Saving Lives</span>
            </h1>

            <p className="text-lg text-white/80 mb-8 leading-relaxed max-w-xl">
              A ruggedized, intelligent monitoring system safeguarding vaccine integrity across rural Ghana — overcoming power outages and the field gap to keep every community protected.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-white hover:bg-white/90 text-primary font-semibold shadow-lg transition-all"
              >
                <Mail className="w-5 h-5" />
                Contact Us
              </a>
              <Link
                href="#features"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold backdrop-blur-sm border border-white/20 transition-all"
              >
                Learn More
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Banner ── */}
      <section className="w-full bg-primary text-white py-6">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-2xl md:text-3xl font-extrabold">2–8°C</div>
            <div className="text-sm text-white/70 mt-1">Safe Range Monitored</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold">24/7</div>
            <div className="text-sm text-white/70 mt-1">Continuous Logging</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold">100%</div>
            <div className="text-sm text-white/70 mt-1">Offline Capable</div>
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-extrabold">IP67</div>
            <div className="text-sm text-white/70 mt-1">Rugged & Waterproof</div>
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className="w-full py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">

          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why ColdGuard?
            </h2>
            <p className="text-foreground-secondary max-w-2xl mx-auto">
              Built from the ground up for the harsh environmental and infrastructural realities of rural medical distribution in Ghana.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            <div className="bg-surface p-8 rounded-2xl border border-border/50 card-hover animate-fade-in-up animate-delay-100">
              <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center text-primary mb-6">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">MKT Math Validation</h3>
              <p className="text-foreground-secondary leading-relaxed">
                Calculates Mean Kinetic Temperature using the Arrhenius equation — mathematically proving whether a batch is safe after a &quot;Dumsor&quot; power outage or heat spike.
              </p>
            </div>

            <div className="bg-surface p-8 rounded-2xl border border-border/50 card-hover animate-fade-in-up animate-delay-200">
              <div className="w-12 h-12 bg-accent-gold-light rounded-xl flex items-center justify-center text-accent-gold mb-6">
                <WifiOff className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Offline Store-and-Forward</h3>
              <p className="text-foreground-secondary leading-relaxed">
                A true &quot;No Network&quot; protocol — hardware logs to SD Card, nurses sync seamlessly via BLE onto the mobile app, bridging the gap until internet is restored.
              </p>
            </div>

            <div className="bg-surface p-8 rounded-2xl border border-border/50 card-hover animate-fade-in-up animate-delay-300">
              <div className="w-12 h-12 bg-accent-green-light rounded-xl flex items-center justify-center text-accent-green mb-6">
                <PackageCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Rugged Fail-safes</h3>
              <p className="text-foreground-secondary leading-relaxed">
                Capacitive &quot;no-hole&quot; touch sensors, PETG cases for motorbike transit, and active Magnetic Reed Switches to prevent basic human errors like open lids.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── Image Showcase / Impact Section ── */}
      <section id="impact" className="w-full py-20 bg-surface-muted">
        <div className="max-w-6xl mx-auto px-6">

          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Our Impact on the Ground
            </h2>
            <p className="text-foreground-secondary max-w-2xl mx-auto">
              From the clinic fridge to the furthest village — ColdGuard protects every step of the cold chain.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Cold Boxes Image Card */}
            <div className="relative rounded-2xl overflow-hidden group card-hover animate-fade-in-up animate-delay-100">
              <div className="aspect-[4/3] relative">
                <Image
                  src="/images/cold-boxes.png"
                  alt="WHO-standard vaccine cold boxes with ice packs used in rural healthcare outreach"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                <h3 className="text-xl font-bold text-white mb-1">Cold Chain Integrity</h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  WHO-standard vaccine carriers monitored continuously — ensuring the 2–8°C safe range is never silently breached.
                </p>
              </div>
            </div>

            {/* Outreach Image Card */}
            <div className="relative rounded-2xl overflow-hidden group card-hover animate-fade-in-up animate-delay-200">
              <div className="aspect-[4/3] relative">
                <Image
                  src="/images/outreach.png"
                  alt="Community health nurses conducting a mobile vaccination outreach in a rural Ghanaian village"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                <h3 className="text-xl font-bold text-white mb-1">Community Outreach</h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  Designed for motorbike transit and field clinics — ColdGuard travels everywhere your nurses do.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Contact Section ── */}
      <section id="contact" className="w-full py-20 bg-background">
        <div className="max-w-3xl mx-auto px-6 text-center animate-fade-in-up">
          <div className="bg-surface rounded-2xl border border-border p-10 md:p-16">
            <div className="w-16 h-16 bg-primary-light rounded-2xl flex items-center justify-center text-primary mx-auto mb-6">
              <Mail className="w-8 h-8" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Get in Touch
            </h2>
            <p className="text-foreground-secondary mb-8 leading-relaxed max-w-lg mx-auto">
              Are you a health institution, NGO, or government agency interested in deploying ColdGuard in your community? We&apos;d love to hear from you.
            </p>
            <a
              href="mailto:info@coldguard.org"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-primary hover:bg-primary-pressed text-white font-semibold shadow-lg shadow-primary/20 transition-all text-lg"
            >
              <Mail className="w-5 h-5" />
              info@coldguard.org
            </a>
            <p className="text-foreground-secondary text-sm mt-6">
              We typically respond within 48 hours.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
