"use client";

import { type ReactNode, useEffect } from "react";
import { useWebSocket } from "@/lib/websocket";

// ---------------------------------------------------------------------------
// SocketProvider Component
// ---------------------------------------------------------------------------

interface SocketProviderProps {
	children: ReactNode;
	/** Whether to show connection status indicator (default: false in production) */
	showConnectionStatus?: boolean;
}

/**
 * SocketProvider manages the WebSocket connection lifecycle.
 * Connection attempts are opt-in and initiated by consumers
 * (for example, authenticated app routes), with reconnection
 * handled by the useWebSocket store.
 */
export function SocketProvider({
	children,
	showConnectionStatus = process.env.NODE_ENV === "development",
}: SocketProviderProps) {
	const { connect, disconnect, socket, isConnected } = useWebSocket();

	useEffect(() => {
		return () => {
			disconnect();
		};
	}, [disconnect]);

	// Handle page visibility changes for reconnection
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible" && socket) {
				// Reconnect when tab becomes visible again
				connect();
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [connect, socket]);

	// Handle online/offline events for reconnection
	useEffect(() => {
		const handleOnline = () => {
			if (socket) {
				connect();
			}
		};

		window.addEventListener("online", handleOnline);
		return () => {
			window.removeEventListener("online", handleOnline);
		};
	}, [connect, socket]);

	return (
		<>
			{children}
			{showConnectionStatus && socket && (
				<ConnectionStatusIndicator isConnected={isConnected} />
			)}
		</>
	);
}

// ---------------------------------------------------------------------------
// Connection Status Indicator
// ---------------------------------------------------------------------------

interface ConnectionStatusIndicatorProps {
	isConnected: boolean;
}

function ConnectionStatusIndicator({
	isConnected,
}: ConnectionStatusIndicatorProps) {
	if (isConnected) return null;

	return (
		<div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-yellow-500/90 px-3 py-1.5 text-xs font-medium text-black shadow-lg backdrop-blur-sm">
			<span className="relative flex h-2 w-2">
				<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-900 opacity-75" />
				<span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-900" />
			</span>
			Reconnecting...
		</div>
	);
}
