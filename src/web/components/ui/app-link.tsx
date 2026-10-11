"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { forwardRef, useCallback, type AnchorHTMLAttributes, type ReactNode } from "react";
import { isWebOnlyPath, navigateTo, toNativeHref } from "@/utils/navigation";
import { useIsNative } from "@/utils/user-store";

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    /** In-app route such as "/prepare?action=review" or "/progress#streak". */
    href: string;
    children?: ReactNode;
};

/**
 * Link for in-app routes that also works inside the Android app, where
 * pages are separate .html files and client-side page loads are not
 * available. Web-only pages open the public website on Android.
 */
export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink({ href, children, ...props }, ref) {
    const isNative = useIsNative();
    if (isNative) {
        const external = isWebOnlyPath(href);
        return (
            <a
                ref={ref}
                href={toNativeHref(href)}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                {...props}
            >
                {children}
            </a>
        );
    }
    return (
        <NextLink ref={ref} href={href} {...props}>
            {children}
        </NextLink>
    );
});

/** Programmatic navigation that works on web and in the Android app. */
export function useAppNavigate(): (path: string) => void {
    const router = useRouter();
    return useCallback((path: string) => navigateTo(path, router.push), [router]);
}
