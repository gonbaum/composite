import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import ActionsPage from "@/pages/ActionsPage";
import CreateActionPage from "@/pages/CreateActionPage";
import EditActionPage from "@/pages/EditActionPage";
import AuthPage from "@/pages/AuthPage";
import CreateAuthPage from "@/pages/CreateAuthPage";
import HistoryPage from "@/pages/HistoryPage";
import LoginPage from "@/pages/LoginPage";
import { useSession } from "@/lib/auth-client";

const isDev = import.meta.env.DEV;

export default function App() {
  const { data: session, isPending } = useSession();

  if (!isDev && isPending) return null;

  if (!isDev && !session) {
    return <LoginPage />;
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
