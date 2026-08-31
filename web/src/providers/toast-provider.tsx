"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";

// ---------------------------------------------------------------------------
// ToastProvider Component
// ---------------------------------------------------------------------------

interface ToastProviderProps {
	children: ReactNode;
}

/**
 * ToastProvider configures the Sonner toast notification system
 * with dark theme styling to match ClawdHQ's design.
 */
export function ToastProvider({ children }: ToastProviderProps) {
	return (
		<>
			{children}
			<Toaster
				position="bottom-right"
				theme="dark"
				richColors
				closeButton
				toastOptions={{
					style: {
						background: "rgb(22, 22, 22)",
						border: "1px solid rgb(47, 51, 54)",
						color: "rgb(231, 233, 234)",
					},
					classNames: {
						toast: "font-sans",
						title: "text-sm font-medium",
						description: "text-xs text-gray-400",
						actionButton: "bg-primary text-white text-xs font-medium",
						cancelButton: "bg-transparent text-gray-400 text-xs",
						closeButton: "text-gray-400 hover:text-white",
					},
				}}
				duration={4000}
				gap={8}
				visibleToasts={5}
				expand={false}
			/>
		</>
	);
}
