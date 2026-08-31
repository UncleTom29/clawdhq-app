"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { QueryProvider } from "./query-provider";
import { AuthProvider } from "./auth-provider";
import { ThemeProvider } from "./theme-provider";
import { SocketProvider } from "./socket-provider";
import { ToastProvider } from "./toast-provider";

// { ssr: false }, not a static import: @privy-io/react-auth bundles support
// for every wallet connector/login method it offers regardless of this app's
// loginMethods: ['email'] config (the SDK can't statically tree-shake around
// a runtime config value) — confirmed in Circuits Protocol's own migration
// (~/clawd-hq) that a static import alone pushed their Cloudflare Worker
// bundle past even the paid-plan 10MB hard limit. ssr:false keeps this
// browser-only dependency out of the server bundle entirely; acceptable
// since every page here already relies on client-side data-fetching anyway.
const ClawdHQPrivyProvider = dynamic(
	() => import("./privy-provider").then((m) => m.ClawdHQPrivyProvider),
	{ ssr: false },
);

// ---------------------------------------------------------------------------
// Combined Providers Component
// ---------------------------------------------------------------------------

interface ProvidersProps {
	children: ReactNode;
}

/**
 * Providers wraps the application with all necessary context providers.
 * The order is important:
 * 1. QueryProvider - React Query client (previously bundled inside the now-
 *    removed Dynamic.xyz provider — must stay above anything that fetches)
 * 2. ThemeProvider - Theme management (light/dark mode)
 * 3. ClawdHQPrivyProvider - Privy (email login, embedded wallet) — must sit
 *    above AuthProvider, since useHumanAuth() calls usePrivy() internally
 * 4. AuthProvider - Dual auth provider (JWT for humans, API key for agents)
 * 5. SocketProvider - WebSocket connection for real-time updates
 * 6. ToastProvider - Toast notifications
 */
export function Providers({ children }: ProvidersProps) {
	return (
		<QueryProvider>
			<ThemeProvider>
				<ClawdHQPrivyProvider>
					<AuthProvider>
						<SocketProvider>
							<ToastProvider>{children}</ToastProvider>
						</SocketProvider>
					</AuthProvider>
				</ClawdHQPrivyProvider>
			</ThemeProvider>
		</QueryProvider>
	);
}

// ---------------------------------------------------------------------------
// Re-export individual providers for flexible usage
// ---------------------------------------------------------------------------

export { QueryProvider } from "./query-provider";
export { AuthProvider, useAuth } from "./auth-provider";
export { ThemeProvider, useTheme } from "./theme-provider";
export { SocketProvider } from "./socket-provider";
export { ToastProvider } from "./toast-provider";
