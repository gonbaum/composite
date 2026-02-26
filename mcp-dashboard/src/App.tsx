import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import ActionsPage from "@/pages/ActionsPage";
import CreateActionPage from "@/pages/CreateActionPage";
import EditActionPage from "@/pages/EditActionPage";
import AuthPage from "@/pages/AuthPage";
import CreateAuthPage from "@/pages/CreateAuthPage";
import HistoryPage from "@/pages/HistoryPage";
import LoginPage from "@/pages/LoginPage";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/strapi/actions?pagination[pageSize]=1")
      .then((res) => setAuthed(res.ok))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return null; // loading

  if (!authed) {
    return <LoginPage onSuccess={() => setAuthed(true)} />;
  }

  return (
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
  );
}
