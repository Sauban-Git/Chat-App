import { useEffect, useState } from "react";
import { useErrorContentStore } from "../store/errorStore";

export const Error: React.FC = () => {
  const { errorContent, isErrorContent, setErrorContent } = useErrorContentStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isErrorContent && errorContent) {
      setVisible(true);

      const timer = setTimeout(() => {
        setVisible(false);
        setErrorContent(null, false); // Clear the error from the store
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [errorContent, isErrorContent, setErrorContent]);

  if (!visible || !errorContent) return null;

  return (
    <div
      className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg z-50 animate-fade-in"
      role="alert"
    >
      <strong className="font-bold">Error: </strong>
      <span className="block sm:inline">{errorContent}</span>
    </div>
  );
};