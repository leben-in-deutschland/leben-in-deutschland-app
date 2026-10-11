import { ToastContainer } from "react-toastify";
import { useTheme } from "next-themes";
interface ToastProviderProps {
    children: React.ReactNode;
}

export default function ToastProvider({ children }: ToastProviderProps) {
    const { resolvedTheme } = useTheme();
    return (
        <>
            {children}
            <ToastContainer
                position="bottom-center"
                autoClose={4000}
                hideProgressBar
                newestOnTop
                closeOnClick
                limit={3}
                theme={resolvedTheme === "dark" ? "dark" : "light"}
            />
        </>
    );
}
