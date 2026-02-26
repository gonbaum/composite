import { createContext, useContext, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import ActionsPage from "@/pages/ActionsPage";
import CreateActionPage from "@/pages/CreateActionPage";
import EditActionPage from "@/pages/EditActionPage";
import AuthPage from "@/pages/AuthPage";
import CreateAuthPage from "@/pages/CreateAuthPage";
import HistoryPage from "@/pages/HistoryPage";
import LoginPage from "@/pages/LoginPage";

const AuthContext = createContext<{ logout: () => void }>({ logout: () => {} });
export function useAuth() { return useContext(AuthContext); }

const isDev = import.meta.env.DEV;

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(isDev ? true : null);

  useEffect(() => {
    if (isDev) return; // auth bypassed in local dev
    fetch("/api/strapi/actions?pagination[pageSize]=1")
      .then((res) => setAuthed(res.ok))
      .catch(() => setAuthed(false));
  }, []);

  function logout() {
    if (isDev) { setAuthed(false); return; }
    fetch("/api/logout", { method: "POST" }).finally(() => setAuthed(false));
  }

  if (authed === null) return null; // loading

  if (!authed) {
    return <LoginPage onSuccess={() => setAuthed(true)} />;
  }

  return (
    <AuthContext.Provider value={{ logout }}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<ActionsPage />} />
            <Route path="/actions/new" element={<CreateActionPage />} />
            <Route path="/actions/:documentId/edit" element={<EditActionPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/new" element={<CreateAuthPage />} />
            <Route path="/auth/:documentId/edit" element={<CreateAuthPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
