"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export type ToastMessage = {
  id: number;
  text: string;
};

let toastId = 0;
let setToastsExternal: React.Dispatch<React.SetStateAction<ToastMessage[]>> | null = null;

export function showToast(text: string) {
  if (!setToastsExternal) {
    console.warn("ToastProvider not mounted");
    return;
  }
  const id = ++toastId;
  setToastsExternal((prev) => [...prev, { id, text }]);
  setTimeout(() => {
    setToastsExternal?.((prev) => prev.filter((t) => t.id !== id));
  }, 3000);
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    setToastsExternal = setToasts;
    return () => {
      setToastsExternal = null;
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto bg-foreground text-background px-4 py-3 rounded-lg shadow-lg text-sm max-w-xs"
          >
            {toast.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}