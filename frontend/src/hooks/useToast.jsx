import { useState, useCallback, useMemo } from "react";
import React from "react";
import Toast from "../ui/Toast";

// Composant ToastContainer mémorisé pour éviter les re-rendus inutiles
const ToastContainer = React.memo(({ toasts, removeToast }) => (
  <div className="toastContainer">
    {toasts.map((toast) => (
      <Toast
        key={toast.id}
        message={toast.message}
        type={toast.type}
        onClose={() => removeToast(toast.id)}
      />
    ))}
  </div>
));

ToastContainer.displayName = "ToastContainer";

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((prevToasts) => [...prevToasts, { id, message, type }]);

    const timer = setTimeout(() => {
      removeToast(id);
    }, 4000);

    return () => clearTimeout(timer);
  }, [removeToast]);

  // Retourner un composant wrapper qui passe les props au ToastContainer mémorisé
  const ToastContainerWrapper = useMemo(
    () => () => <ToastContainer toasts={toasts} removeToast={removeToast} />,
    [toasts, removeToast]
  );

  return { toasts, addToast, removeToast, ToastContainer: ToastContainerWrapper };
}

export default useToast;
