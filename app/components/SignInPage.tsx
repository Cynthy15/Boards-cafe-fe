"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUserRole, loginWithApi } from "../../lib/api-client";
import cafePhoto from "../images/cafe.jpeg";
import cafeLogo from "../images/ima.png";
import coffeeBeans from "../images/image.png";

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <Image src={cafeLogo} alt="" fill sizes="43px" />
    </span>
  );
}

export default function SignInPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const identifier = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const { user } = await loginWithApi(identifier, password);
      const role = getUserRole(user);
      router.replace(role === "admin" ? "/dashboard/admin" : "/dashboard/user");
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Sign in failed. Check the email and password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      {/* FORM START: left-side brand/story section */}
      <section
        className="story-panel"
        aria-label="About Mug & Bean Cafe"
        style={{ backgroundImage: `url("${cafePhoto.src}")` }}
      >
        <Link className="brand" href="/" aria-label="Mug and Bean Cafe home">
          <BrandMark />
        </Link>

        <div className="story-copy">
          <span className="eyebrow"><span />COFFEE SHOP, THOUGHTFULLY MANAGED</span>
          <p>From the morning rush to the final stock count, BOARDS keeps your team, sales, and inventory in one calm workspace.</p>
        </div>
      </section>

      {/* FORM START: right-side login form section */}
      <section
        className="auth-panel"
        aria-label="Sign in"
        style={{ backgroundImage: `url("${coffeeBeans.src}")` }}
      >
        <div className="auth-card">
          {/* LOGIN SECTION START */}
          <div className="card-heading">
            <h2>Welcome back</h2>
            <p>Sign in to your BOARDS workspace.</p>
          </div>

          {/* LOGIN FORM START */}
          <form className="login-form" noValidate onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <div className="input-wrap">
              <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="4" width="15" height="12" rx="2" /><path d="m3.5 5.5 6.5 5 6.5-5" /></svg>
              <input id="email" name="email" type="text" placeholder="user@example.com" autoComplete="username" required />
            </div>

            <div className="password-label-row">
              <label htmlFor="password">Password</label>
              <a href="mailto:support@mugandbean.cafe?subject=Password%20reset">Forgot password?</a>
            </div>
            <div className="input-wrap">
              <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="8.5" width="13" height="9" rx="2" /><path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5M10 12v2" /></svg>
              <input id="password" name="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password" required />
              <button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? (
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 3 17 17M8.6 8.7a2 2 0 0 0 2.7 2.7M6.2 5.2A9 9 0 0 1 10 4.3c4.1 0 6.7 3.2 7.5 5.7a8.5 8.5 0 0 1-2.1 3.4M4.4 6.5A8.7 8.7 0 0 0 2.5 10c.8 2.5 3.4 5.7 7.5 5.7 1 0 1.9-.2 2.7-.6" /></svg>
                ) : (
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 10s2.6-5.7 7.5-5.7 7.5 5.7 7.5 5.7-2.6 5.7-7.5 5.7-7.5-5.7-7.5-5.7Z" /><circle cx="10" cy="10" r="2.2" /></svg>
                )}
              </button>
            </div>

            <button className="submit-button" type="submit" disabled={isSubmitting}>
              <span aria-hidden="true">→</span> {isSubmitting ? "Signing in…" : "Sign in"}
            </button>

            {error && <p className="form-notice" role="alert">{error}</p>}
          </form>

          <div className="card-bottom">
            <svg className="secure-icon" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1.5 13 3.4v3.8c0 3.2-2 5.8-5 7.3-3-1.5-5-4.1-5-7.3V3.4L8 1.5Z" />
              <path d="m5.8 7.7 1.5 1.5 3-3.2" />
            </svg>
            <p>Protected by secure workspace authentication</p>
          </div>
          {/* LOGIN SECTION END */}
        </div>
        <footer className="auth-footer">
          <span>© 2026 BOARDS</span>
        </footer>
      </section>
      
      {/* FORM END */}
    </main>
  );
}
