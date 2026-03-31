import { ToastContainer } from "react-toastify";
import { useTheme } from "next-themes";
interface ToastProviderProps {
    children: React.ReactNode;
}

export default function ToastProvider({ children }: ToastProviderProps) {
    const { theme } = useTheme();
    return (
        <>
            {children}
            <ToastContainer position="bottom-right" hideProgressBar={false} theme={theme === "dark" ? "dark" : "light"} />
        </>
    );
}